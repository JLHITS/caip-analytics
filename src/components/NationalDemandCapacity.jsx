import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Search, X, Loader2, Calendar, Phone, Monitor, TrendingUp, Users,
  BarChart3, AlertTriangle, Info, Star, StarOff, ChevronDown, ExternalLink,
  Share2, Copy, CheckCircle, Sparkles, Activity, Clock, UserCheck, Trophy,
  ChevronUp, ChevronRight, ArrowUp, ArrowDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Analytics imports
import { trackEvent, trackPracticeLookup, trackTabView } from '../firebase/config';

// Component imports
import Card from './ui/Card';
import MetricCard from './ui/MetricCard';
import Toast from './ui/Toast';
import FancyNationalLoader from './ui/FancyNationalLoader';
import NationalTelephony from './NationalTelephony';
import NationalOnlineConsultations from './NationalOnlineConsultations';
import NationalWorkforce from './NationalWorkforce';

// Utility imports
import { parseNationalAppointmentsData, searchAppointmentPractices } from '../utils/parseNationalAppointments';
import { loadAppointmentsData, loadTelephonyData, loadOnlineConsultationsData } from '../data/dataLoader';
import {
  calculatePracticeMetrics,
  calculateNetworkAverages,
  formatMetricValue,
  DEMAND_CAPACITY_METRICS,
  getMetricConfig,
  forecastValues,
  calculateCombinedDemandIndex,
} from '../utils/demandCapacityMetrics';
import {
  APPOINTMENT_FILES,
  MONTHS_ORDERED,
  MONTHS_NEWEST_FIRST,
  PRIORITY_MONTHS,
  getFileForMonth,
} from '../assets/appt/index.js';

// Constants imports
import { NHS_BLUE, NHS_GREEN, NHS_RED, NHS_AMBER, GP_BAND_RED, GP_BAND_AMBER, GP_BAND_GREEN, GP_BAND_BLUE } from '../constants/colors';
import { COMPARISON_COLORS } from '../constants/colors';
import { commonOptions, percentageOptions, donutOptions, gpBandOptions } from '../constants/chartConfigs';

/**
 * National Demand & Capacity Analysis Component
 * Unified hub combining appointment, telephony, and online consultation data
 * All data is loaded upfront for seamless tab switching
 */
const InlineInfoTooltip = ({ text }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-slate-600"
        aria-label="Show metric description"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-lg">
          {text}
        </div>
      )}
    </div>
  );
};

/**
 * National Spectrum Visualizer - Shows where a practice sits on the national spectrum
 * Uses a rainbow gradient from red (lowest) to violet (highest) based on actual national data
 */
const NationalSpectrumVisualizer = ({ value, allValues, label, rank, total }) => {
  // Calculate percentile position (0-100)
  const sortedValues = [...allValues].filter(v => v > 0).sort((a, b) => a - b);
  const minVal = sortedValues[0] || 0;
  const maxVal = sortedValues[sortedValues.length - 1] || 1;

  // Find percentile - what percentage of practices are below this value
  const belowCount = sortedValues.filter(v => v < value).length;
  const percentile = sortedValues.length > 0 ? (belowCount / sortedValues.length) * 100 : 50;

  // Get percentile labels (p10, p25, p50, p75, p90)
  const getPercentileValue = (p) => {
    const idx = Math.floor((p / 100) * (sortedValues.length - 1));
    return sortedValues[idx] || 0;
  };

  const p10 = getPercentileValue(10);
  const p25 = getPercentileValue(25);
  const p50 = getPercentileValue(50);
  const p75 = getPercentileValue(75);
  const p90 = getPercentileValue(90);

  // Rainbow gradient colors
  const gradientStops = [
    { pos: 0, color: '#dc2626' },    // Red - lowest
    { pos: 15, color: '#ea580c' },   // Orange
    { pos: 30, color: '#f59e0b' },   // Amber
    { pos: 45, color: '#84cc16' },   // Lime
    { pos: 55, color: '#22c55e' },   // Green - good
    { pos: 65, color: '#14b8a6' },   // Teal
    { pos: 75, color: '#06b6d4' },   // Cyan
    { pos: 85, color: '#3b82f6' },   // Blue - better
    { pos: 92, color: '#8b5cf6' },   // Violet
    { pos: 100, color: '#a855f7' },  // Purple - highest
  ];

  // Get color at percentile
  const getColorAtPercentile = (pct) => {
    for (let i = gradientStops.length - 1; i >= 0; i--) {
      if (pct >= gradientStops[i].pos) {
        if (i === gradientStops.length - 1) return gradientStops[i].color;
        const next = gradientStops[i + 1];
        const t = (pct - gradientStops[i].pos) / (next.pos - gradientStops[i].pos);
        return gradientStops[i].color; // Simplified - just return the stop color
      }
    }
    return gradientStops[0].color;
  };

  const markerColor = getColorAtPercentile(percentile);

  // Format percentage
  const formatPct = (v) => v?.toFixed(2) + '%';

  return (
    <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-slate-700">{label}</h4>
        <div className="text-right">
          <span className="text-2xl font-bold" style={{ color: markerColor }}>{formatPct(value)}</span>
          {rank && total && (
            <p className="text-xs text-slate-500">Rank #{rank} of {total.toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Spectrum Bar */}
      <div className="relative mt-4 mb-6">
        {/* Rainbow gradient bar */}
        <div
          className="h-4 rounded-full shadow-inner overflow-hidden"
          style={{
            background: `linear-gradient(to right, ${gradientStops.map(s => `${s.color} ${s.pos}%`).join(', ')})`
          }}
        />

        {/* Marker for practice position */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
          style={{ left: `${Math.max(2, Math.min(98, percentile))}%` }}
        >
          {/* Marker pin */}
          <div className="relative">
            <div
              className="w-6 h-6 -ml-3 rounded-full border-4 border-white shadow-lg transform -translate-y-0"
              style={{ backgroundColor: markerColor }}
            />
            {/* Arrow pointing down */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `8px solid ${markerColor}`,
              }}
            />
          </div>
        </div>

        {/* Percentile markers */}
        <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[9px] text-slate-400 px-1">
          <span>0%</span>
          <span style={{ position: 'absolute', left: '25%', transform: 'translateX(-50%)' }}>25th</span>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>50th</span>
          <span style={{ position: 'absolute', left: '75%', transform: 'translateX(-50%)' }}>75th</span>
          <span>100%</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-8 grid grid-cols-5 gap-2 text-center">
        <div className="p-2 bg-white rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Min</p>
          <p className="text-xs font-semibold text-slate-600">{formatPct(minVal)}</p>
        </div>
        <div className="p-2 bg-white rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">P25</p>
          <p className="text-xs font-semibold text-slate-600">{formatPct(p25)}</p>
        </div>
        <div className="p-2 bg-white rounded-lg border border-amber-200 bg-amber-50">
          <p className="text-[10px] text-amber-600 uppercase tracking-wide">Median</p>
          <p className="text-xs font-bold text-amber-700">{formatPct(p50)}</p>
        </div>
        <div className="p-2 bg-white rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">P75</p>
          <p className="text-xs font-semibold text-slate-600">{formatPct(p75)}</p>
        </div>
        <div className="p-2 bg-white rounded-lg border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Max</p>
          <p className="text-xs font-semibold text-slate-600">{formatPct(maxVal)}</p>
        </div>
      </div>

      {/* Percentile interpretation */}
      <div className="mt-4 text-center">
        <p className="text-sm">
          <span className="text-slate-500">Your practice is at the </span>
          <span className="font-bold" style={{ color: markerColor }}>
            {percentile.toFixed(0)}th percentile
          </span>
          <span className="text-slate-500"> nationally</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {percentile >= 75 ? '🌟 Top quartile performance' :
           percentile >= 50 ? '✓ Above median' :
           percentile >= 25 ? '↗ Below median, room to improve' :
           '⚠️ Lower quartile - consider reviewing capacity'}
        </p>
      </div>
    </div>
  );
};

const NationalDemandCapacity = ({
  sharedPractice,
  setSharedPractice,
  sharedBookmarks = [],
  updateSharedBookmarks,
  sharedUsageStats = {},
  recordPracticeUsage,
  initialOdsCode,
}) => {
  // ========================================
  // STATE MANAGEMENT
  // ========================================

  // Loading states - track all data sources
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [telephonyLoading, setTelephonyLoading] = useState(true);
  const [ocLoading, setOcLoading] = useState(true);
  const [workforceLoading, setWorkforceLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('appointments'); // 'appointments', 'telephony', 'oc'

  // Master loading state - true until all data sources are loaded
  const isLoading = appointmentsLoading || telephonyLoading || ocLoading || workforceLoading;

  // Data states
  const [appointmentData, setAppointmentData] = useState({}); // { month: parsedData }
  const [loadedMonths, setLoadedMonths] = useState(new Set());
  const [selectedMonth, setSelectedMonth] = useState('November 2025');
  const compareMode = true; // Always compare with previous months
  const defaultEndMonth = MONTHS_NEWEST_FIRST[0];
  const defaultStartMonth = MONTHS_NEWEST_FIRST[Math.min(11, MONTHS_NEWEST_FIRST.length - 1)];
  const [timeRangePreset, setTimeRangePreset] = useState('last12');
  const [customStartMonth, setCustomStartMonth] = useState(defaultStartMonth);
  const [customEndMonth, setCustomEndMonth] = useState(defaultEndMonth);

  // Telephony and OC data - loaded by child components and shared here for combined metrics
  const [telephonyData, setTelephonyData] = useState(null);
  const [ocData, setOcData] = useState(null);
  const populationData = null;

  // Practice selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Sub-tab navigation
  const [activeSubTab, setActiveSubTab] = useState('appointments');

  // Workforce cross-over metrics (exposed from NationalWorkforce component)
  const [workforceMetrics, setWorkforceMetrics] = useState(null);

  // Compare tab state
  const [comparePractices, setComparePractices] = useState([]);
  const [compareSearchQuery, setCompareSearchQuery] = useState('');
  const [compareSearchResults, setCompareSearchResults] = useState([]);
  const [compareSort, setCompareSort] = useState({ key: 'practice', direction: 'asc' });
  const [compareLegendVisible, setCompareLegendVisible] = useState(true);
  const [compareZoom, setCompareZoom] = useState(false);

  // UI state
  const [toast, setToast] = useState(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // ========================================
  // SUB-TABS CONFIGURATION
  // ========================================

  const SUB_TABS = [
    { id: 'appointments', label: 'Appointments', icon: Calendar, color: 'blue' },
    { id: 'telephony', label: 'Telephony', icon: Phone, color: 'blue' },
    { id: 'online-consultations', label: 'Online Consultations', icon: Monitor, color: 'blue' },
    { id: 'workforce', label: 'Workforce', icon: UserCheck, color: 'blue' },
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp, color: 'blue' },
    { id: 'compare', label: 'Compare', icon: Users, color: 'blue' },
  ];

  // ========================================
  // DATA LOADING
  // ========================================

  // Reference to store pre-loaded JSON data (if available)
  const preloadedJsonRef = useRef(null);
  const jsonLoadAttemptedRef = useRef(false);

  // Load telephony and OC data for combined metrics (fallback if child loads lag)
  useEffect(() => {
    let isActive = true;

    const loadSupplementalData = async () => {
      try {
        const [telephony, oc] = await Promise.all([
          telephonyData ? Promise.resolve(telephonyData) : loadTelephonyData(),
          ocData ? Promise.resolve(ocData) : loadOnlineConsultationsData(),
        ]);

        if (!isActive) return;

        if (!telephonyData) setTelephonyData(telephony);
        if (!ocData) setOcData(oc);

        if (telephony) setTelephonyLoading(false);
        if (oc) setOcLoading(false);
      } catch (error) {
        console.error('Error loading telephony/OC data:', error);
        if (!isActive) return;
        setTelephonyLoading(false);
        setOcLoading(false);
      }
    };

    if (!telephonyData || !ocData) {
      loadSupplementalData();
    }

    return () => {
      isActive = false;
    };
  }, [telephonyData, ocData]);

  // Load appointment data for a single month
  const loadMonthData = useCallback(async (month) => {
    if (loadedMonths.has(month)) return appointmentData[month];

    // Check if we have pre-loaded JSON data
    if (preloadedJsonRef.current && preloadedJsonRef.current[month]) {
      const parsed = preloadedJsonRef.current[month];
      setAppointmentData(prev => ({ ...prev, [month]: parsed }));
      setLoadedMonths(prev => new Set([...prev, month]));
      return parsed;
    }

    // Fallback to XLSX loading
    const fileUrl = getFileForMonth(month);
    if (!fileUrl) {
      console.warn(`No file found for month: ${month}`);
      return null;
    }

    try {
      setLoadingMonth(month);
      const response = await fetch(fileUrl);
      const arrayBuffer = await response.arrayBuffer();
      const parsed = parseNationalAppointmentsData(new Uint8Array(arrayBuffer));

      setAppointmentData(prev => ({ ...prev, [month]: parsed }));
      setLoadedMonths(prev => new Set([...prev, month]));

      return parsed;
    } catch (error) {
      console.error(`Error loading ${month}:`, error);
      setToast({ type: 'error', message: `Failed to load data for ${month}` });
      return null;
    } finally {
      setLoadingMonth(null);
    }
  }, [loadedMonths, appointmentData]);

  // Load priority months on mount - try JSON first
  useEffect(() => {
    const loadPriorityMonths = async () => {
      setAppointmentsLoading(true);
      setLoadingStage('appointments');
      setLoadingProgress(0);

      // Try to load pre-processed JSON first (much faster - 10-20x improvement)
      if (!jsonLoadAttemptedRef.current) {
        jsonLoadAttemptedRef.current = true;
        try {
          const jsonData = await loadAppointmentsData();
          if (jsonData) {
            preloadedJsonRef.current = jsonData;
            console.log('Using pre-processed JSON data for appointments');

            // Load all priority months from JSON immediately
            const newData = {};
            const newMonths = new Set();
            for (const month of PRIORITY_MONTHS) {
              if (jsonData[month]) {
                newData[month] = jsonData[month];
                newMonths.add(month);
              }
            }
            setAppointmentData(prev => ({ ...prev, ...newData }));
            setLoadedMonths(prev => new Set([...prev, ...newMonths]));
            setLoadingProgress(100);
            setAppointmentsLoading(false);
            return;
          }
        } catch (e) {
          console.log('Pre-processed JSON not available, falling back to XLSX parsing');
        }
      }

      // Fallback: Load from XLSX files
      for (let i = 0; i < PRIORITY_MONTHS.length; i++) {
        await loadMonthData(PRIORITY_MONTHS[i]);
        setLoadingProgress(((i + 1) / PRIORITY_MONTHS.length) * 100);
      }

      setAppointmentsLoading(false);
    };

    loadPriorityMonths();
  }, []);

  // ========================================
  // PRACTICE SEARCH
  // ========================================

  // Search practices when query changes
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const currentData = appointmentData[selectedMonth];
    if (!currentData) {
      setSearchResults([]);
      return;
    }

    const results = searchAppointmentPractices(currentData, searchQuery, 20);
    setSearchResults(results);
    setShowSearchDropdown(results.length > 0);
  }, [searchQuery, appointmentData, selectedMonth]);

  // Handle practice selection
  const handleSelectPractice = useCallback((practice, options = { recordUsage: true }) => {
    setSelectedPractice(practice);
    setSearchQuery('');
    setShowSearchDropdown(false);

    // Update shared practice state if available
    if (setSharedPractice) {
      setSharedPractice(practice);
    }

    if (options.recordUsage && recordPracticeUsage) {
      recordPracticeUsage(practice);
    }

    // Track practice lookup
    trackPracticeLookup(practice.odsCode, 'national');

    setToast({ type: 'success', message: `Selected: ${practice.gpName}` });
  }, [setSharedPractice, recordPracticeUsage]);

  const copyPracticeLink = useCallback(async () => {
    if (!selectedPractice?.odsCode) return;
    const url = `${window.location.origin}/${selectedPractice.odsCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast({ type: 'success', message: 'Link copied to clipboard' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      setToast({ type: 'error', message: 'Failed to copy link' });
    }
  }, [selectedPractice]);

  // Handle click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchInputRef.current && !searchInputRef.current.contains(e.target)
      ) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-select practice from URL ODS code
  useEffect(() => {
    if (!initialOdsCode || selectedPractice) return;
    const normalizedOds = initialOdsCode.toUpperCase();
    const findAndSelect = async () => {
      const source = preloadedJsonRef.current || appointmentData;
      for (const month of MONTHS_NEWEST_FIRST) {
        let monthData = source[month];
        if (!monthData && !preloadedJsonRef.current) {
          monthData = await loadMonthData(month);
        }
        const practice = monthData?.practices?.find(
          p => p.odsCode && p.odsCode.toUpperCase() === normalizedOds
        );
        if (practice) {
          setSelectedMonth(month);
          handleSelectPractice(practice, { recordUsage: false });
          return;
        }
      }
    };
    findAndSelect();
  }, [initialOdsCode, selectedPractice, appointmentData, handleSelectPractice, loadMonthData]);

  // ========================================
  // CALCULATED METRICS
  // ========================================

  const telephonyByOds = useMemo(() => {
    const monthData = telephonyData?.[selectedMonth];
    if (!monthData?.practices) return new Map();
    return new Map(monthData.practices.map(practice => [practice.odsCode, practice]));
  }, [telephonyData, selectedMonth]);

  const ocByOds = useMemo(() => {
    const monthData = ocData?.[selectedMonth];
    if (!monthData?.practices) return new Map();
    return new Map(monthData.practices.map(practice => [practice.odsCode, practice]));
  }, [ocData, selectedMonth]);

  const comparePcnResults = useMemo(() => {
    if (!appointmentData[selectedMonth] || compareSearchQuery.length < 2) return [];
    const term = compareSearchQuery.toLowerCase();
    const pcnMap = new Map();
    appointmentData[selectedMonth].practices.forEach(practice => {
      const pcnName = practice.pcnName || '';
      const pcnCode = practice.pcnCode || '';
      if (pcnName.toLowerCase().includes(term) || pcnCode.toLowerCase().includes(term)) {
        const key = `${pcnCode}__${pcnName}`;
        if (!pcnMap.has(key)) {
          pcnMap.set(key, {
            pcnCode,
            pcnName,
            count: 0,
          });
        }
        pcnMap.get(key).count += 1;
      }
    });
    return Array.from(pcnMap.values()).sort((a, b) => b.count - a.count);
  }, [appointmentData, selectedMonth, compareSearchQuery]);

  const timeRangeMonths = useMemo(() => {
    const getRange = (startMonth, endMonth) => {
      const startIndex = MONTHS_ORDERED.indexOf(startMonth);
      const endIndex = MONTHS_ORDERED.indexOf(endMonth);
      if (startIndex === -1 || endIndex === -1) {
        return MONTHS_NEWEST_FIRST.slice(0, 6).reverse();
      }
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      return MONTHS_ORDERED.slice(from, to + 1);
    };

    switch (timeRangePreset) {
      case 'last3':
        return MONTHS_NEWEST_FIRST.slice(0, 3).reverse();
      case 'last6':
        return MONTHS_NEWEST_FIRST.slice(0, 6).reverse();
      case 'last12':
        return MONTHS_NEWEST_FIRST.slice(0, 12).reverse();
      case 'all':
        return MONTHS_ORDERED;
      case 'custom':
        return getRange(customStartMonth, customEndMonth);
      default:
        return MONTHS_NEWEST_FIRST.slice(0, 6).reverse();
    }
  }, [timeRangePreset, customStartMonth, customEndMonth]);

  useEffect(() => {
    if (timeRangeMonths.length === 0) return;
    const latestMonth = timeRangeMonths[timeRangeMonths.length - 1];
    if (selectedMonth !== latestMonth) {
      setSelectedMonth(latestMonth);
      loadMonthData(latestMonth);
    }
  }, [timeRangeMonths, selectedMonth, loadMonthData]);

  const addPracticesToCompare = useCallback((practicesToAdd) => {
    if (!practicesToAdd || practicesToAdd.length === 0) return;
    const existing = new Set(comparePractices.map(p => p.odsCode));
    const merged = [...comparePractices];
    let addedCount = 0;
    practicesToAdd.forEach(practice => {
      if (!existing.has(practice.odsCode)) {
        merged.push(practice);
        existing.add(practice.odsCode);
        addedCount++;
      }
    });
    setComparePractices(merged);
    if (addedCount > 0) {
      trackEvent('compare_practices_added', { count: addedCount, total: merged.length });
    }
  }, [comparePractices]);

  const compareTrendMonths = useMemo(() => {
    const source = preloadedJsonRef.current || appointmentData;
    return timeRangeMonths.filter(month => source[month]);
  }, [appointmentData, timeRangeMonths]);

  const compareChartMonths = useMemo(() => {
    if (compareZoom) {
      return compareTrendMonths.slice(-6);
    }
    return compareTrendMonths;
  }, [compareTrendMonths, compareZoom]);

  const compareColorMap = useMemo(() => {
    const map = new Map();
    comparePractices.forEach((practice, index) => {
      map.set(practice.odsCode, COMPARISON_COLORS[index % COMPARISON_COLORS.length]);
    });
    return map;
  }, [comparePractices]);

  const compareTrendData = useMemo(() => {
    if (comparePractices.length === 0 || compareTrendMonths.length === 0) return [];
    return comparePractices.map((practice, index) => {
      const color = compareColorMap.get(practice.odsCode) || COMPARISON_COLORS[index % COMPARISON_COLORS.length];
      const seriesByMonth = new Map();
      compareTrendMonths.forEach(month => {
        const monthData = appointmentData[month] || preloadedJsonRef.current?.[month];
        const apptPractice = monthData?.practices?.find(p => p.odsCode === practice.odsCode);
        if (!apptPractice) {
          seriesByMonth.set(month, null);
          return;
        }
        const monthTelephony = telephonyData?.[month]?.practices?.find(p => p.odsCode === practice.odsCode) || null;
        const monthOc = ocData?.[month]?.practices?.find(p => p.odsCode === practice.odsCode) || null;
        const population = apptPractice.listSize || 10000;
        const metrics = calculatePracticeMetrics(apptPractice, monthTelephony, monthOc, population, month);
        seriesByMonth.set(month, { metrics, oc: monthOc });
      });

      return {
        practice,
        color,
        seriesByMonth,
      };
    });
  }, [comparePractices, compareTrendMonths, appointmentData, telephonyData, ocData, compareColorMap]);

  const compareRows = useMemo(() => {
    return comparePractices.map(practice => {
      const data = appointmentData[selectedMonth]?.practices?.find(
        p => p.odsCode === practice.odsCode
      );
      const telephony = telephonyByOds.get(practice.odsCode) || null;
      const oc = ocByOds.get(practice.odsCode) || null;
      const metrics = data ? calculatePracticeMetrics(
        data, telephony, oc, data.listSize || 10000, selectedMonth
      ) : null;
      const waitBuckets = [
        { label: 'Same Day', value: metrics?.sameDayPct },
        { label: '1-7 Days', value: metrics?.oneToSevenDaysPct },
        { label: '8-14 Days', value: metrics?.eightToFourteenDaysPct },
        { label: '15-21 Days', value: metrics?.fifteenToTwentyOneDaysPct },
        { label: '22-28 Days', value: metrics?.twentyTwoToTwentyEightDaysPct },
        { label: '28+ Days', value: metrics?.twentyEightPlusDaysPct },
      ].filter(bucket => bucket.value !== null && bucket.value !== undefined);
      const topWait = waitBuckets.reduce((best, current) => {
        if (!best) return current;
        return current.value > best.value ? current : best;
      }, null);

      return {
        practice,
        metrics,
        telephony,
        oc,
        color: compareColorMap.get(practice.odsCode),
        topWaitLabel: topWait ? topWait.label : null,
        topWaitValue: topWait ? topWait.value : null,
      };
    });
  }, [comparePractices, appointmentData, selectedMonth, telephonyByOds, ocByOds, compareColorMap]);

  const sortedCompareRows = useMemo(() => {
    const sorted = [...compareRows];
    const direction = compareSort.direction === 'asc' ? 1 : -1;
    const getValue = (row) => {
      switch (compareSort.key) {
        case 'practice':
          return row.practice.gpName || '';
        case 'gpDayPct':
          return row.metrics?.gpApptPerDayPct;
        case 'gpOcDayPct':
          return row.metrics?.gpApptOrOCPerDayPct;
        case 'gpPer1000':
          return row.metrics?.gpApptsPer1000;
        case 'gpOcPer1000':
          return row.metrics?.gpApptOrOCPer1000;
        case 'dnaPct':
          return row.metrics?.dnaPct;
        case 'sameDayPct':
          return row.metrics?.sameDayPct;
        case 'f2fPct':
          return row.metrics?.faceToFacePct;
        case 'topWaitPct':
          return row.topWaitValue;
        case 'gpApptsPerCall':
          return row.metrics?.gpApptsPerCall;
        case 'missedCallPct':
          return row.metrics?.missedCallPct;
        case 'ocRatePer1000':
          return row.oc?.ratePer1000;
        case 'clinicalOcPer1000':
          return row.oc?.clinicalPer1000;
        default:
          return null;
      }
    };

    sorted.sort((a, b) => {
      const aVal = getValue(a);
      const bVal = getValue(b);
      const aMissing = aVal === null || aVal === undefined || Number.isNaN(aVal);
      const bMissing = bVal === null || bVal === undefined || Number.isNaN(bVal);

      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      if (compareSort.key === 'practice') {
        return aVal.localeCompare(bVal) * direction;
      }
      return (aVal - bVal) * direction;
    });

    return sorted;
  }, [compareRows, compareSort]);

  // Get current practice data with metrics
  const practiceMetrics = useMemo(() => {
    if (!selectedPractice || !appointmentData[selectedMonth]) return null;

    const currentData = appointmentData[selectedMonth];
    const practice = currentData.practices.find(
      p => p.odsCode === selectedPractice.odsCode
    );

    if (!practice) return null;

    // Get population from practice data or population file
    const population = practice.listSize || populationData?.[practice.odsCode] || 10000;

    // Get telephony data for this practice (if available)
    const practiceTelephony = telephonyByOds.get(practice.odsCode) || null;

    // Get OC data for this practice (if available)
    const practiceOC = ocByOds.get(practice.odsCode) || null;

    const metrics = calculatePracticeMetrics(
      practice,
      practiceTelephony,
      practiceOC,
      population,
      selectedMonth
    );

    // Calculate rankings based on gpApptPerDayPct metric (higher = better access)
    const allPractices = currentData.practices;
    const allMetricsWithOds = allPractices.map(p => {
      const population = p.listSize || 10000;
      const pTelephony = telephonyByOds.get(p.odsCode) || null;
      const pOC = ocByOds.get(p.odsCode) || null;
      const metrics = calculatePracticeMetrics(p, pTelephony, pOC, population, selectedMonth);
      return {
        odsCode: p.odsCode,
        pcnCode: p.pcnCode,
        subICBCode: p.subICBCode,
        listSize: p.listSize || 0,
        gpApptPerDayPct: metrics.gpApptPerDayPct || 0,
        gpApptOrOCPerDayPct: metrics.gpApptOrOCPerDayPct || 0,
      };
    }).filter(m => m.gpApptPerDayPct > 0);

    // Sort by gpApptPerDayPct descending (higher = better)
    const sortedNational = [...allMetricsWithOds].sort((a, b) => b.gpApptPerDayPct - a.gpApptPerDayPct);
    const nationalRank = sortedNational.findIndex(p => p.odsCode === practice.odsCode) + 1;

    // ICB ranking
    const icbPractices = allMetricsWithOds.filter(p => p.subICBCode === practice.subICBCode);
    const sortedICB = [...icbPractices].sort((a, b) => b.gpApptPerDayPct - a.gpApptPerDayPct);
    const icbRank = sortedICB.findIndex(p => p.odsCode === practice.odsCode) + 1;

    // PCN ranking
    const pcnPractices = allMetricsWithOds.filter(p => p.pcnCode === practice.pcnCode);
    const sortedPCN = [...pcnPractices].sort((a, b) => b.gpApptPerDayPct - a.gpApptPerDayPct);
    const pcnRank = sortedPCN.findIndex(p => p.odsCode === practice.odsCode) + 1;

    const sortedNationalGpOc = [...allMetricsWithOds].sort((a, b) => b.gpApptOrOCPerDayPct - a.gpApptOrOCPerDayPct);
    const gpOcNationalRank = sortedNationalGpOc.findIndex(p => p.odsCode === practice.odsCode) + 1;
    const sortedIcbGpOc = [...icbPractices].sort((a, b) => b.gpApptOrOCPerDayPct - a.gpApptOrOCPerDayPct);
    const gpOcIcbRank = sortedIcbGpOc.findIndex(p => p.odsCode === practice.odsCode) + 1;
    const sortedPcnGpOc = [...pcnPractices].sort((a, b) => b.gpApptOrOCPerDayPct - a.gpApptOrOCPerDayPct);
    const gpOcPcnRank = sortedPcnGpOc.findIndex(p => p.odsCode === practice.odsCode) + 1;

    // Extract all national values for spectrum visualization (exclude small practices < 1000 patients)
    const MIN_POPULATION_FOR_SPECTRUM = 1000;
    const spectrumPractices = allMetricsWithOds.filter(m => m.listSize >= MIN_POPULATION_FOR_SPECTRUM);
    const allGpApptPerDayPctValues = spectrumPractices.map(m => m.gpApptPerDayPct);
    const allGpOcPerDayPctValues = spectrumPractices.map(m => m.gpApptOrOCPerDayPct);

    return {
      ...practice,
      ...metrics,
      telephony: practiceTelephony,
      oc: practiceOC,
      nationalRank: nationalRank > 0 ? nationalRank : null,
      icbRank: icbRank > 0 ? icbRank : null,
      pcnRank: pcnRank > 0 ? pcnRank : null,
      gpOcNationalRank: gpOcNationalRank > 0 ? gpOcNationalRank : null,
      gpOcIcbRank: gpOcIcbRank > 0 ? gpOcIcbRank : null,
      gpOcPcnRank: gpOcPcnRank > 0 ? gpOcPcnRank : null,
      totalPractices: sortedNational.length,
      icbPracticeCount: sortedICB.length,
      pcnPracticeCount: sortedPCN.length,
      // National distribution for spectrum visualization
      allGpApptPerDayPctValues,
      allGpOcPerDayPctValues,
    };
  }, [selectedPractice, appointmentData, selectedMonth, telephonyByOds, ocByOds, populationData]);

  const pcnAverages = useMemo(() => {
    if (!appointmentData[selectedMonth] || !selectedPractice) return null;
    const currentData = appointmentData[selectedMonth];
    const pcnPractices = currentData.practices.filter(
      practice => practice.pcnCode === selectedPractice.pcnCode
    );
    if (pcnPractices.length === 0) return null;

    const totals = pcnPractices.reduce((acc, practice) => {
      const population = practice.listSize || 10000;
      const practiceTelephony = telephonyByOds.get(practice.odsCode) || null;
      const practiceOC = ocByOds.get(practice.odsCode) || null;
      const metrics = calculatePracticeMetrics(practice, practiceTelephony, practiceOC, population, selectedMonth);
      acc.gpApptPerDayPct += metrics.gpApptPerDayPct || 0;
      acc.gpApptOrOCPerDayPct += metrics.gpApptOrOCPerDayPct || 0;
      acc.gpApptsPer1000 += metrics.gpApptsPer1000 || 0;
      acc.dnaPct += metrics.dnaPct || 0;
      acc.sameDayPct += metrics.sameDayPct || 0;
      acc.count += 1;
      return acc;
    }, { gpApptPerDayPct: 0, gpApptOrOCPerDayPct: 0, gpApptsPer1000: 0, dnaPct: 0, sameDayPct: 0, count: 0 });

    if (totals.count === 0) return null;
    return {
      gpApptPerDayPct: totals.gpApptPerDayPct / totals.count,
      gpApptOrOCPerDayPct: totals.gpApptOrOCPerDayPct / totals.count,
      gpApptsPer1000: totals.gpApptsPer1000 / totals.count,
      dnaPct: totals.dnaPct / totals.count,
      sameDayPct: totals.sameDayPct / totals.count,
    };
  }, [appointmentData, selectedMonth, selectedPractice, telephonyByOds, ocByOds]);

  // Calculate network averages
  const networkAverages = useMemo(() => {
    if (!appointmentData[selectedMonth]) return null;

    const currentData = appointmentData[selectedMonth];
    const allMetrics = currentData.practices.map(practice => {
      const population = practice.listSize || 10000;
      const practiceTelephony = telephonyByOds.get(practice.odsCode) || null;
      const practiceOC = ocByOds.get(practice.odsCode) || null;
      return calculatePracticeMetrics(practice, practiceTelephony, practiceOC, population, selectedMonth);
    });

    return calculateNetworkAverages(allMetrics);
  }, [appointmentData, selectedMonth, telephonyByOds, ocByOds]);

  // ========================================
  // BOOKMARK HANDLING
  // ========================================

  const isBookmarked = useMemo(() => {
    if (!selectedPractice) return false;
    return sharedBookmarks.some(b => b.odsCode === selectedPractice.odsCode);
  }, [selectedPractice, sharedBookmarks]);

  const toggleBookmark = useCallback(() => {
    if (!selectedPractice || !updateSharedBookmarks) return;

    if (isBookmarked) {
      updateSharedBookmarks(sharedBookmarks.filter(b => b.odsCode !== selectedPractice.odsCode));
      setToast({ type: 'info', message: 'Removed from bookmarks' });
      trackEvent('bookmark_removed', { ods_code: selectedPractice.odsCode });
    } else {
      updateSharedBookmarks([...sharedBookmarks, {
        odsCode: selectedPractice.odsCode,
        gpName: selectedPractice.gpName,
        addedAt: new Date().toISOString(),
      }]);
      setToast({ type: 'success', message: 'Added to bookmarks' });
      trackEvent('bookmark_added', { ods_code: selectedPractice.odsCode });
    }
  }, [selectedPractice, isBookmarked, sharedBookmarks, updateSharedBookmarks]);

  // ========================================
  // APPOINTMENT SUB-TABS
  // ========================================
  const [appointmentSubTab, setAppointmentSubTab] = useState('overview');

  const APPOINTMENT_SUB_TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'gp-metrics', label: 'GP Metrics', icon: UserCheck },
    { id: 'other-staff', label: 'Other Staff', icon: Users },
    { id: 'breakdown', label: 'Breakdown', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'dna', label: 'DNA Rates', icon: AlertTriangle },
    { id: 'booking', label: 'Booking Waits', icon: Clock },
    { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
  ];

  // ========================================
  // MULTI-MONTH DATA FOR TRENDS
  // ========================================
  const [historicalData, setHistoricalData] = useState([]);

  // Load historical data for selected time range
  useEffect(() => {
    if (selectedPractice) {
      const loadHistoricalData = async () => {
        const dataPoints = [];
        const monthsToLoad = timeRangeMonths;

        // Load all months and collect the returned data directly
        // (can't rely on state because it's async)
        const loadedData = {};
        for (const month of monthsToLoad) {
          // Use preloaded JSON ref if available
          if (preloadedJsonRef.current && preloadedJsonRef.current[month]) {
            loadedData[month] = preloadedJsonRef.current[month];
          } else if (appointmentData[month]) {
            loadedData[month] = appointmentData[month];
          } else {
            const data = await loadMonthData(month);
            if (data) loadedData[month] = data;
          }
        }

        // Collect data points for the selected practice
        for (const month of monthsToLoad) {
          const monthData = loadedData[month];
          if (monthData) {
            const practice = monthData.practices.find(p => p.odsCode === selectedPractice.odsCode);
            if (practice) {
              const population = practice.listSize || 10000;
              const telephonyMonth = telephonyData?.[month];
              const ocMonth = ocData?.[month];
              const practiceTelephony = telephonyMonth?.practices?.find(p => p.odsCode === practice.odsCode) || null;
              const practiceOC = ocMonth?.practices?.find(p => p.odsCode === practice.odsCode) || null;
              const metrics = calculatePracticeMetrics(practice, practiceTelephony, practiceOC, population, month);
              dataPoints.push({ month, ...metrics });
            }
          }
        }
        setHistoricalData(dataPoints);
      };
      loadHistoricalData();
    }
  }, [selectedPractice, appointmentData, telephonyData, ocData, timeRangeMonths]);

  // ========================================
  // LOADING STATE CALCULATIONS
  // ========================================
  const appointmentProgress = appointmentsLoading ? loadingProgress : 100;
  const telephonyProgress = telephonyLoading ? 0 : 100;
  const ocProgress = ocLoading ? 0 : 100;
  const workforceProgress = workforceLoading ? 0 : 100;
  const overallProgress = (appointmentProgress * 0.45) +
    (telephonyProgress * 0.2) +
    (ocProgress * 0.2) +
    (workforceProgress * 0.15);

  const currentStage = appointmentsLoading ? 'Loading Appointments' :
                       telephonyLoading ? 'Loading Telephony' :
                       ocLoading ? 'Loading Online Consultations' :
                       workforceLoading ? 'Loading Workforce' : 'Ready';

  const gpBandSeries = historicalData.length > 0
    ? historicalData
    : (practiceMetrics ? [{ month: selectedMonth, ...practiceMetrics }] : []);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="space-y-6">
      {/* ========================================
          LOADING OVERLAY - Shows while any data source is loading
          Child components are mounted below (hidden) so they can load in background
          ======================================== */}
      {isLoading && (
        <div className="relative">
          <FancyNationalLoader type="demand-capacity" />
          {/* Progress overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-80">
            {/* Overall progress bar */}
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            {/* Stage indicators */}
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span className={`flex items-center gap-1 ${!appointmentsLoading ? 'text-green-600' : 'text-blue-600'}`}>
                <Calendar size={12} />
                {appointmentsLoading ? `${Math.round(loadingProgress)}%` : '✓'}
              </span>
              <span className={`flex items-center gap-1 ${!telephonyLoading ? 'text-green-600' : telephonyLoading && !appointmentsLoading ? 'text-blue-600' : 'text-slate-400'}`}>
                <Phone size={12} />
                {telephonyLoading ? 'Pending' : '✓'}
              </span>
              <span className={`flex items-center gap-1 ${!ocLoading ? 'text-green-600' : ocLoading && !telephonyLoading ? 'text-blue-600' : 'text-slate-400'}`}>
                <Monitor size={12} />
                {ocLoading ? 'Pending' : '✓'}
              </span>
              <span className={`flex items-center gap-1 ${!workforceLoading ? 'text-green-600' : workforceLoading && !ocLoading ? 'text-blue-600' : 'text-slate-400'}`}>
                <UserCheck size={12} />
                {workforceLoading ? 'Pending' : '✓'}
              </span>
            </div>
            <p className="text-sm text-slate-600 text-center font-medium">
              {currentStage}...
            </p>
          </div>
        </div>
      )}

      {/* ========================================
          NOTE: Telephony and OC components are always-mounted below (with CSS hiding)
          They handle their own data loading - no separate preload instances needed
          ======================================== */}

      {/* Skip rendering main content while loading */}
      {isLoading ? null : (
        <>
      {/* Main Content - Only shown after loading completes */}
      {/* Header with Practice Search - z-20 ensures dropdown overlays content below */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative z-20 overflow-visible">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity size={28} />
              National Demand & Capacity Analysis
            </h2>
            <p className="text-blue-100 mt-1">
              Comprehensive analysis combining appointments, telephony, and online consultations
            </p>
          </div>

          {/* Timeframe + Share */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-200" />
              <select
                value={timeRangePreset}
                onChange={(e) => setTimeRangePreset(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="last3" className="text-slate-800">Last 3 months</option>
                <option value="last6" className="text-slate-800">Last 6 months</option>
                <option value="last12" className="text-slate-800">Last 12 months</option>
                <option value="all" className="text-slate-800">Entire timeframe</option>
                <option value="custom" className="text-slate-800">Custom range</option>
              </select>
            </div>
            {timeRangePreset === 'custom' && (
              <div className="flex items-center gap-2 text-sm text-blue-100">
                <select
                  value={customStartMonth}
                  onChange={(e) => setCustomStartMonth(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {MONTHS_ORDERED.map(month => (
                    <option key={month} value={month} className="text-slate-800">
                      {month}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  value={customEndMonth}
                  onChange={(e) => setCustomEndMonth(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  {MONTHS_ORDERED.map(month => (
                    <option key={month} value={month} className="text-slate-800">
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={copyPracticeLink}
              disabled={!selectedPractice}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPractice
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-white/10 text-white/50 cursor-not-allowed'
              }`}
            >
              <Share2 size={16} />
              Share
            </button>
          </div>
        </div>

        {/* Practice Search */}
        <div className="mt-4 relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && searchResults.length > 0 && setShowSearchDropdown(true)}
              placeholder="Search by practice name or ODS code..."
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl max-h-80 overflow-y-auto border border-slate-200"
            >
              {searchResults.map((practice) => (
                <button
                  key={practice.odsCode}
                  onClick={() => handleSelectPractice(practice)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{practice.gpName}</p>
                      <p className="text-sm text-slate-500">
                        {practice.odsCode} • {practice.pcnName || 'Unknown PCN'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {practice.listSize?.toLocaleString()} patients
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Practice Info */}
        {selectedPractice && (
          <div className="mt-4 p-3 bg-white/10 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-bold">{selectedPractice.gpName}</p>
              <p className="text-sm text-blue-200">
                {selectedPractice.odsCode} • {selectedPractice.pcnName || 'Unknown PCN'} •
                {selectedPractice.subICBName || 'Unknown ICB'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleBookmark}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
              >
                {isBookmarked ? <Star size={20} fill="currentColor" /> : <StarOff size={20} />}
              </button>
              <button
                onClick={() => { setSelectedPractice(null); setSearchQuery(''); }}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Data Source Links */}
        <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap justify-center gap-4">
          <a
            href="https://digital.nhs.uk/data-and-information/publications/statistical/appointments-in-general-practice"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-100 hover:text-white transition-colors"
          >
            <Calendar size={12} />
            Appointments Data
            <ExternalLink size={10} />
          </a>
          <a
            href="https://digital.nhs.uk/data-and-information/publications/statistical/cloud-based-telephony-data-in-general-practice"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-100 hover:text-white transition-colors"
          >
            <Phone size={12} />
            Telephony Data
            <ExternalLink size={10} />
          </a>
          <a
            href="https://digital.nhs.uk/data-and-information/publications/statistical/submissions-via-online-consultation-systems-in-general-practice"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-100 hover:text-white transition-colors"
          >
            <Monitor size={12} />
            Online Consultations Data
            <ExternalLink size={10} />
          </a>
          <a
            href="https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-100 hover:text-white transition-colors"
          >
            <Users size={12} />
            Patient List Sizes
            <ExternalLink size={10} />
          </a>
        </div>
      </Card>

      {/* Sub-Tab Navigation */}
      <div className="flex flex-wrap gap-2 items-center bg-slate-100 p-1 rounded-xl">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          // Disable data tabs until a practice is selected (Compare always enabled)
          const requiresPractice = ['appointments', 'telephony', 'online-consultations', 'workforce', 'forecasting'].includes(tab.id);
          const isDisabled = requiresPractice && !selectedPractice;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!isDisabled) {
                  setActiveSubTab(tab.id);
                  trackTabView('national', tab.id);
                }
              }}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : isDisabled
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white/50'
              }`}
              title={isDisabled ? 'Select a practice first' : ''}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}

        {/* CAIP Analysis Button (Disabled) */}
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-400 cursor-not-allowed ml-auto"
        >
          <Sparkles size={18} />
          CAIP Analysis
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">Coming Soon</span>
        </button>
      </div>

      {/* No Practice Selected Message - z-0 ensures it stays below search dropdown */}
      {!selectedPractice && (
        <Card className="text-center py-12 relative z-0">
          <Search className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Select a Practice</h3>
          <p className="text-slate-500">
            Search for a practice by name or ODS code to view their demand and capacity analysis
          </p>
        </Card>
      )}

      {/* ========================================
          APPOINTMENTS TAB WITH SUB-TABS
          ======================================== */}
      {activeSubTab === 'appointments' && selectedPractice && practiceMetrics && (
        <div className="space-y-6">
          {/* Appointment Sub-Tab Navigation - Smaller, pill-style secondary tabs */}
          <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {APPOINTMENT_SUB_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = appointmentSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAppointmentSubTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* OVERVIEW SUB-TAB */}
          {appointmentSubTab === 'overview' && (
            <>
              {/* Core Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <MetricCard
                  title="GP Appt/Day"
                  value={formatMetricValue(practiceMetrics.gpApptPerDayPct, 'percent2')}
                  info="Percentage of registered patients each working day who attended a GP appointment"
                  icon={UserCheck}
                  trend={networkAverages?.gpApptPerDayPct ? (
                    practiceMetrics.gpApptPerDayPct > networkAverages.gpApptPerDayPct.mean ? 'up' : 'down'
                  ) : null}
                />
                <MetricCard
                  title="GP+Med OC/Day"
                  value={formatMetricValue(practiceMetrics.gpApptOrOCPerDayPct, 'percent2')}
                  info="Percentage of registered patients each working day who attended a GP appointment and/or Medical Online Consultation (any outcome)"
                  icon={Activity}
                />
                <MetricCard
                  title="Other Staff/Day %"
                  value={formatMetricValue(practiceMetrics.otherApptPerDayPct, 'percent2')}
                  subtext="Non-GP appointments"
                  icon={Users}
                />
                <MetricCard
                  title="DNA Rate"
                  value={formatMetricValue(practiceMetrics.dnaPct, 'percent1')}
                  subtext="Did Not Attend"
                  icon={AlertTriangle}
                  className={practiceMetrics.dnaPct > 5 ? 'border-red-200 bg-red-50' : ''}
                />
                <MetricCard
                  title="Same Day %"
                  value={formatMetricValue(practiceMetrics.sameDayPct, 'percent1')}
                  subtext="Booked same day"
                  icon={Clock}
                />
                <MetricCard
                  title="GP Appts/Demand"
                  value={practiceMetrics.hasTelephonyData || practiceMetrics.hasOCData
                    ? formatMetricValue(practiceMetrics.gpApptsPerCall, 'decimal2')
                    : 'N/A'}
                  subtext={practiceMetrics.hasTelephonyData || practiceMetrics.hasOCData ? 'Per call + Medical OC' : 'No demand data'}
                  info="GP Appointments divided by (Inbound Calls + Medical OC submissions)"
                  icon={Phone}
                />
              </div>

              {/* Workforce Cross-over Metrics - Only show when workforce data is available */}
              {workforceMetrics?.hasWorkforceData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    title="GP Appts / GP WTE"
                    value={workforceMetrics.appointmentsPerGpWte
                      ? formatMetricValue(workforceMetrics.appointmentsPerGpWte, 'integer')
                      : 'N/A'}
                    subtext={`${formatMetricValue(workforceMetrics.gpWte, 'decimal1')} GP WTE`}
                    info="GP appointments per GP WTE for the month"
                    icon={UserCheck}
                  />
                  <MetricCard
                    title="Appts / Clinical WTE"
                    value={workforceMetrics.appointmentsPerClinicalWte
                      ? formatMetricValue(workforceMetrics.appointmentsPerClinicalWte, 'integer')
                      : 'N/A'}
                    subtext={`${formatMetricValue(workforceMetrics.clinicalWte, 'decimal1')} Clinical WTE`}
                    info="Total appointments per clinical WTE for the month"
                    icon={Users}
                  />
                  <MetricCard
                    title="GP+OC / GP WTE"
                    value={workforceMetrics.gpApptsAndOcPerGpWte
                      ? formatMetricValue(workforceMetrics.gpApptsAndOcPerGpWte, 'integer')
                      : 'N/A'}
                    subtext="GP Appts + Medical OC"
                    info="GP appointments plus Medical Online Consultations per GP WTE"
                    icon={Activity}
                  />
                  <MetricCard
                    title="GP+OC / Clin WTE"
                    value={workforceMetrics.gpApptsAndOcPerClinicalWte
                      ? formatMetricValue(workforceMetrics.gpApptsAndOcPerClinicalWte, 'integer')
                      : 'N/A'}
                    subtext="GP Appts + Medical OC"
                    info="GP appointments plus Medical Online Consultations per clinical WTE"
                    icon={Activity}
                  />
                </div>
              )}

              {/* Appointment Mode & Staff Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-600" />
                    Appointment Mode Breakdown
                  </h3>
                  <div className="h-64">
                    <Doughnut
                      data={{
                        labels: ['Face-to-Face', 'Telephone', 'Video', 'Home Visit'],
                        datasets: [{
                          data: [
                            practiceMetrics.faceToFace || 0,
                            practiceMetrics.telephone || 0,
                            practiceMetrics.video || 0,
                            practiceMetrics.homeVisit || 0,
                          ],
                          backgroundColor: [NHS_BLUE, NHS_GREEN, NHS_AMBER, NHS_RED],
                        }],
                      }}
                      options={{
                        ...donutOptions,
                        plugins: {
                          ...donutOptions.plugins,
                          legend: { position: 'right' },
                        },
                      }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NHS_BLUE }} />
                      <span>Face-to-Face: {formatMetricValue(practiceMetrics.faceToFacePct, 'percent1')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NHS_GREEN }} />
                      <span>Telephone: {formatMetricValue(practiceMetrics.telephonePct, 'percent1')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NHS_AMBER }} />
                      <span>Video: {formatMetricValue(practiceMetrics.videoPct, 'percent1')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NHS_RED }} />
                      <span>Home Visit: {formatMetricValue(practiceMetrics.homeVisitPct, 'percent1')}</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    Staff Type Breakdown
                  </h3>
                  <div className="h-64">
                    <Doughnut
                      data={{
                        labels: ['GP', 'Other Practice Staff'],
                        datasets: [{
                          data: [
                            practiceMetrics.gpAppointments || 0,
                            practiceMetrics.otherAppointments || 0,
                          ],
                          backgroundColor: [NHS_BLUE, NHS_GREEN],
                        }],
                      }}
                      options={{
                        ...donutOptions,
                        plugins: {
                          ...donutOptions.plugins,
                          legend: { position: 'right' },
                        },
                      }}
                    />
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NHS_BLUE }} />
                        GP Appointments
                      </span>
                      <span className="font-medium">
                        {practiceMetrics.gpAppointments?.toLocaleString()} ({formatMetricValue(practiceMetrics.gpPct, 'percent1')})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NHS_GREEN }} />
                        Other Staff
                      </span>
                      <span className="font-medium">
                        {practiceMetrics.otherAppointments?.toLocaleString()} ({formatMetricValue(practiceMetrics.otherStaffPct, 'percent1')})
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Practice Summary */}
              <Card>
                <h3 className="font-bold text-slate-700 mb-4">Practice Summary - {selectedMonth}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500">Total Appointments</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {practiceMetrics.totalAppointments?.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500">Patient List Size</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {practiceMetrics.listSize?.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500">Appts per 1000 Patients</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {formatMetricValue(practiceMetrics.totalApptsPer1000, 'decimal1')}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500">DNA Count</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {practiceMetrics.dna?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Key Metrics Line Charts - GP Appts/Day % and GP+OC/Day % */}
              {historicalData.length >= 2 && (
                <Card>
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-600" />
                    Key Metrics Over Time
                  </h3>
                  <div className="h-72">
                  <Line
                    data={{
                      labels: historicalData.map(d => d.month.replace(' 202', '\n202')),
                      datasets: [
                          {
                            label: 'Patients with GP Appointment per Day (%)',
                            data: historicalData.map(d => d.gpApptPerDayPct),
                            borderColor: NHS_BLUE,
                            backgroundColor: 'transparent',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                          },
                          {
                            label: '% GP + OC per Day',
                            data: historicalData.map(d => d.gpApptOrOCPerDayPct || d.gpApptPerDayPct),
                            borderColor: '#8B5CF6',
                            backgroundColor: 'transparent',
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                          },
                        ],
                      }}
                      options={{
                        ...gpBandOptions,
                        plugins: {
                          ...gpBandOptions.plugins,
                          legend: {
                            position: 'top',
                            labels: { usePointStyle: true }
                          },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`
                            }
                          }
                        },
                        scales: {
                          ...gpBandOptions.scales,
                          y: {
                            ...gpBandOptions.scales.y,
                            title: {
                              display: true,
                              text: '% of Population per Day'
                            }
                          },
                        },
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    GP+OC includes GP + Online medical consultation
                  </p>
                </Card>
              )}

              {/* Prompt to enable comparison if historical data not loaded */}
              {historicalData.length < 2 && (
                <Card className="text-center py-6 bg-blue-50 border-blue-200">
                  <Loader2 className="mx-auto text-blue-500 animate-spin mb-2" size={24} />
                  <p className="text-sm text-blue-700">Loading historical data for trend analysis...</p>
                </Card>
              )}
            </>
          )}

          {/* GP METRICS SUB-TAB */}
          {appointmentSubTab === 'gp-metrics' && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <UserCheck size={18} className="text-blue-600" />
                    GP Appointment Metrics
                  </h3>
                  <span className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    Latest: {selectedMonth}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-600 font-medium">GP Appointments</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-blue-800">{practiceMetrics.gpAppointments?.toLocaleString()}</p>
                      {historicalData.length >= 2 && (() => {
                        const prev = historicalData[historicalData.length - 2]?.gpAppointments;
                        const curr = practiceMetrics.gpAppointments;
                        if (prev && curr) {
                          const diff = curr - prev;
                          return diff !== 0 ? (
                            <span className={`flex items-center text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            </span>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-blue-500">{formatMetricValue(practiceMetrics.gpPct, 'percent1')} of total</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                      <span>Patients with GP Appointment per Day (%)</span>
                      <InlineInfoTooltip text="Percentage of registered patients each working day who attended a GP appointment" />
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-blue-800">{formatMetricValue(practiceMetrics.gpApptPerDayPct, 'percent2')}</p>
                      {historicalData.length >= 2 && (() => {
                        const prev = historicalData[historicalData.length - 2]?.gpApptPerDayPct;
                        const curr = practiceMetrics.gpApptPerDayPct;
                        if (prev && curr) {
                          const diff = curr - prev;
                          return Math.abs(diff) > 0.01 ? (
                            <span className={`flex items-center text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            </span>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-1 text-sm text-purple-600 font-medium">
                      <span>Patients with GP Appointment or Medical Online Consultation per Day (%)</span>
                      <InlineInfoTooltip text="Percentage of registered patients each working day who attended a GP appointment and/or Medical Online Consultation (any outcome)" />
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-purple-800">{formatMetricValue(practiceMetrics.gpApptOrOCPerDayPct, 'percent2')}</p>
                      {historicalData.length >= 2 && (() => {
                        const prev = historicalData[historicalData.length - 2]?.gpApptOrOCPerDayPct;
                        const curr = practiceMetrics.gpApptOrOCPerDayPct;
                        if (prev && curr) {
                          const diff = curr - prev;
                          return Math.abs(diff) > 0.01 ? (
                            <span className={`flex items-center text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            </span>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-purple-500">Includes Medical OC</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-600 font-medium">GP per 1000 Patients</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-blue-800">{formatMetricValue(practiceMetrics.gpApptsPer1000, 'decimal1')}</p>
                      {historicalData.length >= 2 && (() => {
                        const prev = historicalData[historicalData.length - 2]?.gpApptsPer1000;
                        const curr = practiceMetrics.gpApptsPer1000;
                        if (prev && curr) {
                          const diff = curr - prev;
                          return Math.abs(diff) > 0.5 ? (
                            <span className={`flex items-center text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            </span>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-blue-500">Monthly rate</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-sm text-purple-600 font-medium">GP + Medical OC per 1000</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-purple-800">{formatMetricValue(practiceMetrics.gpApptOrOCPer1000, 'decimal1')}</p>
                      {historicalData.length >= 2 && (() => {
                        const prev = historicalData[historicalData.length - 2]?.gpApptOrOCPer1000;
                        const curr = practiceMetrics.gpApptOrOCPer1000;
                        if (prev && curr) {
                          const diff = curr - prev;
                          return Math.abs(diff) > 0.5 ? (
                            <span className={`flex items-center text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            </span>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-purple-500">Monthly rate</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-600 font-medium">GP:Other Ratio</p>
                    <p className="text-3xl font-bold text-blue-800">{formatMetricValue(practiceMetrics.gpToOtherRatio, 'decimal2')}</p>
                    <p className="text-xs text-blue-500">GP to other staff ratio</p>
                  </div>
                </div>
              </Card>

              {/* National Spectrum Visualizations */}
              {practiceMetrics.allGpApptPerDayPctValues?.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <NationalSpectrumVisualizer
                    value={practiceMetrics.gpApptPerDayPct}
                    allValues={practiceMetrics.allGpApptPerDayPctValues}
                    label="Patients with GP Appointment per Day (%)"
                    rank={practiceMetrics.nationalRank}
                    total={practiceMetrics.totalPractices}
                  />
                  <NationalSpectrumVisualizer
                    value={practiceMetrics.gpApptOrOCPerDayPct}
                    allValues={practiceMetrics.allGpOcPerDayPctValues}
                    label="Patients with GP Appt or Medical OC per Day (%)"
                    rank={practiceMetrics.gpOcNationalRank}
                    total={practiceMetrics.totalPractices}
                  />
                </div>
              )}

              {/* Performance Band Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Activity size={18} className="text-blue-600" />
                    GP Appts/Day %
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Red (&lt;0.85%), Amber (0.85-1.10%), Green (1.10-1.30%), Blue (&gt;1.30%)</p>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: gpBandSeries.map(d => d.month),
                        datasets: [{
                          label: 'GP Appts/Day %',
                          data: gpBandSeries.map(d => d.gpApptPerDayPct),
                          borderColor: NHS_BLUE,
                          backgroundColor: 'transparent',
                          fill: false,
                        }],
                      }}
                      options={gpBandOptions}
                    />
                  </div>
                </Card>

                <Card>
                  <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Activity size={18} className="text-purple-600" />
                    GP + Medical OC/Day %
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Combined GP appointments and clinical online consultations</p>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: gpBandSeries.map(d => d.month),
                        datasets: [{
                          label: 'GP + Medical OC/Day %',
                          data: gpBandSeries.map(d => d.gpApptOrOCPerDayPct),
                          borderColor: '#8B5CF6',
                          backgroundColor: 'transparent',
                          fill: false,
                        }],
                      }}
                      options={gpBandOptions}
                    />
                  </div>
                </Card>
              </div>

              {/* PCN Comparison */}
              {pcnAverages && (
                <Card>
                  <h3 className="font-bold text-slate-700 mb-4">Comparison with PCN Average</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'GP Appts/Day %', value: practiceMetrics.gpApptPerDayPct, avg: pcnAverages.gpApptPerDayPct, format: 'percent2' },
                      { label: 'GP + Medical OC/Day %', value: practiceMetrics.gpApptOrOCPerDayPct, avg: pcnAverages.gpApptOrOCPerDayPct, format: 'percent2' },
                      { label: 'GP per 1000 Pts', value: practiceMetrics.gpApptsPer1000, avg: pcnAverages.gpApptsPer1000, format: 'decimal1' },
                    ].map((metric, idx) => {
                      const diff = metric.value - (metric.avg || 0);
                      const isHigher = diff > 0;
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <span className="font-medium text-slate-700">{metric.label}</span>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-bold text-slate-800">{formatMetricValue(metric.value, metric.format)}</p>
                              <p className="text-xs text-slate-500">Your practice</p>
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${isHigher ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isHigher ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                              <span className="text-sm font-medium">{formatMetricValue(Math.abs(diff), metric.format)}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-600">{formatMetricValue(metric.avg, metric.format)}</p>
                              <p className="text-xs text-slate-500">PCN avg</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* OTHER STAFF SUB-TAB */}
          {appointmentSubTab === 'other-staff' && (
            <>
              {/* Info notice about local data */}
              <Card className="bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-medium text-blue-800">More Detail Available in Local Data</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      National GPAD data groups all non-GP staff together. For a detailed breakdown by role
                      (ANP, Pharmacist, Nurse, etc.) use the <strong>Local Data</strong> analysis with your
                      practice's appointment or triage slot extract.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Users size={18} className="text-green-600" />
                    Other Practice Staff Metrics
                  </h3>
                  <span className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                    Latest: {selectedMonth}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-600 font-medium">Other Staff Appointments</p>
                    <p className="text-3xl font-bold text-green-800">{practiceMetrics.otherAppointments?.toLocaleString()}</p>
                    <p className="text-xs text-green-500">{formatMetricValue(practiceMetrics.otherStaffPct, 'percent1')} of total</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-600 font-medium">Other Staff/Day %</p>
                    <p className="text-3xl font-bold text-green-800">{formatMetricValue(practiceMetrics.otherApptPerDayPct, 'percent2')}</p>
                    <p className="text-xs text-green-500">Patients seen daily</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-600 font-medium">Other per 1000 Patients</p>
                    <p className="text-3xl font-bold text-green-800">{formatMetricValue(practiceMetrics.otherApptsPer1000, 'decimal1')}</p>
                    <p className="text-xs text-green-500">Monthly rate</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-600 font-medium">Staff Mix</p>
                    <p className="text-3xl font-bold text-green-800">{formatMetricValue(100 - practiceMetrics.gpPct, 'percent1')}</p>
                    <p className="text-xs text-green-500">Non-GP share</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* BREAKDOWN SUB-TAB */}
          {appointmentSubTab === 'breakdown' && (
            <>
              {/* GPAD Data Disclaimer */}
              <Card className="bg-amber-50 border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-medium text-amber-800">About This Data</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      This breakdown is sourced from NHS Digital's <strong>Appointments in General Practice (GPAD)</strong> dataset.
                      Categories are based on SNOMED codes mapped by NHS Digital. Some appointment types may be categorised
                      differently to how your practice records them locally. For more accurate categorisation, use your
                      practice's local appointment extract.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-600" />
                  Practice Breakdown
                </h3>
                {(appointmentData[MONTHS_NEWEST_FIRST[0]] || preloadedJsonRef.current?.[MONTHS_NEWEST_FIRST[0]]) && selectedPractice ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-600 mb-2">Category Breakdown (Latest month)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Category</th>
                              <th className="px-3 py-2 text-right">Count</th>
                              <th className="px-3 py-2 text-right">% of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const monthData = appointmentData[MONTHS_NEWEST_FIRST[0]] || preloadedJsonRef.current?.[MONTHS_NEWEST_FIRST[0]];
                              const practice = monthData.practices.find(
                                p => p.odsCode === selectedPractice.odsCode
                              );
                              const categoryHeaders = monthData.national.categoryHeaders || [];
                              const categories = practice?.categoryBreakdown || {};
                              const orderedKeys = categoryHeaders.length > 0
                                ? categoryHeaders
                                : Object.keys(categories);
                              const rows = orderedKeys.map(label => ({
                                label,
                                value: Number(categories[label]) || 0,
                              }));
                              const total = rows.reduce((sum, row) => sum + row.value, 0);

                              if (rows.length === 0 || total === 0) {
                                return (
                                  <tr>
                                    <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                                      Category breakdown data not available for this practice.
                                    </td>
                                  </tr>
                                );
                              }
                              return rows.map(row => (
                                <tr key={row.label} className="border-b">
                                  <td className="px-3 py-2 font-medium text-slate-700">{row.label}</td>
                                  <td className="px-3 py-2 text-right">{row.value.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-right">{formatMetricValue(total ? (row.value / total) * 100 : null, 'percent1')}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-600 mb-2">Appointment Mode Breakdown (Latest month)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Mode</th>
                              <th className="px-3 py-2 text-right">Count</th>
                              <th className="px-3 py-2 text-right">% of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const monthData = appointmentData[MONTHS_NEWEST_FIRST[0]] || preloadedJsonRef.current?.[MONTHS_NEWEST_FIRST[0]];
                              const practice = monthData.practices.find(
                                p => p.odsCode === selectedPractice.odsCode
                              );
                              const modes = practice?.appointmentModes || {};
                              const total = modes.total || 0;
                              const rows = [
                                { label: 'Face-to-Face', value: modes.faceToFace || 0 },
                                { label: 'Telephone', value: modes.telephone || 0 },
                                { label: 'Video', value: modes.video || 0 },
                                { label: 'Home Visit', value: modes.homeVisit || 0 },
                                { label: 'Unknown', value: modes.unknown || 0 },
                              ];
                              if (total === 0) {
                                return (
                                  <tr>
                                    <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                                      Mode breakdown data not available for this practice.
                                    </td>
                                  </tr>
                                );
                              }
                              return rows.map(row => (
                                <tr key={row.label} className="border-b">
                                  <td className="px-3 py-2 font-medium text-slate-700">{row.label}</td>
                                  <td className="px-3 py-2 text-right">{row.value.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-right">{formatMetricValue(total ? (row.value / total) * 100 : null, 'percent1')}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Practice breakdown data not available for this month.</p>
                )}
              </Card>
            </>
          )}

          {/* TRENDS SUB-TAB */}
          {appointmentSubTab === 'trends' && (
            <>
              {historicalData.length >= 2 ? (
                <>
                  <Card>
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-purple-600" />
                      GP Appointments Over Time
                    </h3>
                    <div className="h-64">
                      <Line
                        data={{
                          labels: historicalData.map(d => d.month.replace(' 202', '\n202')),
                          datasets: [
                            {
                              label: 'GP Appts/Day %',
                              data: historicalData.map(d => d.gpApptPerDayPct),
                              borderColor: NHS_BLUE,
                              backgroundColor: `${NHS_BLUE}33`,
                              fill: true,
                              tension: 0.4,
                            },
                            {
                              label: 'GP+OC/Day %',
                              data: historicalData.map(d => d.gpApptOrOCPerDayPct || d.gpApptPerDayPct),
                              borderColor: NHS_GREEN,
                              borderDash: [5, 5],
                              fill: false,
                              tension: 0.4,
                            },
                          ],
                        }}
                        options={{
                          ...commonOptions,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: { callback: v => `${v}%` },
                            },
                          },
                        }}
                      />
                    </div>
                  </Card>

                  <Card>
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-600" />
                      DNA Rate Over Time
                    </h3>
                    <div className="h-64">
                      <Line
                        data={{
                          labels: historicalData.map(d => d.month.replace(' 202', '\n202')),
                          datasets: [{
                            label: 'DNA Rate %',
                            data: historicalData.map(d => d.dnaPct),
                            borderColor: NHS_RED,
                            backgroundColor: `${NHS_RED}33`,
                            fill: true,
                            tension: 0.4,
                          }],
                        }}
                        options={{
                          ...commonOptions,
                          scales: {
                            y: {
                              beginAtZero: true,
                              max: 10,
                              ticks: { callback: v => `${v}%` },
                            },
                          },
                        }}
                      />
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="text-center py-8">
                  <Loader2 className="mx-auto text-blue-500 animate-spin mb-4" size={32} />
                  <p className="text-slate-500">Loading historical data...</p>
                </Card>
              )}
            </>
          )}

          {/* DNA RATES SUB-TAB */}
          {appointmentSubTab === 'dna' && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    DNA (Did Not Attend) Analysis
                  </h3>
                  <span className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                    Latest: {selectedMonth}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className={`p-4 rounded-lg border ${practiceMetrics.dnaPct > 5 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-sm text-slate-600 font-medium">Total DNA Rate</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-3xl font-bold ${practiceMetrics.dnaPct > 5 ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatMetricValue(practiceMetrics.dnaPct, 'percent1')}
                      </p>
                      {historicalData.length >= 2 && (() => {
                        const prev = historicalData[historicalData.length - 2]?.dnaPct;
                        const curr = practiceMetrics.dnaPct;
                        if (prev && curr) {
                          const diff = curr - prev;
                          // For DNA, lower is better, so down arrow is green
                          return Math.abs(diff) > 0.1 ? (
                            <span className={`flex items-center text-xs ${diff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {diff < 0 ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                            </span>
                          ) : null;
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-slate-500">Target: &lt;5%</p>
                  </div>
                  {/* PCN DNA Comparison */}
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-600 font-medium">PCN Average DNA</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-purple-800">
                        {pcnAverages?.dnaPct ? formatMetricValue(pcnAverages.dnaPct, 'percent1') : 'N/A'}
                      </p>
                      {pcnAverages?.dnaPct && practiceMetrics.dnaPct && (() => {
                        const diff = practiceMetrics.dnaPct - pcnAverages.dnaPct;
                        // For DNA, lower is better
                        return Math.abs(diff) > 0.1 ? (
                          <span className={`flex items-center text-xs ${diff < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {diff < 0 ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                            <span className="ml-0.5">{Math.abs(diff).toFixed(1)}%</span>
                          </span>
                        ) : <span className="text-xs text-slate-500">same</span>;
                      })()}
                    </div>
                    <p className="text-xs text-purple-500">{selectedPractice?.pcnName?.slice(0, 25) || 'PCN'}...</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 font-medium">DNA Count</p>
                    <p className="text-3xl font-bold text-slate-800">{practiceMetrics.dna?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Appointments missed</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 font-medium">Attended</p>
                    <p className="text-3xl font-bold text-slate-800">{practiceMetrics.attended?.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{formatMetricValue(practiceMetrics.attendedPct, 'percent1')} attended</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-600 font-medium">Unknown Status</p>
                    <p className="text-3xl font-bold text-slate-800">{practiceMetrics.unknownStatus?.toLocaleString() || 'N/A'}</p>
                    <p className="text-xs text-slate-500">Status not recorded</p>
                  </div>
                </div>
              </Card>

              {/* DNA Impact Calculation */}
              <Card>
                <h3 className="font-bold text-slate-700 mb-4">DNA Impact</h3>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-amber-800">
                    <span className="font-bold">{practiceMetrics.dna?.toLocaleString()}</span> missed GP appointments represent
                    wasted capacity equivalent to approximately{' '}
                    <span className="font-bold">
                      {Math.round((practiceMetrics.dna || 0) * 15 / 60)} GP hours
                    </span>{' '}
                    per month (assuming 15 min average GP appointment).
                  </p>
                </div>
              </Card>
            </>
          )}

          {/* BOOKING WAITS SUB-TAB */}
          {appointmentSubTab === 'booking' && (
            <>
              <Card>
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-cyan-600" />
                  Booking Wait Times Distribution
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Booking wait times do not only indicate appointment availability but could also be influenced by patient choice if a practice has more appointments available.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-sm text-green-600 font-medium">Same Day</p>
                    <p className="text-3xl font-bold text-green-800">{formatMetricValue(practiceMetrics.sameDayPct, 'percent1')}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-600 font-medium">1-7 Days</p>
                    <p className="text-3xl font-bold text-blue-800">{formatMetricValue(practiceMetrics.oneToSevenDaysPct, 'percent1')}</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-sm text-amber-600 font-medium">8-14 Days</p>
                    <p className="text-3xl font-bold text-amber-800">{formatMetricValue(practiceMetrics.eightToFourteenDaysPct, 'percent1')}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-sm text-red-600 font-medium">15+ Days</p>
                    <p className="text-3xl font-bold text-red-800">{formatMetricValue(practiceMetrics.fifteenPlusDaysPct, 'percent1')}</p>
                  </div>
                </div>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: ['Same Day', '1-7 Days', '8-14 Days', '15-21 Days', '22-28 Days', '28+ Days'],
                      datasets: [{
                        label: 'Appointments %',
                        data: [
                          practiceMetrics.sameDayPct || 0,
                          practiceMetrics.oneToSevenDaysPct || 0,
                          practiceMetrics.eightToFourteenDaysPct || 0,
                          practiceMetrics.fifteenToTwentyOneDaysPct || 0,
                          practiceMetrics.twentyTwoToTwentyEightDaysPct || 0,
                          practiceMetrics.twentyEightPlusDaysPct || 0,
                        ],
                        backgroundColor: [
                          '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#DC2626', '#991B1B'
                        ],
                      }],
                    }}
                    options={{
                      ...commonOptions,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          ticks: { callback: v => `${v}%` },
                        },
                      },
                    }}
                  />
                </div>
              </Card>
            </>
          )}

          {/* LEADERBOARDS SUB-TAB */}
          {appointmentSubTab === 'leaderboards' && (
            <>
              <Card>
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" />
                  Practice Rankings
                </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-700 font-medium mb-1">National Ranking</p>
                      <p className="text-4xl font-bold text-amber-600">
                        #{practiceMetrics.nationalRank || 'N/A'}
                      </p>
                    <p className="text-xs text-amber-600">
                      out of {appointmentData[selectedMonth]?.practices?.length?.toLocaleString() || 'N/A'} practices
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium mb-1">ICB Ranking</p>
                    <p className="text-4xl font-bold text-blue-600">
                      #{practiceMetrics.icbRank || 'N/A'}
                    </p>
                    <p className="text-xs text-blue-600">
                      in {selectedPractice.subICBName || 'Unknown ICB'}
                    </p>
                  </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700 font-medium mb-1">PCN Ranking</p>
                      <p className="text-4xl font-bold text-green-600">
                        #{practiceMetrics.pcnRank || 'N/A'}
                      </p>
                      <p className="text-xs text-green-600">
                        in {selectedPractice.pcnName || 'Unknown PCN'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-700 font-medium mb-1">National GP+OC Ranking</p>
                      <p className="text-4xl font-bold text-purple-600">
                        #{practiceMetrics.gpOcNationalRank || 'N/A'}
                      </p>
                      <p className="text-xs text-purple-600">
                        out of {appointmentData[selectedMonth]?.practices?.length?.toLocaleString() || 'N/A'} practices
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-lg border border-indigo-200">
                      <p className="text-sm text-indigo-700 font-medium mb-1">ICB GP+OC Ranking</p>
                      <p className="text-4xl font-bold text-indigo-600">
                        #{practiceMetrics.gpOcIcbRank || 'N/A'}
                      </p>
                      <p className="text-xs text-indigo-600">
                        in {selectedPractice.subICBName || 'Unknown ICB'}
                      </p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-700 font-medium mb-1">PCN GP+OC Ranking</p>
                      <p className="text-4xl font-bold text-emerald-600">
                        #{practiceMetrics.gpOcPcnRank || 'N/A'}
                      </p>
                      <p className="text-xs text-emerald-600">
                        in {selectedPractice.pcnName || 'Unknown PCN'}
                      </p>
                    </div>
                  </div>
                </Card>

              <p className="text-sm text-slate-500 text-center">
                Rankings are based on GP Appts/Day % and GP+OC/Day % metrics. Higher access rates contribute to better rankings.
              </p>
            </>
          )}

          {/* Data Availability Notice */}
          {(!practiceMetrics.hasTelephonyData || !practiceMetrics.hasOCData) && (
            <Card className="bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <Info className="text-amber-600 flex-shrink-0" size={20} />
                <div>
                  <h4 className="font-medium text-amber-800">Limited Data Availability</h4>
                  <ul className="text-sm text-amber-700 mt-1 space-y-1">
                    {!practiceMetrics.hasTelephonyData && (
                      <li>• Telephony data only available for October-November 2025</li>
                    )}
                    {!practiceMetrics.hasOCData && (
                      <li>• Online consultation data not available for this practice</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ========================================
          FORECASTING TAB
          ======================================== */}
      {activeSubTab === 'forecasting' && selectedPractice && (
        <div className="space-y-6">
          <Card className="bg-purple-50 border-purple-200">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-purple-600" size={24} />
              <div>
                <h3 className="font-bold text-purple-800">Combined Demand Forecasting</h3>
                <p className="text-sm text-purple-700">
                  Predictions based on historical appointment, telephony, and online consultation data
                </p>
              </div>
            </div>
          </Card>

          <Card className="text-center py-12">
            <TrendingUp className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-slate-700 mb-2">Forecasting Coming Soon</h3>
            <p className="text-slate-500">
              Enable "Compare with previous months" to load historical data for forecasting analysis.
              <br />
              This feature will combine trends from all data sources to predict future demand.
            </p>
          </Card>
        </div>
      )}

      {/* ========================================
          COMPARE TAB
          ======================================== */}
      {activeSubTab === 'compare' && (
        <div className="space-y-6">
          <Card className="bg-orange-50 border-orange-200">
            <div className="flex items-center gap-3">
              <Users className="text-orange-600" size={24} />
              <div>
                <h3 className="font-bold text-orange-800">Practice Comparison</h3>
                <p className="text-sm text-orange-700">
                  Compare practices side-by-side
                </p>
              </div>
            </div>
          </Card>

          {/* Add Practices Section */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-700">Add Practices to Compare</h4>
              <button
                onClick={() => setComparePractices([])}
                className="text-xs font-medium text-slate-600 hover:text-slate-800"
                disabled={comparePractices.length === 0}
              >
                Clear All
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search by practice, ODS code, or PCN..."
                value={compareSearchQuery}
                onChange={(e) => {
                  setCompareSearchQuery(e.target.value);
                  if (e.target.value.length >= 2 && appointmentData[selectedMonth]) {
                    const results = searchAppointmentPractices(appointmentData[selectedMonth], e.target.value, 10);
                    setCompareSearchResults(results.filter(
                      r => !comparePractices.some(cp => cp.odsCode === r.odsCode)
                    ));
                  } else {
                    setCompareSearchResults([]);
                  }
                }}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            {comparePcnResults.length > 0 && (
              <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                  PCN Matches
                </div>
                {comparePcnResults.map(pcn => (
                  <div
                    key={`${pcn.pcnCode}-${pcn.pcnName}`}
                    className="flex items-center justify-between px-3 py-2 border-t border-slate-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">{pcn.pcnName || 'Unknown PCN'}</p>
                      <p className="text-xs text-slate-500">{pcn.pcnCode || 'No PCN code'} • {pcn.count} practices</p>
                    </div>
                    <button
                      onClick={() => {
                        const pcnPractices = appointmentData[selectedMonth]?.practices?.filter(
                          p => p.pcnCode === pcn.pcnCode && p.pcnName === pcn.pcnName
                        ) || [];
                        addPracticesToCompare(pcnPractices);
                        setCompareSearchQuery('');
                        setCompareSearchResults([]);
                      }}
                      className="px-3 py-1 text-xs font-medium text-orange-700 border border-orange-200 rounded-md hover:bg-orange-50"
                    >
                      Add PCN
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search Results for Compare */}
            {compareSearchResults.length > 0 && (
              <div className="mb-4 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {compareSearchResults.map(practice => (
                  <button
                    key={practice.odsCode}
                    onClick={() => {
                      addPracticesToCompare([practice]);
                      setCompareSearchQuery('');
                      setCompareSearchResults([]);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-orange-50 transition-colors border-b border-slate-100 last:border-0 disabled:opacity-50"
                  >
                    <span className="font-medium">{practice.gpName}</span>
                    <span className="text-sm text-slate-500 ml-2">({practice.odsCode})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Practices Chips */}
            <div className="flex flex-wrap gap-2">
              {comparePractices.map((practice, index) => (
                <div
                  key={practice.odsCode}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{practice.odsCode}</span>
                  <span className="text-sm text-slate-500">{practice.gpName.slice(0, 20)}...</span>
                  <button
                    onClick={() => setComparePractices(comparePractices.filter(p => p.odsCode !== practice.odsCode))}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {comparePractices.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No practices added yet. Search and add practices to compare.
              </p>
            )}
          </Card>

          {/* Comparison View */}
          {comparePractices.length >= 2 && (
            <Card>
              <h4 className="font-bold text-slate-700 mb-4">Comparison Results</h4>

              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'practice',
                            direction: prev.key === 'practice' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="flex items-center gap-1 text-left font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Practice
                          {compareSort.key === 'practice' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'gpDayPct',
                            direction: prev.key === 'gpDayPct' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          GP/Day %
                          {compareSort.key === 'gpDayPct' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'gpOcDayPct',
                            direction: prev.key === 'gpOcDayPct' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          GP+OC/Day %
                          {compareSort.key === 'gpOcDayPct' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'gpOcPer1000',
                            direction: prev.key === 'gpOcPer1000' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          GP+OC/1000
                          {compareSort.key === 'gpOcPer1000' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'dnaPct',
                            direction: prev.key === 'dnaPct' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          DNA %
                          {compareSort.key === 'dnaPct' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'sameDayPct',
                            direction: prev.key === 'sameDayPct' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Same Day %
                          {compareSort.key === 'sameDayPct' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'f2fPct',
                            direction: prev.key === 'f2fPct' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          F2F %
                          {compareSort.key === 'f2fPct' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'gpApptsPerCall',
                            direction: prev.key === 'gpApptsPerCall' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          GP Appts/Demand
                          {compareSort.key === 'gpApptsPerCall' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'missedCallPct',
                            direction: prev.key === 'missedCallPct' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Missed Call %
                          {compareSort.key === 'missedCallPct' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'ocRatePer1000',
                            direction: prev.key === 'ocRatePer1000' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          OC/1000
                          {compareSort.key === 'ocRatePer1000' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right">
                        <button
                          onClick={() => setCompareSort(prev => ({
                            key: 'clinicalOcPer1000',
                            direction: prev.key === 'clinicalOcPer1000' && prev.direction === 'asc' ? 'desc' : 'asc',
                          }))}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Clinical OC/1000
                          {compareSort.key === 'clinicalOcPer1000' && (
                            compareSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompareRows.map((row) => {
                      const metrics = row.metrics;
                      const oc = row.oc;
                      return (
                        <tr key={row.practice.odsCode} className="border-b">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: row.color }}
                              />
                              <span className="font-medium">{row.practice.gpName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMetricValue(metrics?.gpApptPerDayPct, 'percent2')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMetricValue(metrics?.gpApptOrOCPerDayPct, 'percent2')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMetricValue(metrics?.gpApptOrOCPer1000, 'decimal1')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMetricValue(metrics?.dnaPct, 'percent1')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMetricValue(metrics?.sameDayPct, 'percent1')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMetricValue(metrics?.faceToFacePct, 'percent1')}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {metrics?.hasTelephonyData
                              ? formatMetricValue(metrics?.gpApptsPerCall, 'decimal2')
                              : 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {metrics?.hasTelephonyData
                              ? formatMetricValue(metrics?.missedCallPct, 'percent1')
                              : 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {oc && oc.ratePer1000 !== undefined ? oc.ratePer1000.toFixed(1) : 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {oc && oc.clinicalPer1000 !== undefined ? oc.clinicalPer1000.toFixed(1) : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {compareTrendMonths.length >= 2 && compareTrendData.length > 0 && (
                <div className="mt-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <span>Show legend</span>
                      <button
                        type="button"
                        onClick={() => setCompareLegendVisible(!compareLegendVisible)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          compareLegendVisible ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            compareLegendVisible ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <span>Zoom to last 6 months</span>
                      <button
                        type="button"
                        onClick={() => setCompareZoom(!compareZoom)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          compareZoom ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            compareZoom ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                  <Card>
                    <h5 className="font-semibold text-slate-700 mb-3">GP+OC/Day % Over Time</h5>
                    <div className="h-80">
                      <Line
                        data={{
                          labels: compareChartMonths.map(month => month.replace(' 202', '\n202')),
                          datasets: compareTrendData.map(entry => ({
                            label: entry.practice.gpName,
                            data: compareChartMonths.map(month => entry.seriesByMonth.get(month)?.metrics?.gpApptOrOCPerDayPct ?? null),
                            borderColor: entry.color,
                            backgroundColor: `${entry.color}22`,
                            tension: 0.3,
                            pointRadius: 0,
                            pointHoverRadius: 3,
                            spanGaps: false,
                          }))
                        }}
                        options={{
                          ...commonOptions,
                          maintainAspectRatio: false,
                          plugins: {
                            ...commonOptions.plugins,
                            legend: {
                              display: compareLegendVisible,
                              position: 'bottom',
                              labels: { usePointStyle: true, boxWidth: 10, font: { size: 10 } }
                            },
                          },
                          scales: {
                            x: {
                              ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 45, minRotation: 45 },
                            },
                            y: {
                              beginAtZero: true,
                              ticks: { callback: v => `${v}%` },
                            },
                          },
                        }}
                      />
                    </div>
                  </Card>

                  <Card>
                    <h5 className="font-semibold text-slate-700 mb-3">GP+OC per 1000 Over Time</h5>
                    <div className="h-80">
                      <Line
                        data={{
                          labels: compareChartMonths.map(month => month.replace(' 202', '\n202')),
                          datasets: compareTrendData.map(entry => ({
                            label: entry.practice.gpName,
                            data: compareChartMonths.map(month => entry.seriesByMonth.get(month)?.metrics?.gpApptOrOCPer1000 ?? null),
                            borderColor: entry.color,
                            backgroundColor: `${entry.color}22`,
                            tension: 0.3,
                            pointRadius: 0,
                            pointHoverRadius: 3,
                            spanGaps: false,
                          }))
                        }}
                        options={{
                          ...commonOptions,
                          maintainAspectRatio: false,
                          plugins: {
                            ...commonOptions.plugins,
                            legend: {
                              display: compareLegendVisible,
                              position: 'bottom',
                              labels: { usePointStyle: true, boxWidth: 10, font: { size: 10 } }
                            },
                          },
                          scales: {
                            x: {
                              ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 45, minRotation: 45 },
                            },
                            y: {
                              beginAtZero: true,
                              ticks: { callback: v => v },
                            },
                          },
                        }}
                      />
                    </div>
                  </Card>

                  <Card>
                    <h5 className="font-semibold text-slate-700 mb-3">Missed Call % Over Time</h5>
                    <div className="h-80">
                      <Line
                        data={{
                          labels: compareChartMonths.map(month => month.replace(' 202', '\n202')),
                          datasets: compareTrendData.map(entry => ({
                            label: entry.practice.gpName,
                            data: compareChartMonths.map(month => entry.seriesByMonth.get(month)?.metrics?.missedCallPct ?? null),
                            borderColor: entry.color,
                            backgroundColor: `${entry.color}22`,
                            tension: 0.3,
                            pointRadius: 0,
                            pointHoverRadius: 3,
                            spanGaps: false,
                          }))
                        }}
                        options={{
                          ...commonOptions,
                          maintainAspectRatio: false,
                          plugins: {
                            ...commonOptions.plugins,
                            legend: {
                              display: compareLegendVisible,
                              position: 'bottom',
                              labels: { usePointStyle: true, boxWidth: 10, font: { size: 10 } }
                            },
                          },
                          scales: {
                            x: {
                              ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 45, minRotation: 45 },
                            },
                            y: {
                              beginAtZero: true,
                              ticks: { callback: v => `${v}%` },
                            },
                          },
                        }}
                      />
                    </div>
                  </Card>

                  <Card>
                    <h5 className="font-semibold text-slate-700 mb-3">Clinical OC per 1000 Over Time</h5>
                    <div className="h-80">
                      <Line
                        data={{
                          labels: compareChartMonths.map(month => month.replace(' 202', '\n202')),
                          datasets: compareTrendData.map(entry => ({
                            label: entry.practice.gpName,
                            data: compareChartMonths.map(month => entry.seriesByMonth.get(month)?.oc?.clinicalPer1000 ?? null),
                            borderColor: entry.color,
                            backgroundColor: `${entry.color}22`,
                            tension: 0.3,
                            pointRadius: 0,
                            pointHoverRadius: 3,
                            spanGaps: false,
                          }))
                        }}
                        options={{
                          ...commonOptions,
                          maintainAspectRatio: false,
                          plugins: {
                            ...commonOptions.plugins,
                            legend: {
                              display: compareLegendVisible,
                              position: 'bottom',
                              labels: { usePointStyle: true, boxWidth: 10, font: { size: 10 } }
                            },
                          },
                          scales: {
                            x: {
                              ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 45, minRotation: 45 },
                            },
                            y: {
                              beginAtZero: true,
                              ticks: { callback: v => v },
                            },
                          },
                        }}
                      />
                    </div>
                  </Card>
                </div>
              )}

              {compareTrendMonths.length < 2 && (
                <Card className="mt-6 text-center py-6 bg-orange-50 border-orange-200">
                  <p className="text-sm text-orange-700">
                    Select a timeframe with at least 2 months to view comparison trends.
                  </p>
                </Card>
              )}

              {/* Share Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setToast({ type: 'info', message: 'Shareable comparison links coming soon!' })}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Share2 size={18} />
                  Share Comparison
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
        </>
      )}

      {/* ========================================
          TELEPHONY TAB - Always mounted (hidden with CSS) for background data loading
          ======================================== */}
      <div className={activeSubTab === 'telephony' && selectedPractice ? '' : 'hidden'}>
        <NationalTelephony
          sharedPractice={selectedPractice || sharedPractice}
          setSharedPractice={(practice) => {
            if (practice) {
              handleSelectPractice(practice);
            } else {
              setSelectedPractice(null);
            }
          }}
          sharedBookmarks={sharedBookmarks}
          updateSharedBookmarks={updateSharedBookmarks}
          sharedUsageStats={sharedUsageStats}
          onLoadingChange={setTelephonyLoading}
          onDataLoaded={setTelephonyData}
          hideSearch={true} // Search and month controls handled by parent
          parentSelectedMonth={selectedMonth}
          parentCompareMode={compareMode}
          parentTimeRangeMonths={timeRangeMonths}
          workforceMetrics={workforceMetrics}
        />
      </div>

      {/* ========================================
          ONLINE CONSULTATIONS TAB - Always mounted (hidden with CSS) for background data loading
          ======================================== */}
      <div className={activeSubTab === 'online-consultations' && selectedPractice ? '' : 'hidden'}>
        <NationalOnlineConsultations
          sharedPractice={selectedPractice || sharedPractice}
          setSharedPractice={(practice) => {
            if (practice) {
              handleSelectPractice(practice);
            } else {
              setSelectedPractice(null);
            }
          }}
          sharedBookmarks={sharedBookmarks}
          updateSharedBookmarks={updateSharedBookmarks}
          sharedUsageStats={sharedUsageStats}
          onLoadingChange={setOcLoading}
          onDataLoaded={setOcData}
          hideSearch={true} // Search and month controls handled by parent
          parentSelectedMonth={selectedMonth}
          parentCompareMode={compareMode}
          parentTimeRangeMonths={timeRangeMonths}
          workforceMetrics={workforceMetrics}
        />
      </div>

      {/* ========================================
          WORKFORCE TAB - Always mounted (hidden with CSS) for background data loading
          ======================================== */}
      <div className={activeSubTab === 'workforce' && selectedPractice ? '' : 'hidden'}>
        <NationalWorkforce
          selectedPractice={selectedPractice || sharedPractice}
          selectedMonth={selectedMonth}
          appointmentData={appointmentData}
          telephonyData={telephonyData}
          ocData={ocData}
          onLoadingChange={setWorkforceLoading}
          onMetricsChange={setWorkforceMetrics}
        />
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default NationalDemandCapacity;
