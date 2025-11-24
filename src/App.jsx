import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Upload, Activity, Calendar, Users, Phone, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Info, Sparkles, Loader2, PlayCircle, Search, User, Download, FileText, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, AlertTriangle } from 'lucide-react';

// --- PRODUCTION IMPORTS ---
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    for(let i = 0; i < count; i++) {
        currentMonthIndex++;
        if(currentMonthIndex > 11) {
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
        const clean = part.replace(/^[\*]+|[\*]+$/g, '');
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
  const [rawStaffData, setRawStaffData] = useState([]); // Store granular staff data
  const [rawSlotData, setRawSlotData] = useState([]);   // Store granular slot data
  const [rawCombinedData, setRawCombinedData] = useState([]); // Store granular combined (staff+slot) data
  const [forecastData, setForecastData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isExporting, setIsExporting] = useState(false);
  
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
    setRawSlotData([]);
    setRawCombinedData([]);
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
    setRawSlotData([]);
    setRawCombinedData([]);
    setForecastData(null);

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

      validateHeaders(apptData, ['Date', 'Day'], 'Appointments CSV');
      if (filesToProcess.dna) validateHeaders(dnaData, ['Staff', 'Appointment Count'], 'DNA CSV');
      if (filesToProcess.unused) validateHeaders(unusedData, ['Staff', 'Unused Slots', 'Total Slots'], 'Unused CSV');

      let telephonyData = [];
      if (configToUse.analyseTelephony && filesToProcess.telephony && filesToProcess.telephony.length > 0) {
        for (const file of filesToProcess.telephony) {
          const text = await extractTextFromPDF(file);
          telephonyData.push({ filename: file.name, text });
        }
      }

      const months = {};
      const monthlyStaffMap = {}; 
      const monthlySlotMap = {}; 
      const monthlyCombinedMap = {}; 

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

      // --- Process DNA ---
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
             if(firstMonth) {
                 updateStaff(firstMonth, staffName, 'dna', count);
                 if (slotName) {
                     updateSlot(firstMonth, slotName, 'dna', count, staffName);
                     updateCombined(firstMonth, staffName, slotName, 'dna', count);
                 }
             }
          }
      });

      // --- Process Unused ---
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
                     // NOTE: We use "Booked" (calculated from Total Slots) for the Slot tables
                     updateSlot(m, slotName, 'unused', splitCount, staffName);
                     updateSlot(m, slotName, 'appts', splitBooked, staffName);

                     updateCombined(m, staffName, slotName, 'unused', splitCount);
                     updateCombined(m, staffName, slotName, 'appts', splitBooked);
                 }
             });
          } else {
             const firstMonth = Object.keys(months)[0];
             if(firstMonth) {
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

         const conversionRatio = t.inboundAnswered > 0 ? (m.totalAppts / t.inboundAnswered) : 0;
         const gpConversionRatio = t.inboundAnswered > 0 ? (m.gpAppts / t.inboundAnswered) : 0;
         
         const totalCapacity = m.totalAppts + estimatedUnused;
         const utilization = totalCapacity > 0 ? (m.totalAppts / totalCapacity) * 100 : 0;

         const gpCapacity = m.gpAppts + estimatedGPUnused;
         const gpUtilization = gpCapacity > 0 ? (m.gpAppts / gpCapacity) * 100 : 0;

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
           
           conversionRatio,
           gpConversionRatio,
           utilization,
           gpUtilization,

           gpApptsPerDay: m.workingDays ? (m.gpAppts / population * 100) / m.workingDays : 0,
           gpUnusedPct: (m.gpAppts + estimatedGPUnused) > 0 ? (estimatedGPUnused / (m.gpAppts + estimatedGPUnused)) * 100 : 0,
           gpDNAPct: m.gpAppts > 0 ? (estimatedGPDNA / m.gpAppts) * 100 : 0,

           allApptsPerDay: m.workingDays ? (m.totalAppts / population * 100) / m.workingDays : 0,
           allUnusedPct: (m.totalAppts + estimatedUnused) > 0 ? (estimatedUnused / (m.totalAppts + estimatedUnused)) * 100 : 0,
           allDNAPct: m.totalAppts > 0 ? (estimatedDNA / m.totalAppts) * 100 : 0,

           ...t,
           capitationCallingPerDay: m.workingDays ? (capitationCalling / m.workingDays) : 0,

           extraSlotsPerDay: extraGPSlotsPerDay 
         };
      });

      const hasNaN = finalData.some(d => 
        isNaN(d.gpApptsPerDay) || 
        isNaN(d.allApptsPerDay) || 
        !isFinite(d.gpApptsPerDay)
      );

      if (hasNaN || finalData.length === 0) {
        throw new Error("Processing resulted in invalid numbers. Please check if your input files contain valid numeric data.");
      }

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
          appts: { actual: [...apptArray, null, null], projected: [...Array(apptArray.length - 1).fill(null), apptArray[apptArray.length-1], ...futureAppts] },
          calls: { actual: [...callArray, null, null], projected: [...Array(callArray.length - 1).fill(null), callArray[callArray.length-1], ...futureCalls] },
          hasData: true
      } : { hasData: false, count: apptArray.length });

      setProcessedData(finalData);
      setRawStaffData(Object.values(monthlyStaffMap)); 
      setRawSlotData(Object.values(monthlySlotMap)); 
      setRawCombinedData(Object.values(monthlyCombinedMap));

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
  
  const getAggregatedData = (rawData) => {
    if (!rawData || rawData.length === 0) return [];
    
    const filtered = selectedMonth === 'All' 
        ? rawData 
        : rawData.filter(d => d.month === selectedMonth);

    const grouped = filtered.reduce((acc, curr) => {
        const key = curr.name + (curr.slot ? `_${curr.slot}` : '');
        if (!acc[key]) {
            acc[key] = { 
                name: curr.name, 
                slot: curr.slot || null,
                isGP: curr.isGP,
                hasGPActivity: curr.hasGPActivity || false,
                appts: 0, 
                dna: 0, 
                unused: 0 
            };
        }
        acc[key].appts += curr.appts;
        acc[key].dna += curr.dna;
        acc[key].unused += curr.unused;
        if (curr.hasGPActivity) acc[key].hasGPActivity = true; 
        return acc;
    }, {});

    return Object.values(grouped).sort((a,b) => b.appts - a.appts);
  };

  const aggregatedStaffData = useMemo(() => getAggregatedData(rawStaffData), [rawStaffData, selectedMonth]);
  const aggregatedSlotData = useMemo(() => getAggregatedData(rawSlotData), [rawSlotData, selectedMonth]);
  const aggregatedCombinedData = useMemo(() => getAggregatedData(rawCombinedData), [rawCombinedData, selectedMonth]);

  const fetchAIReport = async () => {
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
    return result.candidates?.[0]?.content?.parts?.[0]?.text;
  };

  const generateAIInsights = async () => {
    if (!displayedData || displayedData.length === 0) return;
    setIsAiLoading(true);
    setAiError(null);
    
    try {
        const text = await fetchAIReport();
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

  const handleExportPDF = async () => {
      setIsExporting(true);
      try {
          if (!aiReport) {
              try {
                  const text = await fetchAIReport();
                  setAiReport(text);
                  await new Promise(resolve => setTimeout(resolve, 500));
              } catch (e) {
                  console.error("Could not generate AI report for PDF", e);
              }
          }

          const container = document.getElementById('pdf-report-container');
          if (!container) throw new Error("Report container not found");

          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          const addSectionToPDF = async (elementId, addPageBreak = true) => {
              const element = document.getElementById(elementId);
              if (!element) return;

              const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  logging: false,
                  backgroundColor: '#ffffff'
              });

              const imgData = canvas.toDataURL('image/png');
              const imgWidth = canvas.width;
              const imgHeight = canvas.height;
              const ratio = pdfWidth / imgWidth;
              const scaledHeight = imgHeight * ratio;

              if (addPageBreak) pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, scaledHeight);
          };

          await addSectionToPDF('pdf-title-page', false);
          await addSectionToPDF('pdf-overview-section');
          await addSectionToPDF('pdf-gp-section');
          if(config.analyseTelephony) await addSectionToPDF('pdf-telephony-section');
          await addSectionToPDF('pdf-forecast-section');

          const filename = `CAIP Analysis - ${config.surgeryName || 'Surgery'}.pdf`;
          pdf.save(filename);

      } catch (err) {
          console.error("Export failed", err);
          alert("Failed to export PDF. Please try again.");
      } finally {
          setIsExporting(false);
      }
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

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 20 
    },
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
        min: 0, 
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

  const pdfChartOptions = {
    ...commonOptions,
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
  };

  const pdfTimeOptions = {
      ...pdfChartOptions,
      scales: {
          ...pdfChartOptions.scales,
          y: {
              ...pdfChartOptions.scales.y,
              ticks: {
                  color: '#64748b',
                  callback: (v) => `${Math.floor(v/60)}m ${v%60}s`
              }
          }
      }
  };

  const pdfPercentageOptions = {
    ...pdfChartOptions,
    scales: {
      ...pdfChartOptions.scales,
      y: {
        ...pdfChartOptions.scales.y,
        min: 0, 
        ticks: {
          color: '#64748b',
          callback: (value) => `${Number(value).toFixed(2)}%`
        }
      }
    }
  };

  const pdfStackedPercentageOptions = {
    ...pdfPercentageOptions,
    scales: {
        x: { 
          ...commonOptions.scales.x,
          stacked: true 
        },
        y: { 
          ...pdfPercentageOptions.scales.y,
          stacked: true,
          max: 100 
        }
      }
  };

  const pdfRatioOptions = {
    ...pdfChartOptions,
    scales: {
      ...pdfChartOptions.scales,
      y: {
        ...pdfChartOptions.scales.y,
        min: 0,
        ticks: {
          color: '#64748b',
          callback: (value) => Number(value).toFixed(2)
        }
      }
    }
  };

  const pdfUtilizationOptions = {
    ...pdfPercentageOptions,
    scales: {
        ...pdfPercentageOptions.scales,
        y: {
            ...pdfPercentageOptions.scales.y,
            min: 0,
            max: 100
        }
    }
  };

  const pdfGpBandOptions = {
    ...pdfPercentageOptions,
    scales: {
        ...pdfPercentageOptions.scales,
        y: {
            ...pdfPercentageOptions.scales.y,
            min: 0,
            suggestedMax: 1.6 
        }
    },
    plugins: {
        ...pdfPercentageOptions.plugins,
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

  // Define headers based on filter state
  const isFiltered = selectedMonth !== 'All';
  const unusedHeader = isFiltered ? 'Unused Slots (Est. Monthly)' : 'Unused Slots';
  const dnaHeader = isFiltered ? 'DNAs (Est. Monthly)' : 'DNAs';
  
  // Helper for conditional warning in accordion content
  const seasonalWarning = isFiltered ? (
      <p className="text-xs text-amber-600 mb-3 italic flex items-center gap-1">
        <Info size={12} />
        * Monthly averages shown. Exact dates are not available in DNA/Unused CSVs.
      </p>
  ) : null;

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
            
            <div className="flex justify-center gap-4 mb-6" data-html2canvas-ignore="true">
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

                 <button 
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-70"
                 >
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  <span className="font-semibold">Export to PDF</span>
                 </button>
            </div>

            <div className="flex justify-center mb-8" data-html2canvas-ignore="true">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                {[
                    {id: 'dashboard', label: 'Overview', icon: Activity},
                    {id: 'gp', label: 'GP Metrics', icon: Users},
                    {id: 'telephony', label: 'Telephony', icon: Phone},
                    {id: 'forecast', label: 'Forecast', icon: Calendar}
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
                    {seasonalWarning}
                    {aggregatedStaffData && (
                        <SortableTable 
                            data={aggregatedStaffData} 
                            columns={[
                                { header: 'Name', accessor: 'name' },
                                { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                        {seasonalWarning}
                        {aggregatedStaffData && (
                            <SortableTable 
                                data={aggregatedStaffData.filter(s => s.isGP)} 
                                columns={[
                                    { header: 'GP Name', accessor: 'name' },
                                    { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                                    { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                    { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                    { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                    { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                    { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                    { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                            }} options={pdfChartOptions} />
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
            <div id="pdf-report-container" style={{ position: 'fixed', top: 0, left: -10000, width: '1200px', background: '#fff', zIndex: -100 }}>
                
                <div id="pdf-title-page" className="flex flex-col items-center justify-center h-[800px] p-20 text-center bg-slate-50">
                    <img src={logo} className="w-32 h-32 mb-8 rounded-xl shadow-lg" />
                    <h1 className="text-6xl font-bold text-slate-900 mb-4">CAIP Analysis Report</h1>
                    <h2 className="text-4xl text-blue-600 font-medium mb-12">{config.surgeryName || 'Surgery Report'}</h2>
                    <p className="text-slate-500 text-xl">Generated on {new Date().toLocaleDateString()}</p>
                    
                    {aiReport && (
                        <div className="mt-12 text-left bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
                            <h3 className="text-2xl font-bold text-indigo-900 mb-4 flex items-center gap-2"><Sparkles className="text-indigo-500"/> CAIP Analysis Summary</h3>
                            <div className="prose prose-lg max-w-none text-slate-700">
                                <SimpleMarkdown text={aiReport} />
                            </div>
                        </div>
                    )}
                </div>

                <div id="pdf-overview-section" className="p-10 space-y-8">
                    <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">1. Practice Overview</h2>
                    <div className="grid grid-cols-3 gap-6">
                        <MetricCard title="Total Appointments" value={displayedData.reduce((a,b)=>a+b.totalAppts,0).toLocaleString()} icon={Calendar} color="text-blue-600" />
                        <MetricCard title="Avg Inbound Calls" value={Math.round(displayedData.reduce((a,b)=>a+b.inboundReceived,0)/(selectedMonth==='All'?displayedData.length:1)).toLocaleString()} icon={Phone} color="text-indigo-600" />
                        <MetricCard title="Avg DNA Rate" value={`${(displayedData.reduce((a,b)=>a+b.allDNAPct,0)/(selectedMonth==='All'?displayedData.length:1)).toFixed(2)}%`} icon={XCircle} color="text-red-500" />
                    </div>
                    <div className="h-96 border border-slate-200 rounded-xl p-4"><Line data={createChartData('Total Appointments', 'totalAppts', NHS_BLUE)} options={pdfChartOptions} /></div>
                    
                    <div className="mt-8">
                        <h3 className="text-xl font-bold text-slate-700 mb-4">Full Staff Breakdown</h3>
                        <SortableTable 
                            data={aggregatedStaffData} 
                            columns={[
                                { header: 'Name', accessor: 'name' },
                                { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
                            ]} 
                            isPrint={true} 
                        />
                    </div>
                </div>

                <div id="pdf-gp-section" className="p-10 space-y-8">
                    <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">2. GP Metrics</h2>
                    <div className="h-96 border border-slate-200 rounded-xl p-4"><Line data={createChartData('GP Appts %', 'gpApptsPerDay', NHS_DARK_BLUE, false)} options={pdfGpBandOptions} /></div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createChartData('Utilisation %', 'gpUtilization', NHS_GREEN)} options={pdfUtilizationOptions} /></div>
                        <div className="h-80 border border-slate-200 rounded-xl p-4"><Line data={createChartData('GP Conversion Ratio', 'gpConversionRatio', NHS_PURPLE)} options={pdfRatioOptions} /></div>
                    </div>
                    
                    <div className="mt-8">
                        <h3 className="text-xl font-bold text-slate-700 mb-4">GP Staff Performance</h3>
                        <SortableTable 
                            data={aggregatedStaffData.filter(s => s.isGP)} 
                            columns={[
                                { header: 'GP Name', accessor: 'name' },
                                { header: 'Appointments', accessor: 'appts', render: (row) => Math.round(row.appts).toLocaleString() },
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
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
                                { header: unusedHeader, accessor: 'unused', render: (row) => Math.round(row.unused).toLocaleString() },
                                { header: dnaHeader, accessor: 'dna', render: (row) => Math.round(row.dna).toLocaleString() }
                            ]} 
                            isPrint={true} 
                        />
                    </div>
                </div>

                {config.analyseTelephony && (
                    <div id="pdf-telephony-section" className="p-10 space-y-8">
                        <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">3. Telephony Performance</h2>
                        <div className="grid grid-cols-5 gap-4 mb-6">
                            {[
                                { l: 'Inbound Calls', k: 'inboundReceived', c: 'text-blue-600' },
                                { l: 'Answered Queue', k: 'answeredFromQueue', c: 'text-green-600', suffix: '%' },
                                { l: 'Abandoned', k: 'abandonedCalls', c: 'text-amber-600', suffix: '%' },
                                { l: 'Callbacks Success', k: 'callbacksSuccessful', c: 'text-blue-500' },
                                { l: 'Avg Wait', k: 'avgQueueTimeAnswered', c: 'text-slate-600', fmt: v => `${Math.floor(v/60)}m ${v%60}s` }
                            ].map((m, i) => (
                                <Card key={i} className="p-4 border border-slate-200 shadow-none bg-slate-50">
                                    <p className="text-xs font-bold text-slate-400 uppercase">{m.l}</p>
                                    <p className={`text-xl font-bold ${m.c} mt-1`}>
                                        {m.fmt ? m.fmt(displayedData[displayedData.length-1][m.k]) : 
                                         `${displayedData[displayedData.length-1][m.k].toLocaleString()}${m.suffix||''}`}
                                    </p>
                                    <p className="text-[10px] text-slate-400">{selectedMonth === 'All' ? 'Latest Month' : selectedMonth}</p>
                                </Card>
                            ))}
                        </div>
                        <div className="grid grid-cols-3 gap-6 h-80">
                            <div className="border border-slate-200 rounded-xl p-4"><Bar data={{labels:displayedData.map(d=>d.month),datasets:[{label:'Answered %',data:displayedData.map(d=>100-(d.missedFromQueueExRepeatPct||0)),backgroundColor:NHS_GREEN},{label:'Missed %',data:displayedData.map(d=>d.missedFromQueueExRepeatPct||0),backgroundColor:NHS_RED}]}} options={pdfStackedPercentageOptions} /></div>
                            <div className="border border-slate-200 rounded-xl p-4"><Line data={createChartData('Abandoned %', 'abandonedCalls', NHS_AMBER)} options={pdfPercentageOptions} /></div>
                            <div className="border border-slate-200 rounded-xl p-4"><Line data={createChartData('Avg Queue Time', 'avgQueueTimeAnswered', NHS_BLUE)} options={pdfTimeOptions} /></div>
                        </div>
                    </div>
                )}

                <div id="pdf-forecast-section" className="p-10 space-y-8">
                    <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">4. Demand Forecast (GP Only)</h2>
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-blue-800 mb-6">
                        <p className="text-lg">This chart estimates the number of extra GP appointments per day required to meet hidden demand from missed calls.</p>
                    </div>
                    <div className="h-96 border border-slate-200 rounded-xl p-4">
                        <Bar data={{labels:displayedData.map(d=>d.month),datasets:[{label:'Shortfall (Slots/Day)',data:displayedData.map(d=>d.extraSlotsPerDay),backgroundColor:displayedData.map(d=>d.extraSlotsPerDay>0?'#EF4444':'#10B981')}]}} options={pdfChartOptions} />
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
    </div>
  );
}