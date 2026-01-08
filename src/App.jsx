import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import LZString from 'lz-string';
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
  ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, Copy, Minimize2, Maximize2, Share2
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

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
import ShareModal from './components/modals/ShareModal';
import ShareOptionsModal from './components/modals/ShareOptionsModal';
import BugReportModal from './components/modals/BugReportModal';
import AboutModal from './components/modals/AboutModal';
import Toast from './components/ui/Toast';
import ImportButton from './components/ui/ImportButton';
import NationalTelephony from './components/NationalTelephony';
import NationalOnlineConsultations from './components/NationalOnlineConsultations';
import FancyNationalLoader from './components/ui/FancyNationalLoader';
import TriageSlotAnalysis from './components/TriageSlotAnalysis';

// Utility imports
import { calculateLinearForecast, getNextMonthNames, isGP } from './utils/calculations';
import { parseCSV, extractTextFromPDF } from './utils/parsers';
import { validateHeaders } from './utils/validators';
import { exportDemandCapacityToExcel, restoreDemandCapacityFromExcel, validateExcelFile, generateExcelFilename } from './utils/excelUtils';
import { createFirebaseShare, loadFirebaseShare, maybeCleanupExpiredShares } from './utils/shareUtils';
import * as XLSX from 'xlsx';

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
  donutOptions,
  pdfChartOptions, pdfPercentageOptions, pdfGpBandOptions, pdfStackedPercentageOptions,
  pdfRatioOptions, pdfUtilizationOptions, pdfTimeOptions
} from './constants/chartConfigs';

// Asset imports
import logo from './assets/logo.png';
import rushcliffeLogo from './assets/rushcliffe.png';
import nottsWestLogo from './assets/nottswest.png';
import { db } from './firebase/config';

// Sample data imports
import sampleAppt from './assets/sampledata/AppointmentReport.csv?url';
import sampleDNA from './assets/sampledata/DNA.csv?url';
import sampleUnused from './assets/sampledata/Unused.csv?url';
import sampleOnline from './assets/sampledata/OnlineRequests.csv?url';
// 12 months of telephony PDFs
import samplePdf1 from './assets/sampledata/1.pdf?url';
import samplePdf2 from './assets/sampledata/2.pdf?url';
import samplePdf3 from './assets/sampledata/3.pdf?url';
import samplePdf4 from './assets/sampledata/4.pdf?url';
import samplePdf5 from './assets/sampledata/5.pdf?url';
import samplePdf6 from './assets/sampledata/6.pdf?url';
import samplePdf7 from './assets/sampledata/7.pdf?url';
import samplePdf8 from './assets/sampledata/8.pdf?url';
import samplePdf9 from './assets/sampledata/9.pdf?url';
import samplePdf10 from './assets/sampledata/aug.pdf?url';
import samplePdf11 from './assets/sampledata/oct.pdf?url';
import samplePdf12 from './assets/sampledata/sep.pdf?url';

// Print styles
import './styles/print.css';

// Configure PDF.js worker
GlobalWorkerOptions.workerSrc = pdfWorker;

// API Key for Google Gemini
const apiKey = (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_KEY) || "";
const geminiModel = (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_MODEL) || "gemini-2.5-flash";

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
    appointments: [],
    dna: [],
    unused: [],
    onlineRequests: [],
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
  // Navigation state - two levels: dataSource (local/national) then subTab
  const [dataSource, setDataSource] = useState(null); // null = intro, 'local', 'national'
  const [mainTab, setMainTab] = useState('demand'); // Local: 'demand', 'triage' | National: 'telephony', 'online-consultations'

  // National data loading state - only mount components when user first visits national data
  const [nationalDataVisited, setNationalDataVisited] = useState(false);
  const [telephonyLoading, setTelephonyLoading] = useState(true);
  const [ocLoading, setOcLoading] = useState(true);
  const nationalDataLoading = telephonyLoading || ocLoading;

  // Set nationalDataVisited to true when user first selects national data
  useEffect(() => {
    if (dataSource === 'national' && !nationalDataVisited) {
      setNationalDataVisited(true);
    }
  }, [dataSource, nationalDataVisited]);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Shared state between National Telephony and Online Consultations
  const [sharedPractice, setSharedPractice] = useState(null);
  const [sharedBookmarks, setSharedBookmarks] = useState([]);
  const [sharedUsageStats, setSharedUsageStats] = useState({ totalChecks: 0, recentPractices: [] });
  const latestUsageRef = useRef(sharedUsageStats);
  const usageDocRef = useMemo(() => doc(db, 'telephonyStats', 'global'), []);

  // Load shared bookmarks from localStorage
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('sharedPracticeBookmarks');
    if (savedBookmarks) {
      try {
        setSharedBookmarks(JSON.parse(savedBookmarks));
      } catch (e) {
        console.error('Failed to load shared bookmarks:', e);
      }
    }
  }, []);

  // Save shared bookmarks to localStorage
  const updateSharedBookmarks = (newBookmarks) => {
    setSharedBookmarks(newBookmarks);
    localStorage.setItem('sharedPracticeBookmarks', JSON.stringify(newBookmarks));
  };

  // Keep a ref of the latest usage stats for fallback calculations
  useEffect(() => {
    latestUsageRef.current = sharedUsageStats;
  }, [sharedUsageStats]);

  // Load shared usage stats (times used + recents) from localStorage
  useEffect(() => {
    const savedUsage = localStorage.getItem('sharedPracticeUsage');
    if (savedUsage) {
      try {
        setSharedUsageStats(JSON.parse(savedUsage));
      } catch (e) {
        console.error('Failed to load shared usage stats:', e);
      }
    }
  }, []);

  // Load usage stats from Firestore (preserve existing totalChecks)
  useEffect(() => {
    const fetchUsageFromServer = async () => {
      try {
        const usageDoc = await getDoc(usageDocRef);
        if (usageDoc.exists()) {
          const serverTotal = usageDoc.data()?.totalChecks || 0;
          setSharedUsageStats((prev = { totalChecks: 0, recentPractices: [] }) => {
            const merged = {
              ...prev,
              totalChecks: Math.max(prev.totalChecks || 0, serverTotal)
            };
            localStorage.setItem('sharedPracticeUsage', JSON.stringify(merged));
            return merged;
          });
        } else {
          // Initialize server doc with local total if it doesn't exist
          await setDoc(usageDocRef, { totalChecks: latestUsageRef.current.totalChecks || 0 });
        }
      } catch (error) {
        console.error('Failed to fetch usage stats from server:', error);
      }
    };

    fetchUsageFromServer();
  }, [usageDocRef]);


  // Update shared usage stats and persist to localStorage
  const recordPracticeUsage = (practice) => {
    if (!practice) return;
    setSharedUsageStats((prev = { totalChecks: 0, recentPractices: [] }) => {
      const newRecentPractices = [
        {
          odsCode: practice.odsCode,
          name: practice.gpName,
          pcnName: practice.pcnName,
          icbName: practice.icbName
        },
        ...(prev.recentPractices || []).filter(p => p.odsCode !== practice.odsCode)
      ].slice(0, 5);

      const updatedStats = {
        totalChecks: (prev.totalChecks || 0) + 1,
        recentPractices: newRecentPractices
      };

      localStorage.setItem('sharedPracticeUsage', JSON.stringify(updatedStats));
      return updatedStats;
    });

    // Increment server counter without blocking UI
    const syncUsageToServer = async () => {
      try {
        await updateDoc(usageDocRef, { totalChecks: increment(1) });
      } catch (error) {
        try {
          const fallbackTotal = (latestUsageRef.current.totalChecks || 0) + 1;
          await setDoc(usageDocRef, { totalChecks: fallbackTotal }, { merge: true });
        } catch (err) {
          console.error('Failed to sync usage stats to server:', err);
        }
      }
    };

    syncUsageToServer();
  };

  const [selectedMonth, setSelectedMonth] = useState('All');
  const [aiReport, setAiReport] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [isAiMinimized, setIsAiMinimized] = useState(false);
  const [showProcessingInfo, setShowProcessingInfo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [shareType, setShareType] = useState('firebase');
  const [shareExpiresAt, setShareExpiresAt] = useState(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

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

    // Scroll to top on mount to ensure tab menu is visible
    window.scrollTo(0, 0);

    // Cleanup expired shares probabilistically
    maybeCleanupExpiredShares();
  }, []);

  // Auto-select tab based on URL path
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/telephony')) {
      setDataSource('national');
      setMainTab('telephony');
    } else if (path.includes('/oc')) {
      setDataSource('national');
      setMainTab('online-consultations');
    } else if (path.includes('/slots')) {
      setDataSource('local');
      setMainTab('triage');
    } else if (path.includes('/dc')) {
      setDataSource('local');
      setMainTab('demand');
    }
  }, []);

  // Load Firebase shared dashboard from /shared/:id URL
  useEffect(() => {
    const loadFirebaseSharedDashboard = async () => {
      const path = window.location.pathname;
      const match = path.match(/^\/shared\/([a-zA-Z0-9]+)$/);

      if (!match) return;

      try {
        setIsProcessing(true);
        const shareId = match[1];
        const shareData = await loadFirebaseShare(shareId);

        if (shareData.type === 'demand-capacity') {
          setProcessedData(shareData.processedData);
          setConfig(shareData.config);
          setForecastData(shareData.forecastData);
          setAiReport(shareData.aiReport);
          setRawOnlineData(shareData.rawOnlineData || []);
          setRawStaffData(shareData.rawStaffData || []);
          setRawSlotData(shareData.rawSlotData || []);
          setRawCombinedData(shareData.rawCombinedData || []);

          setDataSource('local');
          setMainTab('demand');
          window.history.replaceState({}, '', '/dc');

          setToast({ type: 'success', message: 'Shared dashboard loaded successfully!' });
        } else if (shareData.type === 'triage-slots') {
          // Switch to slots tab - TriageSlotAnalysis will handle loading from the URL
          setMainTab('slots');
          // Don't change the URL - let TriageSlotAnalysis handle it
          return; // Exit early so we don't show processing state
        }
      } catch (error) {
        console.error('Failed to load shared dashboard:', error);
        setToast({ type: 'error', message: error.message });
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    loadFirebaseSharedDashboard();
  }, []);

  // Load shared dashboard from URL on mount
  useEffect(() => {
    const loadSharedDashboard = () => {
      try {
        // Check if URL has hash fragment with shared data
        const hash = window.location.hash;
        if (!hash || !hash.startsWith('#/')) return;

        // Extract compressed data from hash
        const compressed = hash.substring(2); // Remove '#/'
        if (!compressed) return;

        console.log('📥 Loading shared dashboard from URL...');

        // Decompress data
        const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
        if (!decompressed) {
          console.error('❌ Failed to decompress shared data');
          alert('Invalid share URL. The link may be corrupted.');
          return;
        }

        // Parse JSON
        const shareData = JSON.parse(decompressed);

        // Restore all state from shared data
        if (shareData.processedData) setProcessedData(shareData.processedData);
        if (shareData.config) setConfig(shareData.config);
        if (shareData.forecastData) setForecastData(shareData.forecastData);
        if (shareData.aiReport) setAiReport(shareData.aiReport);
        if (shareData.rawOnlineData) setRawOnlineData(shareData.rawOnlineData);
        if (shareData.rawStaffData) setRawStaffData(shareData.rawStaffData);
        if (shareData.rawSlotData) setRawSlotData(shareData.rawSlotData);
        if (shareData.rawCombinedData) setRawCombinedData(shareData.rawCombinedData);

        console.log('✅ Shared dashboard loaded successfully');
        console.log(`📊 Loaded ${shareData.processedData?.length || 0} months of data`);

        // Clear the hash from URL to keep it clean (optional)
        // window.history.replaceState(null, '', window.location.pathname);
      } catch (error) {
        console.error('❌ Failed to load shared dashboard:', error);
        alert('Failed to load shared dashboard. The URL may be invalid or corrupted.');
      }
    };

    loadSharedDashboard();
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

      // Load all 12 months of telephony PDFs
      const pdf1 = await fetchFile(samplePdf1, 'month1.pdf', 'application/pdf');
      const pdf2 = await fetchFile(samplePdf2, 'month2.pdf', 'application/pdf');
      const pdf3 = await fetchFile(samplePdf3, 'month3.pdf', 'application/pdf');
      const pdf4 = await fetchFile(samplePdf4, 'month4.pdf', 'application/pdf');
      const pdf5 = await fetchFile(samplePdf5, 'month5.pdf', 'application/pdf');
      const pdf6 = await fetchFile(samplePdf6, 'month6.pdf', 'application/pdf');
      const pdf7 = await fetchFile(samplePdf7, 'month7.pdf', 'application/pdf');
      const pdf8 = await fetchFile(samplePdf8, 'month8.pdf', 'application/pdf');
      const pdf9 = await fetchFile(samplePdf9, 'month9.pdf', 'application/pdf');
      const pdf10 = await fetchFile(samplePdf10, 'month10.pdf', 'application/pdf');
      const pdf11 = await fetchFile(samplePdf11, 'month11.pdf', 'application/pdf');
      const pdf12 = await fetchFile(samplePdf12, 'month12.pdf', 'application/pdf');

      const exampleFiles = {
        appointments: [apptFile],
        dna: [dnaFile],
        unused: [unusedFile],
        onlineRequests: [onlineFile],
        telephony: [pdf1, pdf2, pdf3, pdf4, pdf5, pdf6, pdf7, pdf8, pdf9, pdf10, pdf11, pdf12]
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

  // Helper function to combine multiple CSV files into one dataset
  // Parses each file and concatenates all rows together
  const combineCSVFiles = async (filesArray) => {
    if (!filesArray || filesArray.length === 0) return [];

    const allRows = [];
    for (const file of filesArray) {
      const rows = await parseCSV(file);
      allRows.push(...rows);
    }
    return allRows;
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
      if (!filesToProcess.appointments || filesToProcess.appointments.length === 0) {
        throw new Error('Please upload an Appointments CSV file.');
      }

      // Parse CSV files (combine multiple files if provided)
      const apptData = await combineCSVFiles(filesToProcess.appointments);
      const dnaData = await combineCSVFiles(filesToProcess.dna);
      const unusedData = await combineCSVFiles(filesToProcess.unused);

      const onlineData = (configToUse.useOnline && filesToProcess.onlineRequests?.length > 0) ? await combineCSVFiles(filesToProcess.onlineRequests) : [];

      // Validate CSV headers and check for privacy violations
      validateHeaders(apptData, ['Date', 'Day'], 'Appointments CSV');
      if (dnaData.length > 0) validateHeaders(dnaData, ['Staff', 'Appointment Count'], 'DNA CSV');
      if (unusedData.length > 0) validateHeaders(unusedData, ['Staff', 'Unused Slots', 'Total Slots'], 'Unused CSV');
      if (onlineData.length > 0) validateHeaders(onlineData, ['Submission started', 'Type', 'Outcome'], 'Online Requests CSV', ['Patient Name', 'Name', 'Patient', 'NHS Number']);

      const monthlyMap = {};
      const staffMap = {};
      const slotMap = {};
      const combinedMap = {};

      // Parse date from multiple formats: "DD/MM/YYYY HH:MM" or "DD MMM YYYY"
      const parseDate = (dateStr) => {
        if (!dateStr) return null;

        // Try format: "01 Aug 2025" or "01 August 2025"
        const monthNames = {
          'jan': 0, 'january': 0,
          'feb': 1, 'february': 1,
          'mar': 2, 'march': 2,
          'apr': 3, 'april': 3,
          'may': 4,
          'jun': 5, 'june': 5,
          'jul': 6, 'july': 6,
          'aug': 7, 'august': 7,
          'sep': 8, 'september': 8,
          'oct': 9, 'october': 9,
          'nov': 10, 'november': 10,
          'dec': 11, 'december': 11
        };

        const parts = dateStr.trim().split(' ');
        if (parts.length === 3) {
          // Format: "01 Aug 2025"
          const day = parseInt(parts[0], 10);
          const monthStr = parts[1].toLowerCase();
          const year = parseInt(parts[2], 10);

          if (monthNames.hasOwnProperty(monthStr) && !isNaN(day) && !isNaN(year)) {
            return new Date(year, monthNames[monthStr], day);
          }
        }

        // Try format: "01/08/2025 HH:MM"
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

      // Helper function to update staff aggregation by month
      const updateStaff = (month, name, type, value) => {
        if (!name) return;
        const key = `${month}_${name}`;
        if (!staffMap[key]) {
          staffMap[key] = { month, staff: name, isGP: isGP(name), totalAppts: 0, dnaCount: 0, unusedSlots: 0 };
        }
        if (type === 'appts') staffMap[key].totalAppts += value;
        else if (type === 'dna') staffMap[key].dnaCount += value;
        else if (type === 'unused') staffMap[key].unusedSlots += value;
      };

      // Helper function to update slot type aggregation by month
      const updateSlot = (month, slotName, type, value, associatedStaffName) => {
        if (!slotName) return;
        const key = `${month}_${slotName}`;
        if (!slotMap[key]) {
          slotMap[key] = { month, slotType: slotName, hasGPActivity: false, totalAppts: 0, dnaCount: 0, unusedSlots: 0 };
        }
        if (type === 'appts') slotMap[key].totalAppts += value;
        else if (type === 'dna') slotMap[key].dnaCount += value;
        else if (type === 'unused') slotMap[key].unusedSlots += value;
        if (associatedStaffName && isGP(associatedStaffName)) {
          slotMap[key].hasGPActivity = true;
        }
      };

      // Helper function to update combined staff + slot aggregation by month
      const updateCombined = (month, staffName, slotName, type, value) => {
        if (!staffName || !slotName) return;
        const key = `${month}_${staffName}_${slotName}`;
        if (!combinedMap[key]) {
          combinedMap[key] = {
            month,
            staff: staffName,
            slotType: slotName,
            isGP: isGP(staffName),
            totalAppts: 0,
            dnaCount: 0,
            unusedSlots: 0
          };
        }
        if (type === 'appts') combinedMap[key].totalAppts += value;
        else if (type === 'dna') combinedMap[key].dnaCount += value;
        else if (type === 'unused') combinedMap[key].unusedSlots += value;
      };

      // Process appointment data: Handle pivot table format where each staff member is a column
      console.log('🔍 Starting appointment processing, rows:', apptData.length);
      if (apptData.length > 0) {
        console.log('  - First row keys:', Object.keys(apptData[0]).slice(0, 5));
        console.log('  - First row sample:', apptData[0]);
      }

      let processedRows = 0;
      for (const row of apptData) {
        const dateStr = row['Date'];
        if (!dateStr) {
          console.log('  ⚠️ Skipping row - no date');
          continue;
        }

        const dateObj = parseDate(dateStr);
        if (!dateObj) {
          console.log('  ⚠️ Skipping row - date parse failed:', dateStr);
          continue;
        }

        const monthKey = toMonthKey(dateObj);
        const dayOfWeek = row['Day'];

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            dateObj: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1),
            totalAppts: 0,
            daysWithAppts: new Set(),
            onlineTotal: 0,
            onlineClinicalNoAppt: 0
          };
          console.log('  ✅ Created month:', monthKey);
        }

        // Track working days (exclude Sat/Sun)
        const isWorkingDay = dayOfWeek !== 'Sat' && dayOfWeek !== 'Sun';
        if (isWorkingDay) {
          monthlyMap[monthKey].daysWithAppts.add(dateStr);
        }

        // Iterate through all columns (each column is a staff member)
        let staffCount = 0;
        Object.keys(row).forEach(key => {
          if (key === 'Date' || key === 'Day') return;

          let val = row[key];
          if (typeof val === 'string') val = val.trim();
          const count = parseInt(val, 10);
          if (isNaN(count) || count === 0) return;

          monthlyMap[monthKey].totalAppts += count;
          updateStaff(monthKey, key, 'appts', count);
          staffCount++;
        });

        processedRows++;
        if (processedRows <= 3) {
          console.log(`  - Row ${processedRows}: ${dateStr}, ${staffCount} staff with appointments`);
        }
      }
      console.log(`✅ Processed ${processedRows} appointment rows`);
      console.log(`   Created ${Object.keys(monthlyMap).length} months, ${Object.keys(staffMap).length} staff entries`);

      // Calculate working days per month
      Object.values(monthlyMap).forEach(m => {
        m.workingDays = m.daysWithAppts.size;
        delete m.daysWithAppts;
      });

      // Helper to get all months a staff member worked
      const getMonthsForStaff = (name) => {
        return Object.values(staffMap)
          .filter(r => r.staff === name)
          .map(r => r.month);
      };

      // Process DNA data: Distribute missed appointments proportionally across months staff worked
      let totalDNA = 0;
      for (const row of dnaData) {
        const count = parseInt(row['Appointment Count'], 10) || 0;
        const staffName = row['Staff'];
        const slotName = row['Slot Type'];

        totalDNA += count;

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
          // Staff not in appointment data - add to first month
          const firstMonth = Object.keys(monthlyMap)[0];
          if (firstMonth) {
            updateStaff(firstMonth, staffName, 'dna', count);
            if (slotName) {
              updateSlot(firstMonth, slotName, 'dna', count, staffName);
              updateCombined(firstMonth, staffName, slotName, 'dna', count);
            }
          }
        }
      }

      // Process unused slots: Distribute wasted capacity across months staff worked
      let totalUnused = 0;
      for (const row of unusedData) {
        const count = parseInt(row['Unused Slots'], 10) || 0;
        const totalSlots = parseInt(row['Total Slots'], 10) || 0;
        const booked = Math.max(0, totalSlots - count);
        const staffName = row['Staff'];
        const slotName = row['Slot Type'];

        totalUnused += count;

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
          // Staff not in appointment data - add to first month
          const firstMonth = Object.keys(monthlyMap)[0];
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
      }

      // Process online requests data: Transform raw CSV into structured format with computed properties
      const processedOnlineRows = [];
      if (configToUse.useOnline && onlineData.length > 0) {
        onlineData.forEach(row => {
          const dateStr = row['Submission started'];
          if (dateStr) {
            const date = parseDate(dateStr);
            if (date) {
              const monthKey = toMonthKey(date);
              const type = row['Type'];
              const outcome = (row['Outcome'] || '').trim();
              const outcomeLower = outcome.toLowerCase();
              const access = row['Access method'];
              const sex = row['Sex'];
              const age = parseInt(row['Age'], 10);
              const completeStr = row['Submission started'];
              const outcomeStr = row['Outcome dateTime'];

              // Aggregate online totals into monthly map
              if (monthlyMap[monthKey]) {
                monthlyMap[monthKey].onlineTotal += 1;

                // Count clinical requests that didn't result in an appointment
                if (type === 'Clinical' && !outcomeLower.includes('appointment offered') && !outcomeLower.includes('appointment booked')) {
                  monthlyMap[monthKey].onlineClinicalNoAppt += 1;
                }
              }

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
          }
        });
      }

      // Store raw data for tables
      console.log('📊 Data Processing Complete:');
      console.log('  - Staff entries:', Object.keys(staffMap).length);
      console.log('  - Slot entries:', Object.keys(slotMap).length);
      console.log('  - Combined entries:', Object.keys(combinedMap).length);
      console.log('  - Monthly entries:', Object.keys(monthlyMap).length);
      console.log('  - Staff sample:', Object.values(staffMap).slice(0, 3));
      console.log('  - Monthly sample:', Object.values(monthlyMap).slice(0, 2));

      setRawStaffData(Object.values(staffMap));
      setRawSlotData(Object.values(slotMap));
      setRawCombinedData(Object.values(combinedMap));
      if (configToUse.useOnline) setRawOnlineData(processedOnlineRows);

      // Process telephony data: Extract call metrics from PDF reports using regex patterns
      if (configToUse.useTelephony && filesToProcess.telephony && filesToProcess.telephony.length > 0) {
        for (const pdfFile of filesToProcess.telephony) {
          const text = await extractTextFromPDF(pdfFile);

          // Extract month from PDF text
          const monthMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s20\d{2}/i);
          if (monthMatch) {
            const pdfDate = new Date(monthMatch[0]);
            const monthKey = toMonthKey(pdfDate);

            if (monthlyMap[monthKey]) {
              // Extract metrics from PDF text using regex
              const extract = (r) => { const m = text.match(r); return m && m[1] ? parseFloat(m[1].replace(/,/g, '')) : 0; };
              const extractTime = (r) => {
                const m = text.match(r);
                if (m) {
                  let min = 0, sec = 0;
                  const fm = m[0];
                  const mm = fm.match(/(\d+)m/);
                  const sm = fm.match(/(\d+)s/);
                  if (mm) min = parseInt(mm[1]);
                  if (sm) sec = parseInt(sm[1]);
                  return (min * 60) + sec;
                }
                return 0;
              };
              const missedUniqueMatch = text.match(/Missed From Queue\s+Excluding Repeat Callers\s+[\d,]+\s+\(([\d.]+)%\)/i);

              monthlyMap[monthKey].telephony = {
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
        }
      }

      // Sort months chronologically
      const monthsArray = Object.values(monthlyMap).sort((a, b) => a.dateObj - b.dateObj);

      const totalApptsAll = monthsArray.reduce((sum, m) => sum + m.totalAppts, 0);
      // totalDNA and totalUnused are already calculated during DNA/Unused processing above

      // Calculate metrics for each month
      const enrichedMonths = monthsArray.map(m => {
        const { month, dateObj, totalAppts, workingDays, telephony, onlineTotal, onlineClinicalNoAppt } = m;

        // Calculate estimated DNA and unused slots using proportional distribution
        // based on this month's appointment volume relative to total appointments
        const weight = totalApptsAll > 0 ? totalAppts / totalApptsAll : 0;
        const estDNA = Math.round(totalDNA * weight);
        const estUnused = Math.round(totalUnused * weight);

        const t = telephony || {};

        const gpAppts = Object.values(staffMap)
          .filter(s => isGP(s.staff))
          .reduce((sum, s) => sum + (s.totalAppts * weight), 0);

        const estGPDNA = Math.round(estDNA * (gpAppts / (totalAppts || 1)));
        const estGPUnused = Math.round(estUnused * (gpAppts / (totalAppts || 1)));

        // Primary metric: "Patients with GP Appointment or Resolved Online Request per Day (%)"
        // Combines traditional face-to-face appointments with digitally resolved requests
        // Provides true picture of GP capacity including modern triage methods
        const gpTriageCapacityPerDayPct = workingDays > 0 && configToUse.population > 0
          ? (((gpAppts + (onlineClinicalNoAppt || 0)) / workingDays) / configToUse.population * 100)
          : 0;

        const gpRatio = t.inboundAnswered > 0 ? (gpAppts / t.inboundAnswered) : 0;
        const gpMissedDemand = gpRatio * (t.missedFromQueueExRepeat || 0);
        const gpWaste = estGPUnused + estGPDNA;
        const extraSlotsPerDay = workingDays > 0 ? ((gpMissedDemand - gpWaste) / workingDays) : 0;

        return {
          month,
          dateObj,
          totalAppts,
          workingDays,
          gpAppts,
          estDNA,
          estUnused,
          estGPDNA,
          estGPUnused,
          onlineTotal: onlineTotal || 0,
          onlineClinicalNoAppt: onlineClinicalNoAppt || 0,
          onlineRequestsPer1000: configToUse.population > 0 ? ((onlineTotal || 0) / configToUse.population * 1000) / 4 : 0,
          gpTriageCapacityPerDayPct,
          gpApptsPerDay: workingDays > 0 ? (gpAppts / configToUse.population * 100) / workingDays : 0,
          gpUtilization: (gpAppts + estGPUnused) > 0 ? (gpAppts / (gpAppts + estGPUnused) * 100) : 0,
          gpDNAPct: gpAppts > 0 ? (estGPDNA / gpAppts * 100) : 0,
          gpUnusedPct: gpAppts > 0 ? (estGPUnused / gpAppts * 100) : 0,
          conversionRatio: t.inboundAnswered ? (totalAppts / t.inboundAnswered) : 0,
          gpConversionRatio: t.inboundAnswered ? (gpAppts / t.inboundAnswered) : 0,
          utilization: (totalAppts + estUnused) > 0 ? (totalAppts / (totalAppts + estUnused) * 100) : 0,
          allApptsPerDay: workingDays > 0 ? (totalAppts / configToUse.population * 100) / workingDays : 0,
          allUnusedPct: (totalAppts + estUnused) > 0 ? (estUnused / (totalAppts + estUnused) * 100) : 0,
          allDNAPct: totalAppts > 0 ? (estDNA / totalAppts * 100) : 0,
          extraSlotsPerDay,
          inboundTotal: t.inboundReceived || 0,
          ...t
        };
      });

      console.log('📈 Enriched Months:', enrichedMonths.length, 'months');
      console.log('  - Sample month data:', enrichedMonths[0]);

      setProcessedData(enrichedMonths);

      // Generate forecast data using linear regression
      if (enrichedMonths.length >= 3) {
        const totalApptsData = enrichedMonths.map(m => m.totalAppts);
        const gpApptsData = enrichedMonths.map(m => m.gpAppts);
        const inboundTotalData = enrichedMonths.map(m => m.inboundTotal || 0);

        const forecastTotalAppts = calculateLinearForecast(totalApptsData, 2);
        const forecastGPAppts = calculateLinearForecast(gpApptsData, 2);
        const forecastInbound = calculateLinearForecast(inboundTotalData, 2);

        const lastMonth = enrichedMonths[enrichedMonths.length - 1].month;
        const nextMonthNames = getNextMonthNames(lastMonth, 2);
        const forecastLabels = [...enrichedMonths.map(m => m.month), ...nextMonthNames];

        setForecastData({
          labels: forecastLabels,
          hasData: true,
          appts: {
            actual: [...totalApptsData, null, null],
            projected: [...totalApptsData, ...forecastTotalAppts]
          },
          calls: {
            actual: [...inboundTotalData, null, null],
            projected: [...inboundTotalData, ...forecastInbound]
          },
          gpAppts: {
            actual: [...gpApptsData, null, null],
            projected: [...gpApptsData, ...forecastGPAppts]
          }
        });
      } else {
        setForecastData({ hasData: false, count: enrichedMonths.length });
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
      // Comprehensive metric definitions with titles and descriptions for AI context
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
          title: 'Percentage of patient population with GP appointments per working day',
          description: 'Percentage of patient population with GP appointments per working day so that practices can standardise the number of appointments per population',
          format: 'percent1'
        },
        {
          key: 'allApptsPerDay',
          title: 'Percentage of patient population with any appointment per working day',
          description: 'Percentage of patient population with any staff appointment per working day so that practices can standardise the number of appointments per population',
          format: 'percent1'
        },
        {
          key: 'utilization',
          title: 'Utilisation (all clinicians)',
          description: 'Percentage of all appointment slots used',
          format: 'percent1'
        },
        {
          key: 'gpUtilPct',
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
          title: 'Calls abandoned at by the patient (NOT MISSED)',
          description: 'Calls that were abandoned by the caller before being answered when they listen to the IVF messaging. A high % here is not a bad thing and indicates effective call flow.',
          format: 'number'
        },
        {
          key: 'callbacksSuccessful',
          title: 'Number of Callbacks successful',
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
          key: 'gpBookConv',
          title: 'Booking conversion (GP)',
          description: 'Ratio of calls that resulted in a GP appointment booking',
          format: 'decimal2'
        },
        {
          key: 'extraSlots',
          title: 'Extra slots required per day',
          description: 'Extra slots required per day over the different months. Sometimes this is minus if meeting capacity',
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

      const dataSummary = processedData.map(d => ({
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
        Analyse the following monthly performance data for ${config.surgeryName || 'this practice'} (Population: ${config.population}).

        Each metric includes a title and description to avoid ambiguity. Base all interpretations on these fields, not the raw field names.

        Data (month by month): ${JSON.stringify(dataSummary, null, 2)}

        IMPORTANT: Start your response DIRECTLY with the first section heading. Do NOT include any introduction, preamble, or explanatory text before the sections.

        Provide your analysis in exactly these two sections using bullet points:

        ### ✅ Positives
        * Highlight metrics that are performing well.

        ### 🚀 Room for Improvement & Actions
        * Identify specific issues.
        * Logic:
            * If **Online Requests** are high but **Patients with a GP appointment or resolved online request per day (%)** is low, suggest: "High digital demand is not being fully captured in clinical workload data."
            * If **Booking Conversion** is low, suggest: "High call volume not converting to appts. Review signposting."
            * If **Utilization** is low (<95%), suggest: "Wasted capacity. Review slot types in rotas where slots are going unused. This may look like unused capacity in national data sets."
            * If **DNA Rate** is high (>7%), suggest: "High DNA rate impacting capacity. Consider reviewing reminder systems."
            * If **Average Queue Time (missed)** is high (>120s), suggest: "Long wait times leading to missed calls. Review telephony staffing."
            * If **Extra slots required per day** is positive, suggest: "Consider increasing daily appointment slots by approximately X to meet demand."
            * If Abandoned Calls % is high (>20%), suggest: "High abandoned call rate. This means your call flow is effective"
            * If **Patients with a GP appointment or resolved online request per day (%)** is below 1.0%, suggest: "Low GP capacity per patient population. Consider recruitment strategies to increase access."
            * If Abandoned Calls % is low (<10%), suggest: "Low abandoned call rate. This may indicate your call flow is inneffective and too short"
            * If **Online Requests per 1,000 patients** is low (<50 per month), suggest: "Low online request volume. Promote digital access channels to patients or open up digital capacity"
            * If Missed Call Rate (unique) is high (>10%), suggest: "High unique missed call rate. Review telephony call flow and staffing levels at peak times."
            * If Missed Call Rate (unique) is low (<5%), suggest: "Low unique missed call rate. This may indicate insufficient call queue capacity leading to abandoned calls."
            * If **GP DNA Rate** is high (>10%), suggest: "High GP DNA rate impacting capacity. Consider targeted interventions for DNA reduction such as SystmOne DNA Probability Report."
            * If Patients with a GP appointment per day (%) is above 1.6%, suggest: "High GP Capacity per patient population. Consider if this is sustainable long-term and review clinical workforce wellbeing."
            * If patients with a GP appointment or resolved online request per day (%) is above 2.0%, suggest: "Very high GP capacity per patient population. This may not be sustainable long-term and could indicate over-servicing. Review clinical workforce wellbeing."
            * If patients with a GP appointment per day (%) is below 1.0%, suggest: "Low GP capacity per patient population. Consider recruitment strategies to increase access."
            * If telephony metrics show poor performance and Online Access method shows a high number of Practice Initiated Link (>20% of online requests), suggest: "Your staff may do too many online requests for patients. Consider promoting online access channels to reduce telephony demand."
            * If Patients with a GP appointment or resolved online request per day (%) is between 1.0% and 1.6%, acknowledge this as a reasonable level of access but suggest continuous monitoring to maintain balance between access and workforce wellbeing.
            * If missed call rate (unique) is between 5% and 10%, acknowledge this as a reasonable performance but suggest continuous monitoring to optimise telephony access.

            * Apply additional best-practice logic from NHS UK access improvement guidance when proposing actions.

        Keep the tone professional, constructive, and specific to NHS Primary Care. Use British English.
      `;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: [{ parts: [{ text: prompt }] }],
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error('No response generated from AI');

      setAiReport(text);
      setIsAiLoading(false);
    } catch (err) {
      console.error("AI Error:", err.message);
      setAiError(`AI analysis failed: ${err.message}`);
      setIsAiLoading(false);
    }
  };

  // PDF Export handler
  const handleExportPDF = async () => {
    try {
      const previousMonth = selectedMonth;
      const previousTab = activeTab;

      // Show all data for complete report
      if (selectedMonth !== 'All') {
        setSelectedMonth('All');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Create PDF in landscape mode
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // ===== PAGE 1: NHS BLUE COVER PAGE =====
      pdf.setFillColor(0, 94, 184); // NHS Blue
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Add logo with white rounded box background
      const logoImg = new Image();
      logoImg.src = logo;
      await new Promise(resolve => { logoImg.onload = resolve; });

      // White rounded box for logo
      pdf.setFillColor(255, 255, 255);
      const logoBoxSize = 60;
      const logoBoxX = pageWidth / 2 - logoBoxSize / 2;
      const logoBoxY = 35;
      pdf.roundedRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 8, 8, 'F');

      // Logo centered in white box
      pdf.addImage(logoImg, 'PNG', pageWidth / 2 - 25, 40, 50, 50);

      // Practice name in white NHS font
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(36);
      pdf.setFont('helvetica', 'bold');
      pdf.text(config.surgeryName || 'Surgery Report', pageWidth / 2, 120, { align: 'center' });

      // Title
      pdf.setFontSize(48);
      const dateRange = displayedData && displayedData.length > 0
        ? `${displayedData[0].month} - ${displayedData[displayedData.length - 1].month}`
        : 'N/A';
      pdf.text('Capacity & Access Data', pageWidth / 2, 145, { align: 'center' });

      // Date range
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'normal');
      pdf.text(dateRange, pageWidth / 2, 160, { align: 'center' });

      // www.CAIP.app on front page
      pdf.setFontSize(16);
      pdf.text('www.CAIP.app', pageWidth / 2, 175, { align: 'center' });

      // ===== PAGE 2: AI ANALYSIS (with placeholder if not generated) =====
      pdf.addPage();
      pdf.setFillColor(0, 94, 184);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('C', 10, 13);

      // Highlight "AI" in CAIP
      pdf.setTextColor(255, 215, 0); // Gold color for AI
      pdf.text('AI', 17, 13);
      pdf.setTextColor(255, 255, 255);
      pdf.text('P Analysis', 28, 13);

      if (aiReport) {
        // Show AI analysis content
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(aiReport, pageWidth - 20);
        pdf.text(lines, 10, 30);
      } else {
        // Show placeholder message
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.text('CAIP Analysis using AI has not been generated.', pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });
        pdf.text('Go back and press CAIP Analysis before exporting your data', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
        pdf.text('to include your analysis.', pageWidth / 2, pageHeight / 2 + 25, { align: 'center' });
      }

      // ===== CAPTURE SECTIONS AS IMAGES =====
      const sectionConfigs = [
        { id: 'overview-section', title: 'Overview', tab: 'dashboard' },
        { id: 'gp-metrics-section', title: 'GP Metrics', tab: 'gp' },
      ];

      if (config.useOnline && onlineStats) {
        sectionConfigs.push({ id: 'online-section', title: 'Online Requests', tab: 'online' });
      }

      if (config.useTelephony) {
        sectionConfigs.push({ id: 'telephony-section', title: 'Telephony', tab: 'telephony' });
      }

      sectionConfigs.push({ id: 'forecast-section', title: 'Demand Forecast', tab: 'forecast' });

      for (const section of sectionConfigs) {
        // Switch to the tab to make content visible
        setActiveTab(section.tab);
        await new Promise(resolve => setTimeout(resolve, 800)); // Wait for render and tables to expand

        const element = document.getElementById(section.id);
        if (!element) continue;

        // Expand all accordions/tables in the section before capturing
        const accordions = element.querySelectorAll('[data-accordion]');
        accordions.forEach(acc => {
          const button = acc.querySelector('button');
          if (button && button.getAttribute('aria-expanded') === 'false') {
            button.click();
          }
        });
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for accordion expansion

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 20;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addPage();

        // Blue header bar with white text
        pdf.setFillColor(0, 94, 184);
        pdf.rect(0, 0, pageWidth, 20, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(section.title, 10, 13);

        // Add section image
        let position = 30;
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);

        // Handle content that spans multiple pages
        let heightLeft = imgHeight - (pageHeight - position);
        while (heightLeft > 0) {
          pdf.addPage();
          pdf.setFillColor(0, 94, 184);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.text(section.title + ' (continued)', 10, 13);

          position = 30 - (imgHeight - heightLeft);
          pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
          heightLeft -= (pageHeight - 30);
        }
      }

      // ===== LAST PAGE: DISCLAIMER & ADVERTISING =====
      pdf.addPage();

      pdf.setFillColor(0, 94, 184);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Important Information', 10, 13);

      // Disclaimer
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      const disclaimerText = 'By generating the dashboard, I understand that this tool is for decision support only and does not constitute clinical advice. Data processing happens locally in your browser, but AI analysis (if used) sends anonymized statistical data to third-party services.';
      const disclaimerLines = pdf.splitTextToSize(disclaimerText, pageWidth - 20);
      pdf.text(disclaimerLines, 10, 35);

      // Advertising
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 94, 184);
      pdf.text('Create your own practice dashboard for free at www.CAIP.app', pageWidth / 2, pageHeight - 40, { align: 'center' });

      // Logo at bottom
      pdf.addImage(logoImg, 'PNG', pageWidth / 2 - 15, pageHeight - 30, 30, 30);

      // Save PDF
      const filename = `CAIP-Analytics-${config.surgeryName?.replace(/\s+/g, '-') || 'Report'}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

      // Restore previous selections
      setActiveTab(previousTab);
      if (previousMonth !== 'All') {
        setTimeout(() => setSelectedMonth(previousMonth), 100);
      }

    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  // Share dashboard handler - generates shareable URL with compressed data
  // Export dashboard to Excel file
  const handleExportToExcel = async () => {
    try {
      setExcelLoading(true);

      if (!processedData || processedData.length === 0) {
        setToast({ type: 'error', message: 'No data to export. Please process your files first.' });
        return;
      }

      const exportData = {
        processedData,
        config,
        forecastData,
        aiReport,
        rawOnlineData,
        rawStaffData,
        rawSlotData,
        rawCombinedData,
      };

      const workbook = exportDemandCapacityToExcel(exportData);
      const filename = generateExcelFilename('demand-capacity', config.surgeryName || 'Dashboard');

      XLSX.writeFile(workbook, filename);

      setShareType('excel');
      setShareUrl(null);
      setShareExpiresAt(null);
      setShowShareOptions(false);
      setToast({ type: 'success', message: 'Excel file downloaded successfully!' });
    } catch (error) {
      console.error('Excel export failed:', error);
      setToast({ type: 'error', message: `Export failed: ${error.message}` });
    } finally {
      setExcelLoading(false);
    }
  };

  // Generate Firebase share link
  const handleGenerateShareLink = async () => {
    try {
      setShareLoading(true);

      if (!processedData || processedData.length === 0) {
        setToast({ type: 'error', message: 'No data to share. Please process your files first.' });
        return;
      }

      // Prevent sharing of sample/example data to reduce abuse
      if (config?.surgeryName === 'Example Surgery') {
        setToast({ type: 'error', message: 'Cannot share example data. Please upload your own data to create share links.' });
        return;
      }

      const shareData = {
        processedData,
        config,
        forecastData,
        aiReport,
        rawOnlineData,
        rawStaffData,
        rawSlotData,
        rawCombinedData,
      };

      const { shareUrl: generatedUrl, expiresAt } = await createFirebaseShare(shareData, 'demand-capacity');

      await navigator.clipboard.writeText(generatedUrl);

      setShareType('firebase');
      setShareUrl(generatedUrl);
      setShareExpiresAt(expiresAt);
      setShowShareOptions(false);
      setToast({ type: 'success', message: 'Link copied to clipboard!' });
    } catch (error) {
      console.error('Share link generation failed:', error);
      setToast({ type: 'error', message: error.message });
    } finally {
      setShareLoading(false);
    }
  };

  // Import dashboard from Excel file
  const handleImportExcel = async (file) => {
    try {
      setImportLoading(true);
      setIsProcessing(true);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);

      validateExcelFile(workbook, 'demand-capacity');

      const restored = restoreDemandCapacityFromExcel(workbook);

      setProcessedData(restored.processedData);
      setConfig(restored.config);
      setForecastData(restored.forecastData);
      setAiReport(restored.aiReport);
      setRawOnlineData(restored.rawOnlineData);
      setRawStaffData(restored.rawStaffData);
      setRawSlotData(restored.rawSlotData);
      setRawCombinedData(restored.rawCombinedData);

      setDataSource('local');
      setMainTab('demand');
      setToast({ type: 'success', message: 'Dashboard restored from Excel!' });
    } catch (error) {
      console.error('Import failed:', error);
      setToast({ type: 'error', message: `Import failed: ${error.message}` });
    } finally {
      setImportLoading(false);
      setIsProcessing(false);
    }
  };

  // Copy AI report to clipboard
  const handleCopyAIReport = async () => {
    if (!aiReport) return;
    try {
      await navigator.clipboard.writeText(aiReport);
      // Could add a toast notification here if desired
      console.log('✅ AI report copied to clipboard');
    } catch (err) {
      console.error('❌ Failed to copy to clipboard:', err);
    }
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
      dna: [],
      unused: [],
      onlineRequests: [],
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

  const aggregatedStaffData = useMemo(() => {
    const data = getAggregatedData(rawStaffData, selectedMonth, processedData);

    // Group by staff name and sum across months
    const grouped = {};
    data?.forEach(item => {
      const key = item.staff;
      if (!grouped[key]) {
        grouped[key] = { name: item.staff, appts: 0, unused: 0, dna: 0, isGP: item.isGP };
      }
      grouped[key].appts += item.totalAppts || 0;
      grouped[key].unused += item.unusedSlots || 0;
      grouped[key].dna += item.dnaCount || 0;
    });

    const result = Object.values(grouped).sort((a, b) => b.appts - a.appts);
    console.log('👥 Aggregated Staff Data:', result?.length || 0, 'entries');
    if (result && result.length > 0) console.log('  - Sample:', result[0]);
    return result;
  }, [rawStaffData, selectedMonth, processedData, getAggregatedData]);

  const aggregatedSlotData = useMemo(() => {
    const data = getAggregatedData(rawSlotData, selectedMonth, processedData);

    // Group by slot type and sum across months
    const grouped = {};
    data?.forEach(item => {
      const key = item.slotType;
      if (!grouped[key]) {
        grouped[key] = { name: item.slotType, appts: 0, unused: 0, dna: 0, hasGPActivity: false };
      }
      grouped[key].appts += item.totalAppts || 0;
      grouped[key].unused += item.unusedSlots || 0;
      grouped[key].dna += item.dnaCount || 0;
      if (item.hasGPActivity) grouped[key].hasGPActivity = true;
    });

    return Object.values(grouped).sort((a, b) => b.appts - a.appts);
  }, [rawSlotData, selectedMonth, processedData, getAggregatedData]);

  const aggregatedCombinedData = useMemo(() => {
    const data = getAggregatedData(rawCombinedData, selectedMonth, processedData);

    // Group by staff + slot combination and sum across months
    const grouped = {};
    data?.forEach(item => {
      const key = `${item.staff}|||${item.slotType}`;
      if (!grouped[key]) {
        grouped[key] = {
          name: item.staff,
          slot: item.slotType,
          appts: 0,
          unused: 0,
          dna: 0,
          isGP: item.isGP
        };
      }
      grouped[key].appts += item.totalAppts || 0;
      grouped[key].unused += item.unusedSlots || 0;
      grouped[key].dna += item.dnaCount || 0;
    });

    return Object.values(grouped).sort((a, b) => b.appts - a.appts);
  }, [rawCombinedData, selectedMonth, processedData, getAggregatedData]);

  // Calculate online request statistics
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
  // Helper function to create line chart data (uses displayedData from component scope)
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

  // Helper function to create donut chart data with percentages and counts
  const createDonutData = (data, colors) => {
    const values = Object.values(data || {});
    const labels = Object.keys(data || {});
    const total = values.reduce((sum, val) => sum + val, 0);

    return {
      labels: labels.map((label, i) => {
        const percentage = total > 0 ? ((values[i] / total) * 100).toFixed(1) : 0;
        return `${label}: ${values[i]} (${percentage}%)`;
      }),
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
      }]
    };
  };

  const createForecastChartData = (labelActual, labelProjected, dataObj, color) => ({
    labels: forecastData?.labels || [],
    datasets: [
      {
        label: labelActual,
        data: dataObj?.actual || [],
        borderColor: color,
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: labelProjected,
        data: dataObj?.projected || [],
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
          <button
            onClick={() => {
              setDataSource(null);
              window.history.pushState(null, '', '/');
            }}
            className="flex items-center gap-2 sm:gap-4 hover:opacity-80 transition-opacity"
            title="Back to Home"
          >
            <img src={logo} alt="CAIP Logo" className="h-10 w-10 rounded-lg object-cover" />
            <div className="text-left">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">CAIP Analytics <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full align-middle ml-2">{APP_VERSION}</span></h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium hidden sm:block">Free data analytics to help you improve capacity and access in primary care</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProcessingInfo(true)}
              className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 transition-all"
              title="Data Processing"
            >
              <Activity size={16} className="text-blue-500" />
            </button>
            <button
              onClick={() => setShowBugReport(true)}
              className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-amber-300 transition-all"
              title="Report a Bug"
            >
              <AlertTriangle size={16} className="text-amber-500" />
            </button>
            <button
              onClick={() => setShowAbout(true)}
              className="p-1.5 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-purple-300 transition-all"
              title="About CAIP.app"
            >
              <HelpCircle size={16} className="text-purple-500" />
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

            {/* Only show month filter and reset for Demand & Capacity section */}
            {dataSource === 'local' && mainTab === 'demand' && processedData && (
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
        {/* INTRO SPLASH PAGE - Choose data source */}
        {!dataSource && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Welcome to CAIP Analytics</h2>
              <p className="text-lg text-slate-600 mb-4">
                Analyse and optimise your primary care demand, capacity, and performance metrics.
              </p>
              <button
                onClick={() => setShowAbout(true)}
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 hover:underline"
              >
                <Info size={16} />
                Learn More
              </button>
            </div>

            <h3 className="text-center text-lg font-semibold text-slate-700 mb-6">Choose your data source</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Local Data Card */}
              <button
                onClick={() => { setDataSource('local'); setMainTab('demand'); }}
                className="group bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all text-left"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-100 transition-colors">
                  <Upload size={28} />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Local Data</h4>
                <p className="text-slate-500 text-sm mb-4">
                  Upload your own practice data for personalised analysis and insights.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">Demand & Capacity</span>
                  <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full font-medium">Triage Slots</span>
                </div>
              </button>

              {/* National Data Card */}
              <button
                onClick={() => { setDataSource('national'); setMainTab('telephony'); }}
                className="group bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200 hover:border-green-400 hover:shadow-xl transition-all text-left"
              >
                <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mb-4 group-hover:bg-green-100 transition-colors">
                  <Users size={28} />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">National Data</h4>
                <p className="text-slate-500 text-sm mb-4">
                  Explore NHS England national datasets and benchmark your practice.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-cyan-50 text-cyan-700 rounded-full font-medium">Telephony</span>
                  <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium">Online Consultations</span>
                </div>
              </button>
            </div>

            {/* Import Card - Below main options */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl shadow border border-slate-200">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center text-slate-600">
                      <Download size={24} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-slate-900 mb-1">Import CAIP Data File</h4>
                    <p className="text-sm text-slate-600 mb-4">
                      Have a previously exported .xlsx file? Import it to restore your dashboard and continue your analysis.
                    </p>
                    <ImportButton
                      onImport={handleImportExcel}
                      loading={importLoading}
                      label="Import Dashboard"
                      variant="secondary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN TAB NAVIGATION - Two-level navigation when data source selected */}
        {dataSource && (
          <>
            {/* Level 1: Data Source Toggle */}
            <div className="flex justify-center mb-4" data-html2canvas-ignore="true">
              <div className="bg-slate-100 p-1 rounded-lg inline-flex">
                <button
                  onClick={() => { setDataSource('local'); setMainTab('demand'); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${dataSource === 'local' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Local Data
                </button>
                <button
                  onClick={() => { setDataSource('national'); setMainTab('telephony'); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${dataSource === 'national' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  National Data
                </button>
              </div>
            </div>

            {/* Level 2: Sub-tabs based on data source */}
            <div className="flex justify-center mb-8" data-html2canvas-ignore="true">
              <div className="bg-white p-1.5 rounded-xl shadow-lg border-2 border-slate-200 inline-flex">
                {dataSource === 'local' && (
                  <>
                    <button
                      onClick={() => setMainTab('demand')}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${mainTab === 'demand' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <BarChart3 size={20} />
                      <span className="flex items-center gap-2">
                        Demand & Capacity
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold ${mainTab === 'demand' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                          Beta
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => setMainTab('triage')}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${mainTab === 'triage' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <Activity size={20} />
                      <span className="flex items-center gap-2">
                        Triage Slots
                        <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-bold ${mainTab === 'triage' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                          Beta
                        </span>
                      </span>
                    </button>
                  </>
                )}
                {dataSource === 'national' && (
                  <>
                    <button
                      onClick={() => setMainTab('telephony')}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${mainTab === 'telephony' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <Phone size={20} />
                      Telephony
                    </button>
                    <button
                      onClick={() => setMainTab('online-consultations')}
                      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${mainTab === 'online-consultations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <Monitor size={20} />
                      Online Consultations
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* See Example Button - Only on Demand & Capacity tab */}
        {dataSource === 'local' && mainTab === 'demand' && !processedData && (
          <div className="flex justify-center mb-6" data-html2canvas-ignore="true">
            <button
              onClick={loadExampleData}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all font-medium shadow-sm hover:shadow"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              See Example
            </button>
          </div>
        )}

        {/* DEMAND & CAPACITY TAB */}
        {dataSource === 'local' && mainTab === 'demand' && !processedData && (
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
                helpText="TPP SystmOne limits to 1 year per extract - Multiple files supported for multi-year analysis"
                accept=".csv"
                file={files.appointments}
                isMulti={true}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFiles(prev => ({ ...prev, appointments: [...prev.appointments, ...Array.from(e.target.files)] }));
                  }
                }}
                onRemove={(index) => {
                  setFiles(prev => ({ ...prev, appointments: prev.appointments.filter((_, i) => i !== index) }));
                }}
              />
              <FileInput
                label="DNA Extract (CSV) *"
                helpText={<>(Must tick <strong>Staff Name</strong> and <strong>Slot Type</strong> in SystmOne) • Multiple files supported (3 months max per file)</>}
                accept=".csv"
                file={files.dna}
                isMulti={true}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFiles(prev => ({ ...prev, dna: [...prev.dna, ...Array.from(e.target.files)] }));
                  }
                }}
                onRemove={(index) => {
                  setFiles(prev => ({ ...prev, dna: prev.dna.filter((_, i) => i !== index) }));
                }}
              />
              <FileInput
                label="Unused Extract (CSV) *"
                helpText={<>(Must tick <strong>Staff Name</strong> and <strong>Slot Type</strong> in SystmOne) • Multiple files supported (3 months max per file)</>}
                accept=".csv"
                file={files.unused}
                isMulti={true}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFiles(prev => ({ ...prev, unused: [...prev.unused, ...Array.from(e.target.files)] }));
                  }
                }}
                onRemove={(index) => {
                  setFiles(prev => ({ ...prev, unused: prev.unused.filter((_, i) => i !== index) }));
                }}
              />
              <FileInput
                label="Online Requests (CSV) - SystmConnect"
                helpText="Misc Reports → SystmConnect Report (Remove Patient Name column) • Multiple files supported (5000 rows max per file)"
                accept=".csv"
                file={files.onlineRequests}
                isMulti={true}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFiles(prev => ({ ...prev, onlineRequests: [...prev.onlineRequests, ...Array.from(e.target.files)] }));
                  }
                }}
                onRemove={(index) => {
                  setFiles(prev => ({ ...prev, onlineRequests: prev.onlineRequests.filter((_, i) => i !== index) }));
                }}
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

              <DisclaimerNotice />

              <button
                onClick={() => processFiles()}
                disabled={isProcessing || files.appointments.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all
                   ${isProcessing || files.appointments.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]'}
                 `}
              >
                {isProcessing ? 'Analysing Data...' : 'Generate Dashboard'}
              </button>
            </Card>
          </div>
        )}

        {dataSource === 'local' && mainTab === 'demand' && processedData && (
          <div className="animate-in fade-in duration-700" id="dashboard-content">
            {/* Practice Header - Visible on screen and print */}
            {config.surgeryName && (
              <Card className="mb-6 text-center bg-gradient-to-br from-blue-50 to-white border-blue-100">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{config.surgeryName}</h1>
                <p className="text-sm text-slate-500">
                  Practice Population: <span className="font-semibold text-slate-700">{config.population?.toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-400 mt-2 print:block">Generated on {new Date().toLocaleDateString()}</p>
              </Card>
            )}

            {aiReport && (
              <Card className="mb-8 bg-gradient-to-br from-indigo-50 to-white border-indigo-100 animate-in slide-in-from-top-4 duration-500 shadow-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                    <Sparkles size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-indigo-900">CAIP Analysis</h3>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={handleCopyAIReport}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy size={14} />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => setIsAiMinimized(!isAiMinimized)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title={isAiMinimized ? "Expand" : "Minimize"}
                    >
                      {isAiMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                    </button>
                    <button
                      onClick={() => {
                        setAiReport(null);
                        setIsAiMinimized(false);
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {!isAiMinimized && (
                  <div className="prose prose-sm prose-indigo max-w-none">
                    <SimpleMarkdown text={aiReport} />
                  </div>
                )}
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
                onClick={() => setShowAIConsent(true)}
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

              {/* 2. Export PDF Button - Hidden for now */}
              <button
                onClick={handleExportPDF}
                className="hidden flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-70"
              >
                <Download size={18} />
                <span className="font-semibold">Export PDF</span>
              </button>

              {/* 3. Share Button with dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowShareOptions(!showShareOptions)}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-70"
                >
                  <Share2 size={18} />
                  <span className="font-semibold">Share Dashboard</span>
                  <ChevronDown size={16} className={`transition-transform ${showShareOptions ? 'rotate-180' : ''}`} />
                </button>
                <ShareOptionsModal
                  isOpen={showShareOptions}
                  onClose={() => setShowShareOptions(false)}
                  onExportExcel={handleExportToExcel}
                  onGenerateLink={handleGenerateShareLink}
                  excelLoading={excelLoading}
                  linkLoading={shareLoading}
                />
              </div>
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
              <div id="overview-section" className="space-y-6">
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
              <div id="gp-metrics-section" className="space-y-6">
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
                    <p className="text-xs text-slate-400 mb-4">Total GP appointments</p>
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
              <div id="online-section" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card className="p-4 flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-400 uppercase">Total Online Requests</p>
                    <h3 className="text-2xl font-bold text-teal-600">{displayedData.reduce((a, b) => a + (b.onlineTotal || 0), 0).toLocaleString()}</h3>
                  </Card>
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
                  <Card>
                    <h3 className="font-bold text-slate-700 mb-4">Request Type</h3>
                    <div className="h-56 relative flex items-center justify-center">
                      <Doughnut data={createDonutData(onlineStats.typeBreakdown, [NHS_BLUE, NHS_AMBER])} options={donutOptions} />
                    </div>
                  </Card>
                  <Card>
                    <h3 className="font-bold text-slate-700 mb-4">Access Method</h3>
                    <div className="h-56 relative flex items-center justify-center">
                      <Doughnut data={createDonutData(onlineStats.accessMethod, [NHS_GREEN, NHS_PURPLE, NHS_AQUA])} options={donutOptions} />
                    </div>
                  </Card>
                  <Card>
                    <h3 className="font-bold text-slate-700 mb-4">Patient Sex</h3>
                    <div className="h-56 relative flex items-center justify-center">
                      <Doughnut data={createDonutData(onlineStats.sexSplit, [NHS_BLUE, NHS_PINK])} options={donutOptions} />
                    </div>
                  </Card>
                </div>

                <Card className="h-80">
                  <h3 className="font-bold text-slate-700 mb-2">Online Request Rate</h3>
                  <p className="text-xs text-slate-400 mb-4">Requests per 1000 patients per week</p>
                  <Line data={createChartData('Requests/1000/wk', 'onlineRequestsPer1000', NHS_AQUA, false)} options={onlineRequestBandOptions} />
                </Card>

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
              <div id="telephony-section" className="space-y-6">
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
                      ].map((m, i) => {
                        const lastMonth = displayedData[displayedData.length - 1] || {};
                        const value = lastMonth[m.k] || 0;
                        return (
                          <Card key={i} className="p-4 border border-slate-200 shadow-none bg-slate-50">
                            <p className="text-xs font-bold text-slate-400 uppercase">{m.l}</p>
                            <p className={`text-xl font-bold ${m.c} mt-1`}>
                              {m.fmt ? m.fmt(value) : `${value.toLocaleString()}${m.suffix || ''}`}
                            </p>
                            <p className="text-[10px] text-slate-400">{selectedMonth === 'All' ? 'Latest Month' : selectedMonth}</p>
                          </Card>
                        );
                      })}
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
              <div id="forecast-section" className="max-w-4xl mx-auto space-y-6">
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

          </div>
        )}

        {/* NATIONAL DATA - Only mount components when user first visits national data */}
        {nationalDataVisited && (
          <>
            {/* NATIONAL DATA UNIFIED LOADING SCREEN */}
            {dataSource === 'national' && nationalDataLoading && (
              <FancyNationalLoader type="combined" />
            )}

            {/* NATIONAL TELEPHONY CONTENT - Keep mounted once visited, use CSS to hide */}
            <div className={dataSource === 'national' && mainTab === 'telephony' && !nationalDataLoading ? '' : 'hidden'}>
              <NationalTelephony
                sharedPractice={sharedPractice}
                setSharedPractice={setSharedPractice}
                sharedBookmarks={sharedBookmarks}
                updateSharedBookmarks={updateSharedBookmarks}
                sharedUsageStats={sharedUsageStats}
                recordPracticeUsage={recordPracticeUsage}
                onLoadingChange={setTelephonyLoading}
              />
            </div>

            {/* NATIONAL ONLINE CONSULTATIONS CONTENT - Keep mounted once visited, use CSS to hide */}
            <div className={dataSource === 'national' && mainTab === 'online-consultations' && !nationalDataLoading ? '' : 'hidden'}>
              <NationalOnlineConsultations
                sharedPractice={sharedPractice}
                setSharedPractice={setSharedPractice}
                sharedBookmarks={sharedBookmarks}
                updateSharedBookmarks={updateSharedBookmarks}
                sharedUsageStats={sharedUsageStats}
                recordPracticeUsage={recordPracticeUsage}
                onLoadingChange={setOcLoading}
              />
            </div>
          </>
        )}

        {/* TRIAGE SLOT ANALYSIS CONTENT */}
        <div className={dataSource === 'local' && mainTab === 'triage' ? '' : 'hidden'}>
          <TriageSlotAnalysis />
        </div>

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
          setFiles({ appointments: [], dna: [], unused: [], onlineRequests: [], telephony: [] });
          setRawStaffData([]);
          setRawSlotData([]);
          setRawCombinedData([]);
          setRawOnlineData([]);
          setForecastData(null);
          setShowResetConfirm(false);
        }}
      />

      <AIConsentModal
        isOpen={showAIConsent}
        onClose={() => setShowAIConsent(false)}
        onProceed={() => {
          setShowAIConsent(false);
          runAIAnalysis();
        }}
      />

      <ShareModal
        isOpen={shareUrl !== null || shareType === 'excel'}
        onClose={() => {
          setShareUrl(null);
          setShareType('firebase');
          setShareExpiresAt(null);
        }}
        shareUrl={shareUrl}
        shareType={shareType}
        expiresAt={shareExpiresAt}
      />

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />

      <AboutModal
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
        onOpenBugReport={() => setShowBugReport(true)}
        timesUsed={sharedUsageStats?.totalChecks || 0}
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
