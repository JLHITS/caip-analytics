import React, { useState, useMemo, useEffect } from 'react';
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
  Activity, Users, Clock, Phone, Calendar,
  BarChart3, PieChart, HelpCircle, Info, Sparkles,
  Download, Loader2, Monitor
} from 'lucide-react';

// PDF.js setup
import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Component imports
import Card from './components/ui/Card';
import MetricCard from './components/ui/MetricCard';
import SectionHeader from './components/ui/SectionHeader';
import Accordion from './components/ui/Accordion';
import SortableTable from './components/ui/SortableTable';
import FileInput from './components/ui/FileInput';
import DisclaimerNotice from './components/ui/DisclaimerNotice';
import SimpleMarkdown from './components/markdown/SimpleMarkdown';
import DataProcessingModal from './components/modals/DataProcessingModal';
import ResetConfirmationModal from './components/modals/ResetConfirmationModal';
import AIConsentModal from './components/modals/AIConsentModal';

// Utility imports
import { calculateLinearForecast, getNextMonthNames, isGP } from './utils/calculations';
import { parseCSV, extractTextFromPDF } from './utils/parsers';
import { validateHeaders } from './utils/validators';

// Constants imports
import {
  NHS_BLUE, NHS_DARK_BLUE, NHS_GREEN, NHS_RED, NHS_GREY, NHS_AMBER,
  NHS_PURPLE, NHS_AQUA, NHS_PINK, GP_BAND_BLUE, GP_BAND_GREEN,
  GP_BAND_AMBER, GP_BAND_RED
} from './constants/colors';
import { GP_PERFORMANCE_THRESHOLDS } from './constants/metrics';
import {
  commonOptions, percentageOptions, gpBandOptions, onlineRequestBandOptions,
  stackedPercentageOptions, ratioOptions, utilizationOptions, timeOptions,
  donutOptions, createDonutData, createChartData
} from './constants/chartConfigs';

// Asset imports
import logo from './assets/logo.png';
import rushcliffeLogo from './assets/rushcliffe.png';
import nottsWestLogo from './assets/nottswest.png';

// Sample data imports
import sampleAppt from './assets/sampledata/AppointmentReport.csv?url';
import sampleDNA from './assets/sampledata/DNA.csv?url';
import sampleUnused from './assets/sampledata/Unused.csv?url';
import sampleOnline from './assets/sampledata/OnlineRequests.csv?url';
import sampleAug from './assets/sampledata/aug.pdf?url';
import sampleSep from './assets/sampledata/sep.pdf?url';
import sampleOct from './assets/sampledata/oct.pdf?url';

// Print styles
import './styles/print.css';

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = pdfWorker;

// API Key for Google Gemini
const apiKey = (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_KEY) || "";

// Auto-versioning from package.json via Vite
const APP_VERSION = __APP_VERSION__;

// Register ChartJS components and custom backgroundBands plugin
// backgroundBands plugin draws colored performance zones behind GP metrics charts
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

export default function App() {
  // Application state management
  const [config, setConfig] = useState({
    surgeryName: '',
    population: 10000,
    analyseTelephony: true,
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
  const [rawOnlineData, setRawOnlineData] = useState([]);
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
  const [showAIConsent, setShowAIConsent] = useState(false);

  // Set document title and favicon on mount
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

  // Load example/sample data for demonstration
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

  // Main data processing function
  // Processes uploaded CSV and PDF files to generate dashboard metrics
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

    try {
      if (!filesToProcess.appointments) {
        throw new Error('Please upload an Appointments CSV file.');
      }

      // Parse CSV files
      const apptData = await parseCSV(filesToProcess.appointments);
      const dnaData = filesToProcess.dna ? await parseCSV(filesToProcess.dna) : [];
      const unusedData = filesToProcess.unused ? await parseCSV(filesToProcess.unused) : [];

      const onlineData = (configToUse.useOnline && filesToProcess.onlineRequests) ? await parseCSV(filesToProcess.onlineRequests) : [];

      // Validate CSV headers and check for privacy violations
      validateHeaders(apptData, ['Date', 'Day'], 'Appointments CSV');
      if (filesToProcess.dna) validateHeaders(dnaData, ['Staff', 'Appointment Count'], 'DNA CSV');
      if (filesToProcess.unused) validateHeaders(unusedData, ['Staff', 'Unused Slots', 'Total Slots'], 'Unused CSV');
      if (configToUse.useOnline && filesToProcess.onlineRequests) validateHeaders(onlineData, ['Submission started', 'Type', 'Outcome'], 'Online Requests CSV', ['Patient Name', 'Name', 'Patient', 'NHS Number']);

      const monthlyMap = {};
      const staffMap = {};
      const slotMap = {};
      const combinedMap = {};

      // Parse date from TPP SystmOne format
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split(' ');
        if (parts.length === 0) return null;
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
          return new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1] || '00:00'}`);
        }
        return null;
      };

      // Generate standardized month key for data matching
      // Format: "MMM-YY" (e.g., "Jan-24")
      const toMonthKey = (date) => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
      };

      // Process appointment data: Build monthly aggregates and calculate working days
      for (const row of apptData) {
        const dateObj = parseDate(row['Date']);
        if (!dateObj) continue;
        const monthKey = toMonthKey(dateObj);

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            dateObj: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1),
            totalAppts: 0,
            daysWithAppts: new Set()
          };
        }

        const staff = row['Staff'];
        const slotType = row['Slot Type'];
        const apptCount = parseInt(row['Total Appointments'] || 0);

        monthlyMap[monthKey].totalAppts += apptCount;
        monthlyMap[monthKey].daysWithAppts.add(row['Date']);

        // Staff-level aggregation
        if (!staffMap[staff]) {
          staffMap[staff] = { staff, totalAppts: 0 };
        }
        staffMap[staff].totalAppts += apptCount;

        // Slot type aggregation
        if (!slotMap[slotType]) {
          slotMap[slotType] = { slotType, totalAppts: 0 };
        }
        slotMap[slotType].totalAppts += apptCount;

        // Combined staff + slot type
        const comboKey = `${staff}|||${slotType}`;
        if (!combinedMap[comboKey]) {
          combinedMap[comboKey] = { staff, slotType, totalAppts: 0 };
        }
        combinedMap[comboKey].totalAppts += apptCount;
      }

      // Calculate working days per month
      Object.values(monthlyMap).forEach(m => {
        m.workingDays = m.daysWithAppts.size;
        delete m.daysWithAppts;
      });

      // Process DNA data: Distribute missed appointments proportionally across months
      for (const row of dnaData) {
        const staff = row['Staff'];
        const dnaCount = parseInt(row['Appointment Count'] || 0);
        if (staffMap[staff]) {
          staffMap[staff].dnaCount = (staffMap[staff].dnaCount || 0) + dnaCount;
        }
      }

      // Process unused slots: Calculate wasted capacity per staff member and slot type
      for (const row of unusedData) {
        const staff = row['Staff'];
        const slotType = row['Slot Type'];
        const unusedSlots = parseInt(row['Unused Slots'] || 0);
        const totalSlots = parseInt(row['Total Slots'] || 0);

        if (staffMap[staff]) {
          staffMap[staff].unusedSlots = (staffMap[staff].unusedSlots || 0) + unusedSlots;
          staffMap[staff].totalSlots = (staffMap[staff].totalSlots || 0) + totalSlots;
        }

        if (slotMap[slotType]) {
          slotMap[slotType].unusedSlots = (slotMap[slotType].unusedSlots || 0) + unusedSlots;
          slotMap[slotType].totalSlots = (slotMap[slotType].totalSlots || 0) + totalSlots;
        }

        const comboKey = `${staff}|||${slotType}`;
        if (combinedMap[comboKey]) {
          combinedMap[comboKey].unusedSlots = (combinedMap[comboKey].unusedSlots || 0) + unusedSlots;
          combinedMap[comboKey].totalSlots = (combinedMap[comboKey].totalSlots || 0) + totalSlots;
        }
      }

      // Store raw data for tables
      setRawStaffData(Object.values(staffMap));
      setRawSlotData(Object.values(slotMap));
      setRawCombinedData(Object.values(combinedMap));
      if (configToUse.useOnline) setRawOnlineData(onlineData);

      let telephonyByMonth = {};

      // Process telephony data: Extract call metrics from PDF reports using regex patterns
      if (configToUse.useTelephony && filesToProcess.telephony && filesToProcess.telephony.length > 0) {
        for (const pdfFile of filesToProcess.telephony) {
          const text = await extractTextFromPDF(pdfFile);

          // Extract metrics from PDF text using regex
          const extract = (r) => { const m = text.match(r); return m && m[1] ? parseFloat(m[1].replace(/,/g, '')) : 0; };

          const inboundTotal = extract(/Calls Offered[:\s]+([0-9,]+)/i) || extract(/Total Inbound[:\s]+([0-9,]+)/i);
          const inboundAnswered = extract(/Calls Answered[:\s]+([0-9,]+)/i);
          const abandoned = extract(/Abandoned in Queue[:\s]+([0-9,]+)/i);
          const avgWaitSec = extract(/Average Wait Time[:\s]+([0-9,]+)/i);
          const callbacksOffered = extract(/Callbacks Offered[:\s]+([0-9,]+)/i);
          const callbacksAccepted = extract(/Callbacks Accepted[:\s]+([0-9,]+)/i);
          const uniqueMissedCallers = extract(/Unique Missed Callers[:\s]+([0-9,]+)/i);

          // Extract month from PDF filename or text
          const monthMatch = pdfFile.name.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
          let pdfMonth = monthMatch ? monthMatch[1].substring(0, 1).toUpperCase() + monthMatch[1].substring(1).toLowerCase() : null;

          if (pdfMonth) {
            const currentYear = new Date().getFullYear();
            const monthKey = `${pdfMonth}-${String(currentYear).slice(-2)}`;
            telephonyByMonth[monthKey] = {
              inboundTotal, inboundAnswered, abandoned, avgWaitSec,
              callbacksOffered, callbacksAccepted, uniqueMissedCallers
            };
          }
        }
      }

      // Sort months chronologically
      const monthsArray = Object.values(monthlyMap).sort((a, b) => a.dateObj - b.dateObj);

      const totalApptsAll = monthsArray.reduce((sum, m) => sum + m.totalAppts, 0);
      const totalDNA = Object.values(staffMap).reduce((sum, s) => sum + (s.dnaCount || 0), 0);
      const totalUnused = Object.values(staffMap).reduce((sum, s) => sum + (s.unusedSlots || 0), 0);

      // Calculate metrics for each month
      const enrichedMonths = monthsArray.map(m => {
        const { month, dateObj, totalAppts, workingDays } = m;

        // Calculate estimated DNA and unused slots using proportional distribution
        // based on this month's appointment volume relative to total appointments
        const weight = totalApptsAll > 0 ? totalAppts / totalApptsAll : 0;
        const estDNA = Math.round(totalDNA * weight);
        const estUnused = Math.round(totalUnused * weight);

        const tel = telephonyByMonth[month] || {};
        const inboundTotal = tel.inboundTotal || 0;
        const inboundAnswered = tel.inboundAnswered || 0;
        const abandoned = tel.abandoned || 0;
        const avgWaitSec = tel.avgWaitSec || 0;
        const callbacksOffered = tel.callbacksOffered || 0;
        const callbacksAccepted = tel.callbacksAccepted || 0;
        const uniqueMissedCallers = tel.uniqueMissedCallers || 0;

        const missedFromQueue = inboundTotal - inboundAnswered - abandoned;
        const missedFromQueueExRepeat = uniqueMissedCallers || Math.round(missedFromQueue * 0.8);

        const gpAppts = Object.values(staffMap)
          .filter(s => isGP(s.staff))
          .reduce((sum, s) => sum + (s.totalAppts * weight), 0);

        const gpRatio = inboundAnswered > 0 ? (gpAppts / inboundAnswered) : 0;
        const gpMissedDemand = gpRatio * missedFromQueueExRepeat;

        const estGPDNA = Math.round(estDNA * (gpAppts / (totalAppts || 1)));
        const estGPUnused = Math.round(estUnused * (gpAppts / (totalAppts || 1)));
        const gpWaste = estGPUnused + estGPDNA;

        // Calculate daily capacity gap: (missed demand - wasted capacity) / working days
        // Missed demand = GP booking rate × missed calls (excluding repeat callers)
        // Wasted capacity = estimated unused slots + estimated DNA slots
        const extraSlots = workingDays > 0 ? ((gpMissedDemand - gpWaste) / workingDays) : 0;

        const gpUtilPct = gpAppts > 0 ? ((gpAppts - estGPUnused) / gpAppts * 100) : 0;
        const gpBookConv = inboundAnswered > 0 ? (gpAppts / inboundAnswered) : 0;
        const gpDNAPct = gpAppts > 0 ? (estGPDNA / gpAppts * 100) : 0;
        const gpUnusedPct = gpAppts > 0 ? (estGPUnused / gpAppts * 100) : 0;

        // Primary metric: "Patients with GP Appointment or Resolved Online Request per Day (%)"
        // Combines traditional face-to-face appointments with digitally resolved requests
        // Provides true picture of GP capacity including modern triage methods
        const gpTriageCapacityPerDayPct = workingDays > 0 && configToUse.population > 0
          ? ((gpAppts / workingDays) / configToUse.population * 100)
          : 0;

        return {
          month,
          dateObj,
          totalAppts,
          workingDays,
          estDNA,
          estUnused,
          inboundTotal,
          inboundAnswered,
          abandoned,
          avgWaitSec,
          callbacksOffered,
          callbacksAccepted,
          uniqueMissedCallers,
          missedFromQueue,
          missedFromQueueExRepeat,
          gpAppts,
          gpRatio,
          gpMissedDemand,
          estGPDNA,
          estGPUnused,
          gpWaste,
          extraSlots,
          gpUtilPct,
          gpBookConv,
          gpDNAPct,
          gpUnusedPct,
          gpTriageCapacityPerDayPct
        };
      });

      setProcessedData(enrichedMonths);

      // Generate forecast data using linear regression
      if (enrichedMonths.length >= 3) {
        const totalApptsData = enrichedMonths.map(m => m.totalAppts);
        const gpApptsData = enrichedMonths.map(m => m.gpAppts);
        const inboundTotalData = enrichedMonths.map(m => m.inboundTotal);

        const forecastTotalAppts = calculateLinearForecast(totalApptsData, 2);
        const forecastGPAppts = calculateLinearForecast(gpApptsData, 2);
        const forecastInbound = calculateLinearForecast(inboundTotalData, 2);

        const lastMonth = enrichedMonths[enrichedMonths.length - 1].month;
        const nextMonthNames = getNextMonthNames(lastMonth, 2);
        const forecastLabels = [...enrichedMonths.map(m => m.month), ...nextMonthNames];

        setForecastData({
          labels: forecastLabels,
          totalAppts: {
            actual: [...totalApptsData, null, null],
            projected: [...totalApptsData, ...forecastTotalAppts]
          },
          gpAppts: {
            actual: [...gpApptsData, null, null],
            projected: [...gpApptsData, ...forecastGPAppts]
          },
          inboundTotal: {
            actual: [...inboundTotalData, null, null],
            projected: [...inboundTotalData, ...forecastInbound]
          }
        });
      }

      setIsProcessing(false);
    } catch (err) {
      console.error("Processing Error", err);
      setError(err.message || 'An error occurred while processing the files.');
      setIsProcessing(false);
    }
  };

  // AI Analysis Handler - generates insights using Google Gemini
  const runAIAnalysis = async () => {
    if (!processedData || processedData.length === 0) {
      setAiError("No data to analyze. Please process your files first.");
      return;
    }

    if (!apiKey) {
      setAiError("Google AI API key not configured. Please set VITE_GEMINI_KEY in your environment.");
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiReport(null);

    try {
      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const lastMonth = processedData[processedData.length - 1];

      const dataStr = `Practice: ${config.surgeryName || 'Unknown'}
Population: ${config.population}
Latest Month: ${lastMonth.month}
Total Appointments: ${lastMonth.totalAppts}
GP Appointments: ${Math.round(lastMonth.gpAppts)}
GP Appointments per working day: ${(lastMonth.gpAppts / lastMonth.workingDays).toFixed(1)}
GP Triage Capacity (% pop per day): ${lastMonth.gpTriageCapacityPerDayPct.toFixed(2)}%
GP Utilization: ${lastMonth.gpUtilPct.toFixed(1)}%
GP Booking Conversion: ${lastMonth.gpBookConv.toFixed(2)}
GP DNA Rate: ${lastMonth.gpDNAPct.toFixed(1)}%
GP Unused Slot Rate: ${lastMonth.gpUnusedPct.toFixed(1)}%
Extra Slots Needed Per Day: ${lastMonth.extraSlots.toFixed(1)}
Inbound Calls: ${lastMonth.inboundTotal}
Calls Answered: ${lastMonth.inboundAnswered}
Missed from Queue: ${lastMonth.missedFromQueue}`;

      const prompt = `You are an NHS primary care access improvement analyst. Analyze this practice data and provide actionable insights.

${dataStr}

Provide a structured report with:
## Positives
- List 2-3 strong points

## Room for Improvement
- List 2-3 areas to work on with specific evidence-based recommendations following NHS UK access improvement guidance

Keep it concise (max 200 words) and professional. Use markdown formatting.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      setAiReport(text);
      setIsAiLoading(false);
    } catch (err) {
      console.error("AI Error", err);
      setAiError(`AI analysis failed: ${err.message}`);
      setIsAiLoading(false);
    }
  };

  // Print/PDF export handler
  const handlePrint = async () => {
    // Ensure AI report is rendered before printing
    if (aiReport) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    window.print();
  };

  // Reset all data and return to initial state
  const handleReset = () => {
    setConfig({
      surgeryName: '',
      population: 10000,
      analyseTelephony: true,
      useTelephony: true,
      useOnline: true,
    });
    setFiles({
      appointments: null,
      dna: null,
      unused: null,
      onlineRequests: null,
      telephony: [],
    });
    setProcessedData(null);
    setRawStaffData([]);
    setRawSlotData([]);
    setRawCombinedData([]);
    setRawOnlineData([]);
    setForecastData(null);
    setError(null);
    setAiReport(null);
    setAiError(null);
    setActiveTab('dashboard');
    setSelectedMonth('All');
    setShowResetConfirm(false);
  };

  // Compute aggregated data with optional month filtering
  const getAggregatedData = useCallback((rawData, monthFilter, monthlyData) => {
    if (monthFilter === 'All') {
      return rawData;
    }

    const selectedMonthData = monthlyData?.find(m => m.month === monthFilter);
    if (!selectedMonthData) return rawData;

    const totalApptsAll = monthlyData.reduce((sum, m) => sum + m.totalAppts, 0);
    const weight = totalApptsAll > 0 ? selectedMonthData.totalAppts / totalApptsAll : 0;

    return rawData.map(item => {
      const monthlyAppts = Math.round(item.totalAppts * weight);
      const monthlyDNA = Math.round((item.dnaCount || 0) * weight);
      const monthlyUnused = Math.round((item.unusedSlots || 0) * weight);
      const monthlyTotal = Math.round((item.totalSlots || 0) * weight);

      return {
        ...item,
        totalAppts: monthlyAppts,
        dnaCount: monthlyDNA,
        unusedSlots: monthlyUnused,
        totalSlots: monthlyTotal
      };
    });
  }, []);

  const aggregatedStaffData = useMemo(
    () => getAggregatedData(rawStaffData, selectedMonth, processedData),
    [rawStaffData, selectedMonth, processedData, getAggregatedData]
  );

  const aggregatedSlotData = useMemo(
    () => getAggregatedData(rawSlotData, selectedMonth, processedData),
    [rawSlotData, selectedMonth, processedData, getAggregatedData]
  );

  const aggregatedCombinedData = useMemo(
    () => getAggregatedData(rawCombinedData, selectedMonth, processedData),
    [rawCombinedData, selectedMonth, processedData, getAggregatedData]
  );

  // Calculate online request statistics
  const onlineStats = useMemo(() => {
    if (!config.useOnline || !rawOnlineData || rawOnlineData.length === 0) return null;

    // Filter by selected month if not "All"
    let filteredData = rawOnlineData;
    if (selectedMonth !== 'All') {
      filteredData = rawOnlineData.filter(row => {
        const dateStr = row['Submission started'];
        if (!dateStr) return false;
        const parts = dateStr.split(' ');
        if (parts.length === 0) return false;
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return false;
        const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthKey = `${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
        return monthKey === selectedMonth;
      });
    }

    const totalRequests = filteredData.length;

    const typeCount = {};
    const accessMethodCount = {};
    const sexCount = {};
    const ageGroupCount = {};
    const outcomeCount = {};

    filteredData.forEach(row => {
      const type = row['Type'] || 'Unknown';
      const accessMethod = row['Access Method'] || 'Unknown';
      const sex = row['Sex'] || 'Unknown';
      const outcome = row['Outcome'] || 'Unknown';

      typeCount[type] = (typeCount[type] || 0) + 1;
      accessMethodCount[accessMethod] = (accessMethodCount[accessMethod] || 0) + 1;
      sexCount[sex] = (sexCount[sex] || 0) + 1;
      outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1;

      const ageStr = row['Age'];
      if (ageStr) {
        const age = parseInt(ageStr);
        let ageGroup = 'Unknown';
        if (age < 18) ageGroup = '0-17';
        else if (age < 40) ageGroup = '18-39';
        else if (age < 65) ageGroup = '40-64';
        else ageGroup = '65+';
        ageGroupCount[ageGroup] = (ageGroupCount[ageGroup] || 0) + 1;
      }
    });

    return {
      totalRequests,
      typeCount,
      accessMethodCount,
      sexCount,
      ageGroupCount,
      outcomeCount
    };
  }, [rawOnlineData, selectedMonth, config.useOnline]);

  // Filter displayed data by selected month
  const displayedData = useMemo(() => {
    if (!processedData) return null;
    if (selectedMonth === 'All') return processedData;
    return processedData.filter(m => m.month === selectedMonth);
  }, [processedData, selectedMonth]);

  // Get available months for filter dropdown
  const availableMonths = useMemo(() => {
    if (!processedData) return ['All'];
    return ['All', ...processedData.map(d => d.month)];
  }, [processedData]);

  // Helper to create forecast chart data
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
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 4
      }
    ]
  });

  // Month filter headers
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
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                CAIP Analytics{' '}
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full align-middle ml-2">
                  {APP_VERSION}
                </span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:block">
                Free data analytics to help you improve capacity and access in primary care
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowProcessingInfo(true)}
            className="text-slate-600 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
            title="How does this work?"
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!processedData ? (
          <div className="space-y-8">
            <Card>
              <div className="text-center py-4">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to CAIP Analytics</h2>
                <p className="text-slate-600 mb-6">
                  Upload your appointment, DNA, unused slot, and telephony data to get started
                </p>
              </div>
            </Card>

