import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Upload, FileText, Activity, Calendar, Users, Phone, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Info, Filter, Sparkles, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
// Set the worker to a CDN to avoid complex build configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Initialize ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const NHS_BLUE = '#005EB8';
const NHS_DARK_BLUE = '#003087';
const NHS_BRIGHT_BLUE = '#0072CE';
const NHS_AQUA = '#00A9CE';
const NHS_GREEN = '#009639';
const NHS_RED = '#DA291C';
const NHS_GREY = '#425563';
const NHS_AMBER = '#ED8B00'; 
const GP_BAND_BLUE = '#005EB820'; // Low opacity for background
const GP_BAND_GREEN = '#00963920';
const GP_BAND_AMBER = '#ED8B0020';
const GP_BAND_RED = '#DA291C20';

const apiKey = import.meta.env.VITE_GEMINI_KEY


// Custom Plugin for Background Bands
const backgroundBandsPlugin = {
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
};

// Register custom plugin
ChartJS.register(backgroundBandsPlugin);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200 p-6 transition-all hover:shadow-md ${className}`}>
    {children}
  </div>
);

const MetricCard = ({ title, value, subtext, icon: Icon, color = 'text-slate-700', trend }) => (
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [libsLoaded, setLibsLoaded] = useState(false);
  
  // Filter State
  const [selectedMonth, setSelectedMonth] = useState('All');

  // AI State
  const [aiReport, setAiReport] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // --- Parsers ---

  const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
      if (!Papa) {
        reject(new Error("PapaParse not loaded"));
        return;
      }
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
      if (!pdfjsLib) throw new Error("PDF.js not loaded");
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let fullText = '';
      
      const maxPages = Math.min(pdf.numPages, 3); 
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += ` --- PAGE ${i} --- \n ${pageText}`;
      }
      return fullText;
    } catch (e) {
      console.error("PDF Parse Error", e);
      throw new Error(`Could not parse PDF: ${file.name}`);
    }
  };

  // --- Main Processing Logic ---

  const processFiles = async () => {
    if (!libsLoaded) {
      setError("Libraries still loading, please wait a moment...");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (!files.appointments) throw new Error("Appointment CSV is required");
      
      const apptData = await parseCSV(files.appointments);
      const dnaData = files.dna ? await parseCSV(files.dna) : [];
      const unusedData = files.unused ? await parseCSV(files.unused) : [];

      let telephonyData = [];
      if (config.analyseTelephony && files.telephony.length > 0) {
        for (const file of files.telephony) {
          const text = await extractTextFromPDF(file);
          telephonyData.push({ filename: file.name, text });
        }
      }

      const months = {}; 

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
          
          months[monthKey].totalAppts += count;
          if (isGP(key)) {
            months[monthKey].gpAppts += count;
          } else {
            months[monthKey].staffAppts += count;
          }
        });
      });

      // --- Process DNA ---
      let globalDNACount = 0;
      let globalGPDNACount = 0;
      
      dnaData.forEach(row => {
          const count = parseInt(row['Appointment Count'], 10) || 0;
          globalDNACount += count;
          if (isGP(row['Staff'])) {
              globalGPDNACount += count;
          }
      });

      // --- Process Unused ---
      let globalUnusedCount = 0;
      let globalGPUnusedCount = 0;
      
      unusedData.forEach(row => {
          const count = parseInt(row['Unused Slots'], 10) || 0;
          globalUnusedCount += count;
          if (isGP(row['Staff'])) {
              globalGPUnusedCount += count;
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
         const population = parseFloat(config.population) || 1;
         const capitationCalling = t.inboundAnswered ? ((t.inboundAnswered / population) * 100) : 0;

         // Ideal Forecast (GP ONLY)
         // Ratio = GP Appts / Answered Calls
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
           extraSlotsPerDay: extraGPSlotsPerDay // Updated to use GP only slots
         };
      });

      setProcessedData(finalData);

    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // --- AI Feature ---
  const generateAIInsights = async () => {
    if (!displayedData || displayedData.length === 0) return;
    
    setIsAiLoading(true);
    setAiError(null);
    setAiReport(null);

    try {
        // Prepare data summary for AI
        const dataSummary = displayedData.map(d => ({
            month: d.month,
            gpAppts: d.gpAppts,
            gpApptsPerDay: d.gpApptsPerDay.toFixed(2) + '%', // Included for the prompt logic
            callbacksSuccess: d.callbacksSuccessful || 0,
            gpDNARate: d.gpDNAPct.toFixed(2) + '%',
            gpUnusedRate: d.gpUnusedPct.toFixed(2) + '%',
            inboundCalls: d.inboundReceived,
            missedCallsPct: (d.missedFromQueueExRepeatPct || 0).toFixed(2) + '%',
            forecastExtraSlotsNeeded: d.extraSlotsPerDay.toFixed(1)
        }));

        const prompt = `
            You are an expert NHS Practice Manager and Data Analyst using CAIP Analytics.
            Analyze the following monthly performance data for ${config.surgeryName || 'the surgery'} (${selectedMonth === 'All' ? 'Trend Analysis' : selectedMonth}).
            
            Data: ${JSON.stringify(dataSummary)}

            Please provide a concise report in exactly these two sections using bullet points:

            ### ✅ Positives
            * Highlight metrics that are performing well (e.g., low DNA rates, high queue answer rates, good capacity usage, good appointment availability).

            ### 🚀 Room for Improvement & Actions
            * Identify specific issues and provide a direct, actionable solution for each.
            * **Strictly apply this logic for your recommendations:**
                * If **Missed Calls %** is high (>3%) but **Callbacks Success** is low, suggest: "High missed calls with low callback success suggests a configuration error. Check telephony callback settings and staffing."
                * If **GP Appts % per Day** is low (<1.1%), suggest: "GP Appointment availability is low relative to population. Consider increasing clinical sessions or reviewing rota capacity."
                * If **GP Appts % per Day** is very high (>1.5%), suggest: "GP Appointment rate is unusually high. Check for rota double-counting or potential clinician burnout risks."
                * If **DNA Rate** is high (>4%), suggest: "DNA rate is above target. Review SMS reminder configuration and ensure patients receive prompts 24h in advance."
                * If **Unused Slots** are high (>2%), suggest: "Unused capacity is high. Rectify SystmOne rota management, check for hidden embargoes, or release slots earlier."

            Keep the tone professional, constructive, and specific to NHS Primary Care. Use British English. Format with Markdown.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) throw new Error('Failed to generate insights');
        
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            setAiReport(text);
        } else {
            throw new Error('No insight generated');
        }

    } catch (e) {
        console.error(e);
        setAiError("Could not generate AI report. Please try again.");
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

  // Options for Time Charts (m s)
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

  // Options specifically for percentage charts (adds % symbol)
  const percentageOptions = {
    ...commonOptions,
    scales: {
      ...commonOptions.scales,
      y: {
        ...commonOptions.scales.y,
        ticks: {
          color: '#64748b',
          callback: (value) => `${Number(value).toFixed(2)}%`
        }
      }
    }
  };

  // GP Band Options
  const gpBandOptions = {
    ...percentageOptions,
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

  // Options for Stacked Bar Charts (100% Split)
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

  // --- Render Helpers ---

  const FileInput = ({ label, accept, onChange, file }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
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
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
             <h1 className="text-xl font-bold text-slate-900">CAIP Analytics</h1>
          </div>
          {processedData && (
             <div className="flex items-center gap-4 text-sm">
               {/* Date Range Dropdown */}
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
               
                {/* AI Button */}
               <button 
                onClick={generateAIInsights}
                disabled={isAiLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50"
               >
                {isAiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} />}
                <span className="font-medium">Analyze with AI</span>
               </button>

               <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium hidden sm:block">
                 {config.surgeryName || 'Surgery Dashboard'}
               </span>
               <button 
                 onClick={() => { setProcessedData(null); setSelectedMonth('All'); setAiReport(null); }} 
                 className="text-slate-500 hover:text-red-600 transition-colors"
               >
                 Reset
               </button>
             </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* --- Configuration & Upload Screen --- */}
        {!processedData && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center mb-10">
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
                      placeholder="e.g. Giltbrook Surgery"
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
                 accept=".csv" 
                 file={files.dna}
                 onChange={(e) => setFiles({...files, dna: e.target.files[0]})}
               />
               <FileInput 
                 label="Unused Slots Extract (CSV) *" 
                 accept=".csv" 
                 file={files.unused}
                 onChange={(e) => setFiles({...files, unused: e.target.files[0]})}
               />
               
               {config.analyseTelephony && (
                   <FileInput 
                     label="Telephony Reports (PDF)" 
                     accept="application/pdf" 
                     file={files.telephony.length > 0 ? files.telephony : null}
                     onChange={(e) => setFiles({...files, telephony: Array.from(e.target.files)})}
                   />
               )}

               {error && (
                 <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 text-sm">
                   <AlertCircle size={16} />
                   {error}
                 </div>
               )}
               
               {!libsLoaded && !error && (
                  <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-xl flex items-center gap-2 text-sm">
                    <Activity className="animate-spin" size={16} />
                    Loading PDF and CSV processors...
                  </div>
               )}

               <button 
                 onClick={processFiles}
                 disabled={isProcessing || !files.appointments || !libsLoaded}
                 className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all
                   ${isProcessing || !files.appointments || !libsLoaded ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]'}
                 `}
               >
                 {isProcessing ? 'Analysing Data...' : 'Generate Dashboard'}
               </button>
             </Card>
          </div>
        )}

        {/* --- Dashboard View --- */}
        {processedData && (
          <div className="animate-in fade-in duration-700">
            
            {/* AI Report Section */}
            {aiReport && (
                <Card className="mb-8 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Sparkles size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-indigo-900">CAIP Copilot Analysis</h3>
                        <button onClick={() => setAiReport(null)} className="ml-auto text-slate-400 hover:text-slate-600 text-sm">Close</button>
                    </div>
                    <div className="prose prose-sm prose-indigo max-w-none">
                        <div className="whitespace-pre-line text-slate-700">
                            {aiReport}
                        </div>
                    </div>
                </Card>
            )}

            {aiError && (
                 <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 text-sm">
                   <AlertCircle size={16} />
                   {aiError}
                 </div>
            )}
            
            {/* Navigation Tabs */}
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

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="h-80 lg:col-span-1">
                        <h3 className="font-bold text-slate-700 mb-4">Appointment Trends</h3>
                        <Line data={createChartData('Total Appointments', 'totalAppts', NHS_BLUE)} options={commonOptions} />
                    </Card>
                    <Card className="h-80 lg:col-span-1">
                        <h3 className="font-bold text-slate-700 mb-4">DNA Rate (%)</h3>
                        <Line data={createChartData('DNA %', 'allDNAPct', NHS_RED)} options={percentageOptions} />
                    </Card>
                    <Card className="h-80 lg:col-span-1">
                        <h3 className="font-bold text-slate-700 mb-4">Unused Slots (%)</h3>
                        <Line data={createChartData('Unused %', 'allUnusedPct', NHS_GREEN)} options={percentageOptions} />
                    </Card>
                 </div>
              </div>
            )}

            {activeTab === 'gp' && (
                <div className="space-y-6">
                    {/* Main GP Visual */}
                    <Card className="h-96 border-2 border-blue-100 shadow-md">
                        <h3 className="font-bold text-slate-800 mb-2 text-lg">Patients with GP Appointment (%)</h3>
                        <p className="text-sm text-slate-500 mb-4">Performance Bands: Red (&lt;0.85%), Amber (0.85-1.10%), Green (1.10-1.30%), Blue (&gt;1.30%)</p>
                        <div className="h-72">
                            <Line data={createChartData('GP Appts %', 'gpApptsPerDay', NHS_DARK_BLUE, false)} options={gpBandOptions} />
                        </div>
                    </Card>

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

                            {/* Main Telephony Charts */}
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

                            {/* Detailed Time Charts */}
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