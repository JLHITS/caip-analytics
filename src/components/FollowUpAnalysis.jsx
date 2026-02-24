import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Upload, FileText, AlertCircle, CheckCircle, Calendar, Clock,
  TrendingUp, BarChart3, Info, Users, Activity, ArrowUp, ArrowDown,
  ChevronDown, ChevronUp, ArrowUpDown, Printer, Loader2, HelpCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import Card from './ui/Card';
import FollowUpGuideModal from './modals/FollowUpGuideModal';
import {
  parseFollowUpCSV,
  mergeCSVTexts,
  calculateOverallFollowUpRates,
  calculateSameGPFollowUpRates,
  calculateClinicianFollowUpRates,
  calculateMonthlyTrends,
} from '../utils/followUpParser';

// Sample CSV
import sampleCSVUrl from '../assets/followup/followup.csv?url';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const TIMEFRAME_OPTIONS = [
  { id: 'all', label: 'Entire Timeframe' },
  { id: '3months', label: 'Last 3 Months' },
  { id: '4weeks', label: 'Last 4 Weeks' },
];

export default function FollowUpAnalysis() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [timeframe, setTimeframe] = useState('all');
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedDoctor, setExpandedDoctor] = useState(null);

  // Sort state per table: { column, direction }
  const [sameGpSort, setSameGpSort] = useState({ column: 'totalVisits', direction: 'desc' });
  const [clinicianSort, setClinicianSort] = useState({ column: 'totalAppointments', direction: 'desc' });
  const [trendSort, setTrendSort] = useState({ column: 'key', direction: 'asc' });

  // Sort toggle helper
  const toggleSort = (setter, current, column) => {
    setter({
      column,
      direction: current.column === column && current.direction === 'desc' ? 'asc' : 'desc',
    });
  };

  // Generic sort function
  const sortRows = (rows, { column, direction }) => {
    return [...rows].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      // Handle string vs number
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return direction === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  };

  const [fileNames, setFileNames] = useState([]);

  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const readPromises = files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => resolve({ name: file.name, text: evt.target.result });
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    }));

    Promise.all(readPromises).then(results => {
      try {
        // Merge all CSV texts: take header from first, data rows from all
        const csvTexts = results.map(r => r.text);
        const merged = mergeCSVTexts(csvTexts);
        const parsed = parseFollowUpCSV(merged);
        if (!parsed || parsed.totalAppointments === 0) {
          setError('Could not parse the CSV file(s). Please check the format includes Clinician, Appointment date, and NHS number columns.');
          return;
        }
        setData(parsed);
        setFileNames(results.map(r => r.name));
        setError(null);
      } catch (err) {
        setError(`Error parsing file(s): ${err.message}`);
      }
    }).catch(err => setError(err.message));

    // Reset the input so re-uploading the same files works
    e.target.value = '';
  }, []);

  const loadSample = useCallback(async () => {
    try {
      const response = await fetch(sampleCSVUrl);
      const text = await response.text();
      const parsed = parseFollowUpCSV(text);
      if (!parsed || parsed.totalAppointments === 0) {
        setError('Could not parse sample data.');
        return;
      }
      setData(parsed);
      setFileNames(['sample-data.csv']);
      setError(null);
    } catch (err) {
      setError(`Error loading sample: ${err.message}`);
    }
  }, []);

  const analysisRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const exportToPDF = useCallback(async () => {
    if (!analysisRef.current) return;
    setExporting(true);

    try {
      // Temporarily show all sections for PDF
      const container = analysisRef.current;

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;

      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      // First page
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      // Additional pages if needed
      while (heightLeft > 0) {
        position = position - (pageHeight - margin * 2);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      const fileName = `Follow-Up-Analysis${data?.orgName ? '-' + data.orgName.replace(/\s+/g, '-') : ''}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export error:', err);
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [data]);

  // Calculations
  const overallRates = useMemo(() => data ? calculateOverallFollowUpRates(data, timeframe) : null, [data, timeframe]);
  const sameGPRates = useMemo(() => data ? calculateSameGPFollowUpRates(data, timeframe) : null, [data, timeframe]);
  const clinicianRates = useMemo(() => data ? calculateClinicianFollowUpRates(data, timeframe) : null, [data, timeframe]);
  const monthlyTrends = useMemo(() => data ? calculateMonthlyTrends(data) : null, [data]);

  const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'any-doctor', label: 'Any Doctor', icon: Users },
    { id: 'same-gp', label: 'Same GP', icon: Activity },
    { id: 'by-clinician', label: 'By Clinician', icon: Calendar },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
  ];

  // Sortable table header component
  const SortHeader = ({ label, column, sort, setSort, align = 'right', className = 'text-slate-600' }) => (
    <th
      className={`p-2 ${align === 'left' ? 'text-left' : 'text-right'} ${className} cursor-pointer hover:bg-slate-100 select-none transition-colors`}
      onClick={() => toggleSort(setSort, sort, column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        {sort.column === column ? (
          sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-30" />
        )}
      </div>
    </th>
  );

  // Upload screen
  if (!data) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-200">
          <div className="text-center py-4">
            <Calendar className="mx-auto text-emerald-600 mb-3" size={48} />
            <h2 className="text-2xl font-bold text-slate-800">Follow Up Analysis</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
              Upload your appointment data to analyse follow-up rates. Understand how often patients return
              within 1 week, 2 weeks and 4 weeks - overall and broken down by clinician.
            </p>
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Upload size={20} />
            Upload Appointment CSV
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Upload one or more CSV files with columns: <strong>Clinician</strong>, <strong>Appointment date</strong> (DD-Mon-YY),
            and <strong>NHS number</strong>. Multiple files will be merged and deduplicated automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 px-6 py-4 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
              <Upload size={20} className="text-emerald-600" />
              <span className="font-medium text-emerald-700">Choose CSV File(s)</span>
              <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={loadSample}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <FileText size={20} className="text-slate-600" />
              <span className="font-medium text-slate-700">Load Sample Data</span>
            </button>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium text-blue-700"
          >
            <HelpCircle size={18} />
            How do I get this data from SystmOne?
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </Card>

        <Card className="bg-slate-50">
          <div className="flex items-start gap-3">
            <Info className="text-slate-400 mt-0.5 flex-shrink-0" size={16} />
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>What this tool analyses:</strong></p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Overall follow-up rates - patients returning to <em>any</em> doctor within 1, 2 and 4 weeks</li>
                <li>Same GP continuity - patients returning to the <em>same</em> GP within 1, 2 and 4 weeks</li>
                <li>Per-clinician breakdown - follow-up rates for each individual doctor</li>
                <li>Monthly trends - how follow-up patterns change over time</li>
              </ul>
              <p className="mt-2">Only clinicians whose name starts with "Dr" are included in GP analysis.</p>
            </div>
          </div>
        </Card>
        <FollowUpGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
      </div>
    );
  }

  // Analysis view
  const formatDate = (d) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Follow Up Analysis</h2>
            <p className="text-sm text-slate-600">
              {data.orgName && <span className="font-medium">{data.orgName} | </span>}
              {data.totalAppointments.toLocaleString()} appointments | {data.totalPatients.toLocaleString()} patients | {data.doctors.length} GPs
              {fileNames.length > 1 && <span className="text-slate-400"> | {fileNames.length} files merged</span>}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {formatDate(data.dateRange.start)} to {formatDate(data.dateRange.end)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Timeframe selector */}
            <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
              {TIMEFRAME_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTimeframe(opt.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    timeframe === opt.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-600">
              <Upload size={14} />
              New File(s)
              <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={exportToPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-600 disabled:opacity-50"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-medium text-blue-600"
              title="How to get this data"
            >
              <HelpCircle size={14} />
            </button>
          </div>
        </div>
      </Card>

      <div ref={analysisRef}>
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                isActive
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
              }`}
            >
              <Icon size={16} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW SECTION ===== */}
      {activeSection === 'overview' && overallRates && sameGPRates && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <p className="text-xs font-bold text-blue-900 mb-1">Total Dr Appointments</p>
              <p className="text-2xl font-bold text-blue-700">{overallRates.totalDoctorAppointments.toLocaleString()}</p>
              <p className="text-xs text-slate-400">{overallRates.patientsWithDrAppts.toLocaleString()} patients</p>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <p className="text-xs font-bold text-emerald-900 mb-1">Follow-up within 7 days</p>
              <p className="text-2xl font-bold text-emerald-700">{overallRates.rate7.toFixed(1)}%</p>
              <p className="text-xs text-slate-400">{overallRates.followUp7} appointments</p>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
              <p className="text-xs font-bold text-amber-900 mb-1">Follow-up within 14 days</p>
              <p className="text-2xl font-bold text-amber-700">{overallRates.rate14.toFixed(1)}%</p>
              <p className="text-xs text-slate-400">cumulative</p>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <p className="text-xs font-bold text-purple-900 mb-1">Follow-up within 28 days</p>
              <p className="text-2xl font-bold text-purple-700">{overallRates.rate28.toFixed(1)}%</p>
              <p className="text-xs text-slate-400">cumulative</p>
            </Card>
            <Card className="bg-gradient-to-br from-slate-100 to-white border-slate-300">
              <p className="text-xs font-bold text-slate-700 mb-1">No Follow-up (28d+)</p>
              <p className="text-2xl font-bold text-slate-500">{overallRates.noFollowUpRate.toFixed(1)}%</p>
              <p className="text-xs text-slate-400">{overallRates.noFollowUp} appointments</p>
            </Card>
          </div>

          {/* Overview charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Any doctor vs Same GP comparison */}
            <Card>
              <h3 className="text-sm font-bold text-slate-700 mb-3">Any Doctor vs Same GP Follow-up Rates</h3>
              <div style={{ height: '280px' }}>
                <Bar
                  data={{
                    labels: ['Within 7 days', 'Within 14 days', 'Within 28 days'],
                    datasets: [
                      {
                        label: 'Any Doctor',
                        data: [overallRates.rate7, overallRates.rate14, overallRates.rate28],
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                      },
                      {
                        label: 'Same GP',
                        data: [sameGPRates.rate7, sameGPRates.rate14, sameGPRates.rate28],
                        backgroundColor: '#6366f1',
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
                      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } },
                    },
                    scales: {
                      y: { beginAtZero: true, ticks: { callback: v => v + '%' } },
                    },
                  }}
                />
              </div>
            </Card>

            {/* Follow-up distribution doughnut */}
            <Card>
              <h3 className="text-sm font-bold text-slate-700 mb-3">Follow-up Timing Distribution (Any Doctor)</h3>
              <div style={{ height: '280px' }} className="flex items-center justify-center">
                <Doughnut
                  data={{
                    labels: ['Within 7 days', '8-14 days', '15-28 days', 'No follow-up within 28 days'],
                    datasets: [{
                      data: [
                        overallRates.followUp7,
                        overallRates.followUp14,
                        overallRates.followUp28,
                        overallRates.denominator - overallRates.followUp7 - overallRates.followUp14 - overallRates.followUp28,
                      ],
                      backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#e2e8f0'],
                      borderWidth: 0,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                    },
                  }}
                />
              </div>
            </Card>
          </div>

          {/* Monthly trend mini chart */}
          {monthlyTrends && monthlyTrends.length >= 2 && (
            <Card>
              <h3 className="text-sm font-bold text-slate-700 mb-3">Monthly Follow-up Rate Trend (Any Doctor)</h3>
              <div style={{ height: '220px' }}>
                <Line
                  data={{
                    labels: monthlyTrends.map(m => m.label),
                    datasets: [
                      {
                        label: '7-day rate',
                        data: monthlyTrends.map(m => m.rate7),
                        borderColor: '#10b981',
                        backgroundColor: '#10b98120',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        borderWidth: 2,
                      },
                      {
                        label: '14-day rate',
                        data: monthlyTrends.map(m => m.rate14),
                        borderColor: '#f59e0b',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 3,
                        borderWidth: 2,
                      },
                      {
                        label: '28-day rate',
                        data: monthlyTrends.map(m => m.rate28),
                        borderColor: '#8b5cf6',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 3,
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } },
                    scales: {
                      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
                      y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                    },
                  }}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ===== ANY DOCTOR SECTION ===== */}
      {activeSection === 'any-doctor' && overallRates && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Users className="text-blue-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-blue-800">Follow-up with Any Doctor</h3>
                <p className="text-sm text-blue-700">
                  How often patients return to <em>any</em> GP within 1, 2 and 4 weeks of a doctor appointment.
                  Based on {overallRates.denominator.toLocaleString()} appointment pairs from {overallRates.patientsWithDrAppts.toLocaleString()} patients.
                </p>
              </div>
            </div>
          </Card>

          {/* Rate cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="text-center">
              <p className="text-xs font-bold text-slate-500 mb-2">Within 1 Week</p>
              <p className="text-4xl font-bold text-emerald-600">{overallRates.rate7.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">{overallRates.followUp7.toLocaleString()} follow-ups</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs font-bold text-slate-500 mb-2">Within 2 Weeks</p>
              <p className="text-4xl font-bold text-amber-600">{overallRates.rate14.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">{(overallRates.followUp7 + overallRates.followUp14).toLocaleString()} follow-ups (cumulative)</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs font-bold text-slate-500 mb-2">Within 4 Weeks</p>
              <p className="text-4xl font-bold text-purple-600">{overallRates.rate28.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">{(overallRates.followUp7 + overallRates.followUp14 + overallRates.followUp28).toLocaleString()} follow-ups (cumulative)</p>
            </Card>
          </div>

          {/* Bar chart */}
          <Card>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Follow-up Rate Breakdown</h3>
            <div style={{ height: '300px' }}>
              <Bar
                data={{
                  labels: ['Within 7 days', '8-14 days', '15-28 days', 'Beyond 28 days'],
                  datasets: [{
                    label: 'Appointments',
                    data: [
                      overallRates.followUp7,
                      overallRates.followUp14,
                      overallRates.followUp28,
                      overallRates.denominator - overallRates.followUp7 - overallRates.followUp14 - overallRates.followUp28,
                    ],
                    backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#cbd5e1'],
                    borderRadius: 6,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* ===== SAME GP SECTION ===== */}
      {activeSection === 'same-gp' && sameGPRates && (
        <div className="space-y-6">
          <Card className="bg-indigo-50 border-indigo-200">
            <div className="flex items-start gap-3">
              <Activity className="text-indigo-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-indigo-800">Same GP Follow-up (Continuity of Care)</h3>
                <p className="text-sm text-indigo-700">
                  How often patients return to the <em>same</em> GP. Based on {sameGPRates.totalPairs.toLocaleString()} consecutive
                  same-GP visit pairs.
                </p>
              </div>
            </div>
          </Card>

          {/* Overall same-GP rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="text-center">
              <p className="text-xs font-bold text-slate-500 mb-2">Same GP within 1 Week</p>
              <p className="text-4xl font-bold text-emerald-600">{sameGPRates.rate7.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">{sameGPRates.sameGP7.toLocaleString()} occurrences</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs font-bold text-slate-500 mb-2">Same GP within 2 Weeks</p>
              <p className="text-4xl font-bold text-amber-600">{sameGPRates.rate14.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">cumulative</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs font-bold text-slate-500 mb-2">Same GP within 4 Weeks</p>
              <p className="text-4xl font-bold text-purple-600">{sameGPRates.rate28.toFixed(1)}%</p>
              <p className="text-sm text-slate-500 mt-1">cumulative</p>
            </Card>
          </div>

          {/* Per-doctor table */}
          <Card>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Same GP Follow-up by Doctor</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortHeader label="Doctor" column="name" sort={sameGpSort} setSort={setSameGpSort} align="left" />
                    <SortHeader label="Total Visits" column="totalVisits" sort={sameGpSort} setSort={setSameGpSort} />
                    <SortHeader label="Patients" column="uniquePatients" sort={sameGpSort} setSort={setSameGpSort} />
                    <SortHeader label="Re-visits" column="patientsWithRevisit" sort={sameGpSort} setSort={setSameGpSort} />
                    <SortHeader label="7-day %" column="rate7" sort={sameGpSort} setSort={setSameGpSort} className="text-emerald-600" />
                    <SortHeader label="14-day %" column="rate14" sort={sameGpSort} setSort={setSameGpSort} className="text-amber-600" />
                    <SortHeader label="28-day %" column="rate28" sort={sameGpSort} setSort={setSameGpSort} className="text-purple-600" />
                  </tr>
                </thead>
                <tbody>
                  {sortRows(sameGPRates.doctorBreakdown, sameGpSort).map((doc) => (
                    <tr key={doc.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-700">{doc.name}</td>
                      <td className="p-2 text-right text-slate-600">{doc.totalVisits.toLocaleString()}</td>
                      <td className="p-2 text-right text-slate-600">{doc.uniquePatients.toLocaleString()}</td>
                      <td className="p-2 text-right text-slate-600">{doc.patientsWithRevisit.toLocaleString()}</td>
                      <td className="p-2 text-right font-medium text-emerald-600">{doc.rate7.toFixed(1)}%</td>
                      <td className="p-2 text-right font-medium text-amber-600">{doc.rate14.toFixed(1)}%</td>
                      <td className="p-2 text-right font-medium text-purple-600">{doc.rate28.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Per-doctor bar chart */}
          {sameGPRates.doctorBreakdown.length > 0 && (
            <Card>
              <h3 className="text-sm font-bold text-slate-700 mb-3">Same GP Follow-up Rate by Doctor</h3>
              <div style={{ height: Math.max(300, sameGPRates.doctorBreakdown.length * 35) + 'px' }}>
                <Bar
                  data={{
                    labels: sameGPRates.doctorBreakdown.map(d => d.name.replace('Dr ', '')),
                    datasets: [
                      {
                        label: '7-day',
                        data: sameGPRates.doctorBreakdown.map(d => d.rate7),
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                      },
                      {
                        label: '14-day',
                        data: sameGPRates.doctorBreakdown.map(d => d.rate14 - d.rate7),
                        backgroundColor: '#f59e0b',
                        borderRadius: 4,
                      },
                      {
                        label: '28-day',
                        data: sameGPRates.doctorBreakdown.map(d => d.rate28 - d.rate14),
                        backgroundColor: '#8b5cf6',
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%` } },
                    },
                    scales: {
                      x: { stacked: true, beginAtZero: true, ticks: { callback: v => v + '%' } },
                      y: { stacked: true, ticks: { font: { size: 10 } } },
                    },
                  }}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ===== BY CLINICIAN SECTION ===== */}
      {activeSection === 'by-clinician' && clinicianRates && (
        <div className="space-y-6">
          <Card className="bg-teal-50 border-teal-200">
            <div className="flex items-start gap-3">
              <Calendar className="text-teal-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-teal-800">Follow-up Rates by Clinician</h3>
                <p className="text-sm text-teal-700">
                  For each GP, what percentage of their appointments result in the patient returning to <em>any</em> clinician
                  within 1, 2 and 4 weeks. GPs only (clinician name starting with "Dr").
                </p>
              </div>
            </div>
          </Card>

          {/* Clinician table */}
          <Card>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Per-Clinician Follow-up Rates</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <SortHeader label="Clinician" column="clinician" sort={clinicianSort} setSort={setClinicianSort} align="left" />
                    <SortHeader label="Appointments" column="totalAppointments" sort={clinicianSort} setSort={setClinicianSort} />
                    <SortHeader label="Patients" column="uniquePatients" sort={clinicianSort} setSort={setClinicianSort} />
                    <SortHeader label="7-day %" column="rate7" sort={clinicianSort} setSort={setClinicianSort} className="text-emerald-600" />
                    <SortHeader label="14-day %" column="rate14" sort={clinicianSort} setSort={setClinicianSort} className="text-amber-600" />
                    <SortHeader label="28-day %" column="rate28" sort={clinicianSort} setSort={setClinicianSort} className="text-purple-600" />
                    <SortHeader label="No F/U %" column="noFollowUpPct" sort={clinicianSort} setSort={setClinicianSort} className="text-slate-500" />
                  </tr>
                </thead>
                <tbody>
                  {sortRows(clinicianRates.map(c => ({ ...c, noFollowUpPct: c.totalAppointments > 0 ? (c.noFollowUp / c.totalAppointments) * 100 : 0 })), clinicianSort).map((c) => (
                    <tr
                      key={c.clinician}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedDoctor(expandedDoctor === c.clinician ? null : c.clinician)}
                    >
                      <td className="p-2 font-medium text-slate-700">
                        <div className="flex items-center gap-1">
                          {expandedDoctor === c.clinician ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {c.clinician}
                        </div>
                      </td>
                      <td className="p-2 text-right text-slate-600">{c.totalAppointments.toLocaleString()}</td>
                      <td className="p-2 text-right text-slate-600">{c.uniquePatients.toLocaleString()}</td>
                      <td className="p-2 text-right font-medium text-emerald-600">{c.rate7.toFixed(1)}%</td>
                      <td className="p-2 text-right font-medium text-amber-600">{c.rate14.toFixed(1)}%</td>
                      <td className="p-2 text-right font-medium text-purple-600">{c.rate28.toFixed(1)}%</td>
                      <td className="p-2 text-right text-slate-400">{c.noFollowUpPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Clinician comparison bar chart */}
          <Card>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Follow-up Rate Comparison (28-day)</h3>
            <div style={{ height: Math.max(300, clinicianRates.length * 35) + 'px' }}>
              <Bar
                data={{
                  labels: clinicianRates.map(c => c.clinician.replace('Dr ', '')),
                  datasets: [
                    {
                      label: '7-day',
                      data: clinicianRates.map(c => c.rate7),
                      backgroundColor: '#10b981',
                      borderRadius: 4,
                    },
                    {
                      label: '8-14 day',
                      data: clinicianRates.map(c => c.rate14 - c.rate7),
                      backgroundColor: '#f59e0b',
                      borderRadius: 4,
                    },
                    {
                      label: '15-28 day',
                      data: clinicianRates.map(c => c.rate28 - c.rate14),
                      backgroundColor: '#8b5cf6',
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  plugins: {
                    legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%` } },
                  },
                  scales: {
                    x: { stacked: true, beginAtZero: true, ticks: { callback: v => v + '%' } },
                    y: { stacked: true, ticks: { font: { size: 10 } } },
                  },
                }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* ===== TRENDS SECTION ===== */}
      {activeSection === 'trends' && monthlyTrends && (
        <div className="space-y-6">
          <Card className="bg-purple-50 border-purple-200">
            <div className="flex items-start gap-3">
              <TrendingUp className="text-purple-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-purple-800">Monthly Follow-up Trends</h3>
                <p className="text-sm text-purple-700">
                  How follow-up patterns change month-by-month across the full data period.
                </p>
              </div>
            </div>
          </Card>

          {monthlyTrends.length < 2 ? (
            <Card className="text-center py-8">
              <p className="text-slate-500">At least 2 months of data are needed for trend analysis.</p>
            </Card>
          ) : (
            <>
              {/* Follow-up rate trend */}
              <Card>
                <h3 className="text-sm font-bold text-slate-700 mb-3">Follow-up Rate Trend (%)</h3>
                <div style={{ height: '300px' }}>
                  <Line
                    data={{
                      labels: monthlyTrends.map(m => m.label),
                      datasets: [
                        {
                          label: '7-day rate',
                          data: monthlyTrends.map(m => m.rate7),
                          borderColor: '#10b981',
                          backgroundColor: '#10b98115',
                          fill: true,
                          tension: 0.3,
                          pointRadius: 4,
                          borderWidth: 2,
                        },
                        {
                          label: '14-day rate',
                          data: monthlyTrends.map(m => m.rate14),
                          borderColor: '#f59e0b',
                          fill: false,
                          tension: 0.3,
                          pointRadius: 4,
                          borderWidth: 2,
                        },
                        {
                          label: '28-day rate',
                          data: monthlyTrends.map(m => m.rate28),
                          borderColor: '#8b5cf6',
                          fill: false,
                          tension: 0.3,
                          pointRadius: 4,
                          borderWidth: 2,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                      scales: {
                        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                      },
                    }}
                  />
                </div>
              </Card>

              {/* Monthly volume */}
              <Card>
                <h3 className="text-sm font-bold text-slate-700 mb-3">Monthly Appointment Volume & Follow-ups</h3>
                <div style={{ height: '280px' }}>
                  <Bar
                    data={{
                      labels: monthlyTrends.map(m => m.label),
                      datasets: [
                        {
                          label: 'Total Dr Appts',
                          data: monthlyTrends.map(m => m.totalAppts),
                          backgroundColor: '#94a3b8',
                          borderRadius: 4,
                        },
                        {
                          label: 'Follow-ups (28d)',
                          data: monthlyTrends.map(m => m.followUp7 + m.followUp14 + m.followUp28),
                          backgroundColor: '#8b5cf6',
                          borderRadius: 4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
                      scales: {
                        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                      },
                    }}
                  />
                </div>
              </Card>

              {/* Monthly data table */}
              <Card>
                <h3 className="text-sm font-bold text-slate-700 mb-3">Monthly Summary Table</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <SortHeader label="Month" column="key" sort={trendSort} setSort={setTrendSort} align="left" />
                        <SortHeader label="Dr Appts" column="totalAppts" sort={trendSort} setSort={setTrendSort} />
                        <SortHeader label="7d F/U" column="followUp7" sort={trendSort} setSort={setTrendSort} className="text-emerald-600" />
                        <SortHeader label="7d %" column="rate7" sort={trendSort} setSort={setTrendSort} className="text-emerald-600" />
                        <SortHeader label="14d %" column="rate14" sort={trendSort} setSort={setTrendSort} className="text-amber-600" />
                        <SortHeader label="28d %" column="rate28" sort={trendSort} setSort={setTrendSort} className="text-purple-600" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortRows(monthlyTrends, trendSort).map((m) => (
                        <tr key={m.key} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-2 font-medium text-slate-700">{m.label}</td>
                          <td className="p-2 text-right text-slate-600">{m.totalAppts.toLocaleString()}</td>
                          <td className="p-2 text-right text-emerald-600">{m.followUp7}</td>
                          <td className="p-2 text-right font-medium text-emerald-600">{m.rate7.toFixed(1)}%</td>
                          <td className="p-2 text-right font-medium text-amber-600">{m.rate14.toFixed(1)}%</td>
                          <td className="p-2 text-right font-medium text-purple-600">{m.rate28.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* About this data */}
      <Card className="bg-slate-50 border-slate-200">
        <div className="flex items-start gap-3">
          <Info className="text-slate-400 mt-0.5 flex-shrink-0" size={16} />
          <div className="text-xs text-slate-500 space-y-1">
            <p><strong>About this analysis:</strong> Follow-up rates measure how often a patient returns within a given window after a GP appointment. Only clinicians whose name starts with "Dr" are included in GP analysis.</p>
            <p><strong>Any Doctor:</strong> Patient returns to any GP within the window. <strong>Same GP:</strong> Patient returns to the same GP. <strong>By Clinician:</strong> For each GP's appointments, whether the patient returns to any clinician.</p>
            <p>This data is processed entirely in your browser. No patient data is sent to any server.</p>
          </div>
        </div>
      </Card>
      </div>{/* end analysisRef */}
      <FollowUpGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
