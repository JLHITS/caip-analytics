/**
 * Comparison utilities for multi-practice dashboard analysis
 */

// Metrics available for comparison with their display configuration
export const COMPARISON_METRICS = [
  { id: 'gpTriageCapacityPerDayPct', label: 'GP Capacity/Day', format: 'percent2', higherBetter: true },
  { id: 'gpApptsPerDay', label: 'GP Appts/Day', format: 'percent2', higherBetter: true },
  { id: 'allApptsPerDay', label: 'All Appts/Day', format: 'percent2', higherBetter: true },
  { id: 'utilization', label: 'Utilisation', format: 'percent1', higherBetter: true },
  { id: 'gpUtilization', label: 'GP Utilisation', format: 'percent1', higherBetter: true },
  { id: 'gpDNAPct', label: 'GP DNA Rate', format: 'percent1', higherBetter: false },
  { id: 'allDNAPct', label: 'All DNA Rate', format: 'percent1', higherBetter: false },
  { id: 'gpUnusedPct', label: 'GP Unused Capacity', format: 'percent1', higherBetter: false },
  { id: 'allUnusedPct', label: 'All Unused Capacity', format: 'percent1', higherBetter: false },
  { id: 'conversionRatio', label: 'Conversion Ratio', format: 'decimal2', higherBetter: true },
  { id: 'gpConversionRatio', label: 'GP Conversion Ratio', format: 'decimal2', higherBetter: true },
  { id: 'missedFromQueueExRepeatPct', label: 'Missed Call Rate', format: 'percent1', higherBetter: false },
  { id: 'avgQueueTimeAnswered', label: 'Avg Queue Time', format: 'time', higherBetter: false },
];

/**
 * Parse a month key string (e.g., "Aug-24") into month index and year
 * @param {string} monthKey - Month string in format "MMM-YY"
 * @returns {[number, number]} [monthIndex (0-11), fullYear]
 */
export const parseMonthKey = (monthKey) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = monthKey.split('-');
  if (parts.length !== 2) return [0, 2000];

  const monthIndex = months.indexOf(parts[0]);
  const year = 2000 + parseInt(parts[1], 10);

  return [monthIndex >= 0 ? monthIndex : 0, year];
};

/**
 * Sort month keys chronologically
 * @param {string[]} months - Array of month strings
 * @returns {string[]} Sorted array
 */
export const sortMonthsChronologically = (months) => {
  return [...months].sort((a, b) => {
    const [ma, ya] = parseMonthKey(a);
    const [mb, yb] = parseMonthKey(b);
    return (ya * 12 + ma) - (yb * 12 + mb);
  });
};

/**
 * Get all unique months from all practices
 * @param {Array} practices - Array of practice data objects
 * @returns {string[]} Sorted array of unique month keys
 */
export const getAllMonths = (practices) => {
  const monthSet = new Set();
  practices.forEach(p => {
    p.processedData?.forEach(d => {
      if (d.month) monthSet.add(d.month);
    });
  });
  return sortMonthsChronologically(Array.from(monthSet));
};

/**
 * Get months that are present in ALL practices
 * @param {Array} practices - Array of practice data objects
 * @returns {string[]} Sorted array of overlapping month keys
 */
export const getOverlappingMonths = (practices) => {
  if (practices.length === 0) return [];

  const allMonths = getAllMonths(practices);
  return allMonths.filter(month =>
    practices.every(p =>
      p.processedData?.some(d => d.month === month)
    )
  );
};

/**
 * Get filtered months based on filter mode
 * @param {Array} practices - Array of practice data objects
 * @param {'all' | 'overlapping' | 'specific'} mode - Filter mode
 * @param {string[]} selectedMonths - For 'specific' mode, the selected months
 * @returns {string[]} Filtered and sorted month keys
 */
export const getFilteredMonths = (practices, mode, selectedMonths = []) => {
  switch (mode) {
    case 'overlapping':
      return getOverlappingMonths(practices);
    case 'specific':
      return sortMonthsChronologically(selectedMonths);
    case 'all':
    default:
      return getAllMonths(practices);
  }
};

/**
 * Calculate network averages across all practices for filtered months
 * @param {Array} practices - Array of practice data objects
 * @param {string[]} filteredMonths - Months to include in calculations
 * @returns {Object} Object with metric IDs as keys, containing { mean, stdDev, min, max, count, values }
 */
export const calculateNetworkAverages = (practices, filteredMonths) => {
  const averages = {};

  COMPARISON_METRICS.forEach(({ id: metric }) => {
    const allValues = [];

    practices.forEach(practice => {
      const relevantData = practice.processedData?.filter(d =>
        filteredMonths.includes(d.month)
      ) || [];

      // Calculate practice average for the filtered months
      const validValues = relevantData
        .map(d => d[metric])
        .filter(v => v !== null && v !== undefined && !isNaN(v));

      if (validValues.length > 0) {
        const practiceAvg = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
        allValues.push({
          shareId: practice.shareId,
          surgeryName: practice.surgeryName || practice.config?.surgeryName,
          value: practiceAvg
        });
      }
    });

    if (allValues.length > 0) {
      const sum = allValues.reduce((s, v) => s + v.value, 0);
      const mean = sum / allValues.length;

      // Calculate standard deviation
      const squaredDiffs = allValues.map(v => Math.pow(v.value - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((s, d) => s + d, 0) / squaredDiffs.length;
      const stdDev = Math.sqrt(avgSquaredDiff);

      averages[metric] = {
        mean,
        stdDev,
        min: Math.min(...allValues.map(v => v.value)),
        max: Math.max(...allValues.map(v => v.value)),
        count: allValues.length,
        values: allValues
      };
    }
  });

  return averages;
};

/**
 * Detect if a value is an outlier using standard deviation method
 * @param {number} value - Practice's value for the metric
 * @param {Object} networkStats - { mean, stdDev } from calculateNetworkAverages
 * @param {number} threshold - Number of standard deviations (default 1.5)
 * @returns {Object} { isOutlier, direction: 'above' | 'below' | null, zScore }
 */
export const detectOutlier = (value, networkStats, threshold = 1.5) => {
  if (!networkStats || networkStats.stdDev === 0 || value === null || value === undefined) {
    return { isOutlier: false, direction: null, zScore: 0 };
  }

  const zScore = (value - networkStats.mean) / networkStats.stdDev;
  const isOutlier = Math.abs(zScore) > threshold;

  return {
    isOutlier,
    direction: isOutlier ? (zScore > 0 ? 'above' : 'below') : null,
    zScore
  };
};

/**
 * Get ranking for all practices by a specific metric
 * @param {Array} practices - Array of practice data objects
 * @param {string} metric - Metric ID to rank by
 * @param {string[]} filteredMonths - Months to include in calculations
 * @param {'asc' | 'desc'} direction - Sort direction
 * @returns {Array} Ranked array with { shareId, surgeryName, odsCode, population, value, monthCount, rank }
 */
export const getRankings = (practices, metric, filteredMonths, direction = 'desc') => {
  const rankings = practices.map(practice => {
    const relevantData = practice.processedData?.filter(d =>
      filteredMonths.includes(d.month)
    ) || [];

    const validValues = relevantData
      .map(d => d[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    const avgValue = validValues.length > 0
      ? validValues.reduce((sum, v) => sum + v, 0) / validValues.length
      : null;

    return {
      shareId: practice.shareId,
      surgeryName: practice.surgeryName || practice.config?.surgeryName || 'Unknown',
      odsCode: practice.odsCode || practice.config?.odsCode || '',
      population: practice.population || practice.config?.population,
      value: avgValue,
      monthCount: relevantData.length
    };
  }).filter(r => r.value !== null);

  // Sort by value
  rankings.sort((a, b) => direction === 'desc' ? b.value - a.value : a.value - b.value);

  // Add rank
  return rankings.map((r, index) => ({ ...r, rank: index + 1 }));
};

/**
 * Format a value for display based on format type
 * @param {number} value - Value to format
 * @param {string} format - Format type: 'percent1', 'percent2', 'decimal2', 'time', 'number'
 * @returns {string} Formatted string
 */
export const formatMetricValue = (value, format) => {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'percent1':
      return `${value.toFixed(1)}%`;
    case 'percent2':
      return `${value.toFixed(2)}%`;
    case 'decimal2':
      return value.toFixed(2);
    case 'time':
      const mins = Math.floor(value / 60);
      const secs = Math.round(value % 60);
      return `${mins}m ${secs}s`;
    case 'number':
      return value.toLocaleString();
    default:
      return value.toFixed(2);
  }
};

/**
 * Get a metric configuration by ID
 * @param {string} metricId - Metric ID
 * @returns {Object | undefined} Metric configuration
 */
export const getMetricConfig = (metricId) => {
  return COMPARISON_METRICS.find(m => m.id === metricId);
};

/**
 * Calculate data coverage for a practice across all months
 * @param {Object} practice - Practice data object
 * @param {string[]} allMonths - All months to check coverage against
 * @returns {Object} { covered: number, total: number, percentage: number, months: boolean[] }
 */
export const calculateDataCoverage = (practice, allMonths) => {
  const monthsWithData = allMonths.map(month =>
    practice.processedData?.some(d => d.month === month) || false
  );

  const covered = monthsWithData.filter(Boolean).length;

  return {
    covered,
    total: allMonths.length,
    percentage: allMonths.length > 0 ? (covered / allMonths.length) * 100 : 0,
    months: monthsWithData
  };
};

/**
 * Extract practice data for chart display
 * @param {Array} practices - Array of practice data objects
 * @param {string} metric - Metric ID to extract
 * @param {string[]} sortedMonths - Sorted months for x-axis
 * @returns {Array} Array of { shareId, surgeryName, data: number[] }
 */
export const extractChartData = (practices, metric, sortedMonths) => {
  return practices.map(practice => {
    const data = sortedMonths.map(month => {
      const monthData = practice.processedData?.find(d => d.month === month);
      return monthData ? monthData[metric] : null;
    });

    return {
      shareId: practice.shareId,
      surgeryName: practice.surgeryName || practice.config?.surgeryName || 'Unknown',
      odsCode: practice.odsCode || practice.config?.odsCode || '',
      data
    };
  });
};

/**
 * Find practices with similar list sizes to the selected practice.
 * Selects randomly from practices within ±30% population to provide variety.
 * @param {Object} selectedPractice - The practice to find similar ones for
 * @param {Array} allPractices - All available practices
 * @param {number} count - Number of similar practices to return (default 5)
 * @returns {Array} Array of randomly selected similar-sized practices
 */
export const findSimilarPractices = (selectedPractice, allPractices, count = 5) => {
  if (!selectedPractice || !allPractices?.length) return [];

  const selectedOds = selectedPractice.odsCode || '';
  const selectedPop = selectedPractice.listSize || 0;

  if (!selectedPop || !selectedOds) return [];

  const lowerBound = selectedPop * 0.7;
  const upperBound = selectedPop * 1.3;

  const candidates = allPractices.filter(p => {
    const pop = p.listSize || 0;
    return p.odsCode !== selectedOds && pop >= lowerBound && pop <= upperBound;
  });

  // Shuffle candidates and pick `count` random ones
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
};
