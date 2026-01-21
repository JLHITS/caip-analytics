/**
 * SystmConnect Data Parser
 * Parses TPP SystmOne SystmConnect extract files
 */
import * as XLSX from 'xlsx';

// Expected columns for SystmConnect extracts
const EXPECTED_COLUMNS = [
  'ID', 'ODS Code', 'Submitted', 'Access method', 'Submission source',
  'Patient name', 'Age', 'Sex', 'Submission started', 'Submission completed',
  'Type', 'Clinical problem type', 'Admin activity type', 'Response preference',
  'Outcome', 'Outcome recorded'
];

// Default outcome grouping rules
export const DEFAULT_OUTCOME_GROUPS = {
  'Appointment': {
    keywords: ['appointment', 'appt', 'booked', 'offered', 'face to face', 'f2f', 'telephone', 'video', 'same day', 'routine', 'embargo', 'home visit', 'continuity', 'extended hours', 'nurse', 'pharmacist', 'physio', 'paramedic', 'gp'],
    color: '#22c55e',
  },
  'Advice / Self-care': {
    keywords: ['advice', 'self care', 'self-care', 'information', 'reassurance'],
    color: '#3b82f6',
  },
  'Prescription / Meds': {
    keywords: ['prescription', 'medication', 'repeat', 'issued', 'rx', 'meds'],
    color: '#8b5cf6',
  },
  'Signposting / Redirect': {
    keywords: ['signposting', 'signpost', 'pharmacy first', 'redirect', 'other service', 'refer to'],
    color: '#f59e0b',
  },
  'Tests / Results / Admin': {
    keywords: ['test', 'result', 'ice', 'blood', 'letter', 'fit note', 'med3', 'sick note', 'report'],
    color: '#06b6d4',
  },
  'No action required': {
    keywords: ['no response required', 'no action', 'resolved', 'self-resolved'],
    color: '#64748b',
  },
  'Timed out / No response': {
    keywords: ['timed out', 'no response', 'expired', 'not responded'],
    color: '#ef4444',
  },
  'Inappropriate / Rejected': {
    keywords: ['inappropriate', 'duplicate', 'spam', 'rejected', 'invalid'],
    color: '#dc2626',
  },
  'Referral': {
    keywords: ['referral', 'referred', '2ww', 'urgent referral'],
    color: '#ec4899',
  },
  'Other / Unknown': {
    keywords: [],
    color: '#94a3b8',
    isDefault: true,
  },
};

// Appointment subtypes for capacity planning
export const APPOINTMENT_SUBTYPES = {
  'F2F Same Day': ['face to face same day', 'f2f same day', 'same day face'],
  'F2F Routine': ['face to face routine', 'f2f routine', 'routine face'],
  'Telephone Same Day': ['telephone same day', 'phone same day'],
  'Telephone Routine': ['telephone routine', 'phone routine'],
  'Video': ['video'],
  'Home Visit': ['home visit', 'visit'],
  'Extended Hours': ['extended hours', 'extended access'],
  'Continuity': ['continuity', 'usual gp'],
  'Nurse': ['nurse'],
  'Pharmacist': ['pharmacist', 'pharmacy'],
  'Physio': ['physio', 'physiotherapist'],
  'Other Appointment': [],
};

// Age bands for demographic analysis
export const AGE_BANDS = [
  { label: '0-4', min: 0, max: 4 },
  { label: '5-17', min: 5, max: 17 },
  { label: '18-24', min: 18, max: 24 },
  { label: '25-44', min: 25, max: 44 },
  { label: '45-64', min: 45, max: 64 },
  { label: '65-74', min: 65, max: 74 },
  { label: '75+', min: 75, max: 999 },
];

/**
 * Parse mixed date formats (e.g., "15/01/2026 07:40" and "20 Jan 2026 11:02")
 */
export const parseFlexibleDate = (value) => {
  if (!value) return null;

  // If already a Date
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // If Excel serial number
  if (typeof value === 'number') {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const date = new Date(utcValue * 1000);

    // Handle time fraction
    const timeFraction = value - Math.floor(value);
    if (timeFraction > 0) {
      const totalMinutes = Math.round(timeFraction * 24 * 60);
      date.setUTCHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    }
    return date;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Try DD/MM/YYYY HH:mm format
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})?$/);
  if (slashMatch) {
    const [, day, month, year, hours, minutes = '0'] = slashMatch;
    return new Date(year, month - 1, day, hours, minutes);
  }

  // Try DD/MM/YYYY format (no time)
  const slashDateOnly = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateOnly) {
    const [, day, month, year] = slashDateOnly;
    return new Date(year, month - 1, day);
  }

  // Try "20 Jan 2026 11:02" format
  const textMatch = str.match(/^(\d{1,2})\s+(\w{3,})\s+(\d{4})\s*(\d{1,2})?:?(\d{2})?$/);
  if (textMatch) {
    const [, day, monthName, year, hours = '0', minutes = '0'] = textMatch;
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthMap[monthName.toLowerCase().substring(0, 3)];
    if (month !== undefined) {
      return new Date(year, month, day, hours, minutes);
    }
  }

  // Try ISO format or native parsing
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Get age band for a given age
 */
export const getAgeBand = (age) => {
  if (age === null || age === undefined || isNaN(age)) return 'Unknown';
  const band = AGE_BANDS.find(b => age >= b.min && age <= b.max);
  return band ? band.label : 'Unknown';
};

/**
 * Classify outcome into an outcome group
 */
export const classifyOutcome = (outcome, customMapping = {}) => {
  if (!outcome) return 'Other / Unknown';

  const lowerOutcome = outcome.toLowerCase().trim();

  // Check custom mapping first
  if (customMapping[lowerOutcome]) {
    return customMapping[lowerOutcome];
  }

  // Check each group's keywords
  for (const [groupName, config] of Object.entries(DEFAULT_OUTCOME_GROUPS)) {
    if (config.isDefault) continue;
    if (config.keywords.some(kw => lowerOutcome.includes(kw))) {
      return groupName;
    }
  }

  return 'Other / Unknown';
};

/**
 * Classify appointment into a subtype
 */
export const classifyAppointmentSubtype = (outcome) => {
  if (!outcome) return 'Other Appointment';

  const lowerOutcome = outcome.toLowerCase().trim();

  for (const [subtype, keywords] of Object.entries(APPOINTMENT_SUBTYPES)) {
    if (keywords.length === 0) continue;
    if (keywords.some(kw => lowerOutcome.includes(kw))) {
      return subtype;
    }
  }

  return 'Other Appointment';
};

/**
 * Validate SystmConnect file headers
 */
export const validateSystmConnectHeaders = (headers) => {
  const normalizedHeaders = headers.map(h => String(h || '').trim().toLowerCase());
  const expectedNormalized = EXPECTED_COLUMNS.map(h => h.toLowerCase());

  // Check if at least 60% of expected headers are present
  let matchCount = 0;
  for (const expected of expectedNormalized) {
    if (normalizedHeaders.some(h => h.includes(expected) || expected.includes(h))) {
      matchCount++;
    }
  }

  return matchCount / expectedNormalized.length >= 0.6;
};

/**
 * Parse SystmConnect data from workbook
 */
export const parseSystmConnectData = (workbook, customOutcomeMapping = {}) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 2) {
    throw new Error('File contains no data rows');
  }

  const headers = data[0];
  if (!validateSystmConnectHeaders(headers)) {
    throw new Error('File format does not match SystmConnect extract. Please ensure you are uploading the correct file.');
  }

  // Find column indices (case-insensitive, partial match)
  const findCol = (name) => headers.findIndex(h =>
    String(h || '').toLowerCase().includes(name.toLowerCase())
  );

  const cols = {
    id: findCol('id'),
    odsCode: findCol('ods code'),
    submitted: findCol('submitted'),
    accessMethod: findCol('access method'),
    submissionSource: findCol('submission source'),
    patientName: findCol('patient name'),
    age: findCol('age'),
    sex: findCol('sex'),
    submissionStarted: findCol('submission started'),
    submissionCompleted: findCol('submission completed'),
    type: findCol('type'),
    clinicalProblemType: findCol('clinical problem type'),
    adminActivityType: findCol('admin activity type'),
    responsePreference: findCol('response preference'),
    outcome: findCol('outcome'),
    outcomeRecorded: findCol('outcome recorded'),
  };

  const rows = [];
  const dataQuality = {
    totalRows: 0,
    missingDates: 0,
    invalidDurations: 0,
    missingOutcomes: 0,
    missingType: 0,
    unparsedDates: 0,
  };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every(cell => !cell)) continue;

    dataQuality.totalRows++;

    const submittedDt = parseFlexibleDate(row[cols.submitted]);
    const startedDt = parseFlexibleDate(row[cols.submissionStarted]);
    const completedDt = parseFlexibleDate(row[cols.submissionCompleted]);
    const outcomeRecordedDt = parseFlexibleDate(row[cols.outcomeRecorded]);

    if (!submittedDt) dataQuality.missingDates++;

    const type = String(row[cols.type] || '').trim();
    if (!type) dataQuality.missingType++;

    const outcome = row[cols.outcome] ? String(row[cols.outcome]).trim() : null;
    if (!outcome) dataQuality.missingOutcomes++;

    const age = parseInt(row[cols.age]);
    const ageBand = getAgeBand(age);

    // Calculate durations
    let leadTimeMinutes = null;
    if (startedDt && completedDt) {
      leadTimeMinutes = (completedDt - startedDt) / (1000 * 60);
      if (leadTimeMinutes < 0) {
        dataQuality.invalidDurations++;
        leadTimeMinutes = null;
      }
    }

    let timeToOutcomeMinutes = null;
    if (completedDt && outcomeRecordedDt) {
      timeToOutcomeMinutes = (outcomeRecordedDt - completedDt) / (1000 * 60);
      if (timeToOutcomeMinutes < 0) {
        dataQuality.invalidDurations++;
        timeToOutcomeMinutes = null;
      }
    }

    // Classify outcome
    const outcomeGroup = classifyOutcome(outcome, customOutcomeMapping);
    const isAppointment = outcomeGroup === 'Appointment';
    const appointmentSubtype = isAppointment ? classifyAppointmentSubtype(outcome) : null;

    // Day of week and hour
    const dow = submittedDt ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][submittedDt.getDay()] : null;
    const hourOfDay = submittedDt ? submittedDt.getHours() : null;
    const isWeekend = dow === 'Saturday' || dow === 'Sunday';

    rows.push({
      // Don't store ID or patient name for privacy
      odsCode: String(row[cols.odsCode] || '').trim(),
      submittedDt,
      startedDt,
      completedDt,
      outcomeRecordedDt,
      accessMethod: String(row[cols.accessMethod] || '').trim() || null,
      submissionSource: String(row[cols.submissionSource] || '').trim() || null,
      age: isNaN(age) ? null : age,
      ageBand,
      sex: String(row[cols.sex] || '').trim() || null,
      type: type.toLowerCase() === 'clinical' ? 'Clinical' : type.toLowerCase() === 'admin' ? 'Admin' : type,
      clinicalProblemType: row[cols.clinicalProblemType] ? String(row[cols.clinicalProblemType]).trim() : null,
      adminActivityType: row[cols.adminActivityType] ? String(row[cols.adminActivityType]).trim() : null,
      responsePreference: String(row[cols.responsePreference] || '').trim() || null,
      outcome,
      outcomeGroup,
      isAppointment,
      appointmentSubtype,
      hasOutcome: !!outcome,
      leadTimeMinutes,
      timeToOutcomeMinutes,
      dow,
      hourOfDay,
      isWeekend,
      isCompleted: !!completedDt,
      hasOutcomeRecorded: !!outcomeRecordedDt,
    });
  }

  return { rows, dataQuality };
};

/**
 * Analyze SystmConnect data and compute all metrics
 */
export const analyzeSystmConnectData = (rows, listSize = null) => {
  if (!rows || rows.length === 0) return null;

  // Date range
  const dates = rows.map(r => r.submittedDt).filter(Boolean);
  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

  // Unique values for filters
  const uniqueOdsCodes = [...new Set(rows.map(r => r.odsCode).filter(Boolean))];
  const uniqueAccessMethods = [...new Set(rows.map(r => r.accessMethod).filter(Boolean))];
  const uniqueSubmissionSources = [...new Set(rows.map(r => r.submissionSource).filter(Boolean))];
  const uniqueResponsePreferences = [...new Set(rows.map(r => r.responsePreference).filter(Boolean))];
  const uniqueClinicalProblemTypes = [...new Set(rows.map(r => r.clinicalProblemType).filter(Boolean))];
  const uniqueAdminActivityTypes = [...new Set(rows.map(r => r.adminActivityType).filter(Boolean))];
  const uniqueOutcomes = [...new Set(rows.map(r => r.outcome).filter(Boolean))];
  const uniqueOutcomeGroups = [...new Set(rows.map(r => r.outcomeGroup).filter(Boolean))];

  // Check if admin data exists
  const hasAdminData = rows.some(r => r.type === 'Admin');

  // Basic counts
  const totalRequests = rows.length;
  const clinicalRequests = rows.filter(r => r.type === 'Clinical').length;
  const adminRequests = rows.filter(r => r.type === 'Admin').length;
  const completedRequests = rows.filter(r => r.isCompleted).length;
  const outcomeRecordedRequests = rows.filter(r => r.hasOutcomeRecorded).length;
  const appointmentRequests = rows.filter(r => r.isAppointment).length;

  // Calculate rates
  const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;
  const outcomeRate = totalRequests > 0 ? (outcomeRecordedRequests / totalRequests) * 100 : 0;
  const appointmentConversionRate = totalRequests > 0 ? (appointmentRequests / totalRequests) * 100 : 0;
  const avoidedAppointmentRate = totalRequests > 0 ? ((totalRequests - appointmentRequests) / totalRequests) * 100 : 0;

  // Per 1000 patients (if list size provided)
  const requestsPer1000 = listSize ? (totalRequests / listSize) * 1000 : null;

  // Outcome group counts
  const outcomeGroupCounts = {};
  rows.forEach(r => {
    const group = r.outcomeGroup || 'Other / Unknown';
    outcomeGroupCounts[group] = (outcomeGroupCounts[group] || 0) + 1;
  });

  // Top outcomes
  const outcomeCounts = {};
  rows.forEach(r => {
    if (r.outcome) {
      outcomeCounts[r.outcome] = (outcomeCounts[r.outcome] || 0) + 1;
    }
  });
  const topOutcomes = Object.entries(outcomeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Appointment subtype counts
  const appointmentSubtypeCounts = {};
  rows.filter(r => r.isAppointment).forEach(r => {
    const subtype = r.appointmentSubtype || 'Other Appointment';
    appointmentSubtypeCounts[subtype] = (appointmentSubtypeCounts[subtype] || 0) + 1;
  });

  // Lead time stats (median, percentiles)
  const leadTimes = rows.map(r => r.leadTimeMinutes).filter(v => v !== null && v >= 0);
  leadTimes.sort((a, b) => a - b);
  const medianLeadTime = leadTimes.length > 0 ? leadTimes[Math.floor(leadTimes.length / 2)] : null;

  // Time to outcome stats
  const timeToOutcomes = rows.map(r => r.timeToOutcomeMinutes).filter(v => v !== null && v >= 0);
  timeToOutcomes.sort((a, b) => a - b);
  const medianTimeToOutcome = timeToOutcomes.length > 0 ? timeToOutcomes[Math.floor(timeToOutcomes.length / 2)] : null;

  // By day of week
  const byDayOfWeek = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };
  rows.forEach(r => {
    if (r.dow) byDayOfWeek[r.dow]++;
  });

  // By hour
  const byHour = {};
  for (let h = 0; h < 24; h++) byHour[h] = 0;
  rows.forEach(r => {
    if (r.hourOfDay !== null) byHour[r.hourOfDay]++;
  });

  // Peak hour and day
  const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];

  // Weekend share
  const weekendRequests = rows.filter(r => r.isWeekend).length;
  const weekendShare = totalRequests > 0 ? (weekendRequests / totalRequests) * 100 : 0;

  // Heatmap data (day x hour)
  const heatmapData = {};
  Object.keys(byDayOfWeek).forEach(day => {
    heatmapData[day] = {};
    for (let h = 0; h < 24; h++) heatmapData[day][h] = 0;
  });
  rows.forEach(r => {
    if (r.dow && r.hourOfDay !== null) {
      heatmapData[r.dow][r.hourOfDay]++;
    }
  });

  // Daily time series
  const byDate = {};
  rows.forEach(r => {
    if (r.submittedDt) {
      const dateKey = r.submittedDt.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = { total: 0, clinical: 0, admin: 0, appointments: 0 };
      }
      byDate[dateKey].total++;
      if (r.type === 'Clinical') byDate[dateKey].clinical++;
      if (r.type === 'Admin') byDate[dateKey].admin++;
      if (r.isAppointment) byDate[dateKey].appointments++;
    }
  });

  // Rolling 7-day average
  const sortedDates = Object.keys(byDate).sort();
  const rolling7Day = [];
  for (let i = 6; i < sortedDates.length; i++) {
    const window = sortedDates.slice(i - 6, i + 1);
    const avg = window.reduce((sum, d) => sum + byDate[d].total, 0) / 7;
    rolling7Day.push({ date: sortedDates[i], value: Math.round(avg * 10) / 10 });
  }

  // Demographics
  const byAgeBand = {};
  AGE_BANDS.forEach(b => byAgeBand[b.label] = { total: 0, appointments: 0, timedOut: 0 });
  byAgeBand['Unknown'] = { total: 0, appointments: 0, timedOut: 0 };
  rows.forEach(r => {
    const band = r.ageBand || 'Unknown';
    if (byAgeBand[band]) {
      byAgeBand[band].total++;
      if (r.isAppointment) byAgeBand[band].appointments++;
      if (r.outcomeGroup === 'Timed out / No response') byAgeBand[band].timedOut++;
    }
  });

  const bySex = {};
  rows.forEach(r => {
    const sex = r.sex || 'Unknown';
    if (!bySex[sex]) bySex[sex] = { total: 0, appointments: 0 };
    bySex[sex].total++;
    if (r.isAppointment) bySex[sex].appointments++;
  });

  // Specific outcome rates
  const timedOutCount = rows.filter(r => r.outcomeGroup === 'Timed out / No response').length;
  const timedOutRate = totalRequests > 0 ? (timedOutCount / totalRequests) * 100 : 0;

  const inappropriateCount = rows.filter(r => r.outcomeGroup === 'Inappropriate / Rejected').length;
  const inappropriateRate = totalRequests > 0 ? (inappropriateCount / totalRequests) * 100 : 0;

  const signpostingCount = rows.filter(r => r.outcomeGroup === 'Signposting / Redirect').length;
  const signpostingRate = totalRequests > 0 ? (signpostingCount / totalRequests) * 100 : 0;

  const prescriptionCount = rows.filter(r => r.outcomeGroup === 'Prescription / Meds').length;
  const prescriptionRate = totalRequests > 0 ? (prescriptionCount / totalRequests) * 100 : 0;

  const adviceCount = rows.filter(r => r.outcomeGroup === 'Advice / Self-care').length;
  const adviceRate = totalRequests > 0 ? (adviceCount / totalRequests) * 100 : 0;

  // SLA metrics (% within X hours)
  const slaMetrics = {};
  [2, 4, 8, 24, 48].forEach(hours => {
    const threshold = hours * 60; // minutes
    const withinSla = timeToOutcomes.filter(t => t <= threshold).length;
    slaMetrics[`within${hours}h`] = timeToOutcomes.length > 0 ? (withinSla / timeToOutcomes.length) * 100 : 0;
  });

  // Weekly outcome group breakdown
  const byWeek = {};
  rows.forEach(r => {
    if (r.submittedDt) {
      const weekStart = new Date(r.submittedDt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const weekKey = weekStart.toISOString().split('T')[0];
      if (!byWeek[weekKey]) {
        byWeek[weekKey] = { total: 0 };
        Object.keys(DEFAULT_OUTCOME_GROUPS).forEach(g => byWeek[weekKey][g] = 0);
      }
      byWeek[weekKey].total++;
      byWeek[weekKey][r.outcomeGroup || 'Other / Unknown']++;
    }
  });

  // Access method distribution
  const byAccessMethod = {};
  rows.forEach(r => {
    const method = r.accessMethod || 'Unknown';
    if (!byAccessMethod[method]) byAccessMethod[method] = { total: 0, appointments: 0 };
    byAccessMethod[method].total++;
    if (r.isAppointment) byAccessMethod[method].appointments++;
  });

  // Submission source distribution
  const bySubmissionSource = {};
  rows.forEach(r => {
    const source = r.submissionSource || 'Unknown';
    if (!bySubmissionSource[source]) bySubmissionSource[source] = { total: 0, appointments: 0 };
    bySubmissionSource[source].total++;
    if (r.isAppointment) bySubmissionSource[source].appointments++;
  });

  // Response preference distribution
  const byResponsePreference = {};
  rows.forEach(r => {
    const pref = r.responsePreference || 'Unknown';
    if (!byResponsePreference[pref]) byResponsePreference[pref] = { total: 0, appointments: 0 };
    byResponsePreference[pref].total++;
    if (r.isAppointment) byResponsePreference[pref].appointments++;
  });

  // Clinical problem type distribution
  const byClinicalProblemType = {};
  rows.filter(r => r.type === 'Clinical').forEach(r => {
    const type = r.clinicalProblemType || 'Unknown';
    byClinicalProblemType[type] = (byClinicalProblemType[type] || 0) + 1;
  });

  // Admin activity type distribution
  const byAdminActivityType = {};
  rows.filter(r => r.type === 'Admin').forEach(r => {
    const type = r.adminActivityType || 'Unknown';
    byAdminActivityType[type] = (byAdminActivityType[type] || 0) + 1;
  });

  return {
    dateRange: { min: minDate, max: maxDate },
    uniqueOdsCodes,
    uniqueAccessMethods,
    uniqueSubmissionSources,
    uniqueResponsePreferences,
    uniqueClinicalProblemTypes,
    uniqueAdminActivityTypes,
    uniqueOutcomes,
    uniqueOutcomeGroups,
    hasAdminData,

    // Core counts
    totalRequests,
    clinicalRequests,
    adminRequests,
    completedRequests,
    outcomeRecordedRequests,
    appointmentRequests,

    // Rates
    completionRate,
    outcomeRate,
    appointmentConversionRate,
    avoidedAppointmentRate,
    requestsPer1000,

    // Outcome analysis
    outcomeGroupCounts,
    topOutcomes,
    appointmentSubtypeCounts,

    // Timing stats
    medianLeadTime,
    medianTimeToOutcome,
    slaMetrics,

    // Time distributions
    byDayOfWeek,
    byHour,
    heatmapData,
    byDate,
    rolling7Day,
    byWeek,
    peakHour: peakHour ? { hour: parseInt(peakHour[0]), count: peakHour[1] } : null,
    peakDay: peakDay ? { day: peakDay[0], count: peakDay[1] } : null,
    weekendShare,

    // Demographics
    byAgeBand,
    bySex,

    // Specific rates
    timedOutRate,
    inappropriateRate,
    signpostingRate,
    prescriptionRate,
    adviceRate,

    // Channel analysis
    byAccessMethod,
    bySubmissionSource,
    byResponsePreference,
    byClinicalProblemType,
    byAdminActivityType,
  };
};
