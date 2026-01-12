import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, X, AlertTriangle, Loader2, Share2, Copy, ArrowLeft,
  BarChart3, Trophy, Calendar, CheckCircle
} from 'lucide-react';
import Card from '../ui/Card';
import MetricCard from '../ui/MetricCard';
import Toast from '../ui/Toast';
import ComparisonDateFilter from './ComparisonDateFilter';
import ComparisonRankingTable from './ComparisonRankingTable';
import ComparisonCharts from './ComparisonCharts';
import { loadComparisonSet, loadComparisonPractices } from '../../utils/shareUtils';
import {
  calculateNetworkAverages,
  getFilteredMonths,
  formatMetricValue,
  getAllMonths,
} from '../../utils/comparisonUtils';
import { COMPARISON_COLORS } from '../../constants/colors';

/**
 * Main Practice Comparison dashboard component
 */
const PracticeComparison = ({ comparisonId, onClose }) => {
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Comparison data
  const [comparisonMeta, setComparisonMeta] = useState(null);
  const [practices, setPractices] = useState([]);
  const [loadErrors, setLoadErrors] = useState([]);

  // Filter state
  const [dateFilter, setDateFilter] = useState({
    mode: 'all',
    selectedMonths: [],
  });

  // Active tab
  const [activeTab, setActiveTab] = useState('overview');

  // Load comparison data on mount
  useEffect(() => {
    const loadComparison = async () => {
      if (!comparisonId) {
        setError('No comparison ID provided');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load comparison set metadata
        const meta = await loadComparisonSet(comparisonId);
        setComparisonMeta(meta);

        // Load all practice data
        const { practices: loadedPractices, errors } = await loadComparisonPractices(meta.shareIds);
        setPractices(loadedPractices);
        setLoadErrors(errors);

        // Show warning if some practices failed to load
        if (errors.length > 0) {
          const expiredCount = errors.filter(e => e.status === 'expired').length;
          const errorCount = errors.filter(e => e.status === 'error').length;

          let message = '';
          if (expiredCount > 0) {
            message += `${expiredCount} practice(s) have expired. `;
          }
          if (errorCount > 0) {
            message += `${errorCount} practice(s) failed to load. `;
          }

          setToast({
            type: 'warning',
            message: message + 'Comparison will proceed with available data.',
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadComparison();
  }, [comparisonId]);

  // Calculate filtered months based on filter mode
  const filteredMonths = useMemo(
    () => getFilteredMonths(practices, dateFilter.mode, dateFilter.selectedMonths),
    [practices, dateFilter]
  );

  // Calculate network averages for filtered months
  const networkAverages = useMemo(
    () => calculateNetworkAverages(practices, filteredMonths),
    [practices, filteredMonths]
  );

  // Copy comparison URL
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast({ type: 'success', message: 'Comparison URL copied to clipboard!' });
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to copy URL' });
    }
  };

  // Handle close
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.pushState(null, '', '/');
      window.location.reload();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading comparison...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to Load Comparison</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Return Home
          </button>
        </Card>
      </div>
    );
  }

  // No practices loaded
  if (practices.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Practices Available</h2>
          <p className="text-slate-600 mb-6">
            All practices in this comparison have expired or failed to load.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Return Home
          </button>
        </Card>
      </div>
    );
  }

  const allMonths = getAllMonths(practices);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} className="text-slate-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Users size={24} className="text-emerald-600" />
                  {comparisonMeta?.name || 'Practice Comparison'}
                </h1>
                <p className="text-sm text-slate-500">
                  {practices.length} practices | {allMonths.length} months of data
                  {comparisonMeta?.expiresAt && (
                    <> | Expires {comparisonMeta.expiresAt.toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Share2 size={16} />
              Share
            </button>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-4 mt-4 border-t border-slate-100 pt-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 size={18} />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'charts'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 size={18} />
              Charts
            </button>
            <button
              onClick={() => setActiveTab('rankings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'rankings'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Trophy size={18} />
              Rankings
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Load errors warning */}
        {loadErrors.length > 0 && (
          <Card className="mb-6 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-amber-800 mb-2">Some practices unavailable</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  {loadErrors.map(err => (
                    <li key={err.shareId} className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        err.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {err.status === 'expired' ? 'Expired' : 'Error'}
                      </span>
                      <span className="font-mono text-xs">{err.shareId}</span>
                      <span>- {err.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Date filter */}
        <ComparisonDateFilter
          practices={practices}
          dateFilter={dateFilter}
          onChange={setDateFilter}
        />

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <>
            {/* Network averages */}
            <Card className="mb-6">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-600" />
                Network Averages ({filteredMonths.length} months)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <MetricCard
                  title="GP Capacity/Day"
                  value={formatMetricValue(networkAverages.gpTriageCapacityPerDayPct?.mean, 'percent2')}
                  subtext="Network average"
                  icon={BarChart3}
                />
                <MetricCard
                  title="Utilisation"
                  value={formatMetricValue(networkAverages.utilization?.mean, 'percent1')}
                  subtext="Network average"
                  icon={CheckCircle}
                />
                <MetricCard
                  title="DNA Rate"
                  value={formatMetricValue(networkAverages.allDNAPct?.mean, 'percent1')}
                  subtext="Network average"
                  icon={AlertTriangle}
                />
                <MetricCard
                  title="Unused Capacity"
                  value={formatMetricValue(networkAverages.allUnusedPct?.mean, 'percent1')}
                  subtext="Network average"
                  icon={Calendar}
                />
                <MetricCard
                  title="Conversion Ratio"
                  value={formatMetricValue(networkAverages.conversionRatio?.mean, 'decimal2')}
                  subtext="Appts per call"
                  icon={Users}
                />
                <MetricCard
                  title="Practices"
                  value={practices.length.toString()}
                  subtext={`of ${comparisonMeta?.practiceCount || practices.length} loaded`}
                  icon={Users}
                />
              </div>
            </Card>

            {/* Practice list */}
            <Card className="mb-6">
              <h3 className="font-bold text-slate-700 mb-4">Practices in Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {practices.map((practice, index) => (
                  <div
                    key={practice.shareId}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{practice.surgeryName}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {practice.odsCode && (
                          <span className="font-mono">{practice.odsCode}</span>
                        )}
                        <span>{practice.population?.toLocaleString()} patients</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick rankings */}
            <ComparisonRankingTable
              practices={practices}
              filteredMonths={filteredMonths}
              networkAverages={networkAverages}
            />
          </>
        )}

        {/* Charts tab */}
        {activeTab === 'charts' && (
          <ComparisonCharts
            practices={practices}
            filteredMonths={filteredMonths}
            networkAverages={networkAverages}
          />
        )}

        {/* Rankings tab */}
        {activeTab === 'rankings' && (
          <ComparisonRankingTable
            practices={practices}
            filteredMonths={filteredMonths}
            networkAverages={networkAverages}
          />
        )}
      </main>

      {/* Toast notifications */}
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

export default PracticeComparison;
