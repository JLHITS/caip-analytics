import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Badge component to indicate outlier status
 * Shows when a practice is >1.5 standard deviations from the network mean
 */
const OutlierBadge = ({ outlierInfo, higherBetter = true }) => {
  if (!outlierInfo || !outlierInfo.isOutlier) return null;

  const isAbove = outlierInfo.direction === 'above';

  // Determine if this is a good or bad outlier based on the metric
  const isPositive = higherBetter ? isAbove : !isAbove;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isPositive
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : 'bg-amber-100 text-amber-700 border border-amber-200'
      }`}
      title={`${Math.abs(outlierInfo.zScore).toFixed(1)} standard deviations ${outlierInfo.direction} average`}
    >
      {isAbove ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      Outlier
    </span>
  );
};

export default OutlierBadge;
