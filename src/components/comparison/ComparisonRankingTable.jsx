import React, { useState, useMemo } from 'react';
import { Trophy, Medal } from 'lucide-react';
import Card from '../ui/Card';
import OutlierBadge from './OutlierBadge';
import {
  COMPARISON_METRICS,
  getRankings,
  formatMetricValue,
  detectOutlier,
  getMetricConfig,
} from '../../utils/comparisonUtils';
import { COMPARISON_COLORS } from '../../constants/colors';

/**
 * Ranking table component showing practices sorted by selected metric
 */
const ComparisonRankingTable = ({ practices, filteredMonths, networkAverages }) => {
  const [activeMetric, setActiveMetric] = useState('gpTriageCapacityPerDayPct');

  // Metric tabs (subset of all metrics for cleaner UI)
  const metricTabs = [
    { id: 'gpTriageCapacityPerDayPct', label: 'GP Capacity/Day' },
    { id: 'utilization', label: 'Utilisation' },
    { id: 'gpDNAPct', label: 'GP DNA Rate' },
    { id: 'gpUnusedPct', label: 'Unused Capacity' },
    { id: 'conversionRatio', label: 'Conversion Ratio' },
    { id: 'missedFromQueueExRepeatPct', label: 'Missed Calls' },
  ];

  // Get current metric configuration
  const currentMetricConfig = useMemo(() => getMetricConfig(activeMetric), [activeMetric]);

  // Calculate rankings for current metric
  const rankings = useMemo(() => {
    const direction = currentMetricConfig?.higherBetter ? 'desc' : 'asc';
    return getRankings(practices, activeMetric, filteredMonths, direction);
  }, [practices, activeMetric, filteredMonths, currentMetricConfig]);

  // Get practice color by index
  const getPracticeColor = (shareId) => {
    const index = practices.findIndex(p => p.shareId === shareId);
    return COMPARISON_COLORS[index % COMPARISON_COLORS.length];
  };

  // Render rank badge
  const RankBadge = ({ rank }) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-1 text-amber-500">
          <Trophy size={16} />
          <span className="font-bold">1st</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="flex items-center gap-1 text-slate-400">
          <Medal size={16} />
          <span className="font-bold">2nd</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="flex items-center gap-1 text-amber-700">
          <Medal size={16} />
          <span className="font-bold">3rd</span>
        </div>
      );
    }
    return <span className="text-slate-500 font-medium">#{rank}</span>;
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-700">Practice Rankings</h3>
        </div>

        {/* Metric tabs */}
        <div className="flex gap-2 flex-wrap">
          {metricTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMetric(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeMetric === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ranking table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-xs">
            <tr>
              <th className="px-4 py-3 text-left w-16">Rank</th>
              <th className="px-4 py-3 text-left">Practice</th>
              <th className="px-4 py-3 text-left w-24">ODS Code</th>
              <th className="px-4 py-3 text-right w-28">Population</th>
              <th className="px-4 py-3 text-right w-32">
                {currentMetricConfig?.label || 'Value'}
              </th>
              <th className="px-4 py-3 text-center w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rankings.map((row, index) => {
              const outlierInfo = detectOutlier(
                row.value,
                networkAverages[activeMetric],
                1.5
              );

              return (
                <tr
                  key={row.shareId}
                  className={`hover:bg-slate-50 transition-colors ${
                    index < 3 ? 'bg-emerald-50/30' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <RankBadge rank={row.rank} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getPracticeColor(row.shareId) }}
                      />
                      <span className="font-medium">{row.surgeryName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {row.odsCode || '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {row.population?.toLocaleString() || '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMetricValue(row.value, currentMetricConfig?.format)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OutlierBadge
                      outlierInfo={outlierInfo}
                      higherBetter={currentMetricConfig?.higherBetter}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Network average footer */}
      {networkAverages[activeMetric] && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 font-medium">Network Average:</span>
            <span className="font-bold text-slate-800">
              {formatMetricValue(networkAverages[activeMetric].mean, currentMetricConfig?.format)}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>
              Min: {formatMetricValue(networkAverages[activeMetric].min, currentMetricConfig?.format)}
            </span>
            <span>
              Max: {formatMetricValue(networkAverages[activeMetric].max, currentMetricConfig?.format)}
            </span>
            <span>
              Std Dev: {networkAverages[activeMetric].stdDev.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 text-xs text-slate-500">
        <span className="font-medium">Note:</span> Rankings based on average across {filteredMonths.length} selected month(s).
        {currentMetricConfig?.higherBetter
          ? ' Higher values are ranked better.'
          : ' Lower values are ranked better.'}
      </div>
    </Card>
  );
};

export default ComparisonRankingTable;
