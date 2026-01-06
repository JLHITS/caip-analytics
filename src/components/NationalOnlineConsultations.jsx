import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, TrendingUp, TrendingDown, ExternalLink, Info, Star, ChevronDown, ChevronUp, Minus, Monitor, Users, Trophy, Clock } from 'lucide-react';
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
import {
  parseOnlineConsultationsData,
  getSupplierStats,
  calculateOCPCNAverages,
  calculateOCNationalRanking,
  calculateOCICBRanking,
  calculateOCPCNRanking,
  getOCPerformanceInterpretation,
  linearRegression,
  forecastValues,
  getOCPCNNationalRanking,
  getOCPCNICBRanking
} from '../utils/parseOnlineConsultations';

// Register Chart.js components
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
  Filler
);

// Import all Excel files - from April 2024 to October 2025
import apr24Data from '../assets/Submissions via Online Consultation Systems in General Practice - April 2024.xlsx?url';
import may24Data from '../assets/Submissions via Online Consultation Systems in General Practice - May 2024.xlsx?url';
import jun24Data from '../assets/Submissions via Online Consultation Systems in General Practice - June 2024.xlsx?url';
import jul24Data from '../assets/Submissions via Online Consultation Systems in General Practice - July 2024.xlsx?url';
import aug24Data from '../assets/Submissions via Online Consultation Systems in General Practice - August 2024.xlsx?url';
import sep24Data from '../assets/Submissions via Online Consultation Systems in General Practice - September 2024.xlsx?url';
import oct24Data from '../assets/Submissions via Online Consultation Systems in General Practice - October 2024.xlsx?url';
import nov24Data from '../assets/Submissions via Online Consultation Systems in General Practice - November 2024.xlsx?url';
import dec24Data from '../assets/Submissions via Online Consultation Systems in General Practice - December 2024.xlsx?url';
import jan25Data from '../assets/Submissions via Online Consultation Systems in General Practice - January 2025.xlsx?url';
import feb25Data from '../assets/Submissions via Online Consultation Systems in General Practice - February 2025.xlsx?url';
import mar25Data from '../assets/Submissions via Online Consultation Systems in General Practice - March 2025.xlsx?url';
import apr25Data from '../assets/Submissions via OC Systems in General Practice - April 2025.xlsx?url';
import may25Data from '../assets/Submissions via OC Systems in General Practice - May 2025.xlsx?url';
import jun25Data from '../assets/Submissions via OC Systems in General Practice - June 2025.xlsx?url';
import jul25Data from '../assets/Submissions via OC Systems in General Practice - July 2025.xlsx?url';
import aug25Data from '../assets/Submissions via OC Systems in General Practice - August 2025.xlsx?url';
import sep25Data from '../assets/Submissions via OC Systems in General Practice - September 2025.xlsx?url';
import oct25Data from '../assets/Submissions via OC Systems in General Practice - October 2025.xlsx?url';
import nov25Data from '../assets/Submissions via OC Systems in General Practice - November 2025.xlsx?url';

// Month data mapping - ordered from oldest to newest
const MONTH_DATA = {
  'April 2024': apr24Data,
  'May 2024': may24Data,
  'June 2024': jun24Data,
  'July 2024': jul24Data,
  'August 2024': aug24Data,
  'September 2024': sep24Data,
  'October 2024': oct24Data,
  'November 2024': nov24Data,
  'December 2024': dec24Data,
  'January 2025': jan25Data,
  'February 2025': feb25Data,
  'March 2025': mar25Data,
  'April 2025': apr25Data,
  'May 2025': may25Data,
  'June 2025': jun25Data,
  'July 2025': jul25Data,
  'August 2025': aug25Data,
  'September 2025': sep25Data,
  'October 2025': oct25Data,
  'November 2025': nov25Data,
};

// Ordered months for charts (oldest first)
const MONTHS_ORDERED = [
  'April 2024', 'May 2024', 'June 2024', 'July 2024', 'August 2024', 'September 2024',
  'October 2024', 'November 2024', 'December 2024', 'January 2025', 'February 2025',
  'March 2025', 'April 2025', 'May 2025', 'June 2025', 'July 2025', 'August 2025',
  'September 2025', 'October 2025', 'November 2025'
];

const NationalOnlineConsultations = ({
  sharedPractice,
  setSharedPractice,
  sharedBookmarks,
  updateSharedBookmarks,
  sharedUsageStats,
  recordPracticeUsage,
  onLoadingChange
}) => {
  const [allMonthsData, setAllMonthsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('November 2025');
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showInterpretationTooltip, setShowInterpretationTooltip] = useState(false);
  const [showCoveragePopup, setShowCoveragePopup] = useState(false);
  const [showRecents, setShowRecents] = useState(() => (sharedUsageStats?.recentPractices?.length || 0) > 0);
  const [showSearchBox, setShowSearchBox] = useState(true);
  const usageStats = sharedUsageStats || { totalChecks: 0, recentPractices: [] };
  // Use shared state for practice and bookmarks
  const bookmarkedPractices = sharedBookmarks;
  const setBookmarkedPractices = updateSharedBookmarks;

  // Local selected practice - synced with shared state
  const [selectedPractice, setSelectedPracticeLocal] = useState(null);
  const recentPractices = usageStats.recentPractices || [];
  const searchRef = useRef(null);

  useEffect(() => {
    if (recentPractices.length > 0 && !showRecents) {
      setShowRecents(true);
    }
  }, [recentPractices.length, showRecents]);

  useEffect(() => {
    if (bookmarkedPractices.length > 0 && !showBookmarks) {
      setShowBookmarks(true);
    }
  }, [bookmarkedPractices.length, showBookmarks]);

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
      setSharedPractice({
        odsCode: practice.odsCode,
        gpName: practice.gpName,
        pcnCode: practice.pcnCode,
        pcnName: practice.pcnName,
        icbCode: practice.icbCode,
        icbName: practice.icbName
      });
      setShowSearchBox(false);
    } else {
      setSearchTerm('');
      setShowSearchBox(true);
      setSharedPractice(null);
    }
  };

  // Tab definitions
  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'trends', label: 'Trends', icon: '📈' },
    { id: 'leaderboards', label: 'Leaderboards', icon: '🏆' },
    { id: 'per1000', label: 'Per 1000 Pts', icon: '👥' },
    { id: 'forecasting', label: 'Forecasting', icon: '🔮' },
  ];

  // Get current data based on selected month
  const data = allMonthsData[selectedMonth] || null;

  // Switch away from Trends/Forecasting tab if comparison is disabled
  useEffect(() => {
    if (!compareWithPrevious && (activeTab === 'trends' || activeTab === 'forecasting')) {
      setActiveTab('overview');
    }
  }, [compareWithPrevious, activeTab]);

  // Get previous month data for comparison
  const previousMonth = useMemo(() => {
    const currentIndex = MONTHS_ORDERED.indexOf(selectedMonth);
    if (currentIndex > 0) {
      return MONTHS_ORDERED[currentIndex - 1];
    }
    return null;
  }, [selectedMonth]);

  const previousData = previousMonth ? allMonthsData[previousMonth] : null;

  // Helper to get previous practice data
  const getPreviousPracticeData = (odsCode) => {
    if (!previousData) return null;
    return previousData.practices.find(p => p.odsCode === odsCode);
  };

  // Calculate metric change
  const getMetricChange = (currentValue, previousValue, higherIsBetter = true) => {
    if (previousValue === undefined || previousValue === null) return null;
    const change = currentValue - previousValue;
    const improved = higherIsBetter ? change > 0 : change < 0;
    const worsened = higherIsBetter ? change < 0 : change > 0;
    return { change, improved, worsened, noChange: change === 0 };
  };

  // Load and parse all Excel files on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const allData = {};

        // Load all months in parallel
        const loadPromises = Object.entries(MONTH_DATA).map(async ([month, fileUrl]) => {
          try {
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(fileUrl + cacheBuster);
            const arrayBuffer = await response.arrayBuffer();
            const parsedData = parseOnlineConsultationsData(arrayBuffer);
            return { month, data: parsedData, success: true };
          } catch (err) {
            console.error(`Error loading ${month}:`, err);
            return { month, data: null, success: false };
          }
        });

        const results = await Promise.all(loadPromises);
        results.forEach(({ month, data, success }) => {
          if (success && data) {
            allData[month] = data;
          }
        });

        console.log('=== ONLINE CONSULTATIONS DATA LOADED ===');
        console.log(`Loaded ${Object.keys(allData).length} months of data`);

        setAllMonthsData(allData);
        setLoading(false);
        onLoadingChange?.(false);
      } catch (error) {
        console.error('Error loading online consultations data:', error);
        setLoading(false);
        onLoadingChange?.(false);
      }
    };
    loadAllData();
  }, [onLoadingChange]);

  // Filter practices based on search
  const filteredPractices = useMemo(() => {
    if (!data || !searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return data.practices.filter(p =>
      p.gpName.toLowerCase().includes(term) ||
      p.odsCode.toLowerCase().includes(term) ||
      p.pcnName.toLowerCase().includes(term)
    ).slice(0, 10);
  }, [data, searchTerm]);

  // Handle practice selection
  const handleSelectPractice = (practice) => {
    setSelectedPractice(practice);
    setSearchTerm('');
    setActiveTab('overview');
    if (recordPracticeUsage) {
      recordPracticeUsage(practice);
    }
  };

  // Toggle bookmark
  const toggleBookmark = (practice) => {
    const isAlreadyBookmarked = bookmarkedPractices.some(p => p.odsCode === practice.odsCode);
    let newBookmarks;

    if (isAlreadyBookmarked) {
      newBookmarks = bookmarkedPractices.filter(p => p.odsCode !== practice.odsCode);
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
    }

    setBookmarkedPractices(newBookmarks);
  };

  const isBookmarked = (odsCode) => {
    return bookmarkedPractices.some(p => p.odsCode === odsCode);
  };

  // Calculate consistency metrics across all months
  const consistencyData = useMemo(() => {
    if (Object.keys(allMonthsData).length < 2) return { consistent: [], volatile: [], practiceScores: {} };

    const practicePerformance = {};

    MONTHS_ORDERED.forEach(month => {
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
          ratePer1000: practice.ratePer1000,
          submissions: practice.submissions
        });
      });
    });

    const practicesWithVariance = Object.values(practicePerformance)
      .filter(p => p.monthlyData.length >= 3)
      .map(practice => {
        const rates = practice.monthlyData.map(d => d.ratePer1000);
        const totalSubmissions = practice.monthlyData.reduce((sum, d) => sum + (d.submissions || 0), 0);
        const maxRate = Math.max(...rates);
        const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

        const squaredDiffs = rates.map(r => Math.pow(r - avgRate, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        const stdDev = Math.sqrt(avgSquaredDiff);

        const range = Math.max(...rates) - Math.min(...rates);

        return {
          ...practice,
          avgRate,
          stdDev,
          range,
          totalSubmissions,
          maxRate,
          monthCount: practice.monthlyData.length,
          consistencyScore: Math.max(0, 100 - (stdDev * 2))
        };
      })
      // Exclude practices with no activity or zero rates (all months zero -> std dev 0 but not meaningful)
      .filter(practice => practice.totalSubmissions > 0 && practice.maxRate > 0);

    const consistent = [...practicesWithVariance]
      .sort((a, b) => a.stdDev - b.stdDev)
      .slice(0, 10);

    const volatile = [...practicesWithVariance]
      .sort((a, b) => b.stdDev - a.stdDev)
      .slice(0, 10);

    const practiceScores = {};
    practicesWithVariance.forEach(p => {
      practiceScores[p.odsCode] = {
        stdDev: p.stdDev,
        range: p.range,
        consistencyScore: p.consistencyScore,
        avgRate: p.avgRate
      };
    });

    return { consistent, volatile, practiceScores };
  }, [allMonthsData]);

  // Calculate practice trend data for forecasting
  const practiceTrendData = useMemo(() => {
    if (!selectedPractice) return null;

    const practiceHistory = [];
    MONTHS_ORDERED.forEach(month => {
      const monthData = allMonthsData[month];
      if (monthData) {
        const practice = monthData.practices.find(p => p.odsCode === selectedPractice.odsCode);
        if (practice) {
          practiceHistory.push({
            month,
            submissions: practice.submissions,
            ratePer1000: practice.ratePer1000,
            clinicalSubmissions: practice.clinicalSubmissions,
            adminSubmissions: practice.adminSubmissions,
          });
        }
      }
    });

    return practiceHistory;
  }, [selectedPractice, allMonthsData]);

  // Loading is now handled by parent component with unified loader
  if (loading) {
    return null;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="text-center py-8 text-red-600">
            <p>Error loading data. Please try refreshing the page.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Monitor size={28} />
            National Online Consultations
          </h2>
          <p className="text-sm text-indigo-200 mt-1">
            {data.national.participatingPractices.toLocaleString()} participating practices | {data.national.totalSubmissions.toLocaleString()} total submissions
          </p>
        </div>
      </Card>

      {/* Month Selection Card */}
      <Card>
        <div className="text-center space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[...MONTHS_ORDERED].reverse().map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={compareWithPrevious}
                onChange={(e) => setCompareWithPrevious(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 font-medium">Compare with previous months</span>
            </label>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://digital.nhs.uk/data-and-information/publications/statistical/submissions-via-online-consultation-systems-in-general-practice"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              💻 Online Consultations Data <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </Card>

      {/* Recent Practices */}
      <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-indigo-600" />
            <h3 className="font-bold text-slate-800">Recent Practices</h3>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
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
                      handleSelectPractice(foundPractice);
                    }}
                    className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${disabled ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-indigo-200 text-indigo-800 hover:bg-indigo-50 hover:border-indigo-300 transition-colors'}`}
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
                      handleSelectPractice(foundPractice);
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
                      toggleBookmark({ odsCode: bookmark.odsCode, gpName: bookmark.name, pcnName: bookmark.pcnName });
                    }}
                    className="ml-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Coverage Popup */}
      {showCoveragePopup && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Can't find your practice?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Not all practices participate in the NHS England Online Consultations data collection.
              If your practice uses an Online Consultation system but isn't appearing in the search,
              it may not be included in the published data.
            </p>
            <p className="text-sm text-slate-600 mb-4">
              The data only includes practices that have reported using an online consultation system.
            </p>
            <a
              href="https://digital.nhs.uk/data-and-information/publications/statistical/submissions-via-online-consultation-systems-in-general-practice"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              View NHS England Publication <ExternalLink size={14} />
            </a>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCoveragePopup(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Practice Search */}
      {showSearchBox && (
        <Card>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
            <Search size={20} className="text-slate-400" />
            <label className="font-semibold text-slate-700">Find Your Practice</label>
            <button
              onClick={() => setShowCoveragePopup(true)}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors ml-auto"
            >
              <Info size={12} /> Can't find your practice?
            </button>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by practice name or ODS code..."
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Search Results Dropdown */}
          {searchTerm && !selectedPractice && filteredPractices.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[50vh] sm:max-h-64 overflow-y-auto">
              {filteredPractices.map((practice) => (
                <div
                  key={practice.odsCode}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors group"
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
                    onClick={() => handleSelectPractice(practice)}
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
        </Card>
      )}

      {/* Selected Practice Header */}
      {selectedPractice && (
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-800">{selectedPractice.gpName}</h3>
                <button
                  onClick={() => toggleBookmark(selectedPractice)}
                  className="p-1 hover:bg-white rounded-full transition-colors"
                >
                  <Star
                    size={20}
                    className={isBookmarked(selectedPractice.odsCode)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-slate-400 hover:text-yellow-400'
                    }
                  />
                </button>
              </div>
              <p className="text-sm text-slate-600">{selectedPractice.odsCode}</p>
              <p className="text-sm text-slate-500">{selectedPractice.pcnName}</p>
              <p className="text-xs text-slate-400">{selectedPractice.icbName}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedPractice.suppliers.map((supplier, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                    {supplier}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setSelectedPractice(null)}
              className="px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 rounded-md transition-colors"
            >
              Change Practice
            </button>
          </div>
        </Card>
      )}

      {/* Tab Navigation */}
      {selectedPractice && (
        <div className="bg-white rounded-lg border border-slate-200 p-1 flex flex-wrap gap-1">
          {TABS.map(tab => {
            const isDisabled = (tab.id === 'trends' || tab.id === 'forecasting') && !compareWithPrevious;
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={`flex-1 min-w-[100px] px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isDisabled
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
                title={isDisabled ? 'Enable "Compare with previous months" to view this tab' : ''}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* OVERVIEW TAB */}
      {selectedPractice && activeTab === 'overview' && (() => {
        const prevPractice = getPreviousPracticeData(selectedPractice.odsCode);
        const nationalRanking = calculateOCNationalRanking(selectedPractice, data.practices);
        const icbRanking = calculateOCICBRanking(selectedPractice, data.practices);
        const pcnRanking = calculateOCPCNRanking(selectedPractice, data.practices);
        const interpretation = getOCPerformanceInterpretation(selectedPractice.ratePer1000, data.national.avgRatePer1000);

        const submissionsChange = prevPractice ? getMetricChange(selectedPractice.submissions, prevPractice.submissions) : null;
        const rateChange = prevPractice ? getMetricChange(selectedPractice.ratePer1000, prevPractice.ratePer1000) : null;

        return (
          <>
            {/* Performance Interpretation */}
            <Card className={`bg-gradient-to-br from-${interpretation.color}-50 to-white border-${interpretation.color}-200`}>
              <div className="text-center">
                <div className="text-4xl mb-2">{interpretation.emoji}</div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-2xl font-bold text-slate-800">{interpretation.label}</h3>
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
                          <p className="font-semibold text-indigo-300 mb-2">Adoption Levels (vs National Average):</p>
                          <p><strong>🚀 Very High Adoption:</strong> 150%+ of national average</p>
                          <p><strong>📈 High Adoption:</strong> 120-150% of national average</p>
                          <p><strong>✓ Average Adoption:</strong> 80-120% of national average</p>
                          <p><strong>📉 Below Average:</strong> 50-80% of national average</p>
                          <p><strong>⚠️ Low Adoption:</strong> Below 50% of national average</p>
                          <p className="pt-2 border-t border-slate-600 mt-2">Based on online consultation submissions per 1000 registered patients</p>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
                <p className="text-slate-600 mt-2">{interpretation.description}</p>
              </div>
            </Card>

            {/* Summary Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Submissions */}
              <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Total Submissions</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold text-indigo-700">{selectedPractice.submissions.toLocaleString()}</p>
                  {compareWithPrevious && submissionsChange && (
                    <span className={`flex items-center text-sm ${submissionsChange.improved ? 'text-green-600' : submissionsChange.worsened ? 'text-red-600' : 'text-slate-500'}`}>
                      {submissionsChange.improved ? <TrendingUp size={14} /> : submissionsChange.worsened ? <TrendingDown size={14} /> : <Minus size={14} />}
                      {submissionsChange.change > 0 ? '+' : ''}{submissionsChange.change.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">National avg: {Math.round(data.national.avgSubmissionsPerPractice).toLocaleString()}</p>
              </Card>

              {/* Rate per 1000 */}
              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Rate per 1000 Patients</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold text-purple-700">{selectedPractice.ratePer1000.toFixed(1)}</p>
                  {compareWithPrevious && rateChange && (
                    <span className={`flex items-center text-sm ${rateChange.improved ? 'text-green-600' : rateChange.worsened ? 'text-red-600' : 'text-slate-500'}`}>
                      {rateChange.improved ? <TrendingUp size={14} /> : rateChange.worsened ? <TrendingDown size={14} /> : <Minus size={14} />}
                      {rateChange.change > 0 ? '+' : ''}{rateChange.change.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">National avg: {data.national.avgRatePer1000.toFixed(1)}</p>
              </Card>

              {/* List Size */}
              <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Patient List Size</p>
                <p className="text-3xl font-bold text-teal-700 mt-1">{selectedPractice.listSize.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">registered patients</p>
              </Card>

              {/* National Rank */}
              <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">National Ranking</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">
                  #{nationalRanking.rank} <span className="text-sm text-slate-500">/ {nationalRanking.total.toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Top {nationalRanking.percentile}% for adoption</p>
              </Card>
            </div>

            {/* Submission Type Breakdown */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Submission Type Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-slate-600 uppercase">Clinical</p>
                  <p className="text-2xl font-bold text-blue-700">{selectedPractice.clinicalSubmissions.toLocaleString()}</p>
                  <p className="text-sm text-blue-600">{(selectedPractice.clinicalPct * 100).toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">National: {(data.national.clinicalPct * 100).toFixed(1)}%</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-slate-600 uppercase">Administrative</p>
                  <p className="text-2xl font-bold text-green-700">{selectedPractice.adminSubmissions.toLocaleString()}</p>
                  <p className="text-sm text-green-600">{(selectedPractice.adminPct * 100).toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">National: {(data.national.adminPct * 100).toFixed(1)}%</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-slate-600 uppercase">Other/Unknown</p>
                  <p className="text-2xl font-bold text-gray-700">{selectedPractice.otherSubmissions.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">{(selectedPractice.otherPct * 100).toFixed(1)}%</p>
                  <p className="text-xs text-slate-500">National: {(data.national.otherPct * 100).toFixed(1)}%</p>
                </div>
              </div>
            </Card>

            {/* Rankings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* National Ranking Detail */}
              <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                <h4 className="text-sm font-bold text-amber-900 mb-2">National Position</h4>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-700">#{nationalRanking.rank}</p>
                  <p className="text-sm text-slate-600">of {nationalRanking.total.toLocaleString()} practices</p>
                  <p className="text-xs text-amber-600 mt-1">Top {nationalRanking.percentile}%</p>
                </div>
              </Card>

              {/* ICB Ranking */}
              <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-200">
                <h4 className="text-sm font-bold text-cyan-900 mb-2">ICB Position</h4>
                <div className="text-center">
                  <p className="text-3xl font-bold text-cyan-700">#{icbRanking.rank}</p>
                  <p className="text-sm text-slate-600">of {icbRanking.total} in ICB</p>
                  <p className="text-xs text-cyan-600 mt-1">Top {icbRanking.percentile}%</p>
                </div>
              </Card>

              {/* PCN Ranking */}
              <Card className="bg-gradient-to-br from-violet-50 to-white border-violet-200">
                <h4 className="text-sm font-bold text-violet-900 mb-2">PCN Position</h4>
                <div className="text-center">
                  <p className="text-3xl font-bold text-violet-700">#{pcnRanking.rank}</p>
                  <p className="text-sm text-slate-600">of {pcnRanking.total} in PCN</p>
                </div>
              </Card>
            </div>

            {/* PCN Practice League */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">{pcnRanking.pcnName} - Practice Rankings</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 border-b-2 border-slate-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                          <th className="text-left p-3 font-semibold text-slate-700">Practice</th>
                          <th className="text-left p-3 font-semibold text-slate-700">Supplier</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Rate/1000</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Submissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pcnRanking.practices.map((practice, idx) => {
                          const isSelected = practice.odsCode === selectedPractice.odsCode;
                          return (
                            <tr key={practice.odsCode} className={`border-b border-slate-100 ${isSelected ? 'bg-indigo-100 font-semibold' : 'hover:bg-slate-50'}`}>
                              <td className="p-3">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600">{practice.supplier}</td>
                              <td className="p-3 text-right text-indigo-600 font-medium">{practice.ratePer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{practice.submissions.toLocaleString()}</td>
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

      {/* TRENDS TAB */}
      {selectedPractice && activeTab === 'trends' && compareWithPrevious && (() => {
        // Build aligned historical data for charts (include months even if practice missing)
        const history = MONTHS_ORDERED.map(month => {
          const label = `${month.split(' ')[0].substring(0, 3)} ${month.split(' ')[1].substring(2)}`;
          const monthData = allMonthsData[month];
          const practice = monthData?.practices.find(p => p.odsCode === selectedPractice.odsCode);
          return {
            month: label,
            submissions: practice ? practice.submissions : 0,
            ratePer1000: practice ? practice.ratePer1000 : 0,
            clinicalPct: practice ? practice.clinicalPct * 100 : 0,
            adminPct: practice ? practice.adminPct * 100 : 0,
            avgRatePer1000: monthData?.national.avgRatePer1000 || 0,
            totalSubmissions: monthData?.national.totalSubmissions || 0,
          };
        });

        const practiceHistory = history;
        const nationalHistory = history;

        return (
          <>
            {/* Submissions Over Time */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Submissions Over Time</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: practiceHistory.map(d => d.month),
                    datasets: [{
                      label: 'Total Submissions',
                      data: practiceHistory.map(d => d.submissions),
                      backgroundColor: 'rgba(99, 102, 241, 0.7)',
                      borderColor: 'rgb(99, 102, 241)',
                      borderWidth: 1,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Submissions' } }
                    }
                  }}
                />
              </div>
            </Card>

            {/* Rate per 1000 Trend */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Rate per 1000 Patients Trend</h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: practiceHistory.map(d => d.month),
                    datasets: [
                      {
                        label: 'Your Practice',
                        data: practiceHistory.map(d => d.ratePer1000),
                        borderColor: 'rgb(99, 102, 241)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.3,
                      },
                      {
                        label: 'National Average',
                        data: nationalHistory.map(d => d.avgRatePer1000),
                        borderColor: 'rgb(156, 163, 175)',
                        borderDash: [5, 5],
                        tension: 0.3,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: 'Rate per 1000' } }
                    }
                  }}
                />
              </div>
            </Card>

            {/* Submission Type Mix Over Time */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Submission Type Mix Over Time</h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: practiceHistory.map(d => d.month),
                    datasets: [
                      {
                        label: 'Clinical %',
                        data: practiceHistory.map(d => d.clinicalPct),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3,
                      },
                      {
                        label: 'Administrative %',
                        data: practiceHistory.map(d => d.adminPct),
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.3,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                      y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage' } }
                    }
                  }}
                />
              </div>
            </Card>

            {/* National Trend */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">National Submissions Trend</h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: nationalHistory.map(d => d.month),
                    datasets: [{
                      label: 'Total National Submissions',
                      data: nationalHistory.map(d => d.totalSubmissions),
                      borderColor: 'rgb(168, 85, 247)',
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      fill: true,
                      tension: 0.3,
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Total Submissions' },
                        ticks: { callback: (v) => (v / 1000000).toFixed(1) + 'M' }
                      }
                    }
                  }}
                />
              </div>
            </Card>

            {/* Consistency Section */}
            {consistencyData.practiceScores[selectedPractice.odsCode] && (
              <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
                <h3 className="text-lg font-bold text-sky-900 mb-3">Your Practice's Consistency</h3>
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
                      ±{consistencyData.practiceScores[selectedPractice.odsCode].stdDev.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase">Range</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {consistencyData.practiceScores[selectedPractice.odsCode].range.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 uppercase">Avg Rate/1000</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {consistencyData.practiceScores[selectedPractice.odsCode].avgRate.toFixed(1)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Most Consistent/Volatile Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Most Consistent */}
              <Card className="bg-gradient-to-br from-sky-50 to-white border-sky-200">
                <h3 className="text-lg font-bold text-sky-900 mb-4">Top 10 Most Consistent</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-sky-100">
                      <tr>
                        <th className="text-left p-2">Practice</th>
                        <th className="text-right p-2">Avg Rate</th>
                        <th className="text-right p-2">Std Dev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consistencyData.consistent.map((practice, idx) => (
                        <tr key={practice.odsCode} className={`border-b ${practice.odsCode === selectedPractice.odsCode ? 'bg-sky-200 font-semibold' : ''}`}>
                          <td className="p-2 text-xs">{practice.gpName}</td>
                          <td className="p-2 text-right">{practice.avgRate.toFixed(1)}</td>
                          <td className="p-2 text-right text-sky-600">±{practice.stdDev.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Most Volatile */}
              <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
                <h3 className="text-lg font-bold text-orange-900 mb-4">Top 10 Most Volatile</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-orange-100">
                      <tr>
                        <th className="text-left p-2">Practice</th>
                        <th className="text-right p-2">Avg Rate</th>
                        <th className="text-right p-2">Std Dev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consistencyData.volatile.map((practice, idx) => (
                        <tr key={practice.odsCode} className={`border-b ${practice.odsCode === selectedPractice.odsCode ? 'bg-orange-200 font-semibold' : ''}`}>
                          <td className="p-2 text-xs">{practice.gpName}</td>
                          <td className="p-2 text-right">{practice.avgRate.toFixed(1)}</td>
                          <td className="p-2 text-right text-orange-600">±{practice.stdDev.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        );
      })()}

      {/* LEADERBOARDS TAB */}
      {selectedPractice && activeTab === 'leaderboards' && (() => {
        const pcnAverages = calculateOCPCNAverages(data.practices);
        const supplierStats = getSupplierStats(data.practices);
        const pcnNationalRanking = getOCPCNNationalRanking(selectedPractice.pcnCode, pcnAverages);
        const pcnICBRanking = getOCPCNICBRanking(selectedPractice.pcnCode, selectedPractice.icbCode, pcnAverages);

        // Top 20 practices by rate
        const top20ByRate = [...data.practices]
          .filter(p => p.participation === 1 && p.ratePer1000 > 0)
          .sort((a, b) => b.ratePer1000 - a.ratePer1000)
          .slice(0, 20);

        // Top 20 by absolute submissions
        const top20BySubmissions = [...data.practices]
          .filter(p => p.participation === 1)
          .sort((a, b) => b.submissions - a.submissions)
          .slice(0, 20);

        // Top PCNs
        const top20PCNs = pcnAverages.filter(p => p.practiceCount > 1).slice(0, 20);

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
            {/* Supplier Statistics */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">System Supplier Market Share</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {supplierStats.slice(0, 8).map((supplier, idx) => (
                  <div key={supplier.name} className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 truncate">{supplier.name}</p>
                    <p className="text-xl font-bold text-indigo-700">{supplier.practiceCount.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">practices</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top 20 by Rate */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Top 20 Practices (Rate per 1000)</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 border-b-2 border-slate-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-slate-700">Rank</th>
                          <th className="text-left p-3 font-semibold text-slate-700">Practice</th>
                          <th className="text-left p-3 font-semibold text-slate-700">PCN</th>
                          <th className="text-left p-3 font-semibold text-slate-700">Supplier</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Rate/1000</th>
                          <th className="text-right p-3 font-semibold text-slate-700">Submissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top20ByRate.map((practice, idx) => {
                          const isSelected = practice.odsCode === selectedPractice.odsCode;
                          return (
                            <tr key={practice.odsCode} className={`border-b border-slate-100 ${isSelected ? 'bg-indigo-100 font-semibold' : 'hover:bg-slate-50'}`}>
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600">{practice.pcnName}</td>
                              <td className="p-3 text-xs text-slate-600">{practice.supplier}</td>
                              <td className="p-3 text-right text-indigo-600 font-medium">{practice.ratePer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{practice.submissions.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top 20 by Absolute Submissions */}
            <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <h3 className="text-lg font-bold text-purple-900 mb-4">Top 20 Practices (Total Submissions)</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-purple-100 border-b-2 border-purple-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-purple-900">Rank</th>
                          <th className="text-left p-3 font-semibold text-purple-900">Practice</th>
                          <th className="text-left p-3 font-semibold text-purple-900">PCN</th>
                          <th className="text-right p-3 font-semibold text-purple-900">Submissions</th>
                          <th className="text-right p-3 font-semibold text-purple-900">List Size</th>
                          <th className="text-right p-3 font-semibold text-purple-900">Rate/1000</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top20BySubmissions.map((practice, idx) => {
                          const isSelected = practice.odsCode === selectedPractice.odsCode;
                          return (
                            <tr key={practice.odsCode} className={`border-b border-purple-100 ${isSelected ? 'bg-purple-200 font-semibold' : 'hover:bg-purple-50'}`}>
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600">{practice.pcnName}</td>
                              <td className="p-3 text-right text-purple-600 font-bold">{practice.submissions.toLocaleString()}</td>
                              <td className="p-3 text-right">{practice.listSize.toLocaleString()}</td>
                              <td className="p-3 text-right">{practice.ratePer1000.toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top PCNs */}
            <Card className="bg-gradient-to-br from-cyan-50 to-white border-cyan-200">
              <h3 className="text-lg font-bold text-cyan-900 mb-4">Top 20 PCNs (Rate per 1000)</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-cyan-100 border-b-2 border-cyan-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-cyan-900">Rank</th>
                          <th className="text-left p-3 font-semibold text-cyan-900">PCN</th>
                          <th className="text-left p-3 font-semibold text-cyan-900">ICB</th>
                          <th className="text-right p-3 font-semibold text-cyan-900">Avg Rate/1000</th>
                          <th className="text-right p-3 font-semibold text-cyan-900">Total Subs</th>
                          <th className="text-right p-3 font-semibold text-cyan-900">Practices</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top20PCNs.map((pcn, idx) => {
                          const isUserPCN = pcn.pcnCode === selectedPractice.pcnCode;
                          return (
                            <tr key={pcn.pcnCode} className={`border-b border-cyan-100 ${isUserPCN ? 'bg-cyan-200 font-semibold' : 'hover:bg-cyan-50'}`}>
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{pcn.pcnName}</div>
                                <div className="text-xs text-slate-500">{pcn.pcnCode}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600">{pcn.icbName}</td>
                              <td className="p-3 text-right text-cyan-600 font-medium">{pcn.avgRatePer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{pcn.totalSubmissions.toLocaleString()}</td>
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

            {/* PCN Performance in Same ICB */}
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
                          <th className="text-right p-3 font-semibold text-slate-700">Avg Rate/1000</th>
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
                                <span className={pcn.avgRatePer1000 > data.national.avgRatePer1000 ? 'text-green-600 font-medium' : ''}>
                                  {pcn.avgRatePer1000.toFixed(1)}
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

      {/* PER 1000 TAB */}
      {selectedPractice && activeTab === 'per1000' && (() => {
        // Practices ranked by rate per 1000
        const rankedByRate = [...data.practices]
          .filter(p => p.participation === 1 && p.ratePer1000 > 0)
          .sort((a, b) => b.ratePer1000 - a.ratePer1000);

        const practiceRank = rankedByRate.findIndex(p => p.odsCode === selectedPractice.odsCode) + 1;

        // Clinical rate ranking
        const rankedByClinical = [...data.practices]
          .filter(p => p.participation === 1 && p.clinicalPer1000 > 0)
          .sort((a, b) => b.clinicalPer1000 - a.clinicalPer1000);

        // Admin rate ranking
        const rankedByAdmin = [...data.practices]
          .filter(p => p.participation === 1 && p.adminPer1000 > 0)
          .sort((a, b) => b.adminPer1000 - a.adminPer1000);

        return (
          <>
            {/* Per 1000 Summary Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Total Rate / 1000</p>
                <p className={`text-3xl font-bold mt-1 ${
                  selectedPractice.ratePer1000 > data.national.avgRatePer1000 ? 'text-green-600' :
                  selectedPractice.ratePer1000 < data.national.avgRatePer1000 ? 'text-red-600' :
                  'text-slate-800'
                }`}>{selectedPractice.ratePer1000.toFixed(1)}</p>
                <p className="text-xs text-slate-500 mt-1">National: {data.national.avgRatePer1000.toFixed(1)}</p>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Clinical / 1000</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{selectedPractice.clinicalPer1000.toFixed(1)}</p>
                <p className="text-xs text-slate-500 mt-1">{(selectedPractice.clinicalPct * 100).toFixed(0)}% of total</p>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Administrative / 1000</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{selectedPractice.adminPer1000.toFixed(1)}</p>
                <p className="text-xs text-slate-500 mt-1">{(selectedPractice.adminPct * 100).toFixed(0)}% of total</p>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                <p className="text-xs text-slate-600 font-semibold uppercase">Your Ranking</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">
                  #{practiceRank} <span className="text-sm text-slate-500">/ {rankedByRate.length.toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Rank 1 = highest adoption</p>
              </Card>
            </div>

            {/* Type Breakdown Per 1000 - Doughnut Chart */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Submission Type Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: ['Clinical', 'Administrative', 'Other'],
                      datasets: [{
                        data: [
                          selectedPractice.clinicalPer1000,
                          selectedPractice.adminPer1000,
                          selectedPractice.otherPer1000
                        ],
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(34, 197, 94, 0.8)',
                          'rgba(156, 163, 175, 0.8)'
                        ],
                        borderColor: [
                          'rgb(59, 130, 246)',
                          'rgb(34, 197, 94)',
                          'rgb(156, 163, 175)'
                        ],
                        borderWidth: 1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        title: { display: true, text: 'Your Practice (per 1000 pts)' }
                      }
                    }}
                  />
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-800">Clinical</span>
                      <span className="text-blue-700 font-bold">{selectedPractice.clinicalPer1000.toFixed(1)} / 1000</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Rank #{rankedByClinical.findIndex(p => p.odsCode === selectedPractice.odsCode) + 1} nationally</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-green-800">Administrative</span>
                      <span className="text-green-700 font-bold">{selectedPractice.adminPer1000.toFixed(1)} / 1000</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Rank #{rankedByAdmin.findIndex(p => p.odsCode === selectedPractice.odsCode) + 1} nationally</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800">Other/Unknown</span>
                      <span className="text-gray-700 font-bold">{selectedPractice.otherPer1000.toFixed(1)} / 1000</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top 20 by Clinical Rate */}
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-4">Top 20 Practices (Clinical Submissions / 1000)</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-blue-100 border-b-2 border-blue-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-blue-900">Rank</th>
                          <th className="text-left p-3 font-semibold text-blue-900">Practice</th>
                          <th className="text-left p-3 font-semibold text-blue-900">PCN</th>
                          <th className="text-right p-3 font-semibold text-blue-900">Clinical/1000</th>
                          <th className="text-right p-3 font-semibold text-blue-900">Total Rate</th>
                          <th className="text-right p-3 font-semibold text-blue-900">Clinical %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedByClinical.slice(0, 20).map((practice, idx) => {
                          const isSelected = practice.odsCode === selectedPractice.odsCode;
                          return (
                            <tr key={practice.odsCode} className={`border-b border-blue-100 ${isSelected ? 'bg-blue-200 font-semibold' : 'hover:bg-blue-50'}`}>
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600">{practice.pcnName}</td>
                              <td className="p-3 text-right text-blue-600 font-bold">{practice.clinicalPer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{practice.ratePer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{(practice.clinicalPct * 100).toFixed(0)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Card>

            {/* Top 20 by Admin Rate */}
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
              <h3 className="text-lg font-bold text-green-900 mb-4">Top 20 Practices (Administrative / 1000)</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden sm:rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-green-100 border-b-2 border-green-200">
                        <tr>
                          <th className="text-left p-3 font-semibold text-green-900">Rank</th>
                          <th className="text-left p-3 font-semibold text-green-900">Practice</th>
                          <th className="text-left p-3 font-semibold text-green-900">PCN</th>
                          <th className="text-right p-3 font-semibold text-green-900">Admin/1000</th>
                          <th className="text-right p-3 font-semibold text-green-900">Total Rate</th>
                          <th className="text-right p-3 font-semibold text-green-900">Admin %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedByAdmin.slice(0, 20).map((practice, idx) => {
                          const isSelected = practice.odsCode === selectedPractice.odsCode;
                          return (
                            <tr key={practice.odsCode} className={`border-b border-green-100 ${isSelected ? 'bg-green-200 font-semibold' : 'hover:bg-green-50'}`}>
                              <td className="p-3 font-medium">{idx + 1}</td>
                              <td className="p-3">
                                <div className="font-medium">{practice.gpName}</div>
                                <div className="text-xs text-slate-500">{practice.odsCode}</div>
                              </td>
                              <td className="p-3 text-xs text-slate-600">{practice.pcnName}</td>
                              <td className="p-3 text-right text-green-600 font-bold">{practice.adminPer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{practice.ratePer1000.toFixed(1)}</td>
                              <td className="p-3 text-right">{(practice.adminPct * 100).toFixed(0)}%</td>
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

      {/* FORECASTING TAB */}
      {selectedPractice && activeTab === 'forecasting' && compareWithPrevious && practiceTrendData && practiceTrendData.length >= 3 && (() => {
        // Forecast submissions
        const submissionsForecast = forecastValues(
          practiceTrendData.map(d => ({ value: d.submissions })),
          3
        );

        // Forecast rate per 1000
        const rateForecast = forecastValues(
          practiceTrendData.map(d => ({ value: d.ratePer1000 })),
          3
        );

        // Get next months labels
        const lastMonth = MONTHS_ORDERED[MONTHS_ORDERED.length - 1];
        const [lastMonthName, lastYear] = lastMonth.split(' ');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const lastMonthIdx = monthNames.indexOf(lastMonthName);

        const futureMonths = [];
        for (let i = 1; i <= 3; i++) {
          const nextMonthIdx = (lastMonthIdx + i) % 12;
          const nextYear = lastMonthIdx + i > 11 ? parseInt(lastYear) + 1 : parseInt(lastYear);
          futureMonths.push(`${monthNames[nextMonthIdx]} ${nextYear}`);
        }

        // Build chart data with forecast
        const historicalLabels = practiceTrendData.map(d => d.month.split(' ')[0].substring(0, 3) + ' ' + d.month.split(' ')[1].substring(2));
        const forecastLabels = futureMonths.map(m => m.split(' ')[0].substring(0, 3) + ' ' + m.split(' ')[1].substring(2));
        const allLabels = [...historicalLabels, ...forecastLabels];

        const historicalSubmissions = practiceTrendData.map(d => d.submissions);
        const forecastedSubmissions = submissionsForecast.forecasts.map(f => f.value);

        const historicalRates = practiceTrendData.map(d => d.ratePer1000);
        const forecastedRates = rateForecast.forecasts.map(f => f.value);

        // Year-over-year comparison
        const yoyData = [];
        MONTHS_ORDERED.forEach(month => {
          const [monthName, year] = month.split(' ');
          const currentData = allMonthsData[month];
          const previousYearMonth = `${monthName} ${parseInt(year) - 1}`;
          const prevData = allMonthsData[previousYearMonth];

          if (currentData && prevData) {
            const currentPractice = currentData.practices.find(p => p.odsCode === selectedPractice.odsCode);
            const prevPractice = prevData.practices.find(p => p.odsCode === selectedPractice.odsCode);

            if (currentPractice && prevPractice) {
              yoyData.push({
                month: monthName,
                year: parseInt(year),
                currentSubmissions: currentPractice.submissions,
                prevSubmissions: prevPractice.submissions,
                change: ((currentPractice.submissions - prevPractice.submissions) / prevPractice.submissions * 100).toFixed(1)
              });
            }
          }
        });

        return (
          <>
            {/* Forecast Summary */}
            <Card className="bg-gradient-to-r from-purple-100 via-indigo-100 to-blue-100 border-2 border-purple-300">
              <div className="text-center py-2">
                <h2 className="text-xl font-bold text-slate-800">🔮 3-Month Forecast</h2>
                <p className="text-sm text-slate-600 mt-1">Based on {practiceTrendData.length} months of historical data</p>
              </div>
            </Card>

            {/* Forecast Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
                <h4 className="text-sm font-bold text-indigo-900 mb-2">Trend Direction</h4>
                <div className="text-center">
                  <div className="text-4xl mb-2">
                    {submissionsForecast.trend === 'increasing' ? '📈' : submissionsForecast.trend === 'decreasing' ? '📉' : '➡️'}
                  </div>
                  <p className="text-lg font-bold text-indigo-700 capitalize">{submissionsForecast.trend}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {submissionsForecast.monthlyChange > 0 ? '+' : ''}{submissionsForecast.monthlyChange.toFixed(0)} submissions/month
                  </p>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                <h4 className="text-sm font-bold text-purple-900 mb-2">Forecast Confidence</h4>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-700">{(submissionsForecast.r2 * 100).toFixed(0)}%</p>
                  <p className="text-xs text-slate-500 mt-1">R² correlation</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {submissionsForecast.r2 > 0.8 ? 'High reliability' : submissionsForecast.r2 > 0.5 ? 'Moderate reliability' : 'Low reliability'}
                  </p>
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                <h4 className="text-sm font-bold text-blue-900 mb-2">Next Month Forecast</h4>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-700">{Math.round(forecastedSubmissions[0]).toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">predicted submissions</p>
                  <p className="text-xs text-slate-400 mt-1">{futureMonths[0]}</p>
                </div>
              </Card>
            </div>

            {/* Submissions Forecast Chart */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Submissions Forecast</h3>
              <div className="h-72">
                <Line
                  data={{
                    labels: allLabels,
                    datasets: [
                      {
                        label: 'Historical',
                        data: [...historicalSubmissions, ...new Array(3).fill(null)],
                        borderColor: 'rgb(99, 102, 241)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.3,
                      },
                      {
                        label: 'Forecast',
                        data: [...new Array(historicalSubmissions.length - 1).fill(null), historicalSubmissions[historicalSubmissions.length - 1], ...forecastedSubmissions],
                        borderColor: 'rgb(168, 85, 247)',
                        borderDash: [5, 5],
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        fill: true,
                        tension: 0.3,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                      y: { beginAtZero: false, title: { display: true, text: 'Submissions' } }
                    }
                  }}
                />
              </div>
            </Card>

            {/* Rate Forecast Chart */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Rate per 1000 Forecast</h3>
              <div className="h-72">
                <Line
                  data={{
                    labels: allLabels,
                    datasets: [
                      {
                        label: 'Historical',
                        data: [...historicalRates, ...new Array(3).fill(null)],
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.3,
                      },
                      {
                        label: 'Forecast',
                        data: [...new Array(historicalRates.length - 1).fill(null), historicalRates[historicalRates.length - 1], ...forecastedRates],
                        borderColor: 'rgb(16, 185, 129)',
                        borderDash: [5, 5],
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } },
                    scales: {
                      y: { beginAtZero: false, title: { display: true, text: 'Rate per 1000' } }
                    }
                  }}
                />
              </div>
            </Card>

            {/* Forecast Table */}
            <Card>
              <h3 className="text-lg font-bold text-slate-800 mb-4">3-Month Forecast Details</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3">Month</th>
                      <th className="text-right p-3">Predicted Submissions</th>
                      <th className="text-right p-3">Predicted Rate/1000</th>
                      <th className="text-right p-3">Change from Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futureMonths.map((month, idx) => {
                      const subChange = forecastedSubmissions[idx] - selectedPractice.submissions;
                      const rateChange = forecastedRates[idx] - selectedPractice.ratePer1000;
                      return (
                        <tr key={month} className="border-b">
                          <td className="p-3 font-medium">{month}</td>
                          <td className="p-3 text-right text-indigo-600 font-bold">{Math.round(forecastedSubmissions[idx]).toLocaleString()}</td>
                          <td className="p-3 text-right text-green-600">{forecastedRates[idx].toFixed(1)}</td>
                          <td className="p-3 text-right">
                            <span className={subChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {subChange >= 0 ? '+' : ''}{Math.round(subChange).toLocaleString()} ({(subChange / selectedPractice.submissions * 100).toFixed(1)}%)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Year-over-Year Comparison */}
            {yoyData.length > 0 && (
              <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200">
                <h3 className="text-lg font-bold text-amber-900 mb-4">Year-over-Year Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-amber-100">
                      <tr>
                        <th className="text-left p-3">Month</th>
                        <th className="text-right p-3">This Year</th>
                        <th className="text-right p-3">Last Year</th>
                        <th className="text-right p-3">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoyData.map((row, idx) => (
                        <tr key={idx} className="border-b border-amber-100">
                          <td className="p-3 font-medium">{row.month} {row.year}</td>
                          <td className="p-3 text-right">{row.currentSubmissions.toLocaleString()}</td>
                          <td className="p-3 text-right text-slate-500">{row.prevSubmissions.toLocaleString()}</td>
                          <td className="p-3 text-right">
                            <span className={parseFloat(row.change) >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {parseFloat(row.change) >= 0 ? '+' : ''}{row.change}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Seasonality Analysis */}
            {practiceTrendData.length >= 12 && (
              <Card>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Seasonality Pattern</h3>
                <p className="text-sm text-slate-500 mb-4">Average submissions by month across all available years</p>
                <div className="h-64">
                  <Bar
                    data={{
                      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                      datasets: [{
                        label: 'Avg Submissions',
                        data: monthNames.map(monthName => {
                          const monthData = practiceTrendData.filter(d => d.month.startsWith(monthName));
                          if (monthData.length === 0) return 0;
                          return monthData.reduce((sum, d) => sum + d.submissions, 0) / monthData.length;
                        }),
                        backgroundColor: 'rgba(99, 102, 241, 0.7)',
                        borderColor: 'rgb(99, 102, 241)',
                        borderWidth: 1,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Avg Submissions' } }
                      }
                    }}
                  />
                </div>
              </Card>
            )}
          </>
        );
      })()}

      {/* Forecasting - Not Enough Data */}
      {selectedPractice && activeTab === 'forecasting' && compareWithPrevious && (!practiceTrendData || practiceTrendData.length < 3) && (
        <Card className="bg-amber-50 border-amber-300">
          <div className="flex items-center gap-3">
            <Info size={24} className="text-amber-600" />
            <div>
              <h3 className="font-bold text-amber-800">Insufficient Data for Forecasting</h3>
              <p className="text-sm text-amber-700">At least 3 months of historical data is needed for forecasting. This practice has {practiceTrendData?.length || 0} months of data.</p>
            </div>
          </div>
        </Card>
      )}

      {/* No Practice Selected */}
      {!selectedPractice && (
        <div className="text-center py-12 text-slate-400">
          <Monitor size={48} className="mx-auto mb-4 opacity-50" />
          <p>Search for and select your practice to view online consultations metrics</p>
        </div>
      )}
    </div>
  );
};

export default NationalOnlineConsultations;
