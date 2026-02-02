/**
 * CAIP Analysis Prompt Builder
 *
 * Builds the prompt for AI analysis of GP practice demand and capacity metrics.
 * Includes helpers for calculating percentiles and trends.
 */

// Ordered list of months for trend calculations
const MONTH_ORDER = [
  'April 2024', 'May 2024', 'June 2024', 'July 2024', 'August 2024',
  'September 2024', 'October 2024', 'November 2024', 'December 2024',
  'January 2025', 'February 2025', 'March 2025', 'April 2025', 'May 2025',
  'June 2025', 'July 2025', 'August 2025', 'September 2025', 'October 2025',
  'November 2025', 'December 2025'
];

/**
 * Get the previous N months from a given month
 */
export function getPreviousMonths(currentMonth, count = 3) {
  const currentIndex = MONTH_ORDER.indexOf(currentMonth);
  if (currentIndex === -1) return [];

  const months = [];
  for (let i = 1; i <= count && currentIndex - i >= 0; i++) {
    months.push(MONTH_ORDER[currentIndex - i]);
  }
  return months;
}

/**
 * Calculate percentile position of a value within an array of values
 * @param {number} value - The value to find percentile for
 * @param {number[]} allValues - Array of all values to compare against
 * @returns {number|null} Percentile (0-100) or null if invalid
 */
export function calculatePercentile(value, allValues) {
  if (value == null || !allValues?.length) return null;

  const validValues = allValues.filter(v => v != null && !isNaN(v));
  if (validValues.length === 0) return null;

  const sorted = [...validValues].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;

  return Math.round((below / sorted.length) * 100);
}

/**
 * Calculate trend by comparing current value to 3-month rolling average
 * @param {number} currentValue - Current month's value
 * @param {number[]} historicalValues - Array of previous months' values
 * @returns {string} Trend description
 */
export function calculateTrend(currentValue, historicalValues) {
  if (currentValue == null || !historicalValues?.length) {
    return 'Insufficient data';
  }

  const validHistorical = historicalValues.filter(v => v != null && !isNaN(v));
  if (validHistorical.length < 2) {
    return 'Insufficient data';
  }

  const avg = validHistorical.reduce((a, b) => a + b, 0) / validHistorical.length;

  if (avg === 0) {
    return currentValue > 0 ? 'Increasing (from zero)' : 'Stable';
  }

  const changePercent = ((currentValue - avg) / avg) * 100;

  if (changePercent > 10) return `Increasing significantly (+${changePercent.toFixed(1)}%)`;
  if (changePercent > 5) return `Increasing (+${changePercent.toFixed(1)}%)`;
  if (changePercent < -10) return `Decreasing significantly (${changePercent.toFixed(1)}%)`;
  if (changePercent < -5) return `Decreasing (${changePercent.toFixed(1)}%)`;
  return 'Stable';
}

/**
 * Format a metric value for display in the prompt
 */
function formatValue(value, decimals = 2) {
  if (value == null || isNaN(value)) return 'N/A';
  return Number(value).toFixed(decimals);
}

/**
 * Format a percentile value for display
 */
function formatPercentile(pctl) {
  if (pctl == null) return 'N/A';
  return pctl.toString();
}

/**
 * The main prompt template with placeholders
 */
export const CAIP_ANALYSIS_PROMPT_TEMPLATE = `You are an expert UK GP primary care demand and capacity analyst.

You interpret appointment, telephony, online consultation, and workforce metrics to assess how effectively a GP practice is responding to patient demand.

Key principles:
- All metrics are benchmarked nationally using percentiles where 0 = lowest observed value and 100 = highest observed value. Percentiles indicate position, not quality.
- You must interpret metrics in combination, not in isolation.
- You must be explicit where evidence supports unmet demand or insufficient capacity.
- Do not soften conclusions unnecessarily.
- Be directive and practical: practices using this analysis want clear actions.
- Avoid clinical judgement; focus on access, operational performance, capacity, and workforce planning.
- Acknowledge uncertainty only where data availability windows materially limit interpretation.
- Where a metric shows 'N/A', acknowledge the data gap but do not let it prevent analysis of available metrics.

You must follow the interpretation rules provided in the user prompt.

Output must follow this structure exactly:

Whats working well
Room for improvement
Actions / Considerations

Analyse this GP practice's demand and capacity using the metrics and national benchmarking below.

PRACTICE CONTEXT
- Practice name: {{PRACTICE_NAME}}
- Practice list size: {{LIST_SIZE}}
- Appointment data available since: Apr 2024
- Online consultation data available since: Apr 2024
- Telephony data available since: Oct 2025
{{DATA_AVAILABILITY_NOTES}}

METRICS (each includes value and national percentile position)

APPOINTMENTS & DEMAND
- GP appointments per unit of demand
  Value={{GP_APPTS_PER_DEMAND}}, Percentile={{GP_APPTS_PER_DEMAND_PCTL}}

- GP appointments per 1000 patients
  Value={{GP_APPTS_PER_1000}}, Percentile={{GP_APPTS_PER_1000_PCTL}}

- % of patient population with a GP appointment or medical online consultation per working day (last month)
  Value={{GP_MED_OC_PCT_PER_DAY}}, Percentile={{GP_MED_OC_PCT_PER_DAY_PCTL}}

- % of patient population with a non-GP clinical appointment per working day (last month)
  Value={{NON_GP_CLINICAL_PCT_PER_DAY}}, Percentile={{NON_GP_CLINICAL_PCT_PER_DAY_PCTL}}

- DNA rate (all appointments)
  Value={{DNA_RATE_PCT}}, Percentile={{DNA_RATE_PCT_PCTL}}

- Same-day booking percentage
  Value={{SAME_DAY_BOOKING_PCT}}, Percentile={{SAME_DAY_BOOKING_PCT_PCTL}}

TELEPHONY
- Inbound calls per 1000 patients (answered + missed)
  Value={{INBOUND_CALLS_PER_1000}}, Percentile={{INBOUND_CALLS_PER_1000_PCTL}}

- Answered calls per 1000 patients
  Value={{ANSWERED_CALLS_PER_1000}}, Percentile={{ANSWERED_CALLS_PER_1000_PCTL}}

- Missed calls per 1000 patients
  Value={{MISSED_CALLS_PER_1000}}, Percentile={{MISSED_CALLS_PER_1000_PCTL}}

- Missed call rate (% of inbound calls)
  Value={{MISSED_CALL_RATE_PCT}}, Percentile={{MISSED_CALL_RATE_PCT_PCTL}}

ONLINE CONSULTATIONS
- Online consultation requests per 1000 patients
  Value={{OC_PER_1000}}, Percentile={{OC_PER_1000_PCTL}}

- % of online consultations that are medical
  Value={{OC_MEDICAL_PCT}}, Percentile={{OC_MEDICAL_PCT_PCTL}}

WORKFORCE
- Patients per GP WTE
  Value={{PATIENTS_PER_GP_WTE}}, Percentile={{PATIENTS_PER_GP_WTE_PCTL}}

- Patients per clinical WTE (all clinicians)
  Value={{PATIENTS_PER_CLINICAL_WTE}}, Percentile={{PATIENTS_PER_CLINICAL_WTE_PCTL}}

TRENDS (direction and scale over time; interpret cautiously where telephony data is shorter)
- GP appointments per demand: {{TREND_GP_APPTS_PER_DEMAND}}
- GP appointments per 1000 patients: {{TREND_GP_APPTS_PER_1000}}
- % population with GP appt or medical OC per day: {{TREND_GP_MED_OC_PCT_PER_DAY}}
- Non-GP clinical activity per day: {{TREND_NON_GP_CLINICAL_PCT_PER_DAY}}
- DNA rate: {{TREND_DNA_RATE_PCT}}
- Same-day booking %: {{TREND_SAME_DAY_BOOKING_PCT}}
- Inbound calls per 1000: {{TREND_INBOUND_CALLS_PER_1000}}
- Missed call rate: {{TREND_MISSED_CALL_RATE_PCT}}
- Online consultation rate: {{TREND_OC_PER_1000}}
- Patients per GP WTE: {{TREND_PATIENTS_PER_GP_WTE}}
- Patients per clinical WTE: {{TREND_PATIENTS_PER_CLINICAL_WTE}}

INTERPRETATION RULES (MANDATORY)
You must interpret demand and capacity holistically, using all metrics together.

General principles:
- No single metric is sufficient to determine performance.
- Metrics modify the meaning of each other and must be interpreted as a system.
- Percentiles represent national position only; they are not inherently good or bad.
- Where multiple metrics point in the same direction, conclusions should be firm.
- Where signals conflict, explain the tension and state the most likely explanation.

Demand interpretation:
- Use inbound calls, online consultation volume, and % medical OCs together to assess true population demand.
- Do not treat low activity as low demand without corroborating demand signals.
- Rising demand with flat or falling activity should be interpreted as emerging or unmet demand.

Capacity interpretation:
- Assess GP capacity using GP appointments per demand, GP appointments per 1000 patients, and patients per GP WTE together.
- Low GP appointments per demand combined with low GP appointments per 1000 patients indicates insufficient GP capacity.
- Evaluate whether non-GP clinical activity meaningfully compensates for constrained GP capacity.

Access and friction:
- Use missed call rate, missed calls per 1000, DNA rate, and same-day booking percentage to identify access bottlenecks.
- High same-day booking must be interpreted cautiously; when combined with high missed calls it may indicate reactive or callback-driven access rather than good responsiveness.
- High DNA rates should be interpreted in the context of booking delay and access model.

Balance and resilience:
- Assess whether the practice is overly reliant on a single channel (telephony, online, or GP-only).
- Identify signs of system strain, such as rising demand, high workforce stretch, and declining conversion of demand into activity.
- Where substitution is present, assess whether it is sufficient or masking underlying capacity gaps.

Trends and confidence:
- Use trends to validate or challenge single-period findings.
- Acknowledge limitations where telephony data is more recent, but do not avoid conclusions if multiple signals align.
- Clearly distinguish between short-term volatility and sustained structural issues.

Tone and actions:
- Be direct and outcome-focused.
- Where evidence supports it, explicitly state unmet demand, insufficient capacity, or access bottlenecks.
- Actions should align with the dominant system issue (capacity, access design, workforce balance, or demand management).

OUTPUT REQUIREMENTS
- Use the exact headings:
  Whats working well
  Room for improvement
  Actions / Considerations
- Reference specific metrics and percentile positions to support conclusions.
- Avoid generic advice; actions should clearly link to the identified issues.
`;

/**
 * Build the complete CAIP analysis prompt with all metrics filled in
 *
 * @param {Object} params
 * @param {string} params.practiceName - Name of the practice
 * @param {number} params.listSize - Practice list size
 * @param {Object} params.metrics - Current month metrics object
 * @param {Object} params.nationalArrays - Object with arrays of all national values for each metric
 * @param {Object} params.historicalMetrics - Object with arrays of historical values for each metric key
 * @param {Object} params.workforceMetrics - Workforce metrics (optional)
 * @param {boolean} params.hasTelephonyData - Whether telephony data is available
 * @param {boolean} params.hasOCData - Whether online consultation data is available
 * @param {boolean} params.hasWorkforceData - Whether workforce data is available
 * @returns {string} The complete prompt with all placeholders filled
 */
export function buildCAIPAnalysisPrompt({
  practiceName,
  listSize,
  metrics,
  nationalArrays,
  historicalMetrics,
  workforceMetrics,
  hasTelephonyData = true,
  hasOCData = true,
  hasWorkforceData = false,
}) {
  let prompt = CAIP_ANALYSIS_PROMPT_TEMPLATE;

  // Build data availability notes
  const availabilityNotes = [];
  if (!hasTelephonyData) {
    availabilityNotes.push('- Note: Telephony data is not available for this practice');
  }
  if (!hasOCData) {
    availabilityNotes.push('- Note: Online consultation data is not available for this practice');
  }
  if (!hasWorkforceData) {
    availabilityNotes.push('- Note: Workforce data is not available for this practice');
  }

  // Replace basic context
  prompt = prompt.replace('{{PRACTICE_NAME}}', practiceName || 'Unknown Practice');
  prompt = prompt.replace('{{LIST_SIZE}}', listSize?.toLocaleString() || 'Unknown');
  prompt = prompt.replace('{{DATA_AVAILABILITY_NOTES}}', availabilityNotes.join('\n'));

  // Calculate and replace appointment & demand metrics
  const gpApptsPerDemand = metrics?.gpApptsPerCall;
  prompt = prompt.replace('{{GP_APPTS_PER_DEMAND}}', formatValue(gpApptsPerDemand));
  prompt = prompt.replace('{{GP_APPTS_PER_DEMAND_PCTL}}',
    formatPercentile(calculatePercentile(gpApptsPerDemand, nationalArrays?.gpApptsPerCall)));

  const gpApptsPer1000 = metrics?.gpApptsPer1000;
  prompt = prompt.replace('{{GP_APPTS_PER_1000}}', formatValue(gpApptsPer1000));
  prompt = prompt.replace('{{GP_APPTS_PER_1000_PCTL}}',
    formatPercentile(calculatePercentile(gpApptsPer1000, nationalArrays?.gpApptsPer1000)));

  const gpMedOcPctPerDay = metrics?.gpApptOrOCPerDayPct;
  prompt = prompt.replace('{{GP_MED_OC_PCT_PER_DAY}}', formatValue(gpMedOcPctPerDay));
  prompt = prompt.replace('{{GP_MED_OC_PCT_PER_DAY_PCTL}}',
    formatPercentile(calculatePercentile(gpMedOcPctPerDay, nationalArrays?.gpApptOrOCPerDayPct)));

  const nonGpClinicalPctPerDay = metrics?.otherApptPerDayPct;
  prompt = prompt.replace('{{NON_GP_CLINICAL_PCT_PER_DAY}}', formatValue(nonGpClinicalPctPerDay));
  prompt = prompt.replace('{{NON_GP_CLINICAL_PCT_PER_DAY_PCTL}}',
    formatPercentile(calculatePercentile(nonGpClinicalPctPerDay, nationalArrays?.otherApptPerDayPct)));

  const dnaRatePct = metrics?.dnaPct;
  prompt = prompt.replace('{{DNA_RATE_PCT}}', formatValue(dnaRatePct));
  prompt = prompt.replace('{{DNA_RATE_PCT_PCTL}}',
    formatPercentile(calculatePercentile(dnaRatePct, nationalArrays?.dnaPct)));

  const sameDayBookingPct = metrics?.sameDayPct;
  prompt = prompt.replace('{{SAME_DAY_BOOKING_PCT}}', formatValue(sameDayBookingPct));
  prompt = prompt.replace('{{SAME_DAY_BOOKING_PCT_PCTL}}',
    formatPercentile(calculatePercentile(sameDayBookingPct, nationalArrays?.sameDayPct)));

  // Calculate and replace telephony metrics
  if (hasTelephonyData && metrics?.inboundCalls && listSize) {
    const inboundCallsPer1000 = (metrics.inboundCalls / listSize) * 1000;
    prompt = prompt.replace('{{INBOUND_CALLS_PER_1000}}', formatValue(inboundCallsPer1000));
    prompt = prompt.replace('{{INBOUND_CALLS_PER_1000_PCTL}}',
      formatPercentile(calculatePercentile(inboundCallsPer1000, nationalArrays?.inboundCallsPer1000)));

    const answeredCallsPer1000 = (metrics.answeredCalls / listSize) * 1000;
    prompt = prompt.replace('{{ANSWERED_CALLS_PER_1000}}', formatValue(answeredCallsPer1000));
    prompt = prompt.replace('{{ANSWERED_CALLS_PER_1000_PCTL}}',
      formatPercentile(calculatePercentile(answeredCallsPer1000, nationalArrays?.answeredCallsPer1000)));
  } else {
    prompt = prompt.replace('{{INBOUND_CALLS_PER_1000}}', 'N/A');
    prompt = prompt.replace('{{INBOUND_CALLS_PER_1000_PCTL}}', 'N/A');
    prompt = prompt.replace('{{ANSWERED_CALLS_PER_1000}}', 'N/A');
    prompt = prompt.replace('{{ANSWERED_CALLS_PER_1000_PCTL}}', 'N/A');
  }

  const missedCallsPer1000 = metrics?.missedCallsPer1000;
  prompt = prompt.replace('{{MISSED_CALLS_PER_1000}}',
    hasTelephonyData ? formatValue(missedCallsPer1000) : 'N/A');
  prompt = prompt.replace('{{MISSED_CALLS_PER_1000_PCTL}}',
    hasTelephonyData ? formatPercentile(calculatePercentile(missedCallsPer1000, nationalArrays?.missedCallsPer1000)) : 'N/A');

  const missedCallRatePct = metrics?.missedCallPct;
  prompt = prompt.replace('{{MISSED_CALL_RATE_PCT}}',
    hasTelephonyData ? formatValue(missedCallRatePct) : 'N/A');
  prompt = prompt.replace('{{MISSED_CALL_RATE_PCT_PCTL}}',
    hasTelephonyData ? formatPercentile(calculatePercentile(missedCallRatePct, nationalArrays?.missedCallPct)) : 'N/A');

  // Calculate and replace online consultation metrics
  if (hasOCData && metrics?.ocSubmissions && listSize) {
    const ocPer1000 = (metrics.ocSubmissions / listSize) * 1000;
    prompt = prompt.replace('{{OC_PER_1000}}', formatValue(ocPer1000));
    prompt = prompt.replace('{{OC_PER_1000_PCTL}}',
      formatPercentile(calculatePercentile(ocPer1000, nationalArrays?.ocPer1000)));

    const ocMedicalPct = metrics.ocSubmissions > 0
      ? ((metrics.ocClinicalSubmissions || 0) / metrics.ocSubmissions) * 100
      : null;
    prompt = prompt.replace('{{OC_MEDICAL_PCT}}', formatValue(ocMedicalPct));
    prompt = prompt.replace('{{OC_MEDICAL_PCT_PCTL}}',
      formatPercentile(calculatePercentile(ocMedicalPct, nationalArrays?.ocMedicalPct)));
  } else {
    prompt = prompt.replace('{{OC_PER_1000}}', 'N/A');
    prompt = prompt.replace('{{OC_PER_1000_PCTL}}', 'N/A');
    prompt = prompt.replace('{{OC_MEDICAL_PCT}}', 'N/A');
    prompt = prompt.replace('{{OC_MEDICAL_PCT_PCTL}}', 'N/A');
  }

  // Calculate and replace workforce metrics
  if (hasWorkforceData && workforceMetrics) {
    const patientsPerGpWte = workforceMetrics.patientsPerGpWte;
    prompt = prompt.replace('{{PATIENTS_PER_GP_WTE}}', formatValue(patientsPerGpWte, 0));
    prompt = prompt.replace('{{PATIENTS_PER_GP_WTE_PCTL}}',
      formatPercentile(calculatePercentile(patientsPerGpWte, nationalArrays?.patientsPerGpWte)));

    const patientsPerClinicalWte = workforceMetrics.patientsPerClinicalWte;
    prompt = prompt.replace('{{PATIENTS_PER_CLINICAL_WTE}}', formatValue(patientsPerClinicalWte, 0));
    prompt = prompt.replace('{{PATIENTS_PER_CLINICAL_WTE_PCTL}}',
      formatPercentile(calculatePercentile(patientsPerClinicalWte, nationalArrays?.patientsPerClinicalWte)));
  } else {
    prompt = prompt.replace('{{PATIENTS_PER_GP_WTE}}', 'N/A');
    prompt = prompt.replace('{{PATIENTS_PER_GP_WTE_PCTL}}', 'N/A');
    prompt = prompt.replace('{{PATIENTS_PER_CLINICAL_WTE}}', 'N/A');
    prompt = prompt.replace('{{PATIENTS_PER_CLINICAL_WTE_PCTL}}', 'N/A');
  }

  // Calculate and replace trend values
  prompt = prompt.replace('{{TREND_GP_APPTS_PER_DEMAND}}',
    calculateTrend(gpApptsPerDemand, historicalMetrics?.gpApptsPerCall));
  prompt = prompt.replace('{{TREND_GP_APPTS_PER_1000}}',
    calculateTrend(gpApptsPer1000, historicalMetrics?.gpApptsPer1000));
  prompt = prompt.replace('{{TREND_GP_MED_OC_PCT_PER_DAY}}',
    calculateTrend(gpMedOcPctPerDay, historicalMetrics?.gpApptOrOCPerDayPct));
  prompt = prompt.replace('{{TREND_NON_GP_CLINICAL_PCT_PER_DAY}}',
    calculateTrend(nonGpClinicalPctPerDay, historicalMetrics?.otherApptPerDayPct));
  prompt = prompt.replace('{{TREND_DNA_RATE_PCT}}',
    calculateTrend(dnaRatePct, historicalMetrics?.dnaPct));
  prompt = prompt.replace('{{TREND_SAME_DAY_BOOKING_PCT}}',
    calculateTrend(sameDayBookingPct, historicalMetrics?.sameDayPct));

  // Telephony trends
  if (hasTelephonyData) {
    const inboundCallsPer1000 = metrics?.inboundCalls && listSize
      ? (metrics.inboundCalls / listSize) * 1000
      : null;
    prompt = prompt.replace('{{TREND_INBOUND_CALLS_PER_1000}}',
      calculateTrend(inboundCallsPer1000, historicalMetrics?.inboundCallsPer1000));
    prompt = prompt.replace('{{TREND_MISSED_CALL_RATE_PCT}}',
      calculateTrend(missedCallRatePct, historicalMetrics?.missedCallPct));
  } else {
    prompt = prompt.replace('{{TREND_INBOUND_CALLS_PER_1000}}', 'Insufficient data (telephony data limited)');
    prompt = prompt.replace('{{TREND_MISSED_CALL_RATE_PCT}}', 'Insufficient data (telephony data limited)');
  }

  // OC trends
  if (hasOCData) {
    const ocPer1000 = metrics?.ocSubmissions && listSize
      ? (metrics.ocSubmissions / listSize) * 1000
      : null;
    prompt = prompt.replace('{{TREND_OC_PER_1000}}',
      calculateTrend(ocPer1000, historicalMetrics?.ocPer1000));
  } else {
    prompt = prompt.replace('{{TREND_OC_PER_1000}}', 'Insufficient data');
  }

  // Workforce trends
  if (hasWorkforceData && workforceMetrics) {
    prompt = prompt.replace('{{TREND_PATIENTS_PER_GP_WTE}}',
      calculateTrend(workforceMetrics.patientsPerGpWte, historicalMetrics?.patientsPerGpWte));
    prompt = prompt.replace('{{TREND_PATIENTS_PER_CLINICAL_WTE}}',
      calculateTrend(workforceMetrics.patientsPerClinicalWte, historicalMetrics?.patientsPerClinicalWte));
  } else {
    prompt = prompt.replace('{{TREND_PATIENTS_PER_GP_WTE}}', 'Insufficient data');
    prompt = prompt.replace('{{TREND_PATIENTS_PER_CLINICAL_WTE}}', 'Insufficient data');
  }

  return prompt;
}

export default {
  buildCAIPAnalysisPrompt,
  calculatePercentile,
  calculateTrend,
  getPreviousMonths,
  CAIP_ANALYSIS_PROMPT_TEMPLATE,
};
