import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowUp, ArrowDown, Phone, Trophy, TrendingUp, ExternalLink, Info, Star, ChevronDown, ChevronUp, TrendingDown, Minus, Clock, BarChart3, Users, Activity, Globe } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { trackEvent } from '../firebase/config';
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
} from 'chart.js';
import Card from './ui/Card';
import PracticeCentricLeaderboard from './ui/PracticeCentricLeaderboard';
import { NHS_GREEN, NHS_RED } from '../constants/colors';
import { parseNationalTelephonyData, getAverageWaitTimeBin, getAverageDurationBin } from '../utils/parseNationalTelephony';
import {
  calculateNationalRanking,
  calculateICBRanking,
  calculatePCNRanking,
  getPerformanceInterpretation,
  calculatePCNAverages,
  getPCNNationalRanking,
  getPCNICBRanking,
  calculateCallsSaved,
  getNationalMissedPct,
  calculateCallsSavedRanking
} from '../utils/telephonyAnalysis';
import { parsePopulationData, calculatePer1000, getWorkloadInterpretation } from '../utils/parsePopulationData';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Import the Excel files
import octData from '../assets/Cloud Based Telephony Publication Summary October 2025_v2.xlsx?url';
import novData from '../assets/Cloud Based Telephony Publication Summary November 2025.xlsx?url';
import decData from '../assets/Cloud Based Telephony Publication Summary December 2025.xlsx?url';

// Import population CSV files
import octPopData from '../assets/PracPopOct.csv?url';
import novPopData from '../assets/PracPopNov.csv?url';
import decPopData from '../assets/PracPopDec.csv?url';

// Month data mapping - ordered from oldest to newest for charts
const MONTH_DATA = {
  'December 2025': { telephony: decData, population: decPopData },
  'November 2025': { telephony: novData, population: novPopData },
  'October 2025': { telephony: octData, population: octPopData }
};

// Ordered months for charts (oldest first)
const MONTHS_ORDERED = ['October 2025', 'November 2025', 'December 2025'];

const NationalTelephony = ({
  sharedPractice,
  setSharedPractice,
  sharedBookmarks,
  updateSharedBookmarks,
  sharedUsageStats,
  recordPracticeUsage,
  onLoadingChange,
  onDataLoaded,
  hideSearch = false, // When true, hides the search box and month/compare controls (used when embedded in unified D&C view)
  parentSelectedMonth, // Optional: controlled month from parent component
  parentCompareMode, // Optional: controlled compare mode from parent component
  parentTimeRangeMonths, // Optional: controlled time range months from parent component
  workforceMetrics, // Optional: workforce cross-over metrics from parent
}) => {
  const [allMonthsData, setAllMonthsData] = useState({}); // Store all months data
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCallsSavedTooltip, setShowCallsSavedTooltip] = useState(false);
  const [showInterpretationTooltip, setShowInterpretationTooltip] = useState(false);
  const [showCoveragePopup, setShowCoveragePopup] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(true);
  const [localSelectedMonth, setLocalSelectedMonth] = useState('November 2025');
  const [localCompareWithPrevious, setLocalCompareWithPrevious] = useState(true);

  // Use parent-controlled values if provided, otherwise use local state
  const selectedMonth = parentSelectedMonth || localSelectedMonth;
  const setSelectedMonth = parentSelectedMonth ? () => {} : setLocalSelectedMonth;
  const compareWithPrevious = parentCompareMode !== undefined ? parentCompareMode : localCompareWithPrevious;
  const setCompareWithPrevious = parentCompareMode !== undefined ? () => {} : setLocalCompareWithPrevious;
  const [activeTab, setActiveTab] = useState('overview');
  const [showRecents, setShowRecents] = useState(() => (sharedUsageStats?.recentPractices?.length || 0) > 0);
  const [showSearchBox, setShowSearchBox] = useState(true);

  const usageStats = sharedUsageStats || { totalChecks: 0, recentPractices: [] };

  // Use shared state for practice and bookmarks
  const bookmarkedPractices = sharedBookmarks;
  const setBookmarkedPractices = updateSharedBookmarks;

  // Local selected practice - synced with shared state
  const [selectedPractice, setSelectedPracticeLocal] = useState(null);

  // Sync local practice with shared state when data loads or shared practice changes
  useEffect(() => {
    if (sharedPractice && allMonthsData[selectedMonth]) {
      const practice = allMonthsData[selectedMonth].practices.find(
        p => p.odsCode === sharedPractice.odsCode
      );
      if (practice) {
        setSelectedPracticeLocal(practice);
        setShowSearchBox(false);
      }
    }
  }, [sharedPractice, allMonthsData, selectedMonth]);

  // Update shared state when local practice is selected
  const setSelectedPractice = (practice) => {
    setSelectedPracticeLocal(practice);
    if (practice) {
      if (recordPracticeUsage) {
        recordPracticeUsage(practice);
      }
      setShowSearchBox(false);
      setSharedPractice({
        odsCode: practice.odsCode,
        gpName: practice.gpName,
        pcnCode: practice.pcnCode,
        pcnName: practice.pcnName,
        icbCode: practice.icbCode,
        icbName: practice.icbName
      });
    } else {
      setSearchTerm('');
      setShowSearchBox(true);
      setSharedPractice(null);
    }
  };

  // Tab definitions
  const TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
    { id: 'per1000', label: 'Per 1000 Pts', icon: Users },
    { id: 'impact', label: 'Impact Metrics', icon: Activity }
  ];

  // Get current data based on selected month
  const data = allMonthsData[selectedMonth] || null;
  const recentPractices = usageStats.recentPractices || [];

  useEffect(() => {
    if (recentPractices.length > 0 && !showRecents) {
      setShowRecents(true);
    }
  }, [recentPractices.length, showRecents]);

  // Switch away from Trends tab if comparison is disabled
  useEffect(() => {
    if (!compareWithPrevious && activeTab === 'trends') {
      setActiveTab('overview');
    }
  }, [compareWithPrevious, activeTab]);

  // Get previous month data for comparison
  const availableChartMonths = useMemo(() => (
    MONTHS_ORDERED.filter(month => allMonthsData[month])
  ), [allMonthsData]);

  const chartMonths = useMemo(() => {
    if (parentTimeRangeMonths && parentTimeRangeMonths.length > 0) {
      const filtered = parentTimeRangeMonths.filter(month => availableChartMonths.includes(month));
      return filtered.length > 0 ? filtered : availableChartMonths;
    }
    return availableChartMonths;
  }, [parentTimeRangeMonths, availableChartMonths]);

  const previousMonth = useMemo(() => {
    const currentIndex = chartMonths.indexOf(selectedMonth);
    if (currentIndex > 0) {
      return chartMonths[currentIndex - 1];
    }
    return null;
  }, [selectedMonth, chartMonths]);

  const previousData = previousMonth ? allMonthsData[previousMonth] : null;

  // Helper function to get practice data from previous month
  const getPreviousPracticeData = (odsCode) => {
    if (!previousData) return null;
    return previousData.practices.find(p => p.odsCode === odsCode);
  };

  // Helper function to calculate metric change
  const getMetricChange = (currentValue, previousValue, lowerIsBetter = false) => {
    if (previousValue === undefined || previousValue === null) return null;
    const change = currentValue - previousValue;
    const improved = lowerIsBetter ? change < 0 : change > 0;
    const worsened = lowerIsBetter ? change > 0 : change < 0;
    return { change, improved, worsened, noChange: change === 0 };
  };

  // Calculate top 10 most improved practices by missed call %
  const mostImprovedByMissedPct = useMemo(() => {
    if (!data || !previousData) return [];

    const improvements = data.practices.map(practice => {
      const prevPractice = previousData.practices.find(p => p.odsCode === practice.odsCode);
      if (!prevPractice) return null;

      const currentMissedPct = practice.missedPct * 100;
      const prevMissedPct = prevPractice.missedPct * 100;
      const improvement = prevMissedPct - currentMissedPct; // Positive = improved

      return {
        ...practice,
        currentMissedPct,
        prevMissedPct,
        improvement
      };
    }).filter(p => p !== null && p.improvement > 0);

    return improvements
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 10);
  }, [data, previousData]);

  // Calculate top 10 most improved by standardised metric (calls saved)
  const mostImprovedByCallsSaved = useMemo(() => {
    if (!data || !previousData) return [];

    const currentNationalMissedPct = getNationalMissedPct(data.practices);
    const prevNationalMissedPct = getNationalMissedPct(previousData.practices);

    const improvements = data.practices.map(practice => {
      const prevPractice = previousData.practices.find(p => p.odsCode === practice.odsCode);
      if (!prevPractice) return null;

      const currentCallsSaved = calculateCallsSaved(practice, currentNationalMissedPct);
      const prevCallsSaved = calculateCallsSaved(prevPractice, prevNationalMissedPct);
      const improvement = currentCallsSaved - prevCallsSaved;

      return {
        ...practice,
        currentCallsSaved,
        prevCallsSaved,
        improvement
      };
    }).filter(p => p !== null && p.improvement > 0);

    return improvements
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 10);
  }, [data, previousData]);

  // Calculate consistency metrics for all practices across all months
  const consistencyData = useMemo(() => {
    if (Object.keys(allMonthsData).length < 2) return { consistent: [], volatile: [], practiceScores: {} };

    // Build a map of practice performance across all months
    const practicePerformance = {};

    chartMonths.forEach(month => {
      const monthData = allMonthsData[month];
      if (!monthData) return;

      monthData.practices.forEach(practice => {
        if (!practicePerformance[practice.odsCode]) {
          practicePerformance[practice.odsCode] = {
            odsCode: practice.odsCode,
            gpName: practice.gpName,
            pcnName: practice.pcnName,
            icbName: practice.icbName,
            monthlyData: []
          };
        }
        practicePerformance[practice.odsCode].monthlyData.push({
          month,
          missedPct: practice.missedPct * 100,
          inboundCalls: practice.inboundCalls
        });
      });
    });

    // Calculate standard deviation for each practice
    const practicesWithVariance = Object.values(practicePerformance)
      .filter(p => p.monthlyData.length >= 2) // Only include practices with data in multiple months
      .map(practice => {
        const missedPcts = practice.monthlyData.map(d => d.missedPct);
        const avgMissedPct = missedPcts.reduce((a, b) => a + b, 0) / missedPcts.length;

        // Calculate standard deviation
        const squaredDiffs = missedPcts.map(pct => Math.pow(pct - avgMissedPct, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        const stdDev = Math.sqrt(avgSquaredDiff);

        // Calculate the range (max - min)
        const range = Math.max(...missedPcts) - Math.min(...missedPcts);

        // Get latest and previous values
        const latestPct = practice.monthlyData[practice.monthlyData.length - 1].missedPct;
        const prevPct = practice.monthlyData[practice.monthlyData.length - 2]?.missedPct;

        return {
          ...practice,
          avgMissedPct,
          stdDev,
          range,
          latestPct,
          prevPct,
          monthCount: practice.monthlyData.length,
          // Consistency score: lower stdDev = higher score (inverse relationship)
          // Normalized to 0-100 scale where 100 = perfectly consistent
          consistencyScore: Math.max(0, 100 - (stdDev * 10))
        };
      });

    // Sort by standard deviation (lowest = most consistent)
    const consistent = [...practicesWithVariance]
      .sort((a, b) => a.stdDev - b.stdDev)
      .slice(0, 10);

    // Sort by standard deviation (highest = most volatile)
    const volatile = [...practicesWithVariance]
      .sort((a, b) => b.stdDev - a.stdDev)
      .slice(0, 10);

    // Create a lookup map for individual practice scores
    const practiceScores = {};
    practicesWithVariance.forEach(p => {
      practiceScores[p.odsCode] = {
        stdDev: p.stdDev,
        range: p.range,
        consistencyScore: p.consistencyScore,
        avgMissedPct: p.avgMissedPct
      };
    });

    return { consistent, volatile, practiceScores };
  }, [allMonthsData, chartMonths]);

  // Toggle bookmark for a practice
  const toggleBookmark = (practice) => {
    const isAlreadyBookmarked = bookmarkedPractices.some(p => p.odsCode === practice.odsCode);
    let newBookmarks;

    if (isAlreadyBookmarked) {
      newBookmarks = bookmarkedPractices.filter(p => p.odsCode !== practice.odsCode);
      trackEvent('bookmark_removed', { ods_code: practice.odsCode, source: 'telephony' });
    } else {
      newBookmarks = [...bookmarkedPractices, {
        odsCode: practice.odsCode,
        name: practice.gpName,
        pcnCode: practice.pcnCode,
        pcnName: practice.pcnName,
        icbCode: practice.icbCode,
        icbName: practice.icbName,
        timestamp: new Date().toISOString()
      }];
      trackEvent('bookmark_added', { ods_code: practice.odsCode, source: 'telephony' });
    }

    setBookmarkedPractices(newBookmarks);
  };

  // Check if a practice is bookmarked
  const isBookmarked = (odsCode) => {
    return bookmarkedPractices.some(p => p.odsCode === odsCode);
  };

  // Track if data has been loaded to prevent re-loading
  const dataLoadedRef = useRef(false);

  // Load and parse all Excel files and population data on mount (only once)
  useEffect(() => {
    // Prevent re-loading if already loaded
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    const loadAllData = async () => {
      try {
        setLoading(true);
        const allData = {};

        // Try to load pre-processed JSON first (much faster - 10-20x improvement)
        let jsonData = null;
        try {
          const jsonResponse = await fetch('/data/telephony.json');
          if (jsonResponse.ok) {
            jsonData = await jsonResponse.json();
            console.log('Using pre-processed JSON data');
          }
        } catch (e) {
          console.log('Pre-processed JSON not available, falling back to XLSX parsing');
        }

        if (jsonData) {
          // Use pre-processed JSON data - just load population data
          for (const month of Object.keys(jsonData)) {
            if (month === 'metadata') continue;
            const monthConfig = MONTH_DATA[month];
            if (monthConfig) {
              const populationMap = await parsePopulationData(monthConfig.population);
              allData[month] = {
                ...jsonData[month],
                populationMap
              };
            }
          }
        } else {
          // Fallback: Load all months in parallel (telephony + population) using XLSX parsing
          const loadPromises = Object.entries(MONTH_DATA).map(async ([month, { telephony, population }]) => {
            const cacheBuster = `?v=${Date.now()}`;

            // Load telephony data
            const response = await fetch(telephony + cacheBuster);
            const arrayBuffer = await response.arrayBuffer();
            const parsedData = parseNationalTelephonyData(arrayBuffer);

            // Load population data
            const populationMap = await parsePopulationData(population + cacheBuster);

            return { month, data: parsedData, populationMap };
          });

          const results = await Promise.all(loadPromises);
          results.forEach(({ month, data, populationMap }) => {
            allData[month] = {
              ...data,
              populationMap
            };
          });
        }

        // DEBUG: Log the loaded data
        console.log('=== ALL MONTHS DATA LOADED ===');
        Object.entries(allData).forEach(([month, parsedData]) => {
          console.log(`${month}: ${parsedData.practices?.length} practices, ${Object.keys(parsedData.populationMap || {}).length} population records`);
        });

        setAllMonthsData(allData);
        onDataLoaded?.(allData);
        setLoading(false);
        onLoadingChange?.(false);
      } catch (error) {
        console.error('Error loading telephony data:', error);
        setLoading(false);
        onLoadingChange?.(false);
      }
    };
    loadAllData();
  }, []);

  // Filter practices based on search (including PCN name search)
  const filteredPractices = useMemo(() => {
    if (!data || !searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return data.practices.filter(p =>
      p.gpName.toLowerCase().includes(term) ||
      p.odsCode.toLowerCase().includes(term) ||
      p.pcnName.toLowerCase().includes(term)
    ).slice(0, 10); // Limit to 10 results
  }, [data, searchTerm]);

  // Calculate comparison arrow
  const getComparisonArrow = (practiceValue, nationalValue, lowerIsBetter = false) => {
    if (practiceValue === nationalValue) return null;
    const isBetter = lowerIsBetter ? practiceValue < nationalValue : practiceValue > nationalValue;

    if (lowerIsBetter) {
      // For metrics where lower is better (missed calls, abandoned calls)
      return isBetter ? (
        <ArrowDown size={20} className="text-green-600" /> // Lower than national = good
      ) : (
        <ArrowUp size={20} className="text-red-600" /> // Higher than national = bad
      );
    } else {
      // For metrics where higher is better (answered calls)
      return isBetter ? (
        <ArrowUp size={20} className="text-green-600" /> // Higher than national = good
      ) : (
        <ArrowDown size={20} className="text-red-600" /> // Lower than national = bad
      );
    }
  };

  // Loading is now handled by parent component with unified loader
  if (loading) {
    return null;
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-red-600">
        <p>Error loading telephony data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Selection Card - Hidden when embedded in unified view */}
      {!hideSearch && (
        <Card>
          <div className="text-center space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Object.keys(MONTH_DATA).map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compareWithPrevious}
                  onChange={(e) => setCompareWithPrevious(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600 font-medium">Compare with previous months</span>
              </label>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://digital.nhs.uk/data-and-information/publications/statistical/cloud-based-telephony-data-in-general-practice"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                📞 Telephony Data <ExternalLink size={12} />
              </a>
              <a
                href="https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                👥 Patient List Sizes <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </Card>
      )}

      {!hideSearch && (
        <>
          {/* Recent Practices */}
      <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            <h3 className="font-bold text-slate-800">Recent Practices</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {recentPractices.length}
            </span>
          </div>
          <button
            onClick={() => setShowRecents(!showRecents)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-3"
          >
            {showRecents ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
        {showRecents && (
          recentPractices.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recentPractices.map((practice) => {
                const foundPractice = data?.practices.find(p => p.odsCode === practice.odsCode);
                const disabled = !foundPractice;
                return (
                  <button
                    key={practice.odsCode}
                    onClick={() => {
                      if (!foundPractice) return;
                      setSelectedPractice(foundPractice);
                      setSearchTerm('');
                    }}
                    className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${disabled ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-blue-200 text-blue-800 hover:bg-blue-50 hover:border-blue-300 transition-colors'}`}
                    disabled={disabled}
                  >
                    <span className="font-semibold truncate max-w-[160px]">{practice.name}</span>
                    <span className="text-xs text-slate-500">{practice.odsCode}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No recent practices yet. Select a practice to build your quick list.</p>
          )
        )}
      </Card>

      {/* Bookmarked Practices */}
      {bookmarkedPractices.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star size={20} className="text-amber-600 fill-amber-600" />
              <h3 className="font-bold text-slate-800">Your Bookmarked Practices</h3>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {bookmarkedPractices.length}
              </span>
            </div>
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-3"
            >
              {showBookmarks ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          {showBookmarks && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {bookmarkedPractices.map((bookmark) => (
                <button
                  key={bookmark.odsCode}
                  onClick={() => {
                    const foundPractice = data?.practices.find(p => p.odsCode === bookmark.odsCode);
                    if (foundPractice) {
                      setSelectedPractice(foundPractice);
                      setSearchTerm('');
                    }
                  }}
                  className="flex items-center justify-between p-3 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-all text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{bookmark.name}</p>
                    <p className="text-xs text-slate-500 truncate">{bookmark.odsCode} • {bookmark.pcnName}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const foundPractice = data?.practices.find(p => p.odsCode === bookmark.odsCode);
                      if (foundPractice) toggleBookmark(foundPractice);
                    }}
                    className="ml-2 p-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Star size={16} className="text-amber-600 fill-amber-600 hover:text-amber-700" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
        </>
      )}

      {/* Coverage Popup Modal */}
      {showCoveragePopup && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
          onClick={() => setShowCoveragePopup(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-full sm:max-w-lg w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info size={24} className="text-blue-600" />
                <h3 className="text-xl font-bold text-slate-800">Can't find your practice?</h3>
              </div>
              <button
                onClick={() => setShowCoveragePopup(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-3"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                This national extract covers <strong>74.7% of GP practices</strong> in England that use cloud-based telephony systems.
              </p>
              <p>
                If you can't find your practice, it may be because:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Your practice hasn't migrated to cloud-based telephony yet</li>
                <li>Your practice opted out of data sharing</li>
                <li>Your practice's data wasn't available for this month</li>
              </ul>
              <p>
                To check your surgery's participation status, visit the <strong>CBT Participation and Summary Extract</strong>:
              </p>
              <a
                href="https://digital.nhs.uk/data-and-information/publications/statistical/cloud-based-telephony-data-in-general-practice/october-2025"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                View NHS England Publication <ExternalLink size={14} />
              </a>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCoveragePopup(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Practice Search - Hidden when embedded in unified D&C view */}
      {!hideSearch && (
      <Card>
        {showSearchBox && (
          <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Search size={20} className="text-slate-400" />
            <label className="font-semibold text-slate-700">Find Your Practice</label>
            <button
              onClick={() => setShowCoveragePopup(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors ml-auto"
            >
              <Info size={12} /> Can't find your practice?
            </button>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by practice name or ODS code..."
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Search Results Dropdown - Only show when searching, hide after selection */}
            {searchTerm && !selectedPractice && filteredPractices.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[50vh] sm:max-h-64 overflow-y-auto">
              {filteredPractices.map((practice) => (
                <div
                  key={practice.odsCode}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors group"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark(practice);
                    }}
                    className="flex-shrink-0 p-3 rounded hover:bg-amber-100 transition-colors"
                    title={isBookmarked(practice.odsCode) ? "Remove bookmark" : "Bookmark this practice"}
                  >
                    <Star
                      size={20}
                      className={isBookmarked(practice.odsCode) ? "text-amber-500 fill-amber-500" : "text-slate-300 hover:text-amber-500"}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPractice(practice);
                      setSearchTerm('');
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-medium text-slate-800 truncate">{practice.gpName}</div>
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {practice.odsCode} • {practice.pcnName} • {practice.icbName}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchTerm && !selectedPractice && filteredPractices.length === 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4">
              <p className="text-sm text-slate-500">No practices found matching "{searchTerm}"</p>
            </div>
          )}
          </div>
        )}

        {selectedPractice && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-start">
            <div>
              <p className="text-sm text-blue-900">
                <strong>Selected:</strong> {selectedPractice.gpName} ({selectedPractice.odsCode})
              </p>
              <p className="text-xs text-blue-700 mt-1">
                PCN: {selectedPractice.pcnName} • ICB: {selectedPractice.icbName}
              </p>
            </div>
            <button
              onClick={() => setSelectedPractice(null)}
              className="px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
            >
              Change Practice
            </button>
          </div>
        )}
      </Card>
      )}

      {/* Tab Navigation - Only show when practice selected */}
      {selectedPractice && (
        <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
          {TABS.map(tab => {
            const isDisabled = tab.id === 'trends' && !compareWithPrevious;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : activeTab === tab.id
                      ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }`}
                title={isDisabled ? 'Enable "Compare with previous months" to view trends' : ''}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* OVERVIEW TAB - National Averages & Summary Tiles */}
      {selectedPractice && activeTab === 'overview' && (() => {
        // Calculate average inbound calls across all practices
        const avgInboundCalls = Math.round(
          data.practices.reduce((sum, p) => sum + p.inboundCalls, 0) / data.practices.length
        );

        // Get previous month practice data for comparison
        const prevPractice = compareWithPrevious ? getPreviousPracticeData(selectedPractice.odsCode) : null;

        // Helper to render month-over-month change indicator
        const renderChangeIndicator = (currentValue, previousValue, lowerIsBetter = false, isPercentage = false) => {
          if (!compareWithPrevious || !prevPractice || previousValue === undefined) return null;
          const change = getMetricChange(currentValue, previousValue, lowerIsBetter);
          if (!change || change.noChange) return null;

          const changeValue = Math.abs(change.change);
          const displayValue = isPercentage ? `${(changeValue * 100).toFixed(1)}%` : changeValue.toLocaleString();

          return (
            <div className={`flex items-center gap-1 text-xs mt-1 ${change.improved ? 'text-green-600' : 'text-red-600'}`}>
              {change.improved ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{change.improved ? '↓' : '↑'} {displayValue} vs {previousMonth?.split(' ')[0]}</span>
            </div>
          );
        };

        return (
          <>
            {/* National Averages */}
            <Card className="bg-gradient-to-br from-slate-100 via-slate-50 to-white border-slate-300 border-l-4 border-l-slate-500 relative overflow-hidden">
              <Globe size={120} className="absolute -right-4 -bottom-4 text-slate-200 opacity-40" />
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-slate-500 mb-4 tracking-wider uppercase flex items-center gap-2">
                  <Globe size={16} />
                  National Averages
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Total Inbound Calls</p>
                    <p className="text-xl font-bold text-slate-700">{avgInboundCalls.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Abandoned (IVR)</p>
                    <p className="text-xl font-bold text-slate-700">{(data.national.endedDuringIVRPct * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Missed</p>
                    <p className="text-xl font-bold text-slate-700">{(data.national.missedPct * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Callback Requested</p>
                    <p className="text-xl font-bold text-slate-700">{(data.national.callbackRequestedPct * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Calls */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Total Inbound Calls</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{selectedPractice.inboundCalls.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">National Avg: {avgInboundCalls.toLocaleString()}</p>
                {compareWithPrevious && prevPractice && (
                  <>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {previousMonth?.split(' ')[0]}: {prevPractice.inboundCalls.toLocaleString()}
                    </p>
                    {selectedPractice.inboundCalls !== prevPractice.inboundCalls && (
                      <div className="flex items-center gap-1 text-xs mt-1 text-blue-600">
                        {selectedPractice.inboundCalls > prevPractice.inboundCalls ? (
                          <><TrendingUp size={14} /><span>↑ {(selectedPractice.inboundCalls - prevPractice.inboundCalls).toLocaleString()} vs {previousMonth?.split(' ')[0]}</span></>
                        ) : (
                          <><TrendingDown size={14} /><span>↓ {(prevPractice.inboundCalls - selectedPractice.inboundCalls).toLocaleString()} vs {previousMonth?.split(' ')[0]}</span></>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {selectedPractice.inboundCalls > avgInboundCalls ? (
                <ArrowUp size={20} className="text-slate-600" />
              ) : selectedPractice.inboundCalls < avgInboundCalls ? (
                <ArrowDown size={20} className="text-slate-600" />
              ) : null}
            </div>
          </Card>

          {/* Abandoned Calls (Ended during IVR) */}
          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Abandoned Calls (IVR)</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.endedDuringIVRPct * 100).toFixed(1)}%</p>
              <p className="text-sm text-slate-600 mt-1">{selectedPractice.endedDuringIVR.toLocaleString()} calls</p>
              <p className="text-xs text-slate-500 mt-1">National: {(data.national.endedDuringIVRPct * 100).toFixed(1)}%</p>
              {renderChangeIndicator(selectedPractice.endedDuringIVRPct, prevPractice?.endedDuringIVRPct, true, true)}
            </div>
          </Card>

          {/* Missed Calls */}
          <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Missed Calls</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.missedPct * 100).toFixed(1)}%</p>
                <p className="text-sm text-slate-600 mt-1">{selectedPractice.missed.toLocaleString()} calls</p>
                <p className="text-xs text-slate-500 mt-1">National: {(data.national.missedPct * 100).toFixed(1)}%</p>
                {renderChangeIndicator(selectedPractice.missedPct, prevPractice?.missedPct, true, true)}
              </div>
              {getComparisonArrow(selectedPractice.missedPct, data.national.missedPct, true)}
            </div>
          </Card>

          {/* Callback Requested - No arrow */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Callback Requested</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{(selectedPractice.callbackRequestedPct * 100).toFixed(1)}%</p>
              <p className="text-sm text-slate-600 mt-1">{selectedPractice.callbackRequested.toLocaleString()} callbacks</p>
              <p className="text-xs text-slate-500 mt-1">National: {(data.national.callbackRequestedPct * 100).toFixed(1)}%</p>
            </div>
          </Card>

          {/* Callbacks Made */}
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase">Callbacks Made</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{selectedPractice.callbackMade.toLocaleString()}</p>
                <p className="text-sm text-slate-600 mt-1">{(selectedPractice.callbackMadePct * 100).toFixed(1)}% of requested</p>
              </div>
            </div>
          </Card>

          {/* Average Wait Time */}
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Avg Wait Time (Answered)</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {getAverageWaitTimeBin(selectedPractice.waitTimeData)}
              </p>
            </div>
          </Card>

          {/* Average Duration */}
          <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Avg Call Duration</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {getAverageDurationBin(selectedPractice.waitTimeData)}
              </p>
            </div>
          </Card>

          {/* Missed Call Wait Time */}
          <Card className="bg-gradient-to-br from-rose-50 to-white border-rose-200">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Avg Missed Call Wait</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                {getAverageWaitTimeBin(selectedPractice.missedWaitData)}
              </p>
            </div>
          </Card>
        </div>
          </>
        );
      })()}

      {/* Performance Rankings & Analysis */}
      {selectedPractice && (() => {
        const nationalRanking = calculateNationalRanking(selectedPractice, data.practices);
        const icbRanking = calculateICBRanking(selectedPractice, data.practices);
        const pcnRanking = calculatePCNRanking(selectedPractice, data.practices);
        const interpretation = getPerformanceInterpretation(nationalRanking.percentile);

        // Calculate Calls Saved metrics
        const nationalMissedPct = getNationalMissedPct(data.practices);
        const practiceCallsSaved = calculateCallsSaved(selectedPractice, nationalMissedPct);
        const callsSavedRanking = calculateCallsSavedRanking(selectedPractice, data.practices);

        // Calculate previous month interpretation for comparison
        const prevPractice = compareWithPrevious ? getPreviousPracticeData(selectedPractice.odsCode) : null;
        let prevInterpretation = null;
        let performanceChange = null;

        if (prevPractice && previousData) {
          const prevRanking = calculateNationalRanking(prevPractice, previousData.practices);
          prevInterpretation = getPerformanceInterpretation(prevRanking.percentile);

          // Determine change (lower percentile is better)
          const currentPercentile = parseFloat(nationalRanking.percentile);
          const prevPercentile = parseFloat(prevRanking.percentile);

          if (currentPercentile < prevPercentile) {
            performanceChange = 'improved';
          } else if (currentPercentile > prevPercentile) {
            performanceChange = 'worsened';
          } else {
            performanceChange = 'same';
          }
        }

        // Generate comparison message
        const getComparisonMessage = () => {
          if (!compareWithPrevious || !prevInterpretation) return null;

          if (performanceChange === 'same') {
            return { emoji: '➡️', message: `You remain ${interpretation.label} compared to last month!`, color: 'blue' };
          } else if (performanceChange === 'improved') {
            if (interpretation.label === prevInterpretation.label) {
              return { emoji: '📈', message: `You remain ${interpretation.label} but improved your ranking!`, color: 'green' };
            } else {
              return { emoji: '🚀', message: `You have improved to ${interpretation.label}!`, color: 'green' };
            }
          } else {
            if (interpretation.label === prevInterpretation.label) {
              return { emoji: '📉', message: `You remain ${interpretation.label} but dropped in ranking.`, color: 'amber' };
            } else {
              return { emoji: '⚠️', message: `You have dropped to ${interpretation.label}.`, color: 'red' };
            }
          }
        };

        const comparisonMessage = getComparisonMessage();

        return (
          <>
            {/* OVERVIEW TAB - Performance Interpretation & Rankings */}
            {activeTab === 'overview' && (
              <>
            {/* Performance Interpretation */}
            <Card className={`bg-gradient-to-br from-${interpretation.color}-50 to-white border-${interpretation.color}-200 ${parseFloat(nationalRanking.percentile) <= 1.0 ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}`}>
              <div className="text-center">
                {parseFloat(nationalRanking.percentile) <= 1.0 && (
                  <div className="mb-2 animate-pulse">
                    <span className="text-4xl">🎉</span>
                    <span className="text-4xl">🏆</span>
                    <span className="text-4xl">🎊</span>
                  </div>
                )}
                <div className="text-5xl mb-3">{interpretation.emoji}</div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-slate-800">
                    {parseFloat(nationalRanking.percentile) <= 1.0 ? '🥇 Top 1% Nationally!' : interpretation.label}
                  </h3>
                  <div className="relative inline-block">
                    <button
                      onMouseEnter={() => setShowInterpretationTooltip(true)}
                      onMouseLeave={() => setShowInterpretationTooltip(false)}
                      className="text-slate-600 hover:text-slate-800 transition-colors p-3"
                    >
                      <Info size={18} />
                    </button>
                    {showInterpretationTooltip && createPortal(
                      <div
                        className="fixed w-[90vw] sm:w-72 max-w-md bg-slate-800 text-white text-xs rounded-lg p-4 shadow-2xl z-[9999] pointer-events-none"
                        style={{
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-blue-300 mb-2">Performance Criteria (by percentile):</p>
                          <p><strong>🌟 Excellent:</strong> Top 5%</p>
                          <p><strong>⭐ Great:</strong> Top 6-10%</p>
                          <p><strong>👍 Good:</strong> Top 11-25%</p>
                          <p><strong>✓ Above Average:</strong> 26-50%</p>
                          <p><strong>⚠ Below Average:</strong> 51-75%</p>
                          <p><strong>⚠️ Poor:</strong> 76-90%</p>
                          <p><strong>❌ Very Poor:</strong> 91-95%</p>
                          <p><strong>🔴 Amongst the Worst:</strong> Bottom 5%</p>
                          <p className="pt-2 border-t border-slate-600 mt-2">Based on your national ranking for missed call %</p>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
                <p className="text-slate-600 font-medium">
                  {parseFloat(nationalRanking.percentile) <= 1.0
                    ? '🎯 Congratulations! Your practice is in the top 1% nationally for call handling. Exceptional performance!'
                    : interpretation.description}
                </p>

                {/* Month-over-month comparison message */}
                {comparisonMessage && (
                  <div className={`mt-3 p-2 rounded-lg bg-${comparisonMessage.color}-100 border border-${comparisonMessage.color}-200`}>
                    <p className={`text-sm font-semibold text-${comparisonMessage.color}-700`}>
                      {comparisonMessage.emoji} {comparisonMessage.message}
                    </p>
                  </div>
                )}

                {parseFloat(nationalRanking.percentile) <= 1.0 && (
                  <p className="text-sm text-emerald-600 font-semibold mt-2 animate-pulse">
                    ✨ Elite tier - Top 1% in the nation ✨
                  </p>
                )}
                <p className="text-sm text-slate-500 mt-2">Based on missed call % performance</p>
              </div>
            </Card>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* National Ranking */}
              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                <div className="flex items-start gap-3">
                  <Trophy size={32} className="text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 font-semibold uppercase mb-1">National Ranking</p>
                    <p className="text-2xl font-bold text-slate-800">
                      #{nationalRanking.rank} <span className="text-sm text-slate-500">/ {nationalRanking.total.toLocaleString()}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">Top {nationalRanking.percentile}%</p>
                  </div>
                </div>
              </Card>

              {/* ICB Ranking */}
              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <div className="flex items-start gap-3">
                  <TrendingUp size={32} className="text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 font-semibold uppercase mb-1">ICB Ranking</p>
                    <p className="text-2xl font-bold text-slate-800">
                      #{icbRanking.rank} <span className="text-sm text-slate-500">/ {icbRanking.total}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{icbRanking.icbName}</p>
                  </div>
                </div>
              </Card>

              {/* PCN Ranking */}
              <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                <div className="flex items-start gap-3">
                  <Trophy size={32} className="text-indigo-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-600 font-semibold uppercase mb-1">PCN Ranking</p>
                    <p className="text-2xl font-bold text-slate-800">
                      #{pcnRanking.rank} <span className="text-sm text-slate-500">/ {pcnRanking.total}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{pcnRanking.pcnName}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Workforce Cross-over Metrics - Only show when workforce data available */}
            {workforceMetrics?.hasWorkforceData && (
              <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  Workforce Context
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium">Admin WTE</p>
                    <p className="text-2xl font-bold text-slate-800">{workforceMetrics.adminWte?.toFixed(1) || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400">Non-clinical staff</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium">Calls / Admin WTE</p>
                    <p className="text-2xl font-bold text-blue-600">{workforceMetrics.callsAnsweredPerAdminWte?.toFixed(0) || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400">Answered calls per WTE</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium">Missed / Admin WTE</p>
                    <p className="text-2xl font-bold text-amber-600">{workforceMetrics.callsMissedPerAdminWte?.toFixed(0) || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400">Missed calls per WTE</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-medium">Patients / GP WTE</p>
                    <p className="text-2xl font-bold text-slate-700">{workforceMetrics.patientsPerGpWte?.toFixed(0) || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400">Practice capacity</p>
                  </div>
                </div>
              </Card>
            )}
              </>
            )}

            {/* TRENDS TAB - Charts & Improvements */}
            {activeTab === 'trends' && (
              <>
            {/* Monthly Trends Charts - Only show when comparison enabled and data exists */}
            {compareWithPrevious && previousData && selectedPractice && (
              <Card>
                <h3 className="text-lg font-bold text-slate-800 mb-4">📊 Your Practice's Monthly Trends</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart - Missed Calls Volume */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-3 text-center">Missed Calls (Volume)</h4>
                    <div className="h-64">
                      <Bar
                        data={{
                          labels: chartMonths.map(m => m.split(' ')[0]),
                          datasets: [{
                            label: 'Missed Calls',
                            data: chartMonths.map(month => {
                              const monthData = allMonthsData[month];
                              if (!monthData) return 0;
                              const practice = monthData.practices.find(p => p.odsCode === selectedPractice.odsCode);
                              return practice ? practice.missed : 0;
                            }),
                            backgroundColor: 'rgba(239, 68, 68, 0.7)',
                            borderColor: 'rgb(239, 68, 68)',
                            borderWidth: 1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: { display: true, text: 'Number of Calls' }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Line Chart - Missed Call % */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-3 text-center">Missed Call %</h4>
                    <div className="h-64">
                      <Line
                        data={{
                          labels: chartMonths.map(m => m.split(' ')[0]),
                          datasets: [
                            {
                              label: 'Your Practice',
                              data: chartMonths.map(month => {
                                const monthData = allMonthsData[month];
                                if (!monthData) return null;
                                const practice = monthData.practices.find(p => p.odsCode === selectedPractice.odsCode);
                                return practice ? (practice.missedPct * 100).toFixed(1) : null;
                              }),
                              borderColor: 'rgb(59, 130, 246)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              borderWidth: 2,
                              fill: true,
                              tension: 0.3
                            },
                            {
                              label: 'National Average',
                              data: chartMonths.map(month => {
                                const monthData = allMonthsData[month];
                                return monthData ? (monthData.national.missedPct * 100).toFixed(1) : null;
                              }),
                              borderColor: 'rgb(156, 163, 175)',
                              borderWidth: 2,
                              borderDash: [5, 5],
                              fill: false,
                              tension: 0.3
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                              labels: { usePointStyle: true, padding: 15 }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: { display: true, text: 'Missed %' }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Most Improved Practices Table */}
            {compareWithPrevious && previousData && mostImprovedByMissedPct.length > 0 && (
              <Card>
                <h3 className="text-lg font-bold text-slate-800 mb-4">🏆 Top 10 Most Improved Practices (Missed Call %)</h3>
                <p className="text-sm text-slate-500 mb-4">Practices with the biggest reduction in missed call % from {previousMonth} to {selectedMonth}</p>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden sm:rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100 border-b-2 border-slate-200">
                          <tr>
                            <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                            <th className="text-left p-3 font-semibold text-slate-700">Practice</th>
                            <th className="text-left p-3 font-semibold text-slate-700">PCN</th>
                            <th className="text-right p-3 font-semibold text-slate-700">{previousMonth?.split(' ')[0]}</th>
                            <th className="text-right p-3 font-semibold text-slate-700">{selectedMonth?.split(' ')[0]}</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Improvement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mostImprovedByMissedPct.map((practice, idx) => (
                            <tr key={practice.odsCode} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-slate-600 text-xs">{practice.pcnName}</td>
                              <td className="p-3 text-right text-slate-500">{practice.prevMissedPct.toFixed(1)}%</td>
                              <td className="p-3 text-right">{practice.currentMissedPct.toFixed(1)}%</td>
                              <td className="p-3 text-right">
                                <span className="text-green-600 font-bold flex items-center justify-end gap-1">
                                  <TrendingDown size={14} />
                                  -{practice.improvement.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Top 10 Most Improved by Calls Saved */}
            {compareWithPrevious && previousData && mostImprovedByCallsSaved.length > 0 && (
              <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                <h3 className="text-lg font-bold text-emerald-900 mb-4">📈 Top 10 Most Improved Practices (Standardised Metric)</h3>
                <p className="text-sm text-slate-500 mb-4">Practices with the biggest improvement in Calls Saved from {previousMonth} to {selectedMonth}</p>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden sm:rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-emerald-100 border-b-2 border-emerald-200">
                          <tr>
                            <th className="text-left p-3 font-semibold text-emerald-900">Rank</th>
                            <th className="text-left p-3 font-semibold text-emerald-900">Practice</th>
                            <th className="text-left p-3 font-semibold text-emerald-900">PCN</th>
                            <th className="text-right p-3 font-semibold text-emerald-900">{previousMonth?.split(' ')[0]}</th>
                            <th className="text-right p-3 font-semibold text-emerald-900">{selectedMonth?.split(' ')[0]}</th>
                            <th className="text-right p-3 font-semibold text-emerald-900">Improvement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mostImprovedByCallsSaved.map((practice, idx) => (
                            <tr key={practice.odsCode} className="border-b border-emerald-100 hover:bg-emerald-50">
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-slate-600 text-xs">{practice.pcnName}</td>
                              <td className="p-3 text-right text-slate-500">
                                {practice.prevCallsSaved >= 0 ? '+' : ''}{Math.round(practice.prevCallsSaved).toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <span className={practice.currentCallsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}>
                                  {practice.currentCallsSaved >= 0 ? '+' : ''}{Math.round(practice.currentCallsSaved).toLocaleString()}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                                  <TrendingUp size={14} />
                                  +{Math.round(practice.improvement).toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Consistency Tracking Section */}
            {consistencyData.consistent.length > 0 && (
              <>
                {/* Your Practice's Consistency */}
                {consistencyData.practiceScores[selectedPractice.odsCode] && (
                  <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
                    <h3 className="text-lg font-bold text-sky-900 mb-3">📊 Your Practice's Consistency</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-600 uppercase">Consistency Score</p>
                        <p className="text-2xl font-bold text-sky-700">
                          {consistencyData.practiceScores[selectedPractice.odsCode].consistencyScore.toFixed(0)}
                          <span className="text-sm text-slate-500">/100</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase">Variation (Std Dev)</p>
                        <p className="text-2xl font-bold text-slate-800">
                          ±{consistencyData.practiceScores[selectedPractice.odsCode].stdDev.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase">Range (High-Low)</p>
                        <p className="text-2xl font-bold text-slate-800">
                          {consistencyData.practiceScores[selectedPractice.odsCode].range.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase">Avg Missed %</p>
                        <p className="text-2xl font-bold text-slate-800">
                          {consistencyData.practiceScores[selectedPractice.odsCode].avgMissedPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Higher consistency score = more stable performance across months
                    </p>
                  </Card>
                )}

                {/* Most Consistent Performers */}
                <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
                  <h3 className="text-lg font-bold text-sky-900 mb-4">🎯 Top 10 Most Consistent Performers</h3>
                  <p className="text-sm text-slate-500 mb-4">Practices with the most stable missed call % across all months (lowest variation)</p>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden sm:rounded-lg">
                        <table className="min-w-full text-sm">
                          <thead className="bg-sky-100 border-b-2 border-sky-200">
                            <tr>
                              <th className="text-left p-3 font-semibold text-sky-900">Rank</th>
                              <th className="text-left p-3 font-semibold text-sky-900">Practice</th>
                              <th className="text-left p-3 font-semibold text-sky-900">PCN</th>
                              <th className="text-right p-3 font-semibold text-sky-900">Avg Missed %</th>
                              <th className="text-right p-3 font-semibold text-sky-900">Variation</th>
                              <th className="text-right p-3 font-semibold text-sky-900">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consistencyData.consistent.map((practice, idx) => {
                              const isSelected = practice.odsCode === selectedPractice.odsCode;
                              return (
                                <tr key={practice.odsCode} className={`border-b border-sky-100 ${isSelected ? 'bg-sky-200 font-semibold' : 'hover:bg-sky-50'}`}>
                                  <td className="p-3 font-medium">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="font-medium">{practice.gpName}</div>
                                    <div className="text-xs text-slate-500">{practice.odsCode}</div>
                                  </td>
                                  <td className="p-3 text-slate-600 text-xs">{practice.pcnName}</td>
                                  <td className="p-3 text-right">{practice.avgMissedPct.toFixed(1)}%</td>
                                  <td className="p-3 text-right text-sky-600 font-medium">±{practice.stdDev.toFixed(2)}%</td>
                                  <td className="p-3 text-right">
                                    <span className="bg-sky-100 text-sky-800 px-2 py-1 rounded-full text-xs font-bold">
                                      {practice.consistencyScore.toFixed(0)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Most Volatile Performers */}
                <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
                  <h3 className="text-lg font-bold text-orange-900 mb-4">⚡ Top 10 Most Volatile Performers</h3>
                  <p className="text-sm text-slate-500 mb-4">Practices with the biggest swings in missed call % between months (highest variation)</p>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="overflow-hidden sm:rounded-lg">
                        <table className="min-w-full text-sm">
                          <thead className="bg-orange-100 border-b-2 border-orange-200">
                            <tr>
                              <th className="text-left p-3 font-semibold text-orange-900">Rank</th>
                              <th className="text-left p-3 font-semibold text-orange-900">Practice</th>
                              <th className="text-left p-3 font-semibold text-orange-900">PCN</th>
                              <th className="text-right p-3 font-semibold text-orange-900">Avg Missed %</th>
                              <th className="text-right p-3 font-semibold text-orange-900">Variation</th>
                              <th className="text-right p-3 font-semibold text-orange-900">Range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {consistencyData.volatile.map((practice, idx) => {
                              const isSelected = practice.odsCode === selectedPractice.odsCode;
                              return (
                                <tr key={practice.odsCode} className={`border-b border-orange-100 ${isSelected ? 'bg-orange-200 font-semibold' : 'hover:bg-orange-50'}`}>
                                  <td className="p-3 font-medium">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="font-medium">{practice.gpName}</div>
                                    <div className="text-xs text-slate-500">{practice.odsCode}</div>
                                  </td>
                                  <td className="p-3 text-slate-600 text-xs">{practice.pcnName}</td>
                                  <td className="p-3 text-right">{practice.avgMissedPct.toFixed(1)}%</td>
                                  <td className="p-3 text-right text-orange-600 font-medium">±{practice.stdDev.toFixed(2)}%</td>
                                  <td className="p-3 text-right">
                                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">
                                      {practice.range.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
              </>
            )}

            {/* LEADERBOARDS TAB - PCN Tables */}
            {activeTab === 'leaderboards' && (
              <>
            {/* PCN League Table */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                {pcnRanking.pcnName} - Practice Performance
              </h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 border-b-2 border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Practice</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Missed %</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Answered %</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcnRanking.practices.map((practice, idx) => {
                      const isSelected = practice.odsCode === selectedPractice.odsCode;
                      return (
                        <tr
                          key={practice.odsCode}
                          className={`border-b border-slate-100 ${isSelected ? 'bg-blue-100 font-semibold' : 'hover:bg-slate-50'}`}
                        >
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-medium">{practice.gpName}</div>
                            <div className="text-xs text-slate-500">{practice.odsCode}</div>
                          </td>
                          <td className="p-3 text-right">
                            <span className={practice.missedPct < data.national.missedPct ? 'text-green-600 font-medium' : ''}>
                              {(practice.missedPct * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-3 text-right">{(practice.answeredPct * 100).toFixed(1)}%</td>
                          <td className="p-3 text-right">{practice.inboundCalls.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Card>

            {/* PCN Performance Leaderboards */}
            {(() => {
              const pcnAverages = calculatePCNAverages(data.practices);
              const pcnNationalRanking = getPCNNationalRanking(selectedPractice.pcnCode, pcnAverages);
              const pcnICBRanking = getPCNICBRanking(selectedPractice.pcnCode, selectedPractice.icbCode, pcnAverages);

              return (
                <>
                  {/* PCN Performance Summary */}
                  <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Your PCN Performance</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 uppercase mb-1">National PCN Ranking</p>
                        <p className="text-2xl font-bold text-slate-800">
                          #{pcnNationalRanking.rank} <span className="text-sm text-slate-500">/ {pcnNationalRanking.total.toLocaleString()}</span>
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Top {pcnNationalRanking.percentile}% of PCNs</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase mb-1">ICB PCN Ranking</p>
                        <p className="text-2xl font-bold text-slate-800">
                          #{pcnICBRanking.rank} <span className="text-sm text-slate-500">/ {pcnICBRanking.total}</span>
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Within {selectedPractice.icbName}</p>
                      </div>
                    </div>
                  </Card>

                  {/* PCNs Nationally - Practice Centric */}
                  <PracticeCentricLeaderboard
                    title="PCNs Nationally (Lowest Missed Calls %)"
                    rankedItems={pcnAverages.filter(pcn => pcn.practiceCount > 1)}
                    selectedOdsCode={selectedPractice.pcnCode}
                    odsCodeAccessor="pcnCode"
                    colorTheme="blue"
                    columns={[
                      { key: 'pcn', header: 'PCN', render: (p) => (<><div className="font-medium">{p.pcnName}</div><div className="text-xs text-slate-500">{p.pcnCode}</div></>), truncate: true },
                      { key: 'icbName', header: 'ICB', render: (p) => <span className="text-xs text-slate-600">{p.icbName}</span> },
                      { key: 'avgMissedPct', header: 'Avg Missed %', align: 'right', render: (p) => <span className="text-green-600 font-medium">{(p.avgMissedPct * 100).toFixed(1)}%</span> },
                      { key: 'practiceCount', header: 'Practices', align: 'right' },
                    ]}
                  />

                  {/* Top PCNs in Same ICB */}
                  <Card>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">
                      PCN Performance in {selectedPractice.icbName}
                    </h3>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden sm:rounded-lg">
                          <table className="min-w-full text-sm">
                        <thead className="bg-slate-100 border-b-2 border-slate-200">
                          <tr>
                            <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                            <th className="text-left p-3 font-semibold text-slate-700">PCN</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Avg Missed %</th>
                            <th className="text-right p-3 font-semibold text-slate-700">Practices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pcnICBRanking.pcns.map((pcn, idx) => {
                            const isUserPCN = pcn.pcnCode === selectedPractice.pcnCode;
                            return (
                              <tr
                                key={pcn.pcnCode}
                                className={`border-b border-slate-100 ${isUserPCN ? 'bg-purple-100 font-semibold' : 'hover:bg-slate-50'}`}
                              >
                                <td className="p-3">{idx + 1}</td>
                                <td className="p-3">
                                  <div className="font-medium">{pcn.pcnName}</div>
                                  <div className="text-xs text-slate-500">{pcn.pcnCode}</div>
                                </td>
                                <td className="p-3 text-right">
                                  <span className={pcn.avgMissedPct < data.national.missedPct ? 'text-green-600 font-medium' : ''}>
                                    {(pcn.avgMissedPct * 100).toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-3 text-right">{pcn.practiceCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              );
            })()}

            {/* National Practice Leaderboard - Per 1000 Patients */}
            {(() => {
              const populationMap = data.populationMap || {};
              const practicesWithPop = data.practices
                .filter(p => populationMap[p.odsCode] > 0)
                .map(p => ({
                  ...p,
                  population: populationMap[p.odsCode],
                  missedPer1000: calculatePer1000(p.missed, populationMap[p.odsCode]),
                }))
                .filter(p => p.missedPer1000 !== null)
                .sort((a, b) => a.missedPer1000 - b.missedPer1000);

              return (
                <PracticeCentricLeaderboard
                  title="Practices Nationally (Lowest Missed Calls per 1000)"
                  rankedItems={practicesWithPop}
                  selectedOdsCode={selectedPractice.odsCode}
                  colorTheme="indigo"
                  columns={[
                    { key: 'practice', header: 'Practice', render: (p) => (<><div className="font-medium">{p.gpName}</div><div className="text-xs text-slate-500">{p.odsCode}</div></>), truncate: true },
                    { key: 'pcnName', header: 'PCN', render: (p) => <span className="text-xs text-slate-600">{p.pcnName}</span> },
                    { key: 'population', header: 'List Size', align: 'right', render: (p) => p.population.toLocaleString() },
                    { key: 'missedPer1000', header: 'Missed/1000', align: 'right', render: (p) => <span className="text-indigo-600 font-medium">{p.missedPer1000.toFixed(1)}</span> },
                    { key: 'missedPct', header: 'Missed %', align: 'right', render: (p) => `${(p.missedPct * 100).toFixed(1)}%` },
                  ]}
                />
              );
            })()}
              </>
            )}

            {/* PER 1000 PATIENTS TAB */}
            {activeTab === 'per1000' && (() => {
              const populationMap = data.populationMap || {};
              const practicePopulation = populationMap[selectedPractice.odsCode];

              // Calculate per 1000 metrics for selected practice
              const practicePer1000 = practicePopulation ? {
                inboundCalls: calculatePer1000(selectedPractice.inboundCalls, practicePopulation),
                missed: calculatePer1000(selectedPractice.missed, practicePopulation),
                answered: calculatePer1000(selectedPractice.answered, practicePopulation),
                callbackRequested: calculatePer1000(selectedPractice.callbackRequested, practicePopulation),
              } : null;

              // Calculate national averages per 1000
              const practicesWithPop = data.practices.filter(p => populationMap[p.odsCode] > 0);
              const totalNationalCalls = practicesWithPop.reduce((sum, p) => sum + p.inboundCalls, 0);
              const totalNationalPop = practicesWithPop.reduce((sum, p) => sum + (populationMap[p.odsCode] || 0), 0);
              const totalNationalMissed = practicesWithPop.reduce((sum, p) => sum + p.missed, 0);
              const totalNationalAnswered = practicesWithPop.reduce((sum, p) => sum + p.answered, 0);

              const nationalPer1000 = {
                inboundCalls: calculatePer1000(totalNationalCalls, totalNationalPop),
                missed: calculatePer1000(totalNationalMissed, totalNationalPop),
                answered: calculatePer1000(totalNationalAnswered, totalNationalPop),
              };

              // Get workload interpretation
              const workloadInterpretation = practicePer1000 && nationalPer1000.inboundCalls
                ? getWorkloadInterpretation(practicePer1000.inboundCalls, nationalPer1000.inboundCalls)
                : null;

              // Calculate rankings per 1000
              const practicesPer1000Ranked = practicesWithPop
                .map(p => ({
                  ...p,
                  population: populationMap[p.odsCode],
                  callsPer1000: calculatePer1000(p.inboundCalls, populationMap[p.odsCode]),
                  missedPer1000: calculatePer1000(p.missed, populationMap[p.odsCode]),
                  answeredPer1000: calculatePer1000(p.answered, populationMap[p.odsCode]),
                }))
                .filter(p => p.callsPer1000 !== null);

              // Sort by missed per 1000 (lowest = best)
              const rankedByMissedPer1000 = [...practicesPer1000Ranked].sort((a, b) => a.missedPer1000 - b.missedPer1000);
              const practiceRankMissed = rankedByMissedPer1000.findIndex(p => p.odsCode === selectedPractice.odsCode) + 1;

              // Sort by calls per 1000 (for demand ranking)
              const rankedByCallsPer1000 = [...practicesPer1000Ranked].sort((a, b) => b.callsPer1000 - a.callsPer1000);

              // Full ranked lists for practice-centric leaderboards
              const allBestPer1000 = rankedByMissedPer1000;
              const allHighestDemand = rankedByCallsPer1000;

              return (
                <>
                  {/* No Population Data Warning */}
                  {!practicePopulation && (
                    <Card className="bg-amber-50 border-amber-300">
                      <div className="flex items-center gap-3">
                        <Info size={24} className="text-amber-600" />
                        <div>
                          <h3 className="font-bold text-amber-800">Population Data Not Available</h3>
                          <p className="text-sm text-amber-700">List size data is not available for {selectedPractice.gpName}. This practice may not be included in the GP practice patient list publication.</p>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Practice Population & Per 1000 Summary */}
                  {practicePopulation && practicePer1000 && (
                    <>
                      {/* Workload Interpretation */}
                      {workloadInterpretation && (
                        <Card className={`bg-gradient-to-br from-${workloadInterpretation.color}-50 to-white border-${workloadInterpretation.color}-200`}>
                          <div className="text-center">
                            <div className="text-4xl mb-2">{workloadInterpretation.emoji}</div>
                            <h3 className="text-2xl font-bold text-slate-800">{workloadInterpretation.label}</h3>
                            <p className="text-slate-600 mt-2">{workloadInterpretation.description}</p>
                            <p className="text-sm text-slate-500 mt-2">Based on calls per 1000 patients compared to national average</p>
                          </div>
                        </Card>
                      )}

                      {/* Summary Tiles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* List Size */}
                        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase">Patient List Size</p>
                          <p className="text-3xl font-bold text-purple-700 mt-1">{practicePopulation.toLocaleString()}</p>
                          <p className="text-xs text-slate-500 mt-1">registered patients</p>
                        </Card>

                        {/* Calls per 1000 */}
                        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase">Inbound Calls / 1000 pts</p>
                          <p className="text-3xl font-bold text-blue-700 mt-1">{practicePer1000.inboundCalls.toFixed(1)}</p>
                          <p className="text-xs text-slate-500 mt-1">National: {nationalPer1000.inboundCalls?.toFixed(1) || 'N/A'}</p>
                        </Card>

                        {/* Missed per 1000 */}
                        <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase">Missed Calls / 1000 pts</p>
                          <p className={`text-3xl font-bold mt-1 ${
                            practicePer1000.missed < nationalPer1000.missed ? 'text-green-600' :
                            practicePer1000.missed > nationalPer1000.missed ? 'text-red-600' :
                            'text-slate-800'
                          }`}>{practicePer1000.missed.toFixed(1)}</p>
                          <p className="text-xs text-slate-500 mt-1">National: {nationalPer1000.missed?.toFixed(1) || 'N/A'}</p>
                        </Card>

                        {/* Answered per 1000 */}
                        <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
                          <p className="text-xs text-slate-600 font-semibold uppercase">Answered Calls / 1000 pts</p>
                          <p className={`text-3xl font-bold mt-1 ${
                            practicePer1000.answered > nationalPer1000.answered ? 'text-green-600' :
                            practicePer1000.answered < nationalPer1000.answered ? 'text-red-600' :
                            'text-slate-800'
                          }`}>{practicePer1000.answered.toFixed(1)}</p>
                          <p className="text-xs text-slate-500 mt-1">National: {nationalPer1000.answered?.toFixed(1) || 'N/A'}</p>
                        </Card>
                      </div>

                      {/* Per 1000 Ranking */}
                      <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                        <h3 className="text-lg font-bold text-indigo-900 mb-3">📊 Your Per 1000 Patients Ranking</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="text-center p-4 bg-white rounded-lg border border-indigo-100">
                            <p className="text-xs text-slate-600 uppercase mb-1">National Ranking (Missed/1000)</p>
                            <p className="text-3xl font-bold text-indigo-700">
                              #{practiceRankMissed} <span className="text-sm text-slate-500">/ {rankedByMissedPer1000.length.toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Rank 1 = fewest missed calls per patient</p>
                          </div>
                          <div className="text-center p-4 bg-white rounded-lg border border-indigo-100">
                            <p className="text-xs text-slate-600 uppercase mb-1">Demand Ranking (Calls/1000)</p>
                            <p className="text-3xl font-bold text-indigo-700">
                              #{rankedByCallsPer1000.findIndex(p => p.odsCode === selectedPractice.odsCode) + 1} <span className="text-sm text-slate-500">/ {rankedByCallsPer1000.length.toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Higher = more calls relative to list size</p>
                          </div>
                        </div>
                      </Card>
                    </>
                  )}

                  <PracticeCentricLeaderboard
                    title="Practices (Lowest Missed Calls per 1000 Patients)"
                    rankedItems={allBestPer1000}
                    selectedOdsCode={selectedPractice.odsCode}
                    colorTheme="blue"
                    columns={[
                      { key: 'practice', header: 'Practice', render: (p) => (<><div className="font-medium">{p.gpName}</div><div className="text-xs text-slate-500">{p.odsCode}</div></>), truncate: true },
                      { key: 'pcnName', header: 'PCN', render: (p) => <span className="text-xs text-slate-600">{p.pcnName}</span> },
                      { key: 'population', header: 'List Size', align: 'right', render: (p) => p.population.toLocaleString() },
                      { key: 'missedPer1000', header: 'Missed/1000', align: 'right', render: (p) => <span className="text-green-600 font-medium">{p.missedPer1000.toFixed(1)}</span> },
                      { key: 'callsPer1000', header: 'Calls/1000', align: 'right', render: (p) => p.callsPer1000.toFixed(1) },
                    ]}
                  />

                  <PracticeCentricLeaderboard
                    title="Highest Demand Practices (Calls per 1000 Patients)"
                    rankedItems={allHighestDemand}
                    selectedOdsCode={selectedPractice.odsCode}
                    colorTheme="amber"
                    columns={[
                      { key: 'practice', header: 'Practice', render: (p) => (<><div className="font-medium">{p.gpName}</div><div className="text-xs text-slate-500">{p.odsCode}</div></>), truncate: true },
                      { key: 'pcnName', header: 'PCN', render: (p) => <span className="text-xs text-slate-600">{p.pcnName}</span> },
                      { key: 'population', header: 'List Size', align: 'right', render: (p) => p.population.toLocaleString() },
                      { key: 'callsPer1000', header: 'Calls/1000', align: 'right', render: (p) => <span className="text-amber-600 font-bold">{p.callsPer1000.toFixed(1)}</span> },
                      { key: 'missedPct', header: 'Missed %', align: 'right', render: (p) => `${(p.missedPct * 100).toFixed(1)}%` },
                    ]}
                  />

                  {/* Best PCNs per 1000 Patients */}
                  {(() => {
                    const pcnPer1000Data = {};
                    practicesPer1000Ranked.forEach(practice => {
                      if (!pcnPer1000Data[practice.pcnCode]) {
                        pcnPer1000Data[practice.pcnCode] = {
                          pcnCode: practice.pcnCode, pcnName: practice.pcnName, icbName: practice.icbName,
                          totalMissed: 0, totalPopulation: 0, practiceCount: 0
                        };
                      }
                      pcnPer1000Data[practice.pcnCode].totalMissed += practice.missed;
                      pcnPer1000Data[practice.pcnCode].totalPopulation += practice.population;
                      pcnPer1000Data[practice.pcnCode].practiceCount += 1;
                    });
                    const pcnsPer1000 = Object.values(pcnPer1000Data)
                      .filter(pcn => pcn.practiceCount > 1 && pcn.totalPopulation > 0)
                      .map(pcn => ({ ...pcn, missedPer1000: (pcn.totalMissed / pcn.totalPopulation) * 1000 }))
                      .sort((a, b) => a.missedPer1000 - b.missedPer1000);

                    return (
                      <PracticeCentricLeaderboard
                        title="PCNs (Lowest Missed Calls per 1000 Patients)"
                        rankedItems={pcnsPer1000}
                        selectedOdsCode={selectedPractice.pcnCode}
                        odsCodeAccessor="pcnCode"
                        colorTheme="blue"
                        columns={[
                          { key: 'pcn', header: 'PCN', render: (p) => (<><div className="font-medium">{p.pcnName}</div><div className="text-xs text-slate-500">{p.pcnCode}</div></>), truncate: true },
                          { key: 'icbName', header: 'ICB', render: (p) => <span className="text-xs text-slate-600">{p.icbName}</span> },
                          { key: 'totalPopulation', header: 'Total Patients', align: 'right', render: (p) => p.totalPopulation.toLocaleString() },
                          { key: 'missedPer1000', header: 'Missed/1000', align: 'right', render: (p) => <span className="text-blue-600 font-medium">{p.missedPer1000.toFixed(1)}</span> },
                          { key: 'practiceCount', header: 'Practices', align: 'right' },
                        ]}
                      />
                    );
                  })()}
                </>
              );
            })()}

            {/* IMPACT METRICS TAB - Volume-Weighted Metrics */}
            {activeTab === 'impact' && (() => {
              const pcnAverages = calculatePCNAverages(data.practices);
              const nationalMissedPct = getNationalMissedPct(data.practices);
              const practiceCallsSaved = calculateCallsSaved(selectedPractice, nationalMissedPct);
              const callsSavedRanking = calculateCallsSavedRanking(selectedPractice, data.practices);
              return (
                <>
                  {/* Section Divider: Volume-Weighted Impact Metrics */}
                  <Card className="bg-gradient-to-r from-teal-100 via-indigo-100 to-violet-100 border-2 border-teal-400">
                    <div className="text-center py-2">
                      <h2 className="text-xl font-bold text-slate-800">📊 Volume-Weighted Impact Metrics</h2>
                      <p className="text-sm text-slate-600 mt-1">Accounting for practice size and patient volume</p>
                    </div>
                  </Card>

                  {/* Calls Saved vs National Average - Volume-Weighted Impact */}
                  <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-400 border-2">
                    <div className="text-center">
                      <p className="text-xs text-teal-700 font-semibold uppercase tracking-wide mb-2">💼 Volume-Weighted Impact Metric</p>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <h3 className="text-2xl font-bold text-slate-800">Calls Saved vs National Average</h3>
                        <div className="relative inline-block">
                          <button
                            onMouseEnter={() => setShowCallsSavedTooltip(true)}
                            onMouseLeave={() => setShowCallsSavedTooltip(false)}
                            className="text-teal-600 hover:text-teal-800 transition-colors p-3"
                          >
                            <Info size={20} />
                          </button>
                          {showCallsSavedTooltip && createPortal(
                            <div
                              className="fixed w-[90vw] sm:w-80 max-w-md bg-slate-800 text-white text-xs rounded-lg p-4 shadow-2xl z-[9999] pointer-events-none"
                              style={{
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              <div className="space-y-2">
                                <p className="font-semibold text-teal-300">How This Metric Works:</p>
                                <p><strong>Formula:</strong> (National Missed % - Your Missed %) × Your Total Calls</p>
                                <p><strong>Positive value:</strong> You saved more calls than the national average would predict for your call volume.</p>
                                <p><strong>Negative value:</strong> You missed more calls than the national average would predict.</p>
                                <p className="pt-2 border-t border-slate-600"><strong>Why volume-weighted?</strong> This metric accounts for practice size. A large practice with good performance has more patient impact than a small practice with the same percentage.</p>
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className={`text-5xl font-bold ${practiceCallsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                          {practiceCallsSaved >= 0 ? '+' : ''}{Math.round(practiceCallsSaved).toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-600 mt-2">
                          {practiceCallsSaved >= 0 ? 'calls saved compared to national average' : 'additional calls missed vs national average'}
                        </p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-teal-200">
                        <p className="text-sm text-slate-600">
                          <strong>National Rank:</strong> #{callsSavedRanking.rank.toLocaleString()} of {callsSavedRanking.total.toLocaleString()} practices
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Higher is better • Accounts for practice call volume
                        </p>
                      </div>
                    </div>
                  </Card>

                  <PracticeCentricLeaderboard
                    title="Practices by Impact (Calls Saved)"
                    rankedItems={callsSavedRanking.practices}
                    selectedOdsCode={selectedPractice.odsCode}
                    colorTheme="indigo"
                    columns={[
                      { key: 'practice', header: 'Practice', render: (p) => (<><div className="font-medium">{p.gpName}</div><div className="text-xs text-slate-500">{p.odsCode}</div></>), truncate: true },
                      { key: 'pcnName', header: 'PCN', render: (p) => <span className="text-xs text-slate-600">{p.pcnName}</span> },
                      { key: 'callsSaved', header: 'Calls Saved', align: 'right', render: (p) => <span className={`font-bold ${p.callsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{p.callsSaved >= 0 ? '+' : ''}{Math.round(p.callsSaved).toLocaleString()}</span> },
                      { key: 'inboundCalls', header: 'Total Calls', align: 'right', render: (p) => p.inboundCalls.toLocaleString() },
                    ]}
                  />

                  <PracticeCentricLeaderboard
                    title="PCNs by Impact (Calls Saved)"
                    rankedItems={pcnAverages.filter(pcn => pcn.practiceCount > 1).sort((a, b) => b.callsSaved - a.callsSaved)}
                    selectedOdsCode={selectedPractice.pcnCode}
                    odsCodeAccessor="pcnCode"
                    colorTheme="indigo"
                    columns={[
                      { key: 'pcn', header: 'PCN', render: (p) => (<><div className="font-medium">{p.pcnName}</div><div className="text-xs text-slate-500">{p.pcnCode}</div></>), truncate: true },
                      { key: 'icbName', header: 'ICB', render: (p) => <span className="text-xs text-slate-600">{p.icbName}</span> },
                      { key: 'callsSaved', header: 'Calls Saved', align: 'right', render: (p) => <span className={`font-bold ${p.callsSaved >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{p.callsSaved >= 0 ? '+' : ''}{Math.round(p.callsSaved).toLocaleString()}</span> },
                      { key: 'practiceCount', header: 'Practices', align: 'right' },
                    ]}
                  />
                </>
              );
            })()}
          </>
        );
      })()}

      {/* No Selection State */}
      {!selectedPractice && (
        <div className="text-center py-12 text-slate-400 relative -z-10">
          <Phone size={48} className="mx-auto mb-4 opacity-50" />
          <p>Search for and select your practice to view telephony metrics</p>
        </div>
      )}
    </div>
  );
};

export default NationalTelephony;
