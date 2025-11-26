import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
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
import {
  Upload, FileText, Activity, Users, Clock, Phone, Calendar,
  BarChart3, PieChart, ArrowRight, CheckCircle, AlertCircle,
  Menu, X, ChevronDown, HelpCircle, Info, Sparkles, XCircle,
  Download, Loader2, PlayCircle, AlertTriangle, Trash2, Plus, Monitor, User, Search,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronUp
} from 'lucide-react';

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
import dataProcessingImage from './assets/dataprocessing.png';

// --- SAMPLE DATA IMPORTS ---
import sampleAppt from './assets/sampledata/AppointmentReport.csv?url';
import sampleDNA from './assets/sampledata/DNA.csv?url';
import sampleUnused from './assets/sampledata/Unused.csv?url';
import sampleOnline from './assets/sampledata/OnlineRequests.csv?url';
import sampleAug from './assets/sampledata/aug.pdf?url';
import sampleSep from './assets/sampledata/sep.pdf?url';
import sampleOct from './assets/sampledata/oct.pdf?url';

// Set the worker source
GlobalWorkerOptions.workerSrc = pdfWorker;

// API Key
const apiKey = (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_KEY) || "";

// Version Info
const APP_VERSION = "0.8.6-beta";

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
const NHS_AQUA = '#00A9CE';
const NHS_PINK = '#AE2573';
const GP_BAND_BLUE = '#005EB820';
const GP_BAND_GREEN = '#00963920';
const GP_BAND_AMBER = '#ED8B0020';
const GP_BAND_RED = '#DA291C20';

// --- FORECASTING HELPER (Linear Regression) ---
const calculateLinearForecast = (dataPoints, periodsToForecast = 2) => {
  if (!dataPoints || dataPoints.length < 3) return [];

  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  dataPoints.forEach((point, i) => {
    sumX += i;
    sumY += point;
    sumXY += i * point;
    sumXX += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecast = [];
  for (let i = 1; i <= periodsToForecast; i++) {
    const nextIndex = n - 1 + i;
    const predictedValue = slope * nextIndex + intercept;
    forecast.push(Math.max(0, Math.round(predictedValue)));
  }
  return forecast;
};

const getNextMonthNames = (lastMonthStr, count) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = new Date(lastMonthStr);
  if (isNaN(date.getTime())) return Array(count).fill('Future');

  let currentMonthIndex = date.getMonth();
  let currentYear = date.getFullYear();

  const result = [];
  for (let i = 0; i < count; i++) {
    currentMonthIndex++;
    if (currentMonthIndex > 11) {
      currentMonthIndex = 0;
      currentYear++;
    }
    result.push(`${months[currentMonthIndex]} ${currentYear}`);
  }
  return result;
};

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
        <div className="p-4 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

const SortableTable = ({ data, columns, isPrint = false, searchPlaceholder = "Search..." }) => {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [data, search]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const displayData = isPrint ? sortedData : sortedData.slice(0, 50);

  return (
    <div>
      {!isPrint && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                  onClick={() => requestSort(col.accessor)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {sortConfig.key === col.accessor ? (
                      sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />
                    ) : (
                      <ArrowUpDown size={14} className="text-slate-300 group-hover:text-slate-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayData.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {columns.map((col, j) => (
                  <td key={j} className="px-4 py-3 font-medium">
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr><td colSpan={columns.length} className="p-4 text-center text-slate-400">No matching records found</td></tr>
            )}
          </tbody>
        </table>
        {!isPrint && sortedData.length > 50 && <p className="text-xs text-slate-400 text-center mt-2">Showing top 50 matches (sort to see more)</p>}
      </div>
    </div>
  );
};


// --- Custom Markdown Renderer Component ---
const SimpleMarkdown = ({ text }) => {
  if (!text) return null;

  const parseBold = (line) => {
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
        const clean = part.replace(/^[*]+|[*]+$/g, '');
        return <strong key={i} className="font-bold text-indigo-900">{clean}</strong>;
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
              <p className="flex-1">{parseBold(trimmed.replace(/^[*-]\s*/, ''))}</p>
            </div>
          );
        }

        return <p key={index} className="leading-relaxed">{parseBold(trimmed)}</p>;
      })}
    </div>
  );
};

const DataProcessingModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-blue-600" size={20} />
            Data Processing Workflow
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 bg-slate-50 flex justify-center">
          <img src={dataProcessingImage} alt="Data Processing Workflow" className="rounded-xl shadow-sm border border-slate-200 max-w-full h-auto" />
        </div>
      </div>
    </div>
  );
};

const ResetConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4 text-amber-600">
          <AlertTriangle size={28} />
          <h3 className="text-xl font-bold text-slate-800">Reset Dashboard?</h3>
        </div>
        <p className="text-slate-600 mb-6">
          Are you sure you want to clear all data and return to the start? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            Yes, Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [config, setConfig] = useState({
    surgeryName: '',
    population: 10000,
    analyseTelephony: true, // Renaming logically below to useTelephony for internal clarity if needed, but keeping key for compat
    useTelephony: true,
    useOnline: true,
  });

  const [files, setFiles] = useState({
    appointments: null,
    dna: null,
    unused: null,
    onlineRequests: null,
    telephony: [],
  });

  const [processedData, setProcessedData] = useState(null);
  const [rawStaffData, setRawStaffData] = useState([]);
  const [rawSlotData, setRawSlotData] = useState([]);
  const [rawCombinedData, setRawCombinedData] = useState([]);
  const [rawOnlineData, setRawOnlineData] = useState([]); // Store raw online data for dynamic filtering
  // const [onlineStats, setOnlineStats] = useState(null); // REMOVED: Now derived
  const [forecastData, setForecastData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [selectedMonth, setSelectedMonth] = useState('All');
  const [aiReport, setAiReport] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showProcessingInfo, setShowProcessingInfo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  // --- PARSERS ---

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
      const pdf = await getDocument({ data: arrayBuffer }).promise;
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

  // --- DATA LOADERS ---
  const loadExampleData = async () => {
    setIsProcessing(true);
    setError(null);
    setProcessedData(null);
    setRawStaffData([]);
    setRawSlotData([]);
    setRawCombinedData([]);
    setRawOnlineData([]);
    setForecastData(null);

    try {
      const fetchFile = async (path, name, type) => {
        const response = await fetch(path);
        const blob = await response.blob();
        return new File([blob], name, { type });
      };

      const apptFile = await fetchFile(sampleAppt, 'AppointmentReport.csv', 'text/csv');
      const dnaFile = await fetchFile(sampleDNA, 'DNA.csv', 'text/csv');
      const unusedFile = await fetchFile(sampleUnused, 'Unused.csv', 'text/csv');
      const onlineFile = await fetchFile(sampleOnline, 'OnlineRequests.csv', 'text/csv');

      const pdf1 = await fetchFile(sampleAug, 'aug.pdf', 'application/pdf');
      const pdf2 = await fetchFile(sampleSep, 'sep.pdf', 'application/pdf');
      const pdf3 = await fetchFile(sampleOct, 'oct.pdf', 'application/pdf');

      const exampleFiles = {
        appointments: apptFile,
        dna: dnaFile,
        unused: unusedFile,
        onlineRequests: onlineFile,
        telephony: [pdf1, pdf2, pdf3]
      };

      const exampleConfig = {
        surgeryName: 'Example Surgery',
        population: 5600,
        useTelephony: true,
        useOnline: true
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

  const validateHeaders = (data, requiredColumns, fileName, forbiddenColumns = []) => {
    if (!data || data.length === 0) {
      throw new Error(`The file "${fileName}" appears to be empty.`);
    }
    const headers = Object.keys(data[0]);

    const missing = requiredColumns.filter(col => !headers.includes(col));
    if (missing.length > 0) {
      throw new Error(`The file "${fileName}" is missing required columns: ${missing.join(', ')}.`);
    }

    const foundForbidden = forbiddenColumns.filter(col => headers.some(h => h.toLowerCase().includes(col.toLowerCase())));
    if (foundForbidden.length > 0) {
      throw new Error(`PRIVACY ERROR: The file "${fileName}" contains disallowed columns: ${foundForbidden.join(', ')}. Please remove patient identifiable data.`);
    }
  };

  // --- Main Processing Logic ---
  const processFiles = async (customFiles = null, customConfig = null) => {
    setIsProcessing(true);
    setError(null);
    setProcessedData(null);
    setRawStaffData([]);
    setRawSlotData([]);
    setRawCombinedData([]);
    setForecastData(null);
    setRawOnlineData([]);

    const filesToProcess = customFiles || files;
    const configToUse = customConfig || config;

    let globalDNACount = 0;
    let globalGPDNACount = 0;
    let globalUnusedCount = 0;
    let globalGPUnusedCount = 0;

    try {
      if (!filesToProcess.appointments) throw new Error("Appointment CSV is required");

      const apptData = await parseCSV(filesToProcess.appointments);
      const dnaData = filesToProcess.dna ? await parseCSV(filesToProcess.dna) : [];
      const unusedData = filesToProcess.unused ? await parseCSV(filesToProcess.unused) : [];
      // Process online only if enabled and file exists
      const onlineData = (configToUse.useOnline && filesToProcess.onlineRequests) ? await parseCSV(filesToProcess.onlineRequests) : [];

      validateHeaders(apptData, ['Date', 'Day'], 'Appointments CSV');
      if (filesToProcess.dna) validateHeaders(dnaData, ['Staff', 'Appointment Count'], 'DNA CSV');
      if (filesToProcess.unused) validateHeaders(unusedData, ['Staff', 'Unused Slots', 'Total Slots'], 'Unused CSV');
      if (configToUse.useOnline && filesToProcess.onlineRequests) validateHeaders(onlineData, ['Submission started', 'Type', 'Outcome'], 'Online Requests CSV', ['Patient Name', 'Name', 'Patient', 'NHS Number']);

      let telephonyData = [];
      if (configToUse.useTelephony && filesToProcess.telephony && filesToProcess.telephony.length > 0) {
        for (const file of filesToProcess.telephony) {
          const text = await extractTextFromPDF(file);
          telephonyData.push({ filename: file.name, text });
        }
      }

      const months = {};
      const monthlyStaffMap = {};
      const monthlySlotMap = {};
      const monthlyCombinedMap = {};

      // REMOVED: onlineStatsData object - now calculating dynamically
      const processedOnlineRows = [];

      const getMonthKey = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleString('default', { month: 'short', year: 'numeric' });
      };

      const parseDateTime = (str) => {
        if (!str) return null;
        let d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        const parts = str.split(' ');
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
          return new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1] || '00:00'}`);
        }
        return null;
      };

      const isGP = (name) => {
        if (!name) return false;
        const n = name.trim();
        return n.includes('Dr') || n.toLowerCase().includes('locum');
      };

      const updateStaff = (month, name, type, value) => {
        if (!name) return;
        const key = `${month}_${name}`;
        if (!monthlyStaffMap[key]) {
          monthlyStaffMap[key] = { month, name, isGP: isGP(name), appts: 0, dna: 0, unused: 0 };
        }
        monthlyStaffMap[key][type] += value;
      };

      const updateSlot = (month, slotName, type, value, associatedStaffName) => {
        if (!slotName) return;
        const key = `${month}_${slotName}`;
        if (!monthlySlotMap[key]) {
          monthlySlotMap[key] = { month, name: slotName, hasGPActivity: false, appts: 0, dna: 0, unused: 0 };
        }
        monthlySlotMap[key][type] += value;
        if (associatedStaffName && isGP(associatedStaffName)) {
          monthlySlotMap[key].hasGPActivity = true;
        }
      };

      const updateCombined = (month, staffName, slotName, type, value) => {
        if (!staffName || !slotName) return;
        const key = `${month}_${staffName}_${slotName}`;
        if (!monthlyCombinedMap[key]) {
          monthlyCombinedMap[key] = {
            month,
            name: staffName,
            slot: slotName,
            isGP: isGP(staffName),
            appts: 0,
            dna: 0,
            unused: 0
          };
        }
        monthlyCombinedMap[key][type] += value;
      };

      // 1. Process Appointments
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
            onlineTotal: 0,
            onlineClinicalNoAppt: 0,
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

          months[monthKey].totalAppts += count;
          if (isGP(key)) {
            months[monthKey].gpAppts += count;
          } else {
            months[monthKey].staffAppts += count;
          }

          updateStaff(monthKey, key, 'appts', count);
          if (row['Slot Type']) {
            updateSlot(monthKey, row['Slot Type'], 'appts', count, key);
          }
        });
      });

      if (Object.keys(months).length === 0) {
        throw new Error("No valid data found. Please check the Date formatting in your Appointments CSV.");
      }

      const getMonthsForStaff = (name) => {
        return Object.values(monthlyStaffMap).filter(r => r.name === name).map(r => r.month);
      };

      // 2. Process DNA
      dnaData.forEach(row => {
        const count = parseInt(row['Appointment Count'], 10) || 0;
        const staffName = row['Staff'];
        const slotName = row['Slot Type'];
        globalDNACount += count;
        if (isGP(staffName)) globalGPDNACount += count;
        const workedMonths = getMonthsForStaff(staffName);
        if (workedMonths.length > 0) {
          const splitCount = count / workedMonths.length;
          workedMonths.forEach(m => {
            updateStaff(m, staffName, 'dna', splitCount);
            if (slotName) {
              updateSlot(m, slotName, 'dna', splitCount, staffName);
              updateCombined(m, staffName, slotName, 'dna', splitCount);
            }
          });
        } else {
          const firstMonth = Object.keys(months)[0];
          if (firstMonth) {
            updateStaff(firstMonth, staffName, 'dna', count);
            if (slotName) {
              updateSlot(firstMonth, slotName, 'dna', count, staffName);
              updateCombined(firstMonth, staffName, slotName, 'dna', count);
            }
          }
        }
      });

      // 3. Process Unused
      unusedData.forEach(row => {
        const count = parseInt(row['Unused Slots'], 10) || 0;
        const totalSlots = parseInt(row['Total Slots'], 10) || 0;
        const booked = Math.max(0, totalSlots - count);
        const staffName = row['Staff'];
        const slotName = row['Slot Type'];
        globalUnusedCount += count;
        if (isGP(staffName)) globalGPUnusedCount += count;
        const workedMonths = getMonthsForStaff(staffName);
        if (workedMonths.length > 0) {
          const splitCount = count / workedMonths.length;
          const splitBooked = booked / workedMonths.length;
          workedMonths.forEach(m => {
            updateStaff(m, staffName, 'unused', splitCount);
            if (slotName) {
              updateSlot(m, slotName, 'unused', splitCount, staffName);
              updateSlot(m, slotName, 'appts', splitBooked, staffName);
              updateCombined(m, staffName, slotName, 'unused', splitCount);
              updateCombined(m, staffName, slotName, 'appts', splitBooked);
            }
          });
        } else {
          const firstMonth = Object.keys(months)[0];
          if (firstMonth) {
            updateStaff(firstMonth, staffName, 'unused', count);
            if (slotName) {
              updateSlot(firstMonth, slotName, 'unused', count, staffName);
              updateSlot(firstMonth, slotName, 'appts', booked, staffName);
              updateCombined(firstMonth, staffName, slotName, 'unused', count);
              updateCombined(firstMonth, staffName, slotName, 'appts', booked);
            }
          }
        }
      });

      // 4. Process Online Requests
      if (configToUse.useOnline) {
        onlineData.forEach(row => {
          const dateStr = row['Submission started'] || row['Submitted'];
          const completeStr = row['Submission completed'];
          const outcomeStr = row['Outcome recorded'];
          const date = parseDateTime(dateStr);

          if (!date) return;

          const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });

          if (months[monthKey]) {
            months[monthKey].onlineTotal += 1;

            const type = row['Type'];
            const outcome = (row['Outcome'] || '').trim();
            const outcomeLower = outcome.toLowerCase();
            const access = row['Access method'];
            const sex = row['Sex'];
            const age = parseInt(row['Age'], 10);

            if (type === 'Clinical' && !outcomeLower.includes('appointment offered') && !outcomeLower.includes('appointment booked')) {
              months[monthKey].onlineClinicalNoAppt += 1;
            }

            // Store raw row with monthKey for dynamic filtering
            processedOnlineRows.push({
              month: monthKey,
              type,
              outcome,
              outcomeLower,
              access,
              sex,
              age: !isNaN(age) ? age : null,
              date,
              completeStr,
              outcomeStr
            });
          }
        });
      }

      // 5. Process Telephony
      if (configToUse.useTelephony) {
        telephonyData.forEach(item => {
          const text = item.text;
          const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s20\d{2}/i);
          if (monthMatch) {
            const pdfDate = new Date(monthMatch[0]);
            const monthKey = pdfDate.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (months[monthKey]) {
              const extract = (r) => { const m = text.match(r); return m && m[1] ? parseFloat(m[1].replace(/,/g, '')) : 0; };
              const extractTime = (r) => { const m = text.match(r); if (m) { let min = 0, sec = 0; if (m[1]) min = parseInt(m[1]); if (m[2]) sec = parseInt(m[2]); const fm = m[0]; const mm = fm.match(/(\d+)m/); const sm = fm.match(/(\d+)s/); if (mm) min = parseInt(mm[1]); if (sm) sec = parseInt(sm[1]); return (min * 60) + sec; } return 0; };
              const missedUniqueMatch = text.match(/Missed From Queue\s+Excluding Repeat Callers\s+[\d,]+\s+\(([\d.]+)%\)/i);
              months[monthKey].telephony = {
                inboundReceived: extract(/Inbound Received\s+([\d,]+)/i),
                inboundAnswered: extract(/Inbound Answered\s+([\d,]+)/i),
                missedFromQueue: extract(/Missed From Queue\s+([\d,]+)/i),
                missedFromQueueExRepeat: extract(/Missed From Queue\s+Excluding Repeat Callers\s+([\d,]+)/i),
                missedFromQueueExRepeatPct: missedUniqueMatch && missedUniqueMatch[1] ? parseFloat(missedUniqueMatch[1]) : 0,
                answeredFromQueue: extract(/Answered From Queue\s+[\d,]+\s+\(([\d.]+)%\)/i),
                abandonedCalls: extract(/Abandoned Calls\s+[\d,]+\s+\(([\d.]+)%\)/i),
                callbacksSuccessful: extract(/Callbacks Successful\s+([\d,]+)/i),
                avgQueueTimeAnswered: extractTime(/Average Queue Time\s+Answered\s+(\d+m\s\d+s|\d+s)/i),
                avgQueueTimeMissed: extractTime(/Average Queue Time\s+Missed\s+(\d+m\s\d+s|\d+s)/i),
                avgInboundTalkTime: extractTime(/Average Inbound Talk\s+Time\s+(\d+m\s\d+s|\d+s)/i),
              };
            }
          }
        });
      }

      const sortedMonths = Object.values(months).sort((a, b) => new Date(a.month) - new Date(b.month));
      const totalApptsAll = Object.values(months).reduce((s, m) => s + m.totalAppts, 0);
      const totalGPApptsAll = Object.values(months).reduce((s, m) => s + m.gpAppts, 0);

      const finalData = sortedMonths.map(m => {
        const weight = totalApptsAll > 0 ? m.totalAppts / totalApptsAll : 0;
        const gpWeight = totalGPApptsAll > 0 ? m.gpAppts / totalGPApptsAll : 0;
        const estDNA = Math.round(globalDNACount * weight);
        const estGPDNA = Math.round(globalGPDNACount * gpWeight);
        const estUnused = Math.round(globalUnusedCount * weight);
        const estGPUnused = Math.round(globalGPUnusedCount * gpWeight);

        const t = m.telephony || {};
        const population = parseFloat(configToUse.population) || 1;
        const capitationCalling = t.inboundAnswered ? ((t.inboundAnswered / population) * 100) : 0;

        const gpRatio = t.inboundAnswered > 0 ? (m.gpAppts / t.inboundAnswered) : 0;
        const gpMissedDemand = gpRatio * (t.missedFromQueueExRepeat || 0);
        const gpWaste = estGPUnused + estGPDNA;
        const extraSlots = m.workingDays > 0 ? ((gpMissedDemand - gpWaste) / m.workingDays) : 0;

        // Online Metrics
        const onlineRequestsPer1000 = ((m.onlineTotal / population) * 1000) / 4;
        const totalTriageCapacity = m.gpAppts + m.onlineClinicalNoAppt;
        const gpTriageCapacityPerDayPct = m.workingDays ? ((totalTriageCapacity / population * 100) / m.workingDays) : 0;

        return {
          month: m.month,
          workingDays: m.workingDays,
          totalAppts: m.totalAppts,
          gpAppts: m.gpAppts,
          conversionRatio: t.inboundAnswered ? (m.totalAppts / t.inboundAnswered) : 0,
          gpConversionRatio: t.inboundAnswered ? (m.gpAppts / t.inboundAnswered) : 0,
          utilization: (m.totalAppts + estUnused) > 0 ? (m.totalAppts / (m.totalAppts + estUnused) * 100) : 0,
          gpUtilization: (m.gpAppts + estGPUnused) > 0 ? (m.gpAppts / (m.gpAppts + estGPUnused) * 100) : 0,
          gpApptsPerDay: m.workingDays ? (m.gpAppts / population * 100) / m.workingDays : 0,
          gpUnusedPct: (m.gpAppts + estGPUnused) > 0 ? (estGPUnused / (m.gpAppts + estGPUnused) * 100) : 0,
          gpDNAPct: m.gpAppts > 0 ? (estGPDNA / m.gpAppts * 100) : 0,
          allApptsPerDay: m.workingDays ? (m.totalAppts / population * 100) / m.workingDays : 0,
          allUnusedPct: (m.totalAppts + estUnused) > 0 ? (estUnused / (m.totalAppts + estUnused) * 100) : 0,
          allDNAPct: m.totalAppts > 0 ? (estDNA / m.totalAppts * 100) : 0,

          // Online
          onlineTotal: m.onlineTotal,
          onlineClinicalNoAppt: m.onlineClinicalNoAppt,
          onlineRequestsPer1000,
          gpTriageCapacityPerDayPct,

          ...t,
          capitationCallingPerDay: m.workingDays ? (capitationCalling / m.workingDays) : 0,
          extraSlotsPerDay: extraSlots
        };
      });

      // Forecasting
      const apptArray = finalData.map(d => d.totalAppts);
      const callArray = finalData.map(d => d.inboundReceived || 0);
      let futureAppts = [], futureCalls = [], futureLabels = [];
      if (apptArray.length >= 3) {
        futureAppts = calculateLinearForecast(apptArray, 2);
        futureCalls = calculateLinearForecast(callArray, 2);
        const lastMonth = finalData[finalData.length - 1]?.month;
        futureLabels = getNextMonthNames(lastMonth, 2);
      }

      setForecastData(apptArray.length >= 3 ? {
        labels: [...finalData.map(d => d.month), ...futureLabels],
        appts: { actual: [...apptArray, null, null], projected: [...Array(apptArray.length - 1).fill(null), apptArray[apptArray.length - 1], ...futureAppts] },
        calls: { actual: [...callArray, null, null], projected: [...Array(callArray.length - 1).fill(null), callArray[callArray.length - 1], ...futureCalls] },
        hasData: true
      } : { hasData: false, count: apptArray.length });

      setProcessedData(finalData);
      setRawStaffData(Object.values(monthlyStaffMap));
      setRawSlotData(Object.values(monthlySlotMap));
      setRawCombinedData(Object.values(monthlyCombinedMap));
      setRawOnlineData(processedOnlineRows);
      // setOnlineStats(configToUse.useOnline ? onlineStatsData : null); // REMOVED

    } catch (err) {
      setError(err.message);
      setProcessedData(null);
      setRawStaffData([]);
      setRawSlotData([]);
      setRawCombinedData([]);
      setForecastData(null);
      console.error("Processing Failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Aggregated Data Helpers (Filtered) ---
  const getAggregatedData = useCallback((rawData) => {
    if (!rawData || rawData.length === 0) return [];
    const filtered = selectedMonth === 'All' ? rawData : rawData.filter(d => d.month === selectedMonth);
    const grouped = filtered.reduce((acc, curr) => {
      const key = curr.name + (curr.slot ? `_${curr.slot}` : '');
      if (!acc[key]) {
        acc[key] = { name: curr.name, slot: curr.slot || null, isGP: curr.isGP, hasGPActivity: curr.hasGPActivity || false, appts: 0, dna: 0, unused: 0 };
      }
      acc[key].appts += curr.appts; acc[key].dna += curr.dna; acc[key].unused += curr.unused;
      if (curr.hasGPActivity) acc[key].hasGPActivity = true;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.appts - a.appts);
  }, [selectedMonth]);

  const aggregatedStaffData = useMemo(() => getAggregatedData(rawStaffData), [getAggregatedData, rawStaffData]);
  const aggregatedSlotData = useMemo(() => getAggregatedData(rawSlotData), [getAggregatedData, rawSlotData]);
  const aggregatedCombinedData = useMemo(() => getAggregatedData(rawCombinedData), [getAggregatedData, rawCombinedData]);

  // --- Dynamic Online Stats ---
  const onlineStats = useMemo(() => {
    if (!config.useOnline || !rawOnlineData || rawOnlineData.length === 0) return null;

    const filtered = selectedMonth === 'All' ? rawOnlineData : rawOnlineData.filter(d => d.month === selectedMonth);

    if (filtered.length === 0) return null;

    const stats = {
      typeBreakdown: { Clinical: 0, Admin: 0 },
      accessMethod: {},
      sexSplit: {},
      outcomes: {},
      totalOfferedOrBooked: 0,
      totalResolved: 0,
      totalAge: 0,
      ageCount: 0,
      clinicalDurationTotal: 0,
      clinicalDurationCount: 0,
      adminDurationTotal: 0,
      adminDurationCount: 0
    };

    const parseDateTime = (str) => {
      if (!str) return null;
      let d = new Date(str);
      if (!isNaN(d.getTime())) return d;
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        return new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1] || '00:00'}`);
      }
      return null;
    };

    filtered.forEach(row => {
      const { type, outcome, outcomeLower, access, sex, age, completeStr, outcomeStr } = row;

      if (outcomeLower.includes('appointment offered') || outcomeLower.includes('appointment booked')) {
        stats.totalOfferedOrBooked++;
      } else {
        stats.totalResolved++;
      }

      if (type) stats.typeBreakdown[type] = (stats.typeBreakdown[type] || 0) + 1;
      if (access) stats.accessMethod[access] = (stats.accessMethod[access] || 0) + 1;
      if (sex) stats.sexSplit[sex] = (stats.sexSplit[sex] || 0) + 1;
      if (outcome) stats.outcomes[outcome] = (stats.outcomes[outcome] || 0) + 1;

      if (age !== null) {
        stats.totalAge += age;
        stats.ageCount++;
      }

      if (completeStr && outcomeStr) {
        const d1 = parseDateTime(completeStr);
        const d2 = parseDateTime(outcomeStr);
        if (d1 && d2) {
          const diffMs = d2 - d1;
          const diffHrs = diffMs / (1000 * 60 * 60);
          if (diffHrs >= 0 && diffHrs < 1000) {
            if (type === 'Clinical') {
              stats.clinicalDurationTotal += diffHrs;
              stats.clinicalDurationCount++;
            } else {
              stats.adminDurationTotal += diffHrs;
              stats.adminDurationCount++;
            }
          }
        }
      }
    });

    return stats;
  }, [rawOnlineData, selectedMonth, config.useOnline]);

  // --- AI Handler ---
  const fetchAIReport = async () => {
    const metricDefinitions = [
      {
        key: 'workingDays',
        title: 'Working days',
        description: 'Clinical working days available in the month',
        format: 'number'
      },
      {
        key: 'totalAppts',
        title: 'All appointments delivered',
        description: 'Total appointments completed across the practice',
        format: 'number'
      },
      {
        key: 'gpAppts',
        title: 'GP appointments delivered',
        description: 'Number of GP-led appointments completed',
        format: 'number'
      },
      {
        key: 'gpApptsPerDay',
        title: 'GP appointments per working day',
        description: 'Average GP appointments delivered per working day',
        format: 'decimal1'
      },
      {
        key: 'allApptsPerDay',
        title: 'All appointments per working day',
        description: 'Average total appointments delivered per working day',
        format: 'decimal1'
      },
      {
        key: 'utilization',
        title: 'Utilisation (all clinicians)',
        description: 'Percentage of all appointment slots used',
        format: 'percent1'
      },
      {
        key: 'gpUtilization',
        title: 'GP utilisation',
        description: 'Percentage of GP appointment slots used',
        format: 'percent1'
      },
      {
        key: 'gpUnusedPct',
        title: 'Unused GP capacity',
        description: 'Percentage of GP slots left unused after embargoes and DNA',
        format: 'percent1'
      },
      {
        key: 'gpDNAPct',
        title: 'GP DNA rate',
        description: 'Did-not-attend rate for GP appointments',
        format: 'percent1'
      },
      {
        key: 'allUnusedPct',
        title: 'Unused capacity (all clinicians)',
        description: 'Percentage of all clinician slots left unused',
        format: 'percent1'
      },
      {
        key: 'allDNAPct',
        title: 'DNA rate (all clinicians)',
        description: 'Did-not-attend rate for all clinicians',
        format: 'percent1'
      },
      {
        key: 'onlineTotal',
        title: 'Online requests received',
        description: 'Total online consultation requests submitted',
        format: 'number'
      },
      {
        key: 'onlineClinicalNoAppt',
        title: 'Online clinical requests without appointment',
        description: 'Clinical online requests resolved without booking an appointment',
        format: 'number'
      },
      {
        key: 'onlineRequestsPer1000',
        title: 'Online requests per 1,000 patients',
        description: 'Rate of online requests normalised by practice size',
        format: 'decimal1'
      },
      {
        key: 'gpTriageCapacityPerDayPct',
        title: 'Patients with a GP appointment or resolved online request per day (%)',
        description: 'Percentage of registered patients per working day who either had a GP appointment or had their online request resolved without an appointment',
        format: 'percent2'
      },
      {
        key: 'inboundReceived',
        title: 'Inbound calls received',
        description: 'Total inbound calls presented to the phone system',
        format: 'number'
      },
      {
        key: 'inboundAnswered',
        title: 'Inbound calls answered',
        description: 'Number of inbound calls answered by the team',
        format: 'number'
      },
      {
        key: 'missedFromQueue',
        title: 'Calls missed from queue',
        description: 'Total calls abandoned from the queue',
        format: 'number'
      },
      {
        key: 'missedFromQueueExRepeat',
        title: 'Missed calls excluding repeats',
        description: 'Unique callers who abandoned the queue (excludes repeat callers)',
        format: 'number'
      },
      {
        key: 'missedFromQueueExRepeatPct',
        title: 'Missed call rate (unique)',
        description: 'Percentage of unique callers who abandoned the queue',
        format: 'percent1'
      },
      {
        key: 'answeredFromQueue',
        title: 'Calls answered from queue',
        description: 'Calls successfully answered after waiting in queue',
        format: 'number'
      },
      {
        key: 'abandonedCalls',
        title: 'Callback abandoned',
        description: 'Callbacks that were not connected after being requested',
        format: 'number'
      },
      {
        key: 'callbacksSuccessful',
        title: 'Callbacks successful',
        description: 'Callbacks that successfully connected to a patient',
        format: 'number'
      },
      {
        key: 'avgQueueTimeAnswered',
        title: 'Average queue time (answered)',
        description: 'Average seconds callers waited before being answered',
        format: 'seconds'
      },
      {
        key: 'avgQueueTimeMissed',
        title: 'Average queue time (missed)',
        description: 'Average seconds callers waited before abandoning',
        format: 'seconds'
      },
      {
        key: 'avgInboundTalkTime',
        title: 'Average inbound talk time',
        description: 'Average call handling time for inbound calls (seconds)',
        format: 'seconds'
      },
      {
        key: 'capitationCallingPerDay',
        title: 'Daily call volume per 1,000 patients',
        description: 'Average daily inbound calls per 1,000 registered patients',
        format: 'percent1'
      },
      {
        key: 'conversionRatio',
        title: 'Booking conversion (all)',
        description: 'Ratio of calls that resulted in any appointment booking',
        format: 'decimal2'
      },
      {
        key: 'gpConversionRatio',
        title: 'Booking conversion (GP)',
        description: 'Ratio of calls that resulted in a GP appointment booking',
        format: 'decimal2'
      },
      {
        key: 'extraSlotsPerDay',
        title: 'Extra slots released per day',
        description: 'Average number of extra slots added daily to meet demand',
        format: 'decimal1'
      }
    ];

    const formatMetricValue = (value, format) => {
      if (value === undefined || value === null || Number.isNaN(value)) return null;

      switch (format) {
        case 'percent1':
          return `${Number(value).toFixed(1)}%`;
        case 'percent2':
          return `${Number(value).toFixed(2)}%`;
        case 'decimal2':
          return Number(value).toFixed(2);
        case 'decimal1':
          return Number(value).toFixed(1);
        case 'seconds':
          return `${Number(value).toFixed(0)} seconds`;
        default:
          return Number(value);
      }
    };

    const dataSummary = displayedData.map(d => ({
      month: d.month,
      metrics: metricDefinitions
        .map(metric => ({
          title: metric.title,
          description: metric.description,
          value: formatMetricValue(d[metric.key], metric.format)
        }))
        .filter(metric => metric.value !== null)
    }));

    const prompt = `
        You are an expert NHS Practice Manager and Data Analyst using CAIP Analytics.
        Analyse the following monthly performance data.

        Each metric includes a title and description to avoid ambiguity. Base all interpretations on these fields, not the raw field names.

        Data (month by month): ${JSON.stringify(dataSummary, null, 2)}

        Please provide a concise report in exactly these two sections using bullet points:

        ### ✅ Positives
        * Highlight metrics that are performing well.

        ### 🚀 Room for Improvement & Actions
        * Identify specific issues.
        * Logic:
            * If **Online Requests** are high but **Patients with a GP appointment or resolved online request per day (%)** is low, suggest: "High digital demand is not being fully captured in clinical workload data."
            * If **Booking Conversion** is low, suggest: "High call volume not converting to appts. Review signposting."
            * If **Utilization** is low (<95%), suggest: "Wasted capacity. Review embargoes."
            * Apply additional best-practice logic from NHS UK access improvement guidance when proposing actions.

        Keep the tone professional, constructive, and specific to NHS Primary Care. Use British English.
    `;

    const ai = new GoogleGenAI({ apiKey });

    // Updated: Properly structured contents for new SDK
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });

    // Updated: Correct response parsing for new SDK (no .text() function)
    return response.candidates?.[0]?.content?.parts?.[0]?.text;
  };

  const generateAIInsights = async () => {
    if (!displayedData || displayedData.length === 0) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const text = await fetchAIReport();
      if (text) setAiReport(text); else throw new Error('No insight generated');
    } catch (e) {
      setAiError(`AI Error: ${e.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!aiReport) {
      setIsAiLoading(true);
      try {
        const text = await fetchAIReport();
        setAiReport(text);
        // Small delay to allow React to render the AI report into the DOM before printing
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error("AI fail", e);
      } finally {
        setIsAiLoading(false);
      }
    }
    window.print();
  };

  const displayedData = useMemo(() => {
    if (!processedData) return null;
    if (selectedMonth === 'All') return processedData;
    return processedData.filter(d => d.month === selectedMonth);
  }, [processedData, selectedMonth]);

  const availableMonths = useMemo(() => {
    if (!processedData) return [];
    return ['All', ...processedData.map(d => d.month)];
  }, [processedData]);

  const commonOptions = { responsive: true, maintainAspectRatio: false, layout: { padding: 20 }, plugins: { legend: { position: 'bottom' }, tooltip: { backgroundColor: 'rgba(255, 255, 255, 0.9)', titleColor: '#1e293b', bodyColor: '#475569', borderColor: '#e2e8f0', borderWidth: 1, padding: 12, boxPadding: 6 } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } }, elements: { line: { tension: 0.4 }, point: { radius: 4, hoverRadius: 6 } } };
  const pdfChartOptions = { ...commonOptions, animation: false };

  const percentageOptions = { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, ticks: { color: '#64748b', callback: (v) => `${Number(v).toFixed(2)}%` } } } };
  const pdfPercentageOptions = { ...percentageOptions, animation: false };

  const onlineRequestBandOptions = { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0 } }, plugins: { ...commonOptions.plugins, backgroundBands: { bands: [{ from: 0, to: 5.0, color: GP_BAND_RED }, { from: 5.0, to: 100, color: GP_BAND_GREEN }] } } };

  const gpBandOptions = { ...percentageOptions, scales: { ...percentageOptions.scales, y: { ...percentageOptions.scales.y, min: 0, suggestedMax: 1.6 } }, plugins: { ...percentageOptions.plugins, backgroundBands: { bands: [{ from: 0, to: 0.85, color: GP_BAND_RED }, { from: 0.85, to: 1.10, color: GP_BAND_AMBER }, { from: 1.10, to: 1.30, color: GP_BAND_GREEN }, { from: 1.30, to: 5.00, color: GP_BAND_BLUE }] } } };
  const pdfGpBandOptions = { ...gpBandOptions, animation: false };

  const stackedPercentageOptions = { ...percentageOptions, scales: { x: { ...commonOptions.scales.x, stacked: true }, y: { ...percentageOptions.scales.y, stacked: true, max: 100 } } };
  const pdfStackedPercentageOptions = { ...stackedPercentageOptions, animation: false };
  const ratioOptions = { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, ticks: { color: '#64748b', callback: (v) => Number(v).toFixed(2) } } } };
  const pdfRatioOptions = { ...ratioOptions, animation: false };
  const utilizationOptions = { ...percentageOptions, scales: { ...percentageOptions.scales, y: { ...percentageOptions.scales.y, min: 0, max: 100 } } };
  const pdfUtilizationOptions = { ...utilizationOptions, animation: false };
  const timeOptions = { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, ticks: { color: '#64748b', callback: (v) => `${Math.floor(v / 60)}m ${v % 60}s` } } } };
  const pdfTimeOptions = { ...timeOptions, animation: false };

  // Helper for Donut/Pie charts
  const createDonutData = (dataMap, colors) => {
    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);
    const total = values.reduce((acc, val) => acc + val, 0);
    const percentages = values.map(value => ((value / total) * 100).toFixed(1) + "%");

    return {
      labels: labels.map((l, i) => `${l} (${percentages[i]})`),
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0
      }]
    };
  };
  const donutOptions = { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } };

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

  const createForecastChartData = (labelActual, labelProjected, dataObj, color) => ({
    labels: forecastData?.labels,
    datasets: [
      {
        label: labelActual,
        data: forecastData ? dataObj.actual : [],
        borderColor: color,
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: labelProjected,
        data: forecastData ? dataObj.projected : [],
        borderColor: color,
        borderDash: [5, 5], // Dotted line for forecast
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 4
      }
    ]
  });

  const FileInput = ({ label, helpText, accept, onChange, file, badge, disabled, onRemove, isMulti }) => {
    const hasFile = isMulti ? (file && file.length > 0) : !!file;

    return (
      <div className={`mb-6 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex justify-between items-baseline mb-2">
          <label className="block text-sm font-bold text-slate-700">{label}</label>
          {badge && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-semibold">{badge}</span>}
        </div>
        {helpText && <p className="text-xs text-slate-500 mb-3">{helpText}</p>}

        <div className="space-y-3">
          {/* Existing Files Display */}
          {hasFile && (
            <div className="space-y-2">
              {isMulti ? (
                file.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm group hover:border-blue-300 transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                        <FileText size={18} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate">{f.name}</span>
                    </div>
                    <button
                      onClick={() => onRemove(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg shadow-sm ring-1 ring-green-500/20">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                      <CheckCircle size={18} />
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={onRemove}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload Area - Always show for multi, or if no file for single */}
          {(isMulti || !hasFile) && (
            <label className="block cursor-pointer group">
              <div className={`flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed rounded-xl transition-all ${isMulti && hasFile ? 'border-slate-300 bg-slate-50 hover:bg-white' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                <input type="file" className="hidden" accept={accept} onChange={onChange} multiple={isMulti} disabled={disabled} />
                <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-blue-600 transition-colors">
                  {isMulti && hasFile ? <Plus size={24} /> : <Upload size={24} />}
                  <span className="text-sm font-medium">
                    {isMulti && hasFile ? 'Add another file' : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {isMulti ? 'Supports multiple files' : 'Single file upload'}
                  </span>
                </div>
              </div>
            </label>
          )}
        </div>
      </div>
    );
  };

  // Define headers based on filter state
  const isFiltered = selectedMonth !== 'All';
  const unusedHeader = isFiltered ? 'Unused Slots (Est. Monthly)' : 'Unused Slots';
  const dnaHeader = isFiltered ? 'DNAs (Est. Monthly)' : 'DNAs';
  const seasonalWarning = isFiltered ? <p className="text-xs text-amber-600 mb-3 italic flex items-center gap-1"><Info size={12} />* Monthly averages shown. Exact dates are not available in DNA/Unused CSVs.</p> : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm/50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src={logo} alt="CAIP Logo" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">CAIP Analytics <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full align-middle ml-2">{APP_VERSION}</span></h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:block">Free data analytics to help you improve capacity and access in primary care</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowProcessingInfo(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm"
            >
              <Info size={16} />
              <span className="hidden sm:inline">How it works</span>
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
            <div className="hidden lg:flex items-center gap-3 bg-white dark:bg-slate-700 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Made in</span>
              <a href="https://www.rushcliffehealth.org" target="_blank" rel="noopener noreferrer">
                <img src={rushcliffeLogo} alt="Rushcliffe PCN" className="h-8 w-auto grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100" />
              </a>
              <a href="https://www.nottinghamwestpcn.co.uk" target="_blank" rel="noopener noreferrer">
                <img src={nottsWestLogo} alt="Nottingham West PCN" className="h-8 w-auto grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100" />
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
                  onClick={() => setShowResetConfirm(true)}
                  className="text-slate-500 hover:text-red-600 transition-colors text-xs font-medium"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:hidden">
        {!processedData && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                  <Activity size={32} />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Let's analyse your demand and capacity</h2>
              <p className="text-slate-500">Upload your TPP SystmOne extracts (no patient data required) and X-on Surgery Connect management reports to get started.</p>
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
                    onChange={e => setConfig({ ...config, surgeryName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Patient Population</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    value={config.population}
                    onChange={e => setConfig({ ...config, population: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="telephony" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={config.useTelephony} onChange={e => setConfig({ ...config, useTelephony: e.target.checked })} />
                    <label htmlFor="telephony" className="text-sm text-slate-700 font-medium">Analyse Telephony Data</label>
                  </div>
                  {!config.useTelephony && <p className="text-xs text-amber-600 mt-1 ml-6">Dashboard will be incomplete without call data.</p>}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="online" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" checked={config.useOnline} onChange={e => setConfig({ ...config, useOnline: e.target.checked })} />
                    <label htmlFor="online" className="text-sm text-slate-700 font-medium">Analyse Online Requests</label>
                  </div>
                  {!config.useOnline && <p className="text-xs text-amber-600 mt-1 ml-6">Digital capacity metrics will not be shown.</p>}
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader title="Data Uploads" subtitle="Ensure date ranges match across files." />

              <FileInput
                label="Appointment Extract (CSV) *"
                accept=".csv"
                file={files.appointments}
                onChange={(e) => setFiles({ ...files, appointments: e.target.files[0] })}
                onRemove={() => setFiles({ ...files, appointments: null })}
              />
              <FileInput
                label="DNA Extract (CSV) *"
                helpText="(Must tick staff name and slot type in SystmOne)"
                accept=".csv"
                file={files.dna}
                onChange={(e) => setFiles({ ...files, dna: e.target.files[0] })}
                onRemove={() => setFiles({ ...files, dna: null })}
              />
              <FileInput
                label="Unused Extract (CSV) *"
                helpText="(Must tick staff name and slot type in SystmOne)"
                accept=".csv"
                file={files.unused}
                onChange={(e) => setFiles({ ...files, unused: e.target.files[0] })}
                onRemove={() => setFiles({ ...files, unused: null })}
              />
              <FileInput
                label="Online Requests (CSV) - SystmConnect"
                helpText="Misc Reports -> SystmConnect Report (Remove Patient Name column)"
                accept=".csv"
                file={files.onlineRequests}
                onChange={(e) => setFiles({ ...files, onlineRequests: e.target.files[0] })}
                onRemove={() => setFiles({ ...files, onlineRequests: null })}
                badge="Accurx Coming Soon"
                disabled={!config.useOnline}
              />

              <FileInput
                label="Telephony Reports (PDF) *"
                helpText="(Simply upload your X-on Surgery Connect Monthly Management Reports - only summary data is used)"
                accept="application/pdf"
                file={files.telephony}
                isMulti={true}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFiles(prev => ({ ...prev, telephony: [...prev.telephony, ...Array.from(e.target.files)] }));
                  }
                }}
                onRemove={(index) => {
                  setFiles(prev => ({ ...prev, telephony: prev.telephony.filter((_, i) => i !== index) }));
                }}
                disabled={!config.useTelephony}
              />

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
          <div className="animate-in fade-in duration-700" id="dashboard-content">
            <div className="hidden print:block mb-8 text-center">
              <h1 className="text-3xl font-bold text-slate-900">CAIP Analysis - {config.surgeryName || 'Surgery Report'}</h1>
              <p className="text-slate-500">Generated on {new Date().toLocaleDateString()}</p>
            </div>

            {aiReport && (
              <Card className="mb-8 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 animate-in slide-in-from-top-4 duration-500 shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-indigo-900">CAIP Analysis</h3>
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

            {/* ACTION BUTTONS: Centered above tabs */}
            <div className="flex justify-center gap-4 mb-6" data-html2canvas-ignore="true">
              {/* 1. CAIP Analysis Button */}
              <button
                onClick={generateAIInsights}
                disabled={isAiLoading}
                className="group relative inline-flex items-center justify-center px-8 py-3 overflow-hidden rounded-full bg-slate-900 font-medium text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-purple-500/50 disabled:opacity-70"
              >
                <span className="absolute inset-0 h-full w-full bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 opacity-100 transition-all duration-300 group-hover:from-purple-500 group-hover:via-indigo-500 group-hover:to-purple-600"></span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full"></span>
                <span className="absolute inset-0 rounded-full border border-white/20"></span>
                <span className="relative flex items-center gap-2">
                  {isAiLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="animate-pulse" />}
                  <span className="font-bold tracking-wide">
                    C<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 animate-pulse">AI</span>P Analysis
                  </span>
                </span>
              </button>

              {/* 2. Print Report Button */}
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-70"
              >
                <Download size={18} />
                <span className="font-semibold">Print Report</span>
              </button>
            </div>

            <div className="flex justify-center mb-8" data-html2canvas-ignore="true">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                {[
                  { id: 'dashboard', label: 'Overview', icon: Activity },
                  { id: 'gp', label: 'GP Metrics', icon: Users },
                  ...(config.useOnline && onlineStats ? [{ id: 'online', label: 'Online', icon: Monitor }] : []), // Conditional Tab
                  ...(config.useTelephony ? [{ id: 'telephony', label: 'Telephony', icon: Phone }] : []), // Conditional Tab
                  { id: 'forecast', label: 'Forecast', icon: Calendar }
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

            {/* --- VISIBLE CONTENT (Interactive) --- */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MetricCard
                    title="Total Appointments"
                    value={displayedData.reduce((a, b) => a + (b.totalAppts || 0), 0).toLocaleString()}
                    subtext={selectedMonth === 'All' ? `Over ${processedData.length} months` : selectedMonth}
                    icon={Calendar}
                    color="text-blue-600"
                  />
                  <MetricCard
                    title="Total Online Requests"
                    value={displayedData.reduce((a, b) => a + (b.onlineTotal || 0), 0).toLocaleString()}
                    subtext="All request types"
                    icon={Monitor}
                    color="text-teal-600"
                  />
                  <MetricCard
                    title="Avg Inbound Calls"
                    value={Math.round(displayedData.reduce((a, b) => a + (b.inboundReceived || 0), 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toLocaleString()}
                    subtext="Per month"
                    icon={Phone}
                    color="text-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="h-80 lg:col-span-1">
                    <h3 className="font-bold text-slate-700 mb-4">Appointment Trends</h3>
                    <Line data={createChartData('Total Appointments', 'totalAppts', NHS_BLUE)} options={commonOptions} />
                  </Card>
                  <Card className="h-80">
                    <h3 className="font-bold text-slate-700 mb-2">Online Request Rate</h3>
                    <p className="text-xs text-slate-400 mb-4">Requests per 1000 patients per week</p>
                    <Line data={createChartData('Requests/1000/wk', 'onlineRequestsPer1000', NHS_AQUA, false)} options={onlineRequestBandOptions} />
                  </Card>
                </div>

                <Accordion title="Staff Breakdown (All Staff)" icon={Users}>
                  {seasonalWarning}
                  {aggregatedStaffData && (
                    <SortableTable
                      data={aggregatedStaffData}
                      columns={[
                        { header: 'Name', accessor: 'name' },
                        { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                        { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                        { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                      ]}
                    />
                  )}
                </Accordion>

                <Accordion title="Slot Type Breakdown (All Slots)" icon={Activity}>
                  {seasonalWarning}
                  {aggregatedSlotData && (
                    <SortableTable
                      data={aggregatedSlotData}
                      searchPlaceholder="Search slot type..."
                      columns={[
                        { header: 'Slot Type', accessor: 'name' },
                        { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                        { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                        { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                      ]}
                    />
                  )}
                </Accordion>

                <Accordion title="Staff & Slot Performance" icon={User}>
                  {seasonalWarning}
                  {aggregatedCombinedData && (
                    <SortableTable
                      data={aggregatedCombinedData}
                      searchPlaceholder="Search staff or slot..."
                      columns={[
                        { header: 'Name', accessor: 'name' },
                        { header: 'Slot Type', accessor: 'slot', render: (row) => row.slot || '-' },
                        { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                        { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                        { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                      ]}
                    />
                  )}
                </Accordion>
              </div>
            )}

            {activeTab === 'gp' && (
              <div className="space-y-6">
                <Card className="h-96 border-2 border-teal-100 shadow-md bg-gradient-to-br from-white to-teal-50/30">
                  <h3 className="font-bold text-slate-800 mb-2 text-lg flex items-center gap-2"><Activity className="text-teal-600" size={24} /> Patients with GP Appointment or Resolved Online Request per Day (%)</h3>
                  <p className="text-sm text-slate-500 mb-4">Percentage of registered patients each working day who either attended a GP appointment or had their online request resolved without needing one.</p>
                  <div className="h-72">
                    <Line data={createChartData('GP appointment or online resolve per day (%)', 'gpTriageCapacityPerDayPct', NHS_AQUA, false)} options={gpBandOptions} />
                  </div>
                </Card>

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
                  {seasonalWarning}
                  {aggregatedStaffData && (
                    <SortableTable
                      data={aggregatedStaffData.filter(s => s.isGP)}
                      columns={[
                        { header: 'GP Name', accessor: 'name' },
                        { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                        { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                        { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                      ]}
                    />
                  )}
                </Accordion>

                <Accordion title="GP Slot Type Breakdown" icon={Activity}>
                  {seasonalWarning}
                  {aggregatedSlotData && (
                    <SortableTable
                      data={aggregatedSlotData.filter(s => s.hasGPActivity)}
                      searchPlaceholder="Search slot type..."
                      columns={[
                        { header: 'Slot Type', accessor: 'name' },
                        { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                        { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                        { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                      ]}
                    />
                  )}
                </Accordion>

                <Accordion title="GP Staff & Slot Performance" icon={User}>
                  {seasonalWarning}
                  {aggregatedCombinedData && (
                    <SortableTable
                      data={aggregatedCombinedData.filter(s => s.isGP)}
                      searchPlaceholder="Search GP or slot..."
                      columns={[
                        { header: 'Name', accessor: 'name' },
                        { header: 'Slot Type', accessor: 'slot', render: (row) => row.slot || '-' },
                        { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                        { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                        { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                      ]}
                    />
                  )}
                </Accordion>
              </div>
            )}

            {/* NEW ONLINE TAB */}
            {activeTab === 'online' && onlineStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card className="p-4 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase">Offered/Booked Appt</p>
                    <h3 className="text-2xl font-bold text-blue-600">{onlineStats.totalOfferedOrBooked.toLocaleString()}</h3>
                  </Card>
                  <Card className="p-4 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase">Digital Resolve</p>
                    <h3 className="text-2xl font-bold text-green-600">{onlineStats.totalResolved.toLocaleString()}</h3>
                  </Card>
                  <Card className="p-4 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase">Avg Requests/Month</p>
                    <h3 className="text-2xl font-bold text-indigo-600">{Math.round(displayedData.reduce((a, b) => a + (b.onlineTotal || 0), 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toLocaleString()}</h3>
                  </Card>
                  <Card className="p-4 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase">Avg Patient Age</p>
                    <h3 className="text-2xl font-bold text-amber-600">{onlineStats.ageCount ? Math.round(onlineStats.totalAge / onlineStats.ageCount) : 0} yrs</h3>
                  </Card>
                  <Card className="p-4 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase">Avg Time (Clin vs Admin)</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs"><span>Clinical:</span> <span className="font-bold text-purple-600">{onlineStats.clinicalDurationCount ? (onlineStats.clinicalDurationTotal / onlineStats.clinicalDurationCount).toFixed(1) : 0}h</span></div>
                      <div className="flex justify-between text-xs"><span>Admin:</span> <span className="font-bold text-slate-600">{onlineStats.adminDurationCount ? (onlineStats.adminDurationTotal / onlineStats.adminDurationCount).toFixed(1) : 0}h</span></div>
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="h-64">
                    <h3 className="font-bold text-slate-700 mb-4">Request Type</h3>
                    <div className="h-48 relative">
                      <Doughnut data={createDonutData(onlineStats.typeBreakdown, [NHS_BLUE, NHS_AMBER])} options={donutOptions} />
                    </div>
                  </Card>
                  <Card className="h-64">
                    <h3 className="font-bold text-slate-700 mb-4">Access Method</h3>
                    <div className="h-48 relative">
                      <Doughnut data={createDonutData(onlineStats.accessMethod, [NHS_GREEN, NHS_PURPLE, NHS_AQUA])} options={donutOptions} />
                    </div>
                  </Card>
                  <Card className="h-64">
                    <h3 className="font-bold text-slate-700 mb-4">Patient Sex</h3>
                    <div className="h-48 relative">
                      <Doughnut data={createDonutData(onlineStats.sexSplit, [NHS_BLUE, NHS_PINK])} options={donutOptions} />
                    </div>
                  </Card>
                </div>

                <Card className="h-96">
                  <h3 className="font-bold text-slate-800 mb-4">Outcome Breakdown</h3>
                  <Bar
                    data={{
                      labels: Object.keys(onlineStats.outcomes),
                      datasets: [{
                        label: 'Count',
                        data: Object.values(onlineStats.outcomes),
                        backgroundColor: NHS_AQUA,
                        borderRadius: 4
                      }]
                    }}
                    options={{
                      ...commonOptions,
                      indexAxis: 'y', // Horizontal Bar Chart
                      scales: { x: { beginAtZero: true } }
                    }}
                  />
                </Card>
              </div>
            )}

            {activeTab === 'online' && !onlineStats && (
              <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                <Monitor size={48} className="mx-auto mb-4 opacity-50" />
                <p>No Online Request data uploaded.</p>
                <p className="text-sm mt-2">Upload a SystmConnect extract to see these metrics.</p>
              </div>
            )}

            {activeTab === 'telephony' && (
              <div className="space-y-6">
                {!config.useTelephony ? ( // Fixed condition logic
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
                        { l: 'Avg Wait', k: 'avgQueueTimeAnswered', c: 'text-slate-600', fmt: v => `${Math.floor(v / 60)}m ${v % 60}s` }
                      ].map((m, i) => (
                        <Card key={i} className="p-4 border border-slate-200 shadow-none bg-slate-50">
                          <p className="text-xs font-bold text-slate-400 uppercase">{m.l}</p>
                          <p className={`text-xl font-bold ${m.c} mt-1`}>
                            {m.fmt ? m.fmt(displayedData[displayedData.length - 1][m.k]) :
                              `${displayedData[displayedData.length - 1][m.k].toLocaleString()}${m.suffix || ''}`}
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
                    }} options={pdfChartOptions} />
                  </div>
                  <div className="mt-6 bg-slate-50 p-4 rounded-xl text-sm text-slate-600">
                    <p className="font-semibold mb-2 flex items-center gap-2"><Info size={16} /> How is this calculated?</p>
                    <p className="mb-2">
                      We take the demand hidden in missed calls (extrapolated using your booking ratio) and subtract your wasted GP capacity (DNAs and Unused slots).
                    </p>
                    <code className="block bg-slate-100 p-2 rounded border border-slate-200 text-xs font-mono">
                      ( (GPAppts/AnsweredRatio × MissedCalls) - (GPUnused + GPDNA) ) ÷ WorkingDays
                    </code>
                  </div>
                </Card>
                {forecastData && forecastData.hasData && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-700 mb-4 mt-8">Future Trends (Next 2 Months)</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createForecastChartData('Actual Appointments', 'Forecast Trend', forecastData.appts, NHS_BLUE)} options={pdfChartOptions} /></div>
                      <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createForecastChartData('Actual Calls', 'Forecast Trend', forecastData.calls, NHS_PURPLE)} options={pdfChartOptions} /></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- HIDDEN PRINT CONTAINER --- */}
            <div id="pdf-report-container" className="hidden print:block bg-white w-full">

              <div id="pdf-title-page" className="flex flex-col items-center justify-center min-h-screen p-20 text-center bg-slate-50 break-after-page">
                <img src={logo} className="w-32 h-32 mb-8 rounded-xl shadow-lg" />
                <h1 className="text-6xl font-bold text-slate-900 mb-4">CAIP Analysis Report</h1>
                <h2 className="text-4xl text-blue-600 font-medium mb-12">{config.surgeryName || 'Surgery Report'}</h2>
                <p className="text-slate-500 text-xl">Generated on {new Date().toLocaleDateString()}</p>

                {aiReport && (
                  <div className="mt-12 text-left bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
                    <h3 className="text-2xl font-bold text-indigo-900 mb-4 flex items-center gap-2"><Sparkles className="text-indigo-500" /> CAIP Analysis Summary</h3>
                    <div className="prose prose-lg max-w-none text-slate-700">
                      <SimpleMarkdown text={aiReport} />
                    </div>
                  </div>
                )}
              </div>

              <div id="pdf-overview-section" className="p-10 space-y-8 break-after-page">
                <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">1. Practice Overview</h2>
                <div className="grid grid-cols-3 gap-6">
                  <MetricCard title="Total Appointments" value={displayedData.reduce((a, b) => a + b.totalAppts, 0).toLocaleString()} icon={Calendar} color="text-blue-600" />
                  <MetricCard title="Avg Inbound Calls" value={Math.round(displayedData.reduce((a, b) => a + b.inboundReceived, 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toLocaleString()} icon={Phone} color="text-indigo-600" />
                  <MetricCard title="Avg DNA Rate" value={`${(displayedData.reduce((a, b) => a + b.allDNAPct, 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toFixed(2)}%`} icon={XCircle} color="text-red-500" />
                </div>
                <div className="h-96 border border-slate-200 rounded-xl p-4"><Line data={createChartData('Total Appointments', 'totalAppts', NHS_BLUE)} options={pdfChartOptions} /></div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">Full Staff Breakdown</h3>
                  <SortableTable
                    data={aggregatedStaffData}
                    columns={[
                      { header: 'Name', accessor: 'name' },
                      { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                      { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                      { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                    ]}
                    isPrint={true}
                  />
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">Slot Type Breakdown</h3>
                  <SortableTable
                    data={aggregatedSlotData}
                    columns={[
                      { header: 'Slot Type', accessor: 'name' },
                      { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                      { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                      { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                    ]}
                    isPrint={true}
                  />
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">Staff & Slot Performance</h3>
                  <SortableTable
                    data={aggregatedCombinedData}
                    columns={[
                      { header: 'Name', accessor: 'name' },
                      { header: 'Slot Type', accessor: 'slot', render: (row) => row.slot || '-' },
                      { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                      { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                      { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                    ]}
                    isPrint={true}
                  />
                </div>
              </div>

              <div id="pdf-gp-section" className="p-10 space-y-8 break-after-page">
                <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">2. GP Metrics</h2>
                <div className="h-96 border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-800 mb-2 text-lg">Patients with GP Appointment or Resolved Online Request per Day (%)</h3><Line data={createChartData('GP appointment or online resolve per day (%)', 'gpTriageCapacityPerDayPct', NHS_AQUA, true)} options={pdfGpBandOptions} /></div>
                <div className="h-96 border border-slate-200 rounded-xl p-4 mt-6"><h3 className="font-bold text-slate-800 mb-2 text-lg">Patients with GP Appointment (%)</h3><Line data={createChartData('GP Appts %', 'gpApptsPerDay', NHS_DARK_BLUE, false)} options={pdfGpBandOptions} /></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createChartData('Utilisation %', 'gpUtilization', NHS_GREEN)} options={pdfUtilizationOptions} /></div>
                  <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createChartData('GP Conversion Ratio', 'gpConversionRatio', NHS_PURPLE)} options={pdfRatioOptions} /></div>
                </div>
                <div className="grid grid-cols-3 gap-6 mt-6">
                  <div className="h-64 border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">GP Unused Slots</h3><div className="h-40"><Line data={createChartData('GP Unused %', 'gpUnusedPct', NHS_GREEN)} options={pdfPercentageOptions} /></div></div>
                  <div className="h-64 border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">GP DNA Rate</h3><div className="h-40"><Line data={createChartData('GP DNA %', 'gpDNAPct', NHS_RED)} options={pdfPercentageOptions} /></div></div>
                  <div className="h-64 border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-sm uppercase">GP Appointments</h3><div className="h-40"><Bar data={{ labels: displayedData.map(d => d.month), datasets: [{ label: 'GP Appointments', data: displayedData.map(d => d.gpAppts), backgroundColor: NHS_BLUE }] }} options={pdfChartOptions} /></div></div>
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">GP Staff Performance</h3>
                  <SortableTable
                    data={aggregatedStaffData.filter(s => s.isGP)}
                    columns={[
                      { header: 'GP Name', accessor: 'name' },
                      { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                      { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                      { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                    ]}
                    isPrint={true}
                  />
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">GP Slot Type Breakdown</h3>
                  <SortableTable
                    data={aggregatedSlotData.filter(s => s.hasGPActivity)}
                    columns={[
                      { header: 'Slot Type', accessor: 'name' },
                      { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                      { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                      { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                    ]}
                    isPrint={true}
                  />
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">GP Staff & Slot Performance</h3>
                  <SortableTable
                    data={aggregatedCombinedData.filter(s => s.isGP)}
                    columns={[
                      { header: 'Name', accessor: 'name' },
                      { header: 'Slot Type', accessor: 'slot', render: (row) => row.slot || '-' },
                      { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                      { header: unusedHeader, accessor: 'unused', render: (row) => `${Math.round(row.unused).toLocaleString()} (${((row.unused / (row.appts + row.unused || 1)) * 100).toFixed(1)}%)` },
                      { header: dnaHeader, accessor: 'dna', render: (row) => `${Math.round(row.dna).toLocaleString()} (${((row.dna / (row.appts || 1)) * 100).toFixed(1)}%)` }
                    ]}
                    isPrint={true}
                  />
                </div>
              </div>

              {config.useOnline && onlineStats && (
                <div id="pdf-online-section" className="p-10 space-y-8 break-after-page">
                  <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">3. Online Requests Analysis</h2>
                  <div className="grid grid-cols-5 gap-4 mb-6">
                    <Card className="p-4 flex flex-col justify-between"><p className="text-xs font-bold text-slate-400 uppercase">Offered/Booked</p><h3 className="text-2xl font-bold text-blue-600">{onlineStats.totalOfferedOrBooked.toLocaleString()}</h3></Card>
                    <Card className="p-4 flex flex-col justify-between"><p className="text-xs font-bold text-slate-400 uppercase">Digital Resolve</p><h3 className="text-2xl font-bold text-green-600">{onlineStats.totalResolved.toLocaleString()}</h3></Card>
                    <Card className="p-4 flex flex-col justify-between"><p className="text-xs font-bold text-slate-400 uppercase">Avg Requests/Mo</p><h3 className="text-2xl font-bold text-indigo-600">{Math.round(displayedData.reduce((a, b) => a + (b.onlineTotal || 0), 0) / (selectedMonth === 'All' ? displayedData.length : 1)).toLocaleString()}</h3></Card>
                    <Card className="p-4 flex flex-col justify-between"><p className="text-xs font-bold text-slate-400 uppercase">Avg Patient Age</p><h3 className="text-2xl font-bold text-amber-600">{onlineStats.ageCount ? Math.round(onlineStats.totalAge / onlineStats.ageCount) : 0} yrs</h3></Card>
                    <Card className="p-4 flex flex-col justify-between"><p className="text-xs font-bold text-slate-400 uppercase">Avg Time (Clin vs Admin)</p>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs"><span>Clinical:</span> <span className="font-bold text-purple-600">{onlineStats.clinicalDurationCount ? (onlineStats.clinicalDurationTotal / onlineStats.clinicalDurationCount).toFixed(1) : 0}h</span></div>
                        <div className="flex justify-between text-xs"><span>Admin:</span> <span className="font-bold text-slate-600">{onlineStats.adminDurationCount ? (onlineStats.adminDurationTotal / onlineStats.adminDurationCount).toFixed(1) : 0}h</span></div>
                      </div>
                    </Card>
                  </div>
                  <div className="grid grid-cols-3 gap-6 h-80">
                    <div className="border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-center">Request Type</h3><Doughnut data={createDonutData(onlineStats.typeBreakdown, [NHS_BLUE, NHS_AMBER])} options={donutOptions} /></div>
                    <div className="border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-center">Access Method</h3><Doughnut data={createDonutData(onlineStats.accessMethod, [NHS_GREEN, NHS_PURPLE, NHS_AQUA])} options={donutOptions} /></div>
                    <div className="border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-center">Patient Sex</h3><Doughnut data={createDonutData(onlineStats.sexSplit, [NHS_BLUE, NHS_PINK])} options={donutOptions} /></div>
                  </div>
                  <div className="h-96 border border-slate-200 rounded-xl p-4 mt-8">
                    <h3 className="font-bold text-slate-800 mb-4">Outcome Breakdown</h3>
                    <Bar data={{ labels: Object.keys(onlineStats.outcomes), datasets: [{ label: 'Count', data: Object.values(onlineStats.outcomes), backgroundColor: NHS_AQUA, borderRadius: 4 }] }} options={{ ...pdfChartOptions, indexAxis: 'y', scales: { x: { beginAtZero: true } } }} />
                  </div>
                </div>
              )}

              {config.useTelephony && (
                <div id="pdf-telephony-section" className="p-10 space-y-8 break-after-page">
                  <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">4. Telephony Performance</h2>
                  <div className="grid grid-cols-5 gap-4 mb-6">
                    {[
                      { l: 'Inbound Calls', k: 'inboundReceived', c: 'text-blue-600' },
                      { l: 'Answered Queue', k: 'answeredFromQueue', c: 'text-green-600', suffix: '%' },
                      { l: 'Abandoned', k: 'abandonedCalls', c: 'text-amber-600', suffix: '%' },
                      { l: 'Callbacks Success', k: 'callbacksSuccessful', c: 'text-blue-500' },
                      { l: 'Avg Wait', k: 'avgQueueTimeAnswered', c: 'text-slate-600', fmt: v => `${Math.floor(v / 60)}m ${v % 60}s` }
                    ].map((m, i) => (
                      <Card key={i} className="p-4 border border-slate-200 shadow-none bg-slate-50">
                        <p className="text-xs font-bold text-slate-400 uppercase">{m.l}</p>
                        <p className={`text-xl font-bold ${m.c} mt-1`}>
                          {m.fmt ? m.fmt(displayedData[displayedData.length - 1][m.k]) :
                            `${displayedData[displayedData.length - 1][m.k].toLocaleString()}${m.suffix || ''}`}
                        </p>
                        <p className="text-[10px] text-slate-400">{selectedMonth === 'All' ? 'Latest Month' : selectedMonth}</p>
                      </Card>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-6 h-80">
                    <div className="border border-slate-200 rounded-xl p-4"><Bar data={{ labels: displayedData.map(d => d.month), datasets: [{ label: 'Answered %', data: displayedData.map(d => 100 - (d.missedFromQueueExRepeatPct || 0)), backgroundColor: NHS_GREEN }, { label: 'Missed %', data: displayedData.map(d => d.missedFromQueueExRepeatPct || 0), backgroundColor: NHS_RED }] }} options={pdfStackedPercentageOptions} /></div>
                    <div className="border border-slate-200 rounded-xl p-4"><Line data={createChartData('Abandoned %', 'abandonedCalls', NHS_AMBER)} options={pdfPercentageOptions} /></div>
                    <div className="border border-slate-200 rounded-xl p-4"><Line data={createChartData('Avg Queue Time', 'avgQueueTimeAnswered', NHS_BLUE)} options={pdfTimeOptions} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 h-80 mt-6">
                    <div className="border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-sm">Missed (Unique) %</h3><Line data={createChartData('Missed Unique %', 'missedFromQueueExRepeatPct', NHS_RED)} options={pdfPercentageOptions} /></div>
                    <div className="border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-sm">Avg Queue Time (Missed)</h3><Line data={createChartData('Time', 'avgQueueTimeMissed', NHS_RED)} options={pdfTimeOptions} /></div>
                    <div className="border border-slate-200 rounded-xl p-4"><h3 className="font-bold text-slate-700 mb-2 text-sm">Avg Inbound Talk Time</h3><Line data={createChartData('Time', 'avgInboundTalkTime', NHS_GREY)} options={pdfTimeOptions} /></div>
                  </div>
                </div>
              )}

              <div id="pdf-forecast-section" className="p-10 space-y-8 break-after-page">
                <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">5. Demand Forecast (GP Only)</h2>
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-blue-800 mb-6">
                  <p className="text-lg">This chart estimates the number of extra GP appointments per day required to meet hidden demand from missed calls.</p>
                </div>
                <div className="h-96 border border-slate-200 rounded-xl p-4">
                  <Bar data={{ labels: displayedData.map(d => d.month), datasets: [{ label: 'Shortfall (Slots/Day)', data: displayedData.map(d => d.extraSlotsPerDay), backgroundColor: displayedData.map(d => d.extraSlotsPerDay > 0 ? '#EF4444' : '#10B981') }] }} options={pdfChartOptions} />
                </div>
                {forecastData && forecastData.hasData && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-700 mb-4 mt-8">Future Trends (Next 2 Months)</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createForecastChartData('Actual Appointments', 'Forecast Trend', forecastData.appts, NHS_BLUE)} options={pdfChartOptions} /></div>
                      <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createForecastChartData('Actual Calls', 'Forecast Trend', forecastData.calls, NHS_PURPLE)} options={pdfChartOptions} /></div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </main>

      <DataProcessingModal isOpen={showProcessingInfo} onClose={() => setShowProcessingInfo(false)} />

      <ResetConfirmationModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setProcessedData(null);
          setSelectedMonth('All');
          setAiReport(null);
          setConfig({ ...config, surgeryName: '', population: 10000 });
          setFiles({ appointments: null, dna: null, unused: null, onlineRequests: null, telephony: [] });
          setRawStaffData([]);
          setRawSlotData([]);
          setRawCombinedData([]);
          setRawOnlineData([]);
          setForecastData(null);
          setShowResetConfirm(false);
        }}
      />
    </div>
  );
}