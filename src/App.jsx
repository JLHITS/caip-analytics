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
  donutOptions,
  pdfChartOptions, pdfPercentageOptions, pdfGpBandOptions, pdfStackedPercentageOptions,
  pdfRatioOptions, pdfUtilizationOptions, pdfTimeOptions
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
          ? ((gpAppts / workingDays) / configToUse.population * 100)
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
      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

              <DisclaimerNotice />

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

              {config.useTelephony && displayedData && displayedData.length > 0 && (
                <div id="pdf-telephony-section" className="p-10 space-y-8 break-after-page">
                  <h2 className="text-3xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">4. Telephony Performance</h2>
                  <div className="grid grid-cols-5 gap-4 mb-6">
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

      <AIConsentModal
        isOpen={showAIConsent}
        onClose={() => setShowAIConsent(false)}
        onProceed={() => {
          setShowAIConsent(false);
          runAIAnalysis();
        }}
      />
    </div>
  );
}