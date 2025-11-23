import React, { useState, useMemo, useEffect } from 'react';
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
import { Upload, Activity, Calendar, Users, Phone, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Info, Sparkles, Loader2, PlayCircle, Search, User } from 'lucide-react';

// --- PRODUCTION IMPORTS ---
import Papa from 'papaparse';

// PDF.js v5+ Import Strategy for Vite
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Import the worker specifically as a URL so Vite bundles it correctly
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// --- ASSET IMPORTS ---
import logo from './assets/logo.png';
import rushcliffeLogo from './assets/rushcliffe.png';
import nottsWestLogo from './assets/nottswest.png';

// --- SAMPLE DATA IMPORTS ---
import sampleAppt from './assets/sampledata/AppointmentReport.csv?url';
import sampleDNA from './assets/sampledata/DNA.csv?url';
import sampleUnused from './assets/sampledata/Unused.csv?url';
import sampleAug from './assets/sampledata/aug.pdf?url';
import sampleSep from './assets/sampledata/sep.pdf?url';
import sampleOct from './assets/sampledata/oct.pdf?url';

// Set the worker source
GlobalWorkerOptions.workerSrc = pdfWorker;

// API Key
const apiKey = (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_KEY) || "";

// Initialize ChartJS
ChartJS.register(
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
  {
    id: 'backgroundBands',
    beforeDraw: (chart, args, options) => {
      if (!options.bands) return;
      const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
      ctx.save();
      options.bands.forEach(band => {
        const yMax = band.to === Infinity ? top : y.getPixelForValue(band.to);
        const yMin = band.from === -Infinity ? bottom : y.getPixelForValue(band.from);
        if (yMin !== undefined && yMax !== undefined) {
          ctx.fillStyle = band.color;
          ctx.fillRect(left, yMax, right - left, yMin - yMax);
        }
      });
      ctx.restore();
    }
  }
);

const NHS_BLUE = '#005EB8';
const NHS_DARK_BLUE = '#003087';
const NHS_GREEN = '#009639';
const NHS_RED = '#DA291C';
const NHS_GREY = '#425563';
const NHS_AMBER = '#ED8B00';
const NHS_PURPLE = '#330072';
const GP_BAND_BLUE = '#005EB820'; 
const GP_BAND_GREEN = '#00963920';
const GP_BAND_AMBER = '#ED8B0020';
const GP_BAND_RED = '#DA291C20';

// --- UI COMPONENTS ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md ${className}`}>
    {children}
  </div>
);

const MetricCard = ({ title, value, subtext, icon: Icon, color = 'text-slate-700' }) => (
  <Card className="flex flex-col justify-between h-full">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <h3 className={`text-2xl font-bold mt-1 ${color}`}>{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-slate-50 ${color}`}>
        {Icon && <Icon size={24} />}
      </div>
    </div>
    {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
  </Card>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
      {title}
    </h2>
    {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
  </div>
);

const Accordion = ({ title, children, defaultOpen = false, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
            {Icon && <Icon size={20} className="text-slate-500" />}
            <span className="font-bold text-slate-700">{title}</span>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const StaffTable = ({ data, columns }) => {
  const [search, setSearch] = useState('');
  
  const filteredData = data.filter(row => 
    row.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input 
          type="text" 
          placeholder="Search staff name..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-4 py-3">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.slice(0, 50).map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {columns.map((col, j) => (
                  <td key={j} className="px-4 py-3 font-medium">
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
            {filteredData.length === 0 && (
                <tr><td colSpan={columns.length} className="p-4 text-center text-slate-400">No matching staff found</td></tr>
            )}
          </tbody>
        </table>
        {filteredData.length > 50 && <p className="text-xs text-slate-400 text-center mt-2">Showing top 50 matches</p>}
      </div>
    </div>
  );
};


// --- Custom Markdown Renderer Component ---
const SimpleMarkdown = ({ text }) => {
  if (!text) return null;

  const parseBold = (line) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-indigo-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 text-slate-700">
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
          const cleanText = trimmed.replace(/^#+\s*/, '');
          return <h3 key={index} className="text-lg font-bold text-indigo-800 mt-6 mb-2 border-b border-indigo-100 pb-1">{cleanText}</h3>;
        }
        
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={index} className="flex items-start gap-2 ml-2">
              <span className="text-indigo-500 mt-1.5">•</span>
              <p className="flex-1">{parseBold(trimmed.replace(/^[\*\-]\s*/, ''))}</p>
            </div>
          );
        }

        return <p key={index} className="leading-relaxed">{parseBold(trimmed)}</p>;
      })}
    </div>
  );
};

export default function App() {
  // --- State ---
  const [config, setConfig] = useState({
    surgeryName: '',
    population: 10000,
    analyseTelephony: true,
  });

  const [files, setFiles] = useState({
    appointments: null,
    dna: null,
    unused: null,
    telephony: [],
  });

  const [processedData, setProcessedData] = useState(null);
  const [rawStaffData, setRawStaffData] = useState([]); // Store raw granular staff data
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filter State
  const [selectedMonth, setSelectedMonth] = useState('All');

  // AI State
  const [aiReport, setAiReport] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // --- Effects: Title & Favicon ---
  useEffect(() => {
    document.title = "CAIP Analytics";
    const link = document.querySelector("link[rel~='icon']");
    if (!link) {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = logo;
      document.head.appendChild(newLink);
    } else {
      link.href = logo;
    }
  }, []);

  // --- Parsers ---

  const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, 
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      });
    });
  };

  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument(arrayBuffer).promise;
      let fullText = '';
      
      if (pdf.numPages === 0) throw new Error("PDF has no pages.");

      const maxPages = Math.min(pdf.numPages, 3); 
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        if (!textContent.items.length) continue;
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += ` --- PAGE ${i} --- \n ${pageText}`;
      }
      
      if (!fullText.trim()) throw new Error("No text found in PDF (it might be an image scan).");
      return fullText;
    } catch (e) {
      console.error("PDF Parse Error", e);
      throw new Error(`Error reading ${file.name}: ${e.message}`);
    }
  };

  // --- Sample Data Loader ---
  const loadExampleData = async () => {
    setIsProcessing(true);
    setError(null);
    setProcessedData(null);
    setRawStaffData([]);

    try {
      const fetchFile = async (path, name, type) => {
        const response = await fetch(path);
        const blob = await response.blob();
        return new File([blob], name, { type });
      };

      const apptFile = await fetchFile(sampleAppt, 'AppointmentReport.csv', 'text/csv');
      const dnaFile = await fetchFile(sampleDNA, 'DNA.csv', 'text/csv');
      const unusedFile = await fetchFile(sampleUnused, 'Unused.csv', 'text/csv');
      
      const pdf1 = await fetchFile(sampleAug, 'aug.pdf', 'application/pdf');
      const pdf2 = await fetchFile(sampleSep, 'sep.pdf', 'application/pdf');
      const pdf3 = await fetchFile(sampleOct, 'oct.pdf', 'application/pdf');

      const exampleFiles = {
        appointments: apptFile,
        dna: dnaFile,
        unused: unusedFile,
        telephony: [pdf1, pdf2, pdf3]
      };

      const exampleConfig = {
        surgeryName: 'Example Surgery',
        population: 5600,
        analyseTelephony: true
      };

      setConfig(exampleConfig);
      setFiles(exampleFiles);

      await processFiles(exampleFiles, exampleConfig);

    } catch (err) {
      console.error("Example Load Error", err);
      setError("Could not load example data. Please try uploading your own files.");
      setIsProcessing(false);
    }
  };

  // --- Validation Helpers ---
  const validateHeaders = (data, requiredColumns, fileName) => {
    if (!data || data.length === 0) {
        throw new Error(`The file "${fileName}" appears to be empty.`);
    }
    const headers = Object.keys(data[0]);
    const missing = requiredColumns.filter(col => !headers.includes(col));
    
    if (missing.length > 0) {
        throw new Error(`The file "${fileName}" is missing required columns: ${missing.join(', ')}. Please check you uploaded the correct report.`);
    }
  };

  // --- Main Processing Logic ---

  const processFiles = async (customFiles = null, customConfig = null) => {
    setIsProcessing(true);
    setError(null);
    setProcessedData(null);
    setRawStaffData([]);

    const filesToProcess = customFiles || files;
    const configToUse = customConfig || config; 
    
    // --- Define Global Counters at the Top Scope of processFiles ---
    let globalDNACount = 0;
    let globalGPDNACount = 0;
    let globalUnusedCount = 0;
    let globalGPUnusedCount = 0;

    try {
      if (!filesToProcess.appointments) throw new Error("Appointment CSV is required");
      
      const apptData = await parseCSV(filesToProcess.appointments);
      const dnaData = filesToProcess.dna ? await parseCSV(filesToProcess.dna) : [];
      const unusedData = filesToProcess.unused ? await parseCSV(filesToProcess.unused) : [];

      validateHeaders(apptData, ['Date', 'Day'], 'Appointments CSV');
      if (filesToProcess.dna) validateHeaders(dnaData, ['Staff', 'Appointment Count'], 'DNA CSV');
      if (filesToProcess.unused) validateHeaders(unusedData, ['Staff', 'Unused Slots'], 'Unused CSV');

      let telephonyData = [];
      if (configToUse.analyseTelephony && filesToProcess.telephony && filesToProcess.telephony.length > 0) {
        for (const file of filesToProcess.telephony) {
          const text = await extractTextFromPDF(file);
          telephonyData.push({ filename: file.name, text });
        }
      }

      const months = {};
      
      // Store granular staff data by month+name for proper filtering later
      // Key: "MonthKey_StaffName", Value: { stats }
      const monthlyStaffMap = {}; 

      const getMonthKey = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleString('default', { month: 'short', year: 'numeric' });
      };

      const isGP = (name) => {
        if (!name) return false;
        const n = name.trim();
        return n.includes('Dr') || n.toLowerCase().includes('locum');
      };

      // Helper to update monthly staff stats
      const updateStaff = (month, name, type, value) => {
        if (!name) return;
        const key = `${month}_${name}`;
        if (!monthlyStaffMap[key]) {
            monthlyStaffMap[key] = { month, name, isGP: isGP(name), appts: 0, dna: 0, unused: 0 };
        }
        monthlyStaffMap[key][type] += value;
      };

      // --- Process Appointments ---
      apptData.forEach(row => {
        const date = row['Date'];
        if (!date) return;
        const monthKey = getMonthKey(date);
        if (!monthKey) return; 

        if (!months[monthKey]) {
          months[monthKey] = {
            month: monthKey,
            workingDays: 0,
            totalAppts: 0,
            gpAppts: 0,
            staffAppts: 0,
            days: new Set(),
            dates: []
          };
        }

        const dayOfWeek = row['Day'];
        const isWorkingDay = dayOfWeek !== 'Sat' && dayOfWeek !== 'Sun';
        if (isWorkingDay && !months[monthKey].days.has(date)) {
            months[monthKey].workingDays += 1;
            months[monthKey].days.add(date);
        }
        months[monthKey].dates.push(date);

        Object.keys(row).forEach(key => {
          if (key === 'Date' || key === 'Day') return;
          
          let val = row[key];
          if (typeof val === 'string') val = val.trim();
          const count = parseInt(val, 10);
          
          if (isNaN(count)) return;
          
          // Monthly Aggregation
          months[monthKey].totalAppts += count;
          if (isGP(key)) {
            months[monthKey].gpAppts += count;
          } else {
            months[monthKey].staffAppts += count;
          }

          // Staff Aggregation
          updateStaff(monthKey, key, 'appts', count);
        });
      });

      if (Object.keys(months).length === 0) {
          throw new Error("No valid data found. Please check the Date formatting in your Appointments CSV.");
      }
      
      // Helper to find which months a staff member worked in (for distrubtion)
      const getMonthsForStaff = (name) => {
         return Object.values(monthlyStaffMap).filter(r => r.name === name).map(r => r.month);
      };

      // --- Process DNA ---
      dnaData.forEach(row => {
          const count = parseInt(row['Appointment Count'], 10) || 0;
          const staffName = row['Staff'];
          globalDNACount += count;
          if (isGP(staffName)) globalGPDNACount += count;
          
          // Distribute to months where this staff member has appointments
          const workedMonths = getMonthsForStaff(staffName);
          if (workedMonths.length > 0) {
             const splitCount = count / workedMonths.length; // Even split approximation
             workedMonths.forEach(m => updateStaff(m, staffName, 'dna', splitCount));
          } else {
             // Staff had DNA but no appts? Assign to first available month of data
             const firstMonth = Object.keys(months)[0];
             if(firstMonth) updateStaff(firstMonth, staffName, 'dna', count);
          }
      });

      // --- Process Unused ---
      unusedData.forEach(row => {
          const count = parseInt(row['Unused Slots'], 10) || 0;
          const staffName = row['Staff'];
          globalUnusedCount += count;
          if (isGP(staffName)) globalGPUnusedCount += count;

          const workedMonths = getMonthsForStaff(staffName);
          if (workedMonths.length > 0) {
             const splitCount = count / workedMonths.length;
             workedMonths.forEach(m => updateStaff(m, staffName, 'unused', splitCount));
          } else {
             const firstMonth = Object.keys(months)[0];
             if(firstMonth) updateStaff(firstMonth, staffName, 'unused', count);
          }
      });

      // --- Process Telephony ---
      telephonyData.forEach(item => {
        const text = item.text;
        const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s20\d{2}/i);
        if (!monthMatch) return;
        
        const pdfDate = new Date(monthMatch[0]);
        const monthKey = pdfDate.toLocaleString('default', { month: 'short', year: 'numeric' });

        if (months[monthKey]) {
           const extract = (regex) => {
             const match = text.match(regex);
             if (match && match[1]) return parseFloat(match[1].replace(/,/g, ''));
             return 0;
           };

           const extractTime = (regex) => {
                const match = text.match(regex);
                if (match) {
                    let minutes = 0;
                    let seconds = 0;
                    if(match[1]) minutes = parseInt(match[1]); 
                    if(match[2]) seconds = parseInt(match[2]);
                    const fullStr = match[0];
                    const minMatch = fullStr.match(/(\d+)m/);
                    const secMatch = fullStr.match(/(\d+)s/);
                    if (minMatch) minutes = parseInt(minMatch[1]);
                    if (secMatch) seconds = parseInt(secMatch[1]);
                    return (minutes * 60) + seconds;
                }
                return 0;
           }
           
           const missedUniqueMatch = text.match(/Missed From Queue\s+Excluding Repeat Callers\s+[\d,]+\s+\(([\d.]+)%\)/i);
           const missedUniquePct = missedUniqueMatch && missedUniqueMatch[1] ? parseFloat(missedUniqueMatch[1]) : 0;

           months[monthKey].telephony = {
             inboundReceived: extract(/Inbound Received\s+([\d,]+)/i),
             inboundAnswered: extract(/Inbound Answered\s+([\d,]+)/i),
             missedFromQueue: extract(/Missed From Queue\s+([\d,]+)/i),
             missedFromQueueExRepeat: extract(/Missed From Queue\s+Excluding Repeat Callers\s+([\d,]+)/i),
             missedFromQueueExRepeatPct: missedUniquePct, 
             answeredFromQueue: extract(/Answered From Queue\s+[\d,]+\s+\(([\d.]+)%\)/i), 
             abandonedCalls: extract(/Abandoned Calls\s+[\d,]+\s+\(([\d.]+)%\)/i), 
             callbacksSuccessful: extract(/Callbacks Successful\s+([\d,]+)/i),
             avgQueueTimeAnswered: extractTime(/Average Queue Time\s+Answered\s+(\d+m\s\d+s|\d+s)/i),
             avgQueueTimeMissed: extractTime(/Average Queue Time\s+Missed\s+(\d+m\s\d+s|\d+s)/i),
             avgInboundTalkTime: extractTime(/Average Inbound Talk\s+Time\s+(\d+m\s\d+s|\d+s)/i),
           };
        }
      });

      const totalApptsAllMonths = Object.values(months).reduce((sum, m) => sum + m.totalAppts, 0);
      const totalGPApptsAllMonths = Object.values(months).reduce((sum, m) => sum + m.gpAppts, 0);

      const sortedMonths = Object.values(months).sort((a, b) => new Date(a.month) - new Date(b.month));

      const finalData = sortedMonths.map(m => {
         const weight = totalApptsAllMonths > 0 ? m.totalAppts / totalApptsAllMonths : 0;
         const gpWeight = totalGPApptsAllMonths > 0 ? m.gpAppts / totalGPApptsAllMonths : 0;

         const estimatedDNA = Math.round(globalDNACount * weight);
         const estimatedGPDNA = Math.round(globalGPDNACount * gpWeight);
         const estimatedUnused = Math.round(globalUnusedCount * weight);
         const estimatedGPUnused = Math.round(globalGPUnusedCount * gpWeight);
         
         const t = m.telephony || {};
         const population = parseFloat(configToUse.population) || 1;
         const capitationCalling = t.inboundAnswered ? ((t.inboundAnswered / population) * 100) : 0;

         // Ratios - CHANGED TO RAW RATIO (not percentage)
         const conversionRatio = t.inboundAnswered > 0 ? (m.totalAppts / t.inboundAnswered) : 0;
         const gpConversionRatio = t.inboundAnswered > 0 ? (m.gpAppts / t.inboundAnswered) : 0;
         
         // Capacity Utilization
         const totalCapacity = m.totalAppts + estimatedUnused;
         const utilization = totalCapacity > 0 ? (m.totalAppts / totalCapacity) * 100 : 0;

         const gpCapacity = m.gpAppts + estimatedGPUnused;
         const gpUtilization = gpCapacity > 0 ? (m.gpAppts / gpCapacity) * 100 : 0;

         // Ideal Forecast
         const gpRatio = t.inboundAnswered > 0 ? (m.gpAppts / t.inboundAnswered) : 0;
         const gpMissedDemand = gpRatio * (t.missedFromQueueExRepeat || 0);
         const gpWaste = estimatedGPUnused + estimatedGPDNA;
         
         const extraGPSlotsNeeded = gpMissedDemand - gpWaste;
         const extraGPSlotsPerDay = m.workingDays > 0 ? (extraGPSlotsNeeded / m.workingDays) : 0;

         return {
           month: m.month,
           workingDays: m.workingDays,
           
           totalAppts: m.totalAppts,
           gpAppts: m.gpAppts,
           
           // New Ratios
           conversionRatio,
           gpConversionRatio,
           utilization,
           gpUtilization,

           // GP Metrics
           gpApptsPerDay: m.workingDays ? (m.gpAppts / population * 100) / m.workingDays : 0,
           gpUnusedPct: (m.gpAppts + estimatedGPUnused) > 0 ? (estimatedGPUnused / (m.gpAppts + estimatedGPUnused)) * 100 : 0,
           gpDNAPct: m.gpAppts > 0 ? (estimatedGPDNA / m.gpAppts) * 100 : 0,

           // All Staff Metrics
           allApptsPerDay: m.workingDays ? (m.totalAppts / population * 100) / m.workingDays : 0,
           allUnusedPct: (m.totalAppts + estimatedUnused) > 0 ? (estimatedUnused / (m.totalAppts + estimatedUnused)) * 100 : 0,
           allDNAPct: m.totalAppts > 0 ? (estimatedDNA / m.totalAppts) * 100 : 0,

           // Telephony
           ...t,
           capitationCallingPerDay: m.workingDays ? (capitationCalling / m.workingDays) : 0,

           // Ideal
           extraSlotsPerDay: extraGPSlotsPerDay 
         };
      });

      // 3. Final Sanity Check
      const hasNaN = finalData.some(d => 
        isNaN(d.gpApptsPerDay) || 
        isNaN(d.allApptsPerDay) || 
        !isFinite(d.gpApptsPerDay)
      );

      if (hasNaN || finalData.length === 0) {
        throw new Error("Processing resulted in invalid numbers. Please check if your input files contain valid numeric data.");
      }

      setProcessedData(finalData);
      setRawStaffData(Object.values(monthlyStaffMap)); // Store the granular data

    } catch (err) {
      setError(err.message);
      setProcessedData(null); 
      setRawStaffData([]);
      console.error("Processing Failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // --- Aggregated Staff Data (Filtered) ---
  const aggregatedStaffData = useMemo(() => {
    if (!rawStaffData || rawStaffData.length === 0) return [];
    
    // 1. Filter by month if needed
    const filtered = selectedMonth === 'All' 
        ? rawStaffData 
        : rawStaffData.filter(d => d.month === selectedMonth);

    // 2. Aggregate by name
    const grouped = filtered.reduce((acc, curr) => {
        if (!acc[curr.name]) {
            acc[curr.name] = { 
                name: curr.name, 
                isGP: curr.isGP, 
                appts: 0, 
                dna: 0, 
                unused: 0 
            };
        }
        acc[curr.name].appts += curr.appts;
        acc[curr.name].dna += curr.dna;
        acc[curr.name].unused += curr.unused;
        return acc;
    }, {});

    // 3. Convert to array and sort
    return Object.values(grouped).sort((a,b) => b.appts - a.appts);

  }, [rawStaffData, selectedMonth]);


  // --- AI Feature ---
  const generateAIInsights = async () => {
    if (!displayedData || displayedData.length === 0) return;
    
    setIsAiLoading(true);
    setAiError(null);
    setAiReport(null);

    try {
        const dataSummary = displayedData.map(d => ({
            month: d.month,
            gpAppts: d.gpAppts,
            utilization: d.utilization.toFixed(1) + '%',
            gpApptsPerDay: d.gpApptsPerDay.toFixed(2) + '%', 
            bookingConversion: d.conversionRatio.toFixed(2),
            gpDNARate: d.gpDNAPct.toFixed(2) + '%',
            inboundCalls: d.inboundReceived,
            forecastExtraSlotsNeeded: d.extraSlotsPerDay.toFixed(1)
        }));

        const prompt = `
            You are an expert NHS Practice Manager and Data Analyst using CAIP Analytics.
            Analyze the following monthly performance data for this NHS GP Practice (${selectedMonth === 'All' ? 'Trend Analysis' : selectedMonth}).
            
            Data: ${JSON.stringify(dataSummary)}

            Please provide a concise report in exactly these two sections using bullet points:

            ### ✅ Positives
            * Highlight metrics that are performing well (e.g., high utilization, low DNA rates, good access ratios).

            ### 🚀 Room for Improvement & Actions
            * Identify specific issues and provide a direct, actionable solution for each.
            * Logic to apply:
                * If **Booking Conversion** (Appts / Answered Calls) is low (<0.5), suggest: "A high volume of calls are not resulting in appointments. Review signposting/navigation scripts or check if patients are calling for non-clinical reasons."
                * If **Utilization** is low (<95%), suggest: "You have wasted clinical capacity. Review embargo placement or release slots sooner."
                * If **GP Appts % per Day** is low (<1.1%), suggest: "GP Appointment availability is low relative to population. Consider increasing clinical sessions or reviewing rota capacity."
                * If **DNA Rate** is high (>4%), suggest: "DNA rate is above target. Review SMS reminder configuration."

            Keep the tone professional, constructive, and specific to NHS Primary Care. Use British English. Format with Markdown.
        `;

        // Updated Model URL to gemini-2.5-flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'Failed to generate insights');
        }
        
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            setAiReport(text);
        } else {
            throw new Error('No insight generated');
        }

    } catch (e) {
        console.error("AI Error:", e);
        setAiError(`AI Error: ${e.message}`);
    } finally {
        setIsAiLoading(false);
    }
  };

  // --- Filtering ---
  const displayedData = useMemo(() => {
    if (!processedData) return null;
    if (selectedMonth === 'All') return processedData;
    return processedData.filter(d => d.month === selectedMonth);
  }, [processedData, selectedMonth]);

  const availableMonths = useMemo(() => {
    if (!processedData) return [];
    return ['All', ...processedData.map(d => d.month)];
  }, [processedData]);

  // --- Charts Configuration ---

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { color: '#64748b' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' }
      }
    },
    elements: {
        line: { tension: 0.4 },
        point: { radius: 4, hoverRadius: 6 }
    }
  };

  const timeOptions = {
      ...commonOptions,
      scales: {
          ...commonOptions.scales,
          y: {
              ...commonOptions.scales.y,
              ticks: {
                  color: '#64748b',
                  callback: (v) => `${Math.floor(v/60)}m ${v%60}s`
              }
          }
      }
  };

  const percentageOptions = {
    ...commonOptions,
    scales: {
      ...commonOptions.scales,
      y: {
        ...commonOptions.scales.y,
        min: 0, // Ensure it starts at 0
        ticks: {
          color: '#64748b',
          callback: (value) => `${Number(value).toFixed(2)}%`
        }
      }
    }
  };
  
  const ratioOptions = {
    ...commonOptions,
    scales: {
      ...commonOptions.scales,
      y: {
        ...commonOptions.scales.y,
        min: 0,
        ticks: {
          color: '#64748b',
          callback: (value) => Number(value).toFixed(2)
        }
      }
    },
    plugins: {
        ...commonOptions.plugins,
        tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)}`
            }
        }
    }
  };

  const utilizationOptions = {
    ...percentageOptions,
    scales: {
        ...percentageOptions.scales,
        y: {
            ...percentageOptions.scales.y,
            min: 0,
            max: 100
        }
    }
  };

  const gpBandOptions = {
    ...percentageOptions,
    scales: {
        ...percentageOptions.scales,
        y: {
            ...percentageOptions.scales.y,
            min: 0,
            suggestedMax: 1.6 
        }
    },
    plugins: {
        ...percentageOptions.plugins,
        backgroundBands: {
            bands: [
                { from: 0, to: 0.85, color: GP_BAND_RED },
                { from: 0.85, to: 1.10, color: GP_BAND_AMBER },
                { from: 1.10, to: 1.30, color: GP_BAND_GREEN },
                { from: 1.30, to: 5.00, color: GP_BAND_BLUE }, 
            ]
        }
    }
  };

  const stackedPercentageOptions = {
    ...percentageOptions,
    scales: {
        x: { 
          ...commonOptions.scales.x,
          stacked: true 
        },
        y: { 
          ...percentageOptions.scales.y,
          stacked: true,
          max: 100 
        }
      }
  };

  const createChartData = (label, dataKey, color, fill = true) => ({
    labels: displayedData?.map(d => d.month),
    datasets: [{
      label: label,
      data: displayedData?.map(d => d[dataKey]),
      borderColor: color,
      backgroundColor: fill ? `${color}20` : 'transparent',
      fill: fill,
    }]
  });

  const FileInput = ({ label, helpText, accept, onChange, file }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {helpText && <p className="text-xs text-slate-500 mb-2">{helpText}</p>}
      <div className="flex items-center gap-3">
        <label className="flex-1 cursor-pointer group">
          <div className={`flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-xl transition-all ${file ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
            <input type="file" className="hidden" accept={accept} onChange={onChange} multiple={accept === "application/pdf"} />
            <div className="flex items-center gap-2 text-slate-500 group-hover:text-blue-600">
               {file ? <CheckCircle size={18} className="text-green-600" /> : <Upload size={18} />}
               <span className="text-sm truncate max-w-[200px]">
                 {file ? (Array.isArray(file) ? `${file.length} files` : file.name) : 'Upload file'}
               </span>
            </div>
          </div>
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
             <img src={logo} alt="CAIP Logo" className="h-10 w-10 rounded-lg object-cover" />
             <div>
               <h1 className="text-xl font-bold text-slate-900 leading-tight">CAIP Analytics</h1>
               <p className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:block">Free data analytics to help you improve capacity and access in primary care</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-3 bg-white dark:bg-slate-700 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Made in</span>
                <a href="https://www.rushcliffehealth.org" target="_blank" rel="noopener noreferrer">
                  <img src={rushcliffeLogo} alt="Rushcliffe PCN" className="h-8 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100" />
                </a>
                <a href="https://www.nottinghamwestpcn.co.uk" target="_blank" rel="noopener noreferrer">
                  <img src={nottsWestLogo} alt="Nottingham West PCN" className="h-8 w-auto grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100" />
                </a>
             </div>

             {!processedData && (
               <button 
                 onClick={loadExampleData}
                 disabled={isProcessing}
                 className="flex items-center gap-2 px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-all text-sm font-medium"
               >
                 {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                 See Example
               </button>
             )}

             {processedData && (
               <div className="flex items-center gap-4 text-sm">
                 <div className="relative group">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 cursor-pointer">
                       <Calendar size={14} />
                       <select 
                          value={selectedMonth} 
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="bg-transparent border-none outline-none cursor-pointer text-sm font-medium appearance-none pr-4"
                       >
                          {availableMonths.map(m => (
                             <option key={m} value={m}>{m === 'All' ? 'All Months' : m}</option>
                          ))}
                       </select>
                       <ChevronDown size={12} className="absolute right-3 pointer-events-none" />
                    </div>
                 </div>
                 
                 <button 
                  onClick={generateAIInsights}
                  disabled={isAiLoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50"
                 >
                  {isAiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} />}
                  <span className="font-medium">Analyze with AI</span>
                 </button>

                 <button 
                   onClick={() => { setProcessedData(null); setSelectedMonth('All'); setAiReport(null); setConfig({...config, surgeryName: '', population: 10000}); setFiles({appointments:null, dna:null, unused:null, telephony:[]}); }} 
                   className="text-slate-500 hover:text-red-600 transition-colors text-xs font-medium"
                 >
                   Reset
                 </button>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!processedData && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center mb-10">
               <div className="flex justify-center mb-4">
                 <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Activity size={32} />
                 </div>
               </div>
               <h2 className="text-3xl font-bold text-slate-900 mb-2">Let's analyse your demand</h2>
               <p className="text-slate-500">Upload your SystmOne extracts and Surgery Connect reports.</p>
             </div>

             <Card className="mb-6">
               <SectionHeader title="Practice Details" />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Surgery Name</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      placeholder="e.g. High Street Practice"
                      value={config.surgeryName}
                      onChange={e => setConfig({...config, surgeryName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Patient Population</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      value={config.population}
                      onChange={e => setConfig({...config, population: e.target.value})}
                    />
                  </div>
               </div>
               <div className="mt-4 flex items-center gap-2">
                 <input 
                   type="checkbox" 
                   id="telephony" 
                   className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                   checked={config.analyseTelephony}
                   onChange={e => setConfig({...config, analyseTelephony: e.target.checked})}
                 />
                 <label htmlFor="telephony" className="text-sm text-slate-700">Analyse Telephony Data (Requires PDF uploads)</label>
               </div>
             </Card>

             <Card>
               <SectionHeader title="Data Uploads" subtitle="Ensure date ranges match across files." />
               
               <FileInput 
                 label="Appointment Extract (CSV) *" 
                 accept=".csv" 
                 file={files.appointments}
                 onChange={(e) => setFiles({...files, appointments: e.target.files[0]})}
               />
               <FileInput 
                 label="DNA Extract (CSV) *" 
                 helpText="(Must tick staff name and slot type in SystmOne)"
                 accept=".csv" 
                 file={files.dna}
                 onChange={(e) => setFiles({...files, dna: e.target.files[0]})}
               />
               <FileInput 
                 label="Unused Extract (CSV) *" 
                 helpText="(Must tick staff name and slot type in SystmOne)"
                 accept=".csv" 
                 file={files.unused}
                 onChange={(e) => setFiles({...files, unused: e.target.files[0]})}
               />
               
               {config.analyseTelephony && (
                   <FileInput 
                     label="Telephony Reports (PDF) *" 
                     helpText="(Simply upload your X-on Surgery Connect Monthly Management Reports - only summary data is used)"
                     accept="application/pdf" 
                     file={files.telephony.length > 0 ? files.telephony : null}
                     onChange={(e) => setFiles({...files, telephony: Array.from(e.target.files)})}
                   />
               )}

               {error && (
                 <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 text-sm border border-red-100">
                   <AlertCircle size={18} className="shrink-0 mt-0.5" />
                   <span className="font-medium">{error}</span>
                 </div>
               )}

               <button 
                 onClick={() => processFiles()}
                 disabled={isProcessing || !files.appointments}
                 className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all
                   ${isProcessing || !files.appointments ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]'}
                 `}
               >
                 {isProcessing ? 'Analysing Data...' : 'Generate Dashboard'}
               </button>
             </Card>
          </div>
        )}

        {processedData && (
          <div className="animate-in fade-in duration-700">
            {aiReport && (
                <Card className="mb-8 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 animate-in slide-in-from-top-4 duration-500 shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Sparkles size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-indigo-900">CAIP Copilot Analysis</h3>
                        <button onClick={() => setAiReport(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-sm">Close</button>
                    </div>
                    <div className="prose prose-sm prose-indigo max-w-none">
                        <SimpleMarkdown text={aiReport} />
                    </div>
                </Card>
            )}

            {aiError && (
                 <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 text-sm">
                   <AlertCircle size={16} />
                   {aiError}
                 </div>
            )}
            
            <div className="flex justify-center mb-8">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                {[
                    {id: 'dashboard', label: 'Overview', icon: Activity},
                    {id: 'gp', label: 'GP Metrics', icon: Users},
                    {id: 'telephony', label: 'Telephony', icon: Phone},
                    {id: 'forecast', label: 'Ideal Forecast', icon: Calendar}
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
              </div>
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <MetricCard 
                     title="Total Appointments" 
                     value={displayedData.reduce((a,b) => a + (b.totalAppts || 0), 0).toLocaleString()} 
                     subtext={selectedMonth === 'All' ? `Over ${processedData.length} months` : selectedMonth}
                     icon={Calendar}
                     color="text-blue-600"
                   />
                   <MetricCard 
                     title="Avg Inbound Calls" 
                     value={Math.round(displayedData.reduce((a,b) => a + (b.inboundReceived||0), 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toLocaleString()} 
                     subtext="Per month"
                     icon={Phone}
                     color="text-indigo-600"
                   />
                   <MetricCard 
                     title="Avg DNA Rate" 
                     value={`${(displayedData.reduce((a,b) => a + b.allDNAPct, 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toFixed(2)}%`} 
                     subtext="All staff types"
                     icon={XCircle}
                     color="text-red-500"
                   />
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="h-80 lg:col-span-1">
                        <h3 className="font-bold text-slate-700 mb-4">Appointment Trends</h3>
                        <Line data={createChartData('Total Appointments', 'totalAppts', NHS_BLUE)} options={commonOptions} />
                    </Card>
                    <Card className="h-80 lg:col-span-1">
                        <h3 className="font-bold text-slate-700 mb-4">Booking Conversion Ratio</h3>
                        <p className="text-xs text-slate-400 mb-2">Appointments booked per answered call</p>
                        <Line data={createChartData('Conversion Ratio', 'conversionRatio', NHS_PURPLE)} options={ratioOptions} />
                    </Card>
                 </div>
                 
                 <Accordion title="Staff Breakdown (All Staff)" icon={Users}>
                    {aggregatedStaffData && (
                        <StaffTable 
                            data={aggregatedStaffData} 
                            columns={[
                                { header: 'Name', accessor: 'name' },
                                { header: 'Appointments', accessor: 'appts' },
                                { header: 'Unused Slots', accessor: 'unused' },
                                { header: 'DNAs', accessor: 'dna' }
                            ]}
                        />
                    )}
                 </Accordion>
              </div>
            )}

            {activeTab === 'gp' && (
                <div className="space-y-6">
                    <Card className="h-96 border-2 border-blue-100 shadow-md">
                        <h3 className="font-bold text-slate-800 mb-2 text-lg">Patients with GP Appointment per Day (%)</h3>
                        <p className="text-sm text-slate-500 mb-4">Performance Bands: Red (&lt;0.85%), Amber (0.85-1.10%), Green (1.10-1.30%), Blue (&gt;1.30%)</p>
                        <div className="h-72">
                            <Line data={createChartData('GP Appts %', 'gpApptsPerDay', NHS_DARK_BLUE, false)} options={gpBandOptions} />
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="h-80">
                            <h3 className="font-bold text-slate-700 mb-2">GP Capacity Utilisation</h3>
                            <p className="text-xs text-slate-400 mb-4">% of total GP capacity (Appts + Unused) that was used</p>
                            <Line data={createChartData('Utilisation %', 'gpUtilization', NHS_GREEN)} options={utilizationOptions} />
                        </Card>
                        <Card className="h-80">
                            <h3 className="font-bold text-slate-700 mb-2">GP Booking Conversion</h3>
                            <p className="text-xs text-slate-400 mb-4">GP Appointments per answered call</p>
                            <Line data={createChartData('GP Conversion Ratio', 'gpConversionRatio', NHS_PURPLE)} options={ratioOptions} />
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="h-64">
                            <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">GP Unused Slots</h3>
                            <p className="text-xs text-slate-400 mb-4">% of total GP slots</p>
                            <div className="h-40">
                                <Line data={createChartData('GP Unused %', 'gpUnusedPct', NHS_GREEN)} options={percentageOptions} />
                            </div>
                        </Card>
                        <Card className="h-64">
                            <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">GP DNA Rate</h3>
                            <p className="text-xs text-slate-400 mb-4">% of GP appointments</p>
                            <div className="h-40">
                                <Line data={createChartData('GP DNA %', 'gpDNAPct', NHS_RED)} options={percentageOptions} />
                            </div>
                        </Card>
                        <Card className="h-64">
                            <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">GP Appointments</h3>
                             <div className="h-40">
                                <Bar data={{
                                    labels: displayedData.map(d => d.month),
                                    datasets: [
                                        { label: 'GP Appointments', data: displayedData.map(d => d.gpAppts), backgroundColor: NHS_BLUE },
                                    ]
                                }} options={commonOptions} />
                             </div>
                        </Card>
                    </div>

                    <Accordion title="GP Performance Breakdown" icon={User}>
                        {aggregatedStaffData && (
                            <StaffTable 
                                data={aggregatedStaffData.filter(s => s.isGP)} 
                                columns={[
                                    { header: 'GP Name', accessor: 'name' },
                                    { header: 'Appointments', accessor: 'appts' },
                                    { header: 'Unused Slots', accessor: 'unused' },
                                    { header: 'DNAs', accessor: 'dna' }
                                ]}
                            />
                        )}
                    </Accordion>
                </div>
            )}

            {activeTab === 'telephony' && (
                <div className="space-y-6">
                    {!config.analyseTelephony ? (
                        <div className="text-center py-20 text-slate-400">
                            <p>Telephony analysis is disabled.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {[
                                    { l: 'Inbound Calls', k: 'inboundReceived', c: 'text-blue-600' },
                                    { l: 'Answered Queue', k: 'answeredFromQueue', c: 'text-green-600', suffix: '%' },
                                    { l: 'Abandoned', k: 'abandonedCalls', c: 'text-amber-600', suffix: '%' }, 
                                    { l: 'Callbacks Success', k: 'callbacksSuccessful', c: 'text-blue-500' },
                                    { l: 'Avg Wait', k: 'avgQueueTimeAnswered', c: 'text-slate-600', fmt: v => `${Math.floor(v/60)}m ${v%60}s` }
                                ].map((m, i) => (
                                    <Card key={i} className="p-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase">{m.l}</p>
                                        <p className={`text-xl font-bold ${m.c} mt-1`}>
                                            {m.fmt ? m.fmt(displayedData[displayedData.length-1][m.k]) : 
                                             `${displayedData[displayedData.length-1][m.k].toLocaleString()}${m.suffix||''}`}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{selectedMonth === 'All' ? 'Latest Month' : selectedMonth}</p>
                                    </Card>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="h-80">
                                    <h3 className="font-bold text-slate-700 mb-4">Queue Percentage Split</h3>
                                    <Bar data={{
                                        labels: displayedData.map(d => d.month),
                                        datasets: [
                                            { 
                                                label: 'Answered %', 
                                                data: displayedData.map(d => 100 - (d.missedFromQueueExRepeatPct || 0)), 
                                                backgroundColor: NHS_GREEN 
                                            },
                                            { 
                                                label: 'Missed (Unique) %', 
                                                data: displayedData.map(d => d.missedFromQueueExRepeatPct || 0), 
                                                backgroundColor: NHS_RED 
                                            }
                                        ]
                                    }} options={stackedPercentageOptions} />
                                </Card>
                                <Card className="h-80">
                                    <h3 className="font-bold text-slate-700 mb-4">Abandoned Calls (%)</h3>
                                    <Line data={createChartData('Abandoned %', 'abandonedCalls', NHS_AMBER)} options={percentageOptions} />
                                </Card>
                                <Card className="h-80">
                                    <h3 className="font-bold text-slate-700 mb-4">Missed Call % (Unique)</h3>
                                    <Line data={createChartData('Missed Unique %', 'missedFromQueueExRepeatPct', NHS_RED)} options={percentageOptions} />
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="h-64">
                                    <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">Avg Queue Time (Answered)</h3>
                                    <div className="h-40">
                                        <Line data={createChartData('Time', 'avgQueueTimeAnswered', NHS_BLUE)} options={timeOptions} />
                                    </div>
                                </Card>
                                <Card className="h-64">
                                    <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">Avg Queue Time (Missed)</h3>
                                    <div className="h-40">
                                        <Line data={createChartData('Time', 'avgQueueTimeMissed', NHS_RED)} options={timeOptions} />
                                    </div>
                                </Card>
                                <Card className="h-64">
                                    <h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">Avg Inbound Talk Time</h3>
                                    <div className="h-40">
                                        <Line data={createChartData('Time', 'avgInboundTalkTime', NHS_GREY)} options={timeOptions} />
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'forecast' && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Activity size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Demand Forecasting (GP Only)</h3>
                                <p className="text-blue-100 mt-2 max-w-xl">
                                    We've analyzed your missed calls, GP DNA rates, and GP unused slots to calculate the "Ideal" scenario.
                                    This metric estimates the number of <strong>extra GP appointments per day</strong> required to meet hidden demand.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card>
                         <h3 className="font-bold text-slate-800 mb-6">Extra GP Appointments Needed Per Day (Forecast)</h3>
                         <div className="h-80">
                            <Bar data={{
                                labels: displayedData.map(d => d.month),
                                datasets: [{
                                    label: 'Shortfall (Slots/Day)',
                                    data: displayedData.map(d => d.extraSlotsPerDay),
                                    backgroundColor: displayedData.map(d => d.extraSlotsPerDay > 0 ? '#EF4444' : '#10B981'),
                                }]
                            }} options={{
                                ...commonOptions,
                                plugins: {
                                    ...commonOptions.plugins,
                                    tooltip: {
                                        callbacks: {
                                            label: (ctx) => {
                                                const v = ctx.raw;
                                                return v > 0 ? `Shortfall: ${v.toFixed(1)} slots/day` : `Surplus: ${Math.abs(v).toFixed(1)} slots/day`;
                                            }
                                        }
                                    }
                                }
                            }} />
                         </div>
                         <div className="mt-6 bg-slate-50 p-4 rounded-xl text-sm text-slate-600">
                             <p className="font-semibold mb-2 flex items-center gap-2"><Info size={16}/> How is this calculated?</p>
                             <p className="mb-2">
                                 We take the demand hidden in missed calls (extrapolated using your booking ratio) and subtract your wasted GP capacity (DNAs and Unused slots).
                             </p>
                             <code className="block bg-slate-100 p-2 rounded border border-slate-200 text-xs font-mono">
                                 ( (GPAppts/AnsweredRatio × MissedCalls) - (GPUnused + GPDNA) ) ÷ WorkingDays
                             </code>
                         </div>
                    </Card>
                </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}