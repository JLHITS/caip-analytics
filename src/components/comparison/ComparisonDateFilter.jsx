import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import Card from '../ui/Card';
import { getAllMonths, getOverlappingMonths, sortMonthsChronologically } from '../../utils/comparisonUtils';
import { COMPARISON_COLORS } from '../../constants/colors';

/**
 * Date filter component for comparison dashboard
 * Allows filtering by: all months, overlapping only, or specific month selection
 */
const ComparisonDateFilter = ({ practices, dateFilter, onChange }) => {
  // Get all unique months from all practices
  const allMonths = useMemo(() => getAllMonths(practices), [practices]);

  // Get overlapping months (present in ALL practices)
  const overlappingMonths = useMemo(() => getOverlappingMonths(practices), [practices]);

  // Toggle a specific month in selection
  const toggleMonth = (month) => {
    const current = dateFilter.selectedMonths || [];
    const isSelected = current.includes(month);

    const newSelection = isSelected
      ? current.filter(m => m !== month)
      : sortMonthsChronologically([...current, month]);

    onChange({
      mode: 'specific',
      selectedMonths: newSelection,
    });
  };

  // Select all months
  const handleSelectAll = () => {
    onChange({
      mode: 'specific',
      selectedMonths: allMonths,
    });
  };

  // Clear selection
  const handleClearSelection = () => {
    onChange({
      mode: 'specific',
      selectedMonths: [],
    });
  };

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={18} className="text-slate-500" />
        <h3 className="font-bold text-slate-700">Date Range Filter</h3>
      </div>

      {/* Filter mode selection */}
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="dateMode"
            checked={dateFilter.mode === 'all'}
            onChange={() => onChange({ mode: 'all', selectedMonths: [] })}
            className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-700">
            All Months <span className="text-slate-400">({allMonths.length})</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="dateMode"
            checked={dateFilter.mode === 'overlapping'}
            onChange={() => onChange({ mode: 'overlapping', selectedMonths: overlappingMonths })}
            className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-700">
            Overlapping Only <span className="text-slate-400">({overlappingMonths.length})</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="dateMode"
            checked={dateFilter.mode === 'specific'}
            onChange={() => onChange({ mode: 'specific', selectedMonths: dateFilter.selectedMonths || [] })}
            className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-700">
            Select Specific
            {dateFilter.mode === 'specific' && (
              <span className="text-slate-400 ml-1">
                ({dateFilter.selectedMonths?.length || 0} selected)
              </span>
            )}
          </span>
        </label>
      </div>

      {/* Specific month selection */}
      {dateFilter.mode === 'specific' && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Select all
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={handleClearSelection}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allMonths.map(month => {
              const isSelected = dateFilter.selectedMonths?.includes(month);
              const inOverlapping = overlappingMonths.includes(month);

              return (
                <button
                  key={month}
                  onClick={() => toggleMonth(month)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : inOverlapping
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={inOverlapping ? 'Data available in all practices' : 'Data only in some practices'}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Data coverage visualization */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 mb-2">Data coverage by practice:</p>
        <div className="space-y-1.5">
          {practices.map((practice, index) => {
            const practiceMonths = new Set(practice.processedData?.map(d => d.month) || []);

            return (
              <div key={practice.shareId} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COMPARISON_COLORS[index % COMPARISON_COLORS.length] }}
                />
                <span className="w-32 text-xs text-slate-600 truncate" title={practice.surgeryName}>
                  {practice.surgeryName}
                </span>
                <div className="flex-1 flex gap-0.5">
                  {allMonths.map(month => {
                    const hasData = practiceMonths.has(month);
                    const isFiltered = dateFilter.mode === 'all' ||
                      (dateFilter.mode === 'overlapping' && overlappingMonths.includes(month)) ||
                      (dateFilter.mode === 'specific' && dateFilter.selectedMonths?.includes(month));

                    return (
                      <div
                        key={month}
                        className={`h-3 flex-1 rounded-sm transition-opacity ${
                          hasData
                            ? 'bg-emerald-400'
                            : 'bg-slate-200'
                        } ${isFiltered ? 'opacity-100' : 'opacity-30'}`}
                        title={`${month}: ${hasData ? 'Data available' : 'No data'}`}
                      />
                    );
                  })}
                </div>
                <span className="text-xs text-slate-400 w-12 text-right">
                  {practiceMonths.size}/{allMonths.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning for no overlapping data */}
      {overlappingMonths.length === 0 && practices.length >= 2 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <strong>Note:</strong> These practices have no overlapping months.
            Select "All Months" to compare available data with gaps.
          </p>
        </div>
      )}
    </Card>
  );
};

export default ComparisonDateFilter;
