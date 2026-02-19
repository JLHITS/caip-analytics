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
 * SYSTEM prompt - static instructions and interpretation rules (cacheable by OpenAI)
 * This stays identical across all requests to maximize prompt cache hits.
 */
export const CAIP_SYSTEM_PROMPT = `You are an expert UK GP primary care demand and capacity analyst.

You interpret appointment, telephony, online consultation, and workforce metrics to assess how effectively a GP practice is responding to patient demand.

Key principles:
- All metrics are benchmarked nationally using percentiles where 0 = lowest observed value and 100 = highest observed value. Percentiles indicate position, not quality.
- You must interpret metrics in combination, not in isolation.
- You must be explicit where evidence supports unmet demand or insufficient capacity.
- Do not soften conclusions unnecessarily.
- Be directive and practical: practices using this analysis want clear actions they can take.
- Avoid clinical judgement; focus on access, operational performance, capacity, and workforce planning.
- Where a metric shows 'N/A', acknowledge the data gap but do not let it prevent analysis of available metrics.
- CRITICAL: Data availability limitations (e.g., telephony data only from Oct 2025) are national NHS Digital constraints, NOT practice issues. Never suggest actions related to data availability - focus only on actionable operational improvements within the practice's control.
- If trend data shows "Insufficient data", this means historical comparison data is limited - acknowledge briefly but focus analysis on the current snapshot metrics available.

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
- CRITICAL: Low same-day booking percentage is NOT automatically a concern. It must be interpreted alongside other access metrics to determine if it reflects unmet demand or patient choice.

Balance and resilience:
- Assess whether the practice is overly reliant on a single channel (telephony, online, or GP-only).
- Identify signs of system strain, such as rising demand, high workforce stretch, and declining conversion of demand into activity.
- Where substitution is present, assess whether it is sufficient or masking underlying capacity gaps.

Practice model interpretation:
- Compare "GP appointments per day (GP-only)" with "GP + Medical OC per day (combined)" to understand the practice's access model.
- If Medical OC contribution < 10%: Traditional model - interpret GP appointment volumes and same-day booking as primary access indicators.
- If Medical OC contribution 10-30%: Hybrid model - consider both GP and OC metrics together when assessing capacity.
- If Medical OC contribution > 30%: Total Triage model - lower GP appointment volumes may indicate effective triage rather than capacity issues. Demand is being resolved at the triage layer before requiring a GP appointment.

Same-day booking interpretation (CRITICAL - context dependent):
- Low same-day booking % is ONLY a concern when accompanied by signs of unmet demand.
- Signs of unmet demand: high missed call rate, high missed calls per 1000, high DNA rate, low GP appointments per demand, or patients struggling to access care.
- Signs that low same-day % reflects PATIENT CHOICE (positive): low missed call rate, low DNA rate, good conversion of demand to appointments, adequate workforce capacity. In this scenario, patients have good access and choose to book appointments at times that suit their schedules rather than being forced into same-day slots.
- Traditional model with good access metrics (low missed calls, low DNA): Low same-day % likely reflects patient choice and distributed booking - NOT a capacity concern. Do not recommend increasing same-day capacity if other access metrics are strong.
- Traditional model with poor access metrics (high missed calls, high DNA): Low same-day % may indicate genuine capacity constraints for acute demand - this IS a concern.
- Total Triage model: Low same-day may be acceptable if demand is resolved at triage without requiring appointments.

GP appointment volume interpretation by practice model:
- Traditional model: Lower GP/1000 indicates potential capacity constraints.
- Total Triage model: Lower GP/1000 combined with high Medical OC contribution is POSITIVE - indicates effective demand resolution at triage layer before needing GP time. Do not interpret this as a capacity issue.

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
 * USER prompt template - practice-specific data (dynamic per request)
 */
export const CAIP_USER_PROMPT_TEMPLATE = `Analyse this GP practice's demand and capacity using the metrics and national benchmarking below.

PRACTICE CONTEXT
- Practice name: {{PRACTICE_NAME}}
- Practice list size: {{LIST_SIZE}}

DATA AVAILABILITY (national NHS Digital publication dates - NOT practice controllable):
- Appointment data: available from Apr 2024
- Online consultation data: available from Apr 2024
- Telephony data: available from Oct 2025 (NHS Digital only began publishing GP telephony data nationally from this date)
- Workforce data: monthly snapshots

Note: Data availability limitations are due to national NHS Digital publication schedules. Do NOT include data availability gaps as actions or recommendations - practices cannot control when NHS Digital publishes national datasets.
{{DATA_AVAILABILITY_NOTES}}

METRICS (each includes value and national percentile position)

APPOINTMENTS & DEMAND
- GP appointments per unit of demand
  Value={{GP_APPTS_PER_DEMAND}}, Percentile={{GP_APPTS_PER_DEMAND_PCTL}}

- GP appointments per 1000 patients
  Value={{GP_APPTS_PER_1000}}, Percentile={{GP_APPTS_PER_1000_PCTL}}

- % of patient population with a GP appointment or medical online consultation per working day (last month)
  Value={{GP_MED_OC_PCT_PER_DAY}}, Percentile={{GP_MED_OC_PCT_PER_DAY_PCTL}}

- % of patient population with a GP appointment per working day (EXCLUDING medical online consultations)
  Value={{GP_APPT_PCT_PER_DAY}}, Percentile={{GP_APPT_PCT_PER_DAY_PCTL}}

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

PRACTICE MODEL CONTEXT
- Estimated practice model: {{PRACTICE_MODEL_TYPE}}
- Medical OC contribution over GP-only: {{MEDICAL_OC_CONTRIBUTION_PCT}}%
- Interpretation: {{PRACTICE_MODEL_DESCRIPTION}}

TRENDS (direction and scale over time; interpret cautiously where telephony data is shorter)
- GP appointments per demand: {{TREND_GP_APPTS_PER_DEMAND}}
- GP appointments per 1000 patients: {{TREND_GP_APPTS_PER_1000}}
- % population with GP appt per day (GP only): {{TREND_GP_APPT_PCT_PER_DAY}}
- % population with GP appt or medical OC per day: {{TREND_GP_MED_OC_PCT_PER_DAY}}
- Non-GP clinical activity per day: {{TREND_NON_GP_CLINICAL_PCT_PER_DAY}}
- DNA rate: {{TREND_DNA_RATE_PCT}}
- Same-day booking %: {{TREND_SAME_DAY_BOOKING_PCT}}
- Inbound calls per 1000: {{TREND_INBOUND_CALLS_PER_1000}}
- Missed call rate: {{TREND_MISSED_CALL_RATE_PCT}}
- Online consultation rate: {{TREND_OC_PER_1000}}
- Patients per GP WTE: {{TREND_PATIENTS_PER_GP_WTE}}
- Patients per clinical WTE: {{TREND_PATIENTS_PER_CLINICAL_WTE}}
`;

/**
 * Legacy combined template (kept for backwards compatibility with App.jsx local analysis)
 */
export const CAIP_ANALYSIS_PROMPT_TEMPLATE = CAIP_SYSTEM_PROMPT + '\n' + CAIP_USER_PROMPT_TEMPLATE;

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
/**
 * Build the user prompt portion with practice-specific data filled in
 */
export function buildCAIPUserPrompt({
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
  let prompt = CAIP_USER_PROMPT_TEMPLATE;

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

  // GP-only metric (excluding medical online consultations)
  const gpApptPctPerDay = metrics?.gpApptPerDayPct;
  prompt = prompt.replace('{{GP_APPT_PCT_PER_DAY}}', formatValue(gpApptPctPerDay));
  prompt = prompt.replace('{{GP_APPT_PCT_PER_DAY_PCTL}}',
    formatPercentile(calculatePercentile(gpApptPctPerDay, nationalArrays?.gpApptPerDayPct)));

  // Calculate Practice Model Context
  // Medical OC contribution = % increase from medical OC over GP-only appointments
  const medicalOCContributionPct = gpApptPctPerDay > 0 && gpMedOcPctPerDay > 0
    ? ((gpMedOcPctPerDay - gpApptPctPerDay) / gpApptPctPerDay) * 100
    : null;

  // Determine practice model type based on thresholds
  let practiceModelType = 'Unknown';
  let practiceModelDescription = 'Unable to determine practice model (insufficient data)';

  if (medicalOCContributionPct !== null) {
    if (medicalOCContributionPct < 10) {
      practiceModelType = 'Traditional';
      practiceModelDescription = 'Most patient demand is handled through direct GP appointments. Interpret same-day booking and GP volumes as primary access indicators.';
    } else if (medicalOCContributionPct < 30) {
      practiceModelType = 'Hybrid/Transitional';
      practiceModelDescription = 'Practice uses some online consultation triage. Consider both GP appointments and Medical OC when assessing capacity.';
    } else {
      practiceModelType = 'Total Triage';
      practiceModelDescription = 'Significant demand is managed through medical online consultations before requiring GP time. Lower GP appointment volumes may indicate effective triage rather than capacity issues. Same-day booking should be interpreted in context of triage model.';
    }
  }

  prompt = prompt.replace('{{PRACTICE_MODEL_TYPE}}', practiceModelType);
  prompt = prompt.replace('{{MEDICAL_OC_CONTRIBUTION_PCT}}', medicalOCContributionPct !== null ? medicalOCContributionPct.toFixed(1) : 'N/A');
  prompt = prompt.replace('{{PRACTICE_MODEL_DESCRIPTION}}', practiceModelDescription);

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
  prompt = prompt.replace('{{TREND_GP_APPT_PCT_PER_DAY}}',
    calculateTrend(gpApptPctPerDay, historicalMetrics?.gpApptPerDayPct));
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

/**
 * Build both system and user prompts for OpenAI (split for prompt caching)
 * System prompt is static and will be cached by OpenAI across requests.
 */
export function buildCAIPPrompts(params) {
  return {
    systemPrompt: CAIP_SYSTEM_PROMPT,
    userPrompt: buildCAIPUserPrompt(params),
  };
}

/**
 * Legacy: Build the complete combined prompt (used by App.jsx local analysis)
 */
export function buildCAIPAnalysisPrompt(params) {
  const { systemPrompt, userPrompt } = buildCAIPPrompts(params);
  return systemPrompt + '\n' + userPrompt;
}

export default {
  buildCAIPAnalysisPrompt,
  buildCAIPPrompts,
  buildCAIPUserPrompt,
  calculatePercentile,
  calculateTrend,
  getPreviousMonths,
  CAIP_SYSTEM_PROMPT,
  CAIP_USER_PROMPT_TEMPLATE,
};
