/**
 * Demand & Capacity Metrics Calculation Utilities
 * Combines appointment, telephony, and online consultation data
 */

// Working days in each month (approximate, excluding weekends)
// GP practices typically operate Monday-Friday
export const WORKING_DAYS_IN_MONTH = {
  'January': 22,    // ~22 working days
  'February': 20,   // ~20 working days
  'March': 21,      // ~21 working days
  'April': 21,      // ~21 working days (accounting for Easter varies)
  'May': 21,        // ~21 working days (accounting for bank holidays)
  'June': 21,       // ~21 working days
  'July': 23,       // ~23 working days
  'August': 21,     // ~21 working days (bank holiday)
  'September': 21,  // ~21 working days
  'October': 22,    // ~22 working days
  'November': 21,   // ~21 working days
  'December': 20,   // ~20 working days (Christmas)
};

// Calendar days (kept for reference)
export const CALENDAR_DAYS_IN_MONTH = {
  'January': 31,
  'February': 28,
  'March': 31,
  'April': 30,
  'May': 31,
  'June': 30,
  'July': 31,
  'August': 31,
  'September': 30,
  'October': 31,
  'November': 30,
  'December': 31,
};

// Alias for backward compatibility
export const DAYS_IN_MONTH = WORKING_DAYS_IN_MONTH;

/**
 * Get working days in a month from a month string like "November 2025"
 * Uses working days (~20-22) as GP practices operate Monday-Friday
 */
export function getDaysInMonth(monthString) {
  if (!monthString) return 21; // Default to ~21 working days
  const monthName = monthString.split(' ')[0];
  return WORKING_DAYS_IN_MONTH[monthName] || 21;
}

/**
 * Get calendar days in a month (for reference)
 */
export function getCalendarDaysInMonth(monthString) {
  if (!monthString) return 30;
  const monthName = monthString.split(' ')[0];
  return CALENDAR_DAYS_IN_MONTH[monthName] || 30;
}

/**
 * Calculate Patients with GP Appointment per Day %
 * Formula: (GP Appointments / (Population × Days in Month)) × 100
 */
export function calculatePatientsWithGPApptPerDay(gpAppts, population, daysInMonth) {
  if (!population || population === 0 || !daysInMonth) return null;
  return (gpAppts / (population * daysInMonth)) * 100;
}

/**
 * Calculate Patients with GP Appointment or Online Consultation per Day %
 * Formula: ((GP Appointments + OC Submissions) / (Population × Days in Month)) × 100
 */
export function calculatePatientsWithGPApptOrOCPerDay(gpAppts, ocSubmissions, population, daysInMonth) {
  if (!population || population === 0 || !daysInMonth) return null;
  return ((gpAppts + (ocSubmissions || 0)) / (population * daysInMonth)) * 100;
}

/**
 * Calculate GP Appointments per Answered Call (legacy)
 * Formula: GP Appointments / Answered Calls
 */
export function calculateGPApptsPerAnsweredCall(gpAppts, answeredCalls) {
  if (!answeredCalls || answeredCalls === 0) return null;
  return gpAppts / answeredCalls;
}

/**
 * Calculate GP Appointments per Demand Channel
 * Formula: GP Appointments / (Inbound Calls + Medical OC Submissions)
 * This better reflects total demand as it includes both phone and digital channels
 */
export function calculateGPApptsPerDemandChannel(gpAppts, inboundCalls, medicalOcSubmissions) {
  const totalDemand = (inboundCalls || 0) + (medicalOcSubmissions || 0);
  if (totalDemand === 0) return null;
  return gpAppts / totalDemand;
}

/**
 * Calculate per 1000 population rate
 */
export function calculatePer1000(value, population) {
  if (!population || population === 0 || value === null || value === undefined) return null;
  return (value / population) * 1000;
}

/**
 * Calculate DNA rate
 * Formula: (DNA Count / Total Appointments) × 100
 */
export function calculateDNARate(dnaCount, totalAppointments) {
  if (!totalAppointments || totalAppointments === 0) return null;
  return (dnaCount / totalAppointments) * 100;
}

/**
 * Main function to calculate all practice metrics combining all data sources
 */
export function calculatePracticeMetrics(apptData, telephonyData, ocData, population, month) {
  const daysInMonth = getDaysInMonth(month);

  // Extract appointment data
  const gpAppts = apptData?.staffBreakdown?.gpAppointments || 0;
  const otherAppts = apptData?.staffBreakdown?.otherStaffAppointments || 0;
  const totalAppts = apptData?.totalAppointments || (gpAppts + otherAppts);

  // Extract mode data
  const faceToFace = apptData?.appointmentModes?.faceToFace || 0;
  const telephone = apptData?.appointmentModes?.telephone || 0;
  const video = apptData?.appointmentModes?.video || 0;
  const homeVisit = apptData?.appointmentModes?.homeVisit || 0;

  // Extract booking wait data
  const sameDay = apptData?.bookingWait?.sameDay || 0;
  const sameDayPct = apptData?.bookingWait?.sameDayPct || 0;
  const withinWeekPct = apptData?.bookingWait?.withinWeekPct || 0;
  const oneToSevenDaysPct = apptData?.bookingWait?.oneToSevenDaysPct || 0;
  const eightToFourteenDaysPct = apptData?.bookingWait?.eightToFourteenDaysPct || 0;
  const fifteenToTwentyOneDaysPct = apptData?.bookingWait?.fifteenToTwentyOneDaysPct || 0;
  const twentyTwoToTwentyEightDaysPct = apptData?.bookingWait?.twentyTwoToTwentyEightDaysPct || 0;
  const twentyEightPlusDaysPct = apptData?.bookingWait?.twentyEightPlusDaysPct || 0;
  const fifteenPlusDaysPct = fifteenToTwentyOneDaysPct + twentyTwoToTwentyEightDaysPct + twentyEightPlusDaysPct;

  // Extract status data
  const attended = apptData?.appointmentStatus?.attended || 0;
  const dna = apptData?.appointmentStatus?.dna || 0;
  const dnaPct = apptData?.appointmentStatus?.dnaPct || 0;

  // Extract telephony data (may be null if not available)
  const answeredCalls = telephonyData?.answered || 0;
  const inboundCalls = telephonyData?.inboundCalls || 0;
  const missedCalls = telephonyData?.missed || 0;
  const missedCallPct = telephonyData?.missedPct !== undefined ? telephonyData.missedPct * 100 : null;

  // Extract OC data (may be null if not available)
  const ocSubmissions = ocData?.submissions || ocData?.totalSubmissions || 0;
  const ocClinicalSubmissions = ocData?.clinicalSubmissions || 0; // Medical/clinical OC only
  const ocRatePer1000 = ocData?.ratePer1000 || 0;

  // Calculate core metrics
  const metrics = {
    // Per-Day Metrics
    gpApptPerDayPct: calculatePatientsWithGPApptPerDay(gpAppts, population, daysInMonth),
    otherApptPerDayPct: calculatePatientsWithGPApptPerDay(otherAppts, population, daysInMonth),
    totalApptPerDayPct: calculatePatientsWithGPApptPerDay(totalAppts, population, daysInMonth),
    // GP + Medical OC per day (clinical submissions only, not admin)
    gpApptOrOCPerDayPct: calculatePatientsWithGPApptOrOCPerDay(gpAppts, ocClinicalSubmissions, population, daysInMonth),

    // Per 1000 Metrics
    gpApptsPer1000: calculatePer1000(gpAppts, population),
    gpApptOrOCPer1000: calculatePer1000(gpAppts + ocClinicalSubmissions, population),
    otherApptsPer1000: calculatePer1000(otherAppts, population),
    totalApptsPer1000: calculatePer1000(totalAppts, population),
    callsPer1000: calculatePer1000(inboundCalls, population),
    missedCallsPer1000: calculatePer1000(missedCalls, population),

    // Conversion/Efficiency Metrics
    // gpApptsPerCall now uses (inbound calls + medical OC) to reflect total demand
    gpApptsPerCall: calculateGPApptsPerDemandChannel(gpAppts, inboundCalls, ocClinicalSubmissions),
    totalApptsPerCall: calculateGPApptsPerDemandChannel(totalAppts, inboundCalls, ocClinicalSubmissions),

    // Rate Metrics
    dnaPct,
    dnaRate: calculateDNARate(dna, totalAppts),
    missedCallPct,

    // Mode Percentages
    faceToFacePct: totalAppts > 0 ? (faceToFace / totalAppts) * 100 : null,
    telephonePct: totalAppts > 0 ? (telephone / totalAppts) * 100 : null,
    videoPct: totalAppts > 0 ? (video / totalAppts) * 100 : null,
    homeVisitPct: totalAppts > 0 ? (homeVisit / totalAppts) * 100 : null,

    // Booking Wait Metrics
    sameDayPct,
    withinWeekPct,
    oneToSevenDaysPct,
    eightToFourteenDaysPct,
    fifteenToTwentyOneDaysPct,
    twentyTwoToTwentyEightDaysPct,
    twentyEightPlusDaysPct,
    fifteenPlusDaysPct,

    // Staff Mix
    gpPct: apptData?.staffBreakdown?.gpPct || null,
    otherStaffPct: apptData?.staffBreakdown?.otherStaffPct || null,
    gpToOtherRatio: apptData?.staffBreakdown?.gpToOtherRatio || null,

    // Raw Values (for charting)
    gpAppointments: gpAppts,
    otherAppointments: otherAppts,
    totalAppointments: totalAppts,
    answeredCalls,
    inboundCalls,
    missedCalls,
    ocSubmissions,
    dna,
    attended,
    faceToFace,
    telephone,
    video,
    homeVisit,
    sameDay,

    // Data Availability Flags
    hasTelephonyData: Boolean(telephonyData && telephonyData.inboundCalls > 0),
    hasOCData: Boolean(ocData && (ocData.submissions > 0 || ocData.totalSubmissions > 0)),
    hasAppointmentData: Boolean(apptData && totalAppts > 0),

    // Population
    population,
    listSize: apptData?.listSize || population,
  };

  return metrics;
}

/**
 * Calculate national/network averages for a set of practices
 */
export function calculateNetworkAverages(practices, metrics = null) {
  if (!practices || practices.length === 0) return null;

  const metricsToAverage = metrics || [
    'gpApptPerDayPct',
    'otherApptPerDayPct',
    'gpApptOrOCPerDayPct',
    'dnaPct',
    'faceToFacePct',
    'telephonePct',
    'sameDayPct',
    'gpPct',
    'missedCallPct',
  ];

  const averages = {};

  metricsToAverage.forEach(metric => {
    const values = practices
      .map(p => p[metric])
      .filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length > 0) {
      const sum = values.reduce((acc, v) => acc + v, 0);
      const mean = sum / values.length;
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      averages[metric] = {
        mean,
        stdDev,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }
  });

  return averages;
}

/**
 * Collect all national values for each metric into arrays for percentile calculations
 * Used for CAIP Analysis to calculate percentile position
 *
 * @param {Array} allPracticeMetrics - Array of practice metric objects
 * @returns {Object} Object with arrays for each metric key
 */
export function collectNationalMetricArrays(allPracticeMetrics) {
  if (!allPracticeMetrics || allPracticeMetrics.length === 0) {
    return {};
  }

  return {
    // Appointment & Demand metrics
    gpApptsPerCall: allPracticeMetrics.map(m => m.gpApptsPerCall).filter(v => v != null && !isNaN(v)),
    gpApptsPer1000: allPracticeMetrics.map(m => m.gpApptsPer1000).filter(v => v != null && !isNaN(v)),
    gpApptOrOCPerDayPct: allPracticeMetrics.map(m => m.gpApptOrOCPerDayPct).filter(v => v != null && !isNaN(v)),
    otherApptPerDayPct: allPracticeMetrics.map(m => m.otherApptPerDayPct).filter(v => v != null && !isNaN(v)),
    dnaPct: allPracticeMetrics.map(m => m.dnaPct).filter(v => v != null && !isNaN(v)),
    sameDayPct: allPracticeMetrics.map(m => m.sameDayPct).filter(v => v != null && !isNaN(v)),

    // Telephony metrics (only from practices with telephony data)
    inboundCallsPer1000: allPracticeMetrics
      .filter(m => m.hasTelephonyData && m.inboundCalls > 0 && m.listSize > 0)
      .map(m => (m.inboundCalls / m.listSize) * 1000)
      .filter(v => v != null && !isNaN(v)),
    answeredCallsPer1000: allPracticeMetrics
      .filter(m => m.hasTelephonyData && m.answeredCalls > 0 && m.listSize > 0)
      .map(m => (m.answeredCalls / m.listSize) * 1000)
      .filter(v => v != null && !isNaN(v)),
    missedCallsPer1000: allPracticeMetrics
      .filter(m => m.hasTelephonyData)
      .map(m => m.missedCallsPer1000)
      .filter(v => v != null && !isNaN(v)),
    missedCallPct: allPracticeMetrics
      .filter(m => m.hasTelephonyData)
      .map(m => m.missedCallPct)
      .filter(v => v != null && !isNaN(v)),

    // Online consultation metrics (only from practices with OC data)
    ocPer1000: allPracticeMetrics
      .filter(m => m.hasOCData && m.ocSubmissions > 0 && m.listSize > 0)
      .map(m => (m.ocSubmissions / m.listSize) * 1000)
      .filter(v => v != null && !isNaN(v)),
    ocMedicalPct: allPracticeMetrics
      .filter(m => m.hasOCData && m.ocSubmissions > 0)
      .map(m => m.ocClinicalSubmissions != null ? (m.ocClinicalSubmissions / m.ocSubmissions) * 100 : null)
      .filter(v => v != null && !isNaN(v)),

    // Note: Workforce metrics (patientsPerGpWte, patientsPerClinicalWte) are calculated
    // separately in NationalWorkforce component and need to be collected there
  };
}

/**
 * Detect if a value is an outlier compared to network stats
 * Uses z-score method: value is outlier if |z| > threshold
 */
export function detectOutlier(value, networkStats, threshold = 1.5) {
  if (value === null || value === undefined || !networkStats) return null;

  const { mean, stdDev } = networkStats;
  if (stdDev === 0) return { isOutlier: false, zScore: 0, direction: null };

  const zScore = (value - mean) / stdDev;
  const isOutlier = Math.abs(zScore) > threshold;

  return {
    isOutlier,
    zScore,
    direction: zScore > 0 ? 'above' : 'below',
    deviations: Math.abs(zScore),
  };
}

/**
 * Format metric value based on type
 */
export function formatMetricValue(value, format = 'number') {
  if (value === null || value === undefined) return 'N/A';

  switch (format) {
    case 'percent1':
      return `${value.toFixed(1)}%`;
    case 'percent2':
      return `${value.toFixed(2)}%`;
    case 'decimal1':
      return value.toFixed(1);
    case 'decimal2':
      return value.toFixed(2);
    case 'integer':
      return Math.round(value).toLocaleString();
    case 'ratio':
      return `${value.toFixed(2)}:1`;
    default:
      return typeof value === 'number' ? value.toLocaleString() : String(value);
  }
}

/**
 * Metric definitions with labels, formats, and interpretation
 */
export const DEMAND_CAPACITY_METRICS = [
  // Core D&C Metrics
  {
    id: 'gpApptPerDayPct',
    label: 'Patients with GP Appointment per Day (%)',
    shortLabel: 'GP/Day',
    format: 'percent2',
    higherBetter: true,
    description: 'Percentage of registered patients each working day who attended a GP appointment',
  },
  {
    id: 'gpApptOrOCPerDayPct',
    label: 'Patients with GP Appointment or Medical Online Consultation per Day (%)',
    shortLabel: 'GP+OC/Day',
    format: 'percent2',
    higherBetter: true,
    description: 'Percentage of registered patients each working day who attended a GP appointment and/or Medical Online Consultation (any outcome)',
  },
  {
    id: 'otherApptPerDayPct',
    label: 'Other Staff/Day %',
    shortLabel: 'Other/Day',
    format: 'percent2',
    higherBetter: true,
    description: 'Percentage of patients seen by other practice staff per day',
  },
  {
    id: 'gpApptsPerCall',
    label: 'GP Appts/Call',
    shortLabel: 'Appts/Call',
    format: 'decimal2',
    higherBetter: true,
    description: 'Number of GP appointments generated per answered phone call',
  },
  {
    id: 'dnaPct',
    label: 'DNA Rate',
    shortLabel: 'DNA',
    format: 'percent1',
    higherBetter: false,
    description: 'Percentage of appointments where patient did not attend',
  },
  // Appointment Mode Metrics
  {
    id: 'faceToFacePct',
    label: 'Face-to-Face %',
    shortLabel: 'F2F',
    format: 'percent1',
    higherBetter: null, // Neutral - depends on practice strategy
    description: 'Percentage of appointments delivered face-to-face',
  },
  {
    id: 'telephonePct',
    label: 'Telephone %',
    shortLabel: 'Phone',
    format: 'percent1',
    higherBetter: null,
    description: 'Percentage of appointments delivered by telephone',
  },
  {
    id: 'videoPct',
    label: 'Video %',
    shortLabel: 'Video',
    format: 'percent1',
    higherBetter: null,
    description: 'Percentage of appointments delivered by video consultation',
  },
  // Booking Metrics
  {
    id: 'sameDayPct',
    label: 'Same Day %',
    shortLabel: 'Same Day',
    format: 'percent1',
    higherBetter: true,
    description: 'Percentage of appointments booked and attended same day',
  },
  {
    id: 'withinWeekPct',
    label: 'Within Week %',
    shortLabel: '<7 Days',
    format: 'percent1',
    higherBetter: true,
    description: 'Percentage of appointments booked within 7 days',
  },
  // Staff Mix Metrics
  {
    id: 'gpPct',
    label: 'GP Share %',
    shortLabel: 'GP Share',
    format: 'percent1',
    higherBetter: null,
    description: 'Percentage of appointments delivered by GPs',
  },
  // Telephony Metrics
  {
    id: 'missedCallPct',
    label: 'Missed Call %',
    shortLabel: 'Missed',
    format: 'percent1',
    higherBetter: false,
    description: 'Percentage of inbound calls that were not answered',
  },
  // Per 1000 Metrics
  {
    id: 'gpApptsPer1000',
    label: 'GP Appts/1000',
    shortLabel: 'GP/1000',
    format: 'decimal1',
    higherBetter: true,
    description: 'GP appointments per 1000 registered patients',
  },
  {
    id: 'gpApptOrOCPer1000',
    label: 'GP+OC/1000',
    shortLabel: 'GP+OC/1000',
    format: 'decimal1',
    higherBetter: true,
    description: 'GP appointments plus online medical consultations per 1000 registered patients',
  },
  {
    id: 'totalApptsPer1000',
    label: 'Total Appts/1000',
    shortLabel: 'Appts/1000',
    format: 'decimal1',
    higherBetter: true,
    description: 'Total appointments per 1000 registered patients',
  },
];

/**
 * Get metric configuration by ID
 */
export function getMetricConfig(metricId) {
  return DEMAND_CAPACITY_METRICS.find(m => m.id === metricId) || null;
}

/**
 * Linear regression for forecasting
 */
export function linearRegression(data) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.value || 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  data.forEach((point, i) => {
    const x = i;
    const y = point.value || point;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const yMean = sumY / n;
  let ssTotal = 0, ssResidual = 0;

  data.forEach((point, i) => {
    const y = point.value || point;
    const yPredicted = slope * i + intercept;
    ssTotal += Math.pow(y - yMean, 2);
    ssResidual += Math.pow(y - yPredicted, 2);
  });

  const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

  return { slope, intercept, r2 };
}

/**
 * Forecast future values based on historical data
 */
export function forecastValues(historicalData, periodsAhead = 3) {
  if (!historicalData || historicalData.length < 3) {
    return { forecasts: [], trend: 'insufficient_data', monthlyChange: 0, r2: 0 };
  }

  const { slope, intercept, r2 } = linearRegression(historicalData);
  const n = historicalData.length;

  const forecasts = [];
  for (let i = 1; i <= periodsAhead; i++) {
    const futureIndex = n - 1 + i;
    const predicted = Math.max(0, slope * futureIndex + intercept);
    forecasts.push({
      periodOffset: i,
      value: predicted,
      confidence: r2,
    });
  }

  // Determine trend direction
  let trend = 'stable';
  if (Math.abs(slope) > 0.01) {
    trend = slope > 0 ? 'increasing' : 'decreasing';
  }

  return {
    forecasts,
    trend,
    monthlyChange: slope,
    r2,
  };
}

/**
 * Calculate combined demand index from all data sources
 * Weighted combination normalized to 100
 */
export function calculateCombinedDemandIndex(metrics, nationalAverages, weights = null) {
  const defaultWeights = {
    gpAppointments: 0.4,
    otherAppointments: 0.15,
    telephonyCalls: 0.25,
    onlineSubmissions: 0.2,
  };

  const w = weights || defaultWeights;

  // Normalize each component relative to national average (100 = average)
  const normalize = (value, avgValue) => {
    if (!avgValue || avgValue === 0) return 100;
    return (value / avgValue) * 100;
  };

  const components = {
    gpAppointments: normalize(
      metrics.gpApptsPer1000 || 0,
      nationalAverages?.gpApptsPer1000?.mean || 100
    ),
    otherAppointments: normalize(
      metrics.otherApptsPer1000 || 0,
      nationalAverages?.otherApptsPer1000?.mean || 100
    ),
    telephonyCalls: normalize(
      metrics.callsPer1000 || 0,
      nationalAverages?.callsPer1000?.mean || 100
    ),
    onlineSubmissions: normalize(
      metrics.ocSubmissions || 0,
      nationalAverages?.ocSubmissions?.mean || 100
    ),
  };

  // Weight and combine
  const index =
    components.gpAppointments * w.gpAppointments +
    components.otherAppointments * w.otherAppointments +
    (metrics.hasTelephonyData ? components.telephonyCalls * w.telephonyCalls : 0) +
    (metrics.hasOCData ? components.onlineSubmissions * w.onlineSubmissions : 0);

  // Adjust for missing data sources
  let totalWeight = w.gpAppointments + w.otherAppointments;
  if (metrics.hasTelephonyData) totalWeight += w.telephonyCalls;
  if (metrics.hasOCData) totalWeight += w.onlineSubmissions;

  return totalWeight > 0 ? index / totalWeight * 100 : 100;
}

export default {
  calculatePracticeMetrics,
  calculateNetworkAverages,
  collectNationalMetricArrays,
  detectOutlier,
  formatMetricValue,
  DEMAND_CAPACITY_METRICS,
  getMetricConfig,
  linearRegression,
  forecastValues,
  calculateCombinedDemandIndex,
  getDaysInMonth,
  calculatePatientsWithGPApptPerDay,
  calculatePatientsWithGPApptOrOCPerDay,
  calculateGPApptsPerAnsweredCall,
  calculatePer1000,
  calculateDNARate,
};
