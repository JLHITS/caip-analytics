import React, { useState, useMemo, useCallback, useEffect } from 'react';
import LZString from 'lz-string';
import {
  Upload, FileText, AlertCircle, CheckCircle, Calendar, Clock,
  TrendingUp, BarChart3, PieChart, AlertTriangle, Info, PlayCircle,
  Loader2, X, ChevronUp, ChevronDown, Activity, Target, Save, Trash2,
  History, ChevronRight, ChevronLeft, Inbox, ArrowUpRight, ArrowDownRight, Share2
} from 'lucide-react';
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
import * as XLSX from 'xlsx';
import Card from './ui/Card';
import ShareModal from './modals/ShareModal';
import Toast from './ui/Toast';
import { restoreTriageSlotsFromExcel, validateExcelFile } from '../utils/excelUtils';
import { createFirebaseShare, loadFirebaseShare } from '../utils/shareUtils';

// Sample data import
import sampleTriageData from '../assets/Rapid Health December Data Example  - 20260106.xlsx?url';

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

// Expected headers for validation
const EXPECTED_HEADERS = [
  'Tenant', 'Request date', 'Request year', 'Request month-year', 'Request month',
  'Request day', 'Request time', 'Request type', 'Admin type', 'Pathway',
  'Urgency', 'Automated', 'Guideline used', 'Slot type', 'Appointment date',
  'Appointment day', 'Appointment status', 'Patient age', 'A&E override',
  'Age between created - invited', 'Age between created - booking',
  'Age between created - scheduled', 'Age between created - processed',
  'Patient selected preferred practitioner'
];

// Day order for consistent display
const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Urgency colors
const URGENCY_COLORS = {
  GREEN: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', chart: '#22c55e' },
  YELLOW: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', chart: '#eab308' },
  AMBER: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-500', chart: '#f59e0b' },
  RED: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', chart: '#ef4444' },
};

// Helper to convert Excel serial date to JS Date
const excelDateToJS = (serial) => {
  if (typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
};

// Helper to convert Excel serial date or value to month name
const excelValueToMonthName = (value) => {
  if (value === null || value === undefined || value === '') return '';

  // If it's a number, treat as Excel serial date
  if (typeof value === 'number') {
    const date = excelDateToJS(value);
    if (date) {
      return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    }
  }

  // Otherwise return as string
  return String(value);
};

// Helper to convert Excel time fraction to hours/minutes
const excelTimeToHour = (timeFraction) => {
  if (typeof timeFraction !== 'number') return null;
  return Math.floor(timeFraction * 24);
};

// Parse time string like "0 hour(s) 12 minute(s)" to minutes
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;
  const hourMatch = timeStr.match(/(\d+)\s*hour/);
  const minMatch = timeStr.match(/(\d+)\s*minute/);
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]) : 0;
  return hours * 60 + minutes;
};

// Helper to restore Date objects from serialized shared data
const restoreDatesInData = (data) => {
  if (!data) return data;

  // Create a shallow copy
  const restored = { ...data };

  // Restore dateRange dates
  if (restored.dateRange) {
    restored.dateRange = {
      min: restored.dateRange.min ? new Date(restored.dateRange.min) : null,
      max: restored.dateRange.max ? new Date(restored.dateRange.max) : null,
    };
  }

  return restored;
};

// Validate file headers match expected format
const validateHeaders = (headers) => {
  const normalizedHeaders = headers.map(h => String(h || '').trim().toLowerCase());
  const expectedNormalized = EXPECTED_HEADERS.map(h => h.toLowerCase());

  // Check if at least 80% of expected headers are present
  let matchCount = 0;
  for (const expected of expectedNormalized) {
    if (normalizedHeaders.some(h => h.includes(expected) || expected.includes(h))) {
      matchCount++;
    }
  }
  return matchCount / expectedNormalized.length >= 0.8;
};

// Parse uploaded data
const parseTriageData = (workbook) => {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 2) {
    throw new Error('File contains no data rows');
  }

  const headers = data[0];
  if (!validateHeaders(headers)) {
    throw new Error('File format does not match Rapid Health Smart Triage extract. Please ensure you are uploading the correct file.');
  }

  // Find column indices
  const findCol = (name) => headers.findIndex(h =>
    String(h || '').toLowerCase().includes(name.toLowerCase())
  );

  const cols = {
    tenant: findCol('tenant'),
    requestDate: findCol('request date'),
    requestMonth: findCol('request month'),
    requestDay: findCol('request day'),
    requestTime: findCol('request time'),
    requestType: findCol('request type'),
    pathway: findCol('pathway'),
    urgency: findCol('urgency'),
    automated: findCol('automated'),
    guideline: findCol('guideline'),
    slotType: findCol('slot type'),
    appointmentStatus: findCol('appointment status'),
    patientAge: findCol('patient age'),
    timeToProcessed: findCol('created - processed'),
  };

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const requestDate = excelDateToJS(row[cols.requestDate]);
    const requestHour = excelTimeToHour(row[cols.requestTime]);
    const patientAge = parseInt(row[cols.patientAge]) || 0;
    const urgency = String(row[cols.urgency] || '-').toUpperCase().trim();
    const automated = row[cols.automated] === true || String(row[cols.automated]).toLowerCase() === 'true';
    const requestDay = String(row[cols.requestDay] || '').trim();

    rows.push({
      tenant: String(row[cols.tenant] || ''),
      requestDate,
      requestMonth: excelValueToMonthName(row[cols.requestMonth]),
      requestDay: requestDay.replace(/\s+/g, ''),
      requestHour,
      requestType: String(row[cols.requestType] || ''),
      pathway: String(row[cols.pathway] || '-'),
      urgency: urgency === '-' ? null : urgency,
      automated,
      guideline: String(row[cols.guideline] || ''),
      slotType: String(row[cols.slotType] || '-'),
      appointmentStatus: String(row[cols.appointmentStatus] || '-'),
      patientAge,
      isAdult: patientAge >= 18,
      timeToProcessedMins: parseTimeToMinutes(row[cols.timeToProcessed]),
    });
  }

  return rows;
};

// Analyze data and compute all metrics
const analyzeData = (rows) => {
  // Get unique months and date range
  const months = [...new Set(rows.map(r => r.requestMonth).filter(Boolean))];
  const dates = rows.map(r => r.requestDate).filter(Boolean);
  const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

  // Get tenant (practice) names
  const tenants = [...new Set(rows.map(r => r.tenant).filter(Boolean))];

  // Medical requests only for most analyses
  const medicalRows = rows.filter(r => r.requestType === 'Medical');
  const adultMedicalRows = medicalRows.filter(r => r.isAdult);

  // === SUBMISSIONS BY DAY OF WEEK ===
  const byDayOfWeek = {};
  DAYS_ORDER.forEach(day => byDayOfWeek[day] = 0);
  rows.forEach(r => {
    const day = DAYS_ORDER.find(d => r.requestDay.toLowerCase().includes(d.toLowerCase()));
    if (day) byDayOfWeek[day]++;
  });

  // === SUBMISSIONS BY HOUR ===
  const byHour = {};
  for (let h = 0; h < 24; h++) byHour[h] = 0;
  rows.forEach(r => {
    if (r.requestHour !== null) byHour[r.requestHour]++;
  });

  // === HEATMAP DATA (Day x Hour) ===
  const heatmapData = {};
  DAYS_ORDER.forEach(day => {
    heatmapData[day] = {};
    for (let h = 0; h < 24; h++) heatmapData[day][h] = 0;
  });
  rows.forEach(r => {
    const day = DAYS_ORDER.find(d => r.requestDay.toLowerCase().includes(d.toLowerCase()));
    if (day && r.requestHour !== null) {
      heatmapData[day][r.requestHour]++;
    }
  });

  // === ROLLING 7-DAY AVERAGES ===
  const byDate = {};
  rows.forEach(r => {
    if (r.requestDate) {
      const dateKey = r.requestDate.toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }
  });
  const sortedDates = Object.keys(byDate).sort();
  const rolling7Day = [];
  for (let i = 6; i < sortedDates.length; i++) {
    const window = sortedDates.slice(i - 6, i + 1);
    const avg = window.reduce((sum, d) => sum + byDate[d], 0) / 7;
    rolling7Day.push({ date: sortedDates[i], value: Math.round(avg * 10) / 10 });
  }

  // === PATHWAY ANALYSIS ===
  const pathwayCounts = {};
  medicalRows.forEach(r => {
    const pathway = r.pathway || '-';
    pathwayCounts[pathway] = (pathwayCounts[pathway] || 0) + 1;
  });

  // Group by symptom (extract from pathway like "Triage.Headache" -> "Headache")
  const symptomCounts = {};
  Object.entries(pathwayCounts).forEach(([pathway, count]) => {
    let symptom = pathway;
    if (pathway.includes('.')) {
      const parts = pathway.split('.');
      symptom = parts[parts.length - 1].replace(/_/g, ' ');
    }
    symptomCounts[symptom] = (symptomCounts[symptom] || 0) + count;
  });

  // Pareto - sort by count and calculate cumulative %
  const sortedSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1]);
  const totalSymptoms = sortedSymptoms.reduce((sum, [, count]) => sum + count, 0);
  let cumulative = 0;
  const paretoData = sortedSymptoms.slice(0, 15).map(([symptom, count]) => {
    cumulative += count;
    return {
      symptom,
      count,
      percentage: (count / totalSymptoms) * 100,
      cumulative: (cumulative / totalSymptoms) * 100,
    };
  });

  // Seasonal comparison by month
  const byMonthSymptom = {};
  months.forEach(m => byMonthSymptom[m] = {});
  medicalRows.forEach(r => {
    if (r.requestMonth && r.pathway) {
      let symptom = r.pathway;
      if (symptom.includes('.')) {
        const parts = symptom.split('.');
        symptom = parts[parts.length - 1].replace(/_/g, ' ');
      }
      byMonthSymptom[r.requestMonth][symptom] = (byMonthSymptom[r.requestMonth][symptom] || 0) + 1;
    }
  });

  // === URGENCY DISTRIBUTION ===
  const urgencyCounts = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0 };
  medicalRows.forEach(r => {
    if (r.urgency && urgencyCounts.hasOwnProperty(r.urgency)) {
      urgencyCounts[r.urgency]++;
    }
  });
  const totalUrgency = Object.values(urgencyCounts).reduce((a, b) => a + b, 0);

  // Urgency by day of week
  const urgencyByDay = {};
  DAYS_ORDER.forEach(day => {
    urgencyByDay[day] = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0 };
  });
  medicalRows.forEach(r => {
    const day = DAYS_ORDER.find(d => r.requestDay.toLowerCase().includes(d.toLowerCase()));
    if (day && r.urgency && urgencyByDay[day].hasOwnProperty(r.urgency)) {
      urgencyByDay[day][r.urgency]++;
    }
  });

  // Urgency by hour
  const urgencyByHour = {};
  for (let h = 0; h < 24; h++) {
    urgencyByHour[h] = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0 };
  }
  medicalRows.forEach(r => {
    if (r.requestHour !== null && r.urgency && urgencyByHour[r.requestHour].hasOwnProperty(r.urgency)) {
      urgencyByHour[r.requestHour][r.urgency]++;
    }
  });

  // Urgency by symptom
  const urgencyBySymptom = {};
  medicalRows.forEach(r => {
    let symptom = r.pathway || '-';
    if (symptom.includes('.')) {
      const parts = symptom.split('.');
      symptom = parts[parts.length - 1].replace(/_/g, ' ');
    }
    if (!urgencyBySymptom[symptom]) {
      urgencyBySymptom[symptom] = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0, total: 0 };
    }
    if (r.urgency && urgencyBySymptom[symptom].hasOwnProperty(r.urgency)) {
      urgencyBySymptom[symptom][r.urgency]++;
    }
    urgencyBySymptom[symptom].total++;
  });

  // === SLOT CAPACITY NEEDED BY DAY (for slot analysis) ===
  // Important: Urgency determines WHEN capacity is needed, not when request was made
  // Practices are closed on weekends (Sat/Sun) - capacity moves to next open weekday
  // RED = Same open day (if request on weekend, Monday)
  // AMBER = Next open day after request
  // YELLOW = 3rd open day after request
  // GREEN = 5th open day after request

  // Map day names to indices (Monday=0 ... Sunday=6)
  const dayToIndex = {};
  DAYS_ORDER.forEach((day, i) => dayToIndex[day] = i);
  const indexToDay = DAYS_ORDER;

  // Helper: Check if a day index is an open day (Mon-Fri = 0-4)
  const isOpenDay = (dayIdx) => dayIdx >= 0 && dayIdx <= 4;

  // Helper: Get the nth open day from a starting day index
  // openDaysOut: 0 = same open day, 1 = next open day, etc.
  const getTargetOpenDay = (requestDayIndex, openDaysOut) => {
    if (openDaysOut === 0) {
      // Same day - if open, use it; else next open (Monday)
      return isOpenDay(requestDayIndex) ? requestDayIndex : 0;
    }

    // Count open days from the request day
    let currentDay = requestDayIndex;
    let openDaysCount = 0;

    while (openDaysCount < openDaysOut) {
      currentDay = (currentDay + 1) % 7;
      if (isOpenDay(currentDay)) {
        openDaysCount++;
      }
    }
    return currentDay;
  };

  // Track where demand was submitted (for reference) and where capacity is needed
  const demandByDayUrgency = {};  // Where requests were made
  const capacityNeededByDay = {}; // Where slots are actually needed (weekdays only)

  DAYS_ORDER.forEach(day => {
    demandByDayUrgency[day] = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0, total: 0 };
    capacityNeededByDay[day] = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0, total: 0 };
  });

  // Count weeks for averaging
  const weekSet = new Set();
  rows.forEach(r => {
    if (r.requestDate) {
      const weekStart = new Date(r.requestDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekSet.add(weekStart.toISOString().split('T')[0]);
    }
  });
  const numWeeks = weekSet.size || 1;

  // Process each medical request and determine when capacity is needed
  medicalRows.forEach(r => {
    const requestDay = DAYS_ORDER.find(d => r.requestDay.toLowerCase().includes(d.toLowerCase()));
    if (!requestDay) return;

    const requestDayIndex = dayToIndex[requestDay];

    // Track where demand was submitted
    demandByDayUrgency[requestDay].total++;
    if (r.urgency && demandByDayUrgency[requestDay].hasOwnProperty(r.urgency)) {
      demandByDayUrgency[requestDay][r.urgency]++;
    }

    // Calculate which OPEN day needs the capacity based on urgency
    // Weekends are skipped - capacity moves to next weekday
    let capacityDayIndex;
    switch (r.urgency) {
      case 'RED':
        // Same open day - if weekend request, moves to Monday
        capacityDayIndex = getTargetOpenDay(requestDayIndex, 0);
        break;
      case 'AMBER':
        // Next open day after request
        capacityDayIndex = getTargetOpenDay(requestDayIndex, 1);
        break;
      case 'YELLOW':
        // 3rd open day after request
        capacityDayIndex = getTargetOpenDay(requestDayIndex, 3);
        break;
      case 'GREEN':
        // 5th open day after request
        capacityDayIndex = getTargetOpenDay(requestDayIndex, 5);
        break;
      default:
        return; // Skip requests without valid urgency
    }

    const capacityDay = indexToDay[capacityDayIndex];
    if (capacityDay && r.urgency) {
      capacityNeededByDay[capacityDay][r.urgency]++;
      capacityNeededByDay[capacityDay].total++;
    }
  });

  // Average per day for both demand and capacity
  Object.keys(demandByDayUrgency).forEach(day => {
    demandByDayUrgency[day].avgTotal = Math.round(demandByDayUrgency[day].total / numWeeks);
    demandByDayUrgency[day].avgGREEN = Math.round(demandByDayUrgency[day].GREEN / numWeeks);
    demandByDayUrgency[day].avgYELLOW = Math.round(demandByDayUrgency[day].YELLOW / numWeeks);
    demandByDayUrgency[day].avgAMBER = Math.round(demandByDayUrgency[day].AMBER / numWeeks);
    demandByDayUrgency[day].avgRED = Math.round(demandByDayUrgency[day].RED / numWeeks);
  });

  Object.keys(capacityNeededByDay).forEach(day => {
    capacityNeededByDay[day].avgTotal = Math.round(capacityNeededByDay[day].total / numWeeks);
    capacityNeededByDay[day].avgGREEN = Math.round(capacityNeededByDay[day].GREEN / numWeeks);
    capacityNeededByDay[day].avgYELLOW = Math.round(capacityNeededByDay[day].YELLOW / numWeeks);
    capacityNeededByDay[day].avgAMBER = Math.round(capacityNeededByDay[day].AMBER / numWeeks);
    capacityNeededByDay[day].avgRED = Math.round(capacityNeededByDay[day].RED / numWeeks);
  });

  // === NON-AUTOMATED PATHWAYS ANALYSIS (Adults only) ===
  const nonAutomatedPathways = {};
  adultMedicalRows.filter(r => !r.automated).forEach(r => {
    const pathway = r.pathway || '-';
    if (!nonAutomatedPathways[pathway]) {
      nonAutomatedPathways[pathway] = {
        total: 0,
        withAppointment: 0,
        appointmentStatuses: {},
      };
    }
    nonAutomatedPathways[pathway].total++;

    const status = r.appointmentStatus;
    if (status && status !== '-') {
      nonAutomatedPathways[pathway].appointmentStatuses[status] =
        (nonAutomatedPathways[pathway].appointmentStatuses[status] || 0) + 1;
      // Count as "given appointment" if status indicates booking/scheduled
      if (status.toLowerCase().includes('booking') ||
          status.toLowerCase().includes('scheduled') ||
          status.toLowerCase().includes('confirmed')) {
        nonAutomatedPathways[pathway].withAppointment++;
      }
    }
  });

  // Calculate appointment rate for each pathway
  const pathwayOpportunities = Object.entries(nonAutomatedPathways)
    .map(([pathway, data]) => ({
      pathway,
      total: data.total,
      withAppointment: data.withAppointment,
      appointmentRate: data.total > 0 ? (data.withAppointment / data.total) * 100 : 0,
      statuses: data.appointmentStatuses,
    }))
    .filter(p => p.total >= 5) // Only show pathways with sufficient data
    .sort((a, b) => b.appointmentRate - a.appointmentRate);

  // === ALL PATHWAYS NON-AUTOMATED ANALYSIS ===
  // Shows all pathways with their total requests and non-automated counts
  // Also includes breakdown by urgency for expandable rows
  const allPathwayAutomation = {};
  medicalRows.forEach(r => {
    const pathway = r.pathway || '-';
    const urgency = r.urgency || 'UNKNOWN';
    if (!allPathwayAutomation[pathway]) {
      allPathwayAutomation[pathway] = {
        total: 0,
        automated: 0,
        notAutomated: 0,
        byUrgency: {
          GREEN: { total: 0, automated: 0, notAutomated: 0 },
          YELLOW: { total: 0, automated: 0, notAutomated: 0 },
          AMBER: { total: 0, automated: 0, notAutomated: 0 },
          RED: { total: 0, automated: 0, notAutomated: 0 },
        },
      };
    }
    allPathwayAutomation[pathway].total++;
    if (r.automated) {
      allPathwayAutomation[pathway].automated++;
    } else {
      allPathwayAutomation[pathway].notAutomated++;
    }
    // Track by urgency
    if (allPathwayAutomation[pathway].byUrgency[urgency]) {
      allPathwayAutomation[pathway].byUrgency[urgency].total++;
      if (r.automated) {
        allPathwayAutomation[pathway].byUrgency[urgency].automated++;
      } else {
        allPathwayAutomation[pathway].byUrgency[urgency].notAutomated++;
      }
    }
  });

  // Convert to array and calculate percentages, sorted by notAutomated descending
  const pathwayAutomationList = Object.entries(allPathwayAutomation)
    .map(([pathway, counts]) => ({
      pathway,
      total: counts.total,
      automated: counts.automated,
      notAutomated: counts.notAutomated,
      notAutomatedPct: counts.total > 0 ? (counts.notAutomated / counts.total * 100) : 0,
      automatedPct: counts.total > 0 ? (counts.automated / counts.total * 100) : 0,
      byUrgency: ['GREEN', 'YELLOW', 'AMBER', 'RED'].map(urg => ({
        urgency: urg,
        total: counts.byUrgency[urg].total,
        automated: counts.byUrgency[urg].automated,
        notAutomated: counts.byUrgency[urg].notAutomated,
        notAutomatedPct: counts.byUrgency[urg].total > 0
          ? (counts.byUrgency[urg].notAutomated / counts.byUrgency[urg].total * 100)
          : 0,
      })).filter(u => u.total > 0), // Only include urgencies with data
    }))
    .sort((a, b) => b.notAutomated - a.notAutomated);

  // === TIME TO RESOLUTION (Medical only) ===
  const resolutionTimes = medicalRows
    .map(r => r.timeToProcessedMins)
    .filter(t => t !== null && t >= 0 && t < 10000); // Filter out outliers

  const avgResolutionMins = resolutionTimes.length > 0
    ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
    : null;

  const medianResolutionMins = resolutionTimes.length > 0
    ? resolutionTimes.sort((a, b) => a - b)[Math.floor(resolutionTimes.length / 2)]
    : null;

  // === AUTOMATION % BY URGENCY (Medical only) ===
  const automationByUrgency = { GREEN: { total: 0, automated: 0 }, YELLOW: { total: 0, automated: 0 }, AMBER: { total: 0, automated: 0 }, RED: { total: 0, automated: 0 } };
  medicalRows.forEach(r => {
    if (r.urgency && automationByUrgency[r.urgency]) {
      automationByUrgency[r.urgency].total++;
      if (r.automated) {
        automationByUrgency[r.urgency].automated++;
      }
    }
  });
  // Calculate percentages
  Object.keys(automationByUrgency).forEach(urg => {
    const data = automationByUrgency[urg];
    data.percentage = data.total > 0 ? (data.automated / data.total * 100) : 0;
  });

  // === SLOT TYPE DISTRIBUTION ===
  const slotTypeCounts = {};
  rows.forEach(r => {
    const slotType = r.slotType || '-';
    slotTypeCounts[slotType] = (slotTypeCounts[slotType] || 0) + 1;
  });

  // === REQUEST TYPES ===
  const requestTypes = [...new Set(rows.map(r => r.requestType).filter(Boolean))];

  // === SUBMISSIONS BY REQUEST TYPE ===
  const byRequestType = {};
  requestTypes.forEach(type => {
    byRequestType[type] = {
      total: 0,
      byDay: {},
      byHour: {},
      slotTypes: {},
    };
    DAYS_ORDER.forEach(day => byRequestType[type].byDay[day] = 0);
    for (let h = 0; h < 24; h++) byRequestType[type].byHour[h] = 0;
  });
  rows.forEach(r => {
    if (r.requestType && byRequestType[r.requestType]) {
      byRequestType[r.requestType].total++;
      const day = DAYS_ORDER.find(d => r.requestDay.toLowerCase().includes(d.toLowerCase()));
      if (day) byRequestType[r.requestType].byDay[day]++;
      if (r.requestHour !== null) byRequestType[r.requestType].byHour[r.requestHour]++;
      const slotType = r.slotType || '-';
      byRequestType[r.requestType].slotTypes[slotType] = (byRequestType[r.requestType].slotTypes[slotType] || 0) + 1;
    }
  });

  // === NON-AUTOMATED INBOX ANALYSIS ===
  // Analyze what slot types clinicians assign to non-automated requests
  const nonAutomatedRows = medicalRows.filter(r => !r.automated && r.slotType && r.slotType !== '-');

  // 1. Urgency → Slot Type breakdown (what slot types do clinicians assign for each urgency?)
  const urgencyToSlotType = {};
  ['GREEN', 'YELLOW', 'AMBER', 'RED'].forEach(urg => {
    urgencyToSlotType[urg] = { total: 0, slotTypes: {} };
  });
  nonAutomatedRows.forEach(r => {
    if (r.urgency && urgencyToSlotType[r.urgency]) {
      urgencyToSlotType[r.urgency].total++;
      urgencyToSlotType[r.urgency].slotTypes[r.slotType] = (urgencyToSlotType[r.urgency].slotTypes[r.slotType] || 0) + 1;
    }
  });
  // Calculate percentages for each urgency → slot type
  Object.keys(urgencyToSlotType).forEach(urg => {
    const total = urgencyToSlotType[urg].total;
    urgencyToSlotType[urg].slotTypeList = Object.entries(urgencyToSlotType[urg].slotTypes)
      .map(([slotType, count]) => ({
        slotType,
        count,
        percentage: total > 0 ? (count / total * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  });

  // 2. Pathway + Urgency → Slot Type breakdown
  const pathwayUrgencySlotType = {};
  nonAutomatedRows.forEach(r => {
    if (!r.urgency || !r.pathway) return;
    const key = `${r.pathway}|||${r.urgency}`;
    if (!pathwayUrgencySlotType[key]) {
      pathwayUrgencySlotType[key] = { pathway: r.pathway, urgency: r.urgency, total: 0, slotTypes: {} };
    }
    pathwayUrgencySlotType[key].total++;
    pathwayUrgencySlotType[key].slotTypes[r.slotType] = (pathwayUrgencySlotType[key].slotTypes[r.slotType] || 0) + 1;
  });
  // Convert to array and calculate percentages
  const pathwayUrgencySlotTypeList = Object.values(pathwayUrgencySlotType)
    .map(item => {
      const slotTypeList = Object.entries(item.slotTypes)
        .map(([slotType, count]) => ({
          slotType,
          count,
          percentage: item.total > 0 ? (count / item.total * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);
      // Determine if there's variation (multiple slot types assigned)
      const hasVariation = slotTypeList.length > 1;
      const topSlotType = slotTypeList[0] || {};
      return {
        ...item,
        slotTypeList,
        hasVariation,
        topSlotType: topSlotType.slotType,
        topSlotTypePct: topSlotType.percentage || 0,
        variationScore: hasVariation ? (100 - topSlotType.percentage) : 0, // Higher = more variation
      };
    })
    .filter(item => item.total >= 3) // Only show items with enough data
    .sort((a, b) => b.variationScore - a.variationScore || b.total - a.total);

  // 3. Identify outliers - where urgency doesn't match slot type naming convention
  // e.g., AMBER urgency but clinician assigned RED slot type
  const outlierAnalysis = [];
  nonAutomatedRows.forEach(r => {
    if (!r.urgency || !r.slotType) return;
    const slotTypeLower = r.slotType.toLowerCase();
    // Check if slot type contains a different urgency than recommended
    let assignedUrgency = null;
    if (slotTypeLower.includes('red') || slotTypeLower.includes('same day') || slotTypeLower.includes('same-day')) {
      assignedUrgency = 'RED';
    } else if (slotTypeLower.includes('amber') || slotTypeLower.includes('next day') || slotTypeLower.includes('next-day')) {
      assignedUrgency = 'AMBER';
    } else if (slotTypeLower.includes('yellow')) {
      assignedUrgency = 'YELLOW';
    } else if (slotTypeLower.includes('green') || slotTypeLower.includes('routine')) {
      assignedUrgency = 'GREEN';
    }
    if (assignedUrgency && assignedUrgency !== r.urgency) {
      outlierAnalysis.push({
        pathway: r.pathway,
        recommendedUrgency: r.urgency,
        assignedSlotType: r.slotType,
        inferredUrgency: assignedUrgency,
      });
    }
  });

  // Aggregate outliers by pathway + recommended vs assigned
  const outlierSummary = {};
  outlierAnalysis.forEach(o => {
    const key = `${o.pathway}|||${o.recommendedUrgency}|||${o.inferredUrgency}`;
    if (!outlierSummary[key]) {
      outlierSummary[key] = {
        pathway: o.pathway,
        recommendedUrgency: o.recommendedUrgency,
        assignedUrgency: o.inferredUrgency,
        count: 0,
        slotTypes: {},
      };
    }
    outlierSummary[key].count++;
    outlierSummary[key].slotTypes[o.assignedSlotType] = (outlierSummary[key].slotTypes[o.assignedSlotType] || 0) + 1;
  });
  const outlierList = Object.values(outlierSummary)
    .map(item => ({
      ...item,
      slotTypeList: Object.entries(item.slotTypes)
        .map(([st, count]) => ({ slotType: st, count }))
        .sort((a, b) => b.count - a.count),
      direction: ['RED', 'AMBER', 'YELLOW', 'GREEN'].indexOf(item.assignedUrgency) < ['RED', 'AMBER', 'YELLOW', 'GREEN'].indexOf(item.recommendedUrgency)
        ? 'upgraded' : 'downgraded',
    }))
    .sort((a, b) => b.count - a.count);

  const nonAutomatedInboxData = {
    totalNonAutomated: nonAutomatedRows.length,
    urgencyToSlotType,
    pathwayUrgencySlotTypeList,
    outlierList,
    outlierCount: outlierAnalysis.length,
  };

  return {
    totalSubmissions: rows.length,
    medicalSubmissions: medicalRows.length,
    adultMedicalSubmissions: adultMedicalRows.length,
    tenants,
    months,
    dateRange: { min: minDate, max: maxDate },
    numWeeks,
    byDayOfWeek,
    byHour,
    heatmapData,
    rolling7Day,
    symptomCounts,
    paretoData,
    byMonthSymptom,
    urgencyCounts,
    totalUrgency,
    urgencyByDay,
    urgencyByHour,
    urgencyBySymptom,
    demandByDayUrgency,
    capacityNeededByDay,
    pathwayOpportunities,
    pathwayAutomationList,
    avgResolutionMins,
    medianResolutionMins,
    resolutionTimes,
    automationByUrgency,
    slotTypeCounts,
    requestTypes,
    byRequestType,
    nonAutomatedInboxData,
  };
};

export default function TriageSlotAnalysis() {
  const [files, setFiles] = useState([]);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [requestTypeFilter, setRequestTypeFilter] = useState('All');
  const [shareUrl, setShareUrl] = useState(null);
  const [shareType, setShareType] = useState('firebase');
  const [shareExpiresAt, setShareExpiresAt] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Slot capacity inputs (user-configurable)
  const [slotCapacity, setSlotCapacity] = useState({
    Monday: { GREEN: 10, YELLOW: 8, AMBER: 6, RED: 4 },
    Tuesday: { GREEN: 10, YELLOW: 8, AMBER: 6, RED: 4 },
    Wednesday: { GREEN: 10, YELLOW: 8, AMBER: 6, RED: 4 },
    Thursday: { GREEN: 10, YELLOW: 8, AMBER: 6, RED: 4 },
    Friday: { GREEN: 10, YELLOW: 8, AMBER: 6, RED: 4 },
    Saturday: { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0 },
    Sunday: { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0 },
  });

  const [showSlotSettings, setShowSlotSettings] = useState(false);

  // Toggle for whether practice accepts requests on weekends
  const [acceptWeekendRequests, setAcceptWeekendRequests] = useState(false);

  // Load Firebase shared dashboard from /shared/:id URL
  useEffect(() => {
    const loadFirebaseSharedDashboard = async () => {
      const path = window.location.pathname;
      const match = path.match(/^\/shared\/([a-zA-Z0-9]+)$/);

      if (!match) return;

      try {
        setIsLoading(true);
        const shareId = match[1];
        const shareData = await loadFirebaseShare(shareId);

        if (shareData.type === 'triage-slots') {
          setData(restoreDatesInData(shareData.data));
          setFiles(shareData.files || ['Shared Dashboard']);
          setSlotCapacity(shareData.slotCapacity || slotCapacity);
          setAcceptWeekendRequests(shareData.acceptWeekendRequests || false);
          setActiveTab('overview');
          window.history.replaceState({}, '', '/slots');

          setToast({ type: 'success', message: 'Shared dashboard loaded successfully!' });
        }
      } catch (error) {
        console.error('Failed to load shared dashboard:', error);
        setToast({ type: 'error', message: error.message });
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };

    loadFirebaseSharedDashboard();
  }, []);

  // Load shared dashboard from URL hash on mount
  useEffect(() => {
    const loadSharedDashboard = () => {
      try {
        const hash = window.location.hash;
        if (!hash || !hash.startsWith('#')) return;

        const compressed = hash.substring(1);
        if (!compressed) return;

        const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
        if (!decompressed) {
          console.error('Failed to decompress shared data');
          return;
        }

        const shareData = JSON.parse(decompressed);

        if (shareData.data) {
          setData(restoreDatesInData(shareData.data));
          setFiles(shareData.files || ['Shared Dashboard']);
          setSlotCapacity(shareData.slotCapacity || slotCapacity);
          setAcceptWeekendRequests(shareData.acceptWeekendRequests || false);
          setActiveTab('overview');
        }
      } catch (error) {
        console.error('Error loading shared dashboard:', error);
      }
    };

    loadSharedDashboard();
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      let allRows = [];

      for (const file of uploadedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const rows = parseTriageData(workbook);
        allRows = allRows.concat(rows);
      }

      if (allRows.length === 0) {
        throw new Error('No valid data found in uploaded files');
      }

      const analysis = analyzeData(allRows);
      setData(analysis);
      setFiles(uploadedFiles.map(f => f.name));
      setActiveTab('overview');
    } catch (err) {
      setError(err.message);
      setData(null);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load example data
  const loadExampleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(sampleTriageData);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const rows = parseTriageData(workbook);
      const analysis = analyzeData(rows);
      setData(analysis);
      setFiles(['Rapid Health December Data Example - 20260106.xlsx (Sample)']);
      setActiveTab('overview');
    } catch (err) {
      setError('Failed to load example data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset data
  const handleReset = useCallback(() => {
    setData(null);
    setFiles([]);
    setError(null);
    setActiveTab('overview');
  }, []);

  // Generate Firebase share link
  const handleGenerateShareLink = useCallback(async () => {
    try {
      setShareLoading(true);

      if (!data || data.length === 0) {
        setToast({ type: 'error', message: 'No data to share. Please upload and process your files first.' });
        return;
      }

      // Prevent sharing of sample/example data to reduce abuse
      if (files.some(f => f.includes('(Sample)'))) {
        setToast({ type: 'error', message: 'Cannot share example data. Please upload your own data to create share links.' });
        return;
      }

      const shareData = {
        data,
        slotCapacity,
        acceptWeekendRequests,
        files,
      };

      const { shareUrl: generatedUrl, expiresAt } = await createFirebaseShare(shareData, 'triage-slots');

      await navigator.clipboard.writeText(generatedUrl);

      setShareType('firebase');
      setShareUrl(generatedUrl);
      setShareExpiresAt(expiresAt);
      setToast({ type: 'success', message: 'Link copied to clipboard!' });
    } catch (error) {
      console.error('Share link generation failed:', error);
      setToast({ type: 'error', message: error.message });
    } finally {
      setShareLoading(false);
    }
  }, [data, slotCapacity, acceptWeekendRequests, files]);

  // Update slot capacity
  const updateSlotCapacity = (day, urgency, value) => {
    setSlotCapacity(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [urgency]: Math.max(0, parseInt(value) || 0),
      },
    }));
  };

  // Tab definitions
  const TABS = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'slots', label: 'Slot Analysis', icon: <Target size={16} /> },
    { id: 'timing', label: 'Timing', icon: <Clock size={16} /> },
    { id: 'pathways', label: 'Pathways', icon: <Activity size={16} /> },
    { id: 'urgency', label: 'Urgency', icon: <AlertTriangle size={16} /> },
    { id: 'opportunities', label: 'Automation', icon: <CheckCircle size={16} /> },
    { id: 'nonauto-inbox', label: 'Non-automated Inbox', icon: <Inbox size={16} /> },
  ];

  // Format date range for display
  const dateRangeText = useMemo(() => {
    if (!data?.dateRange.min || !data?.dateRange.max) return '';
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${data.dateRange.min.toLocaleDateString('en-GB', options)} - ${data.dateRange.max.toLocaleDateString('en-GB', options)}`;
  }, [data]);

  // Recalculate capacity needed based on acceptWeekendRequests toggle
  // This fixes AMBER logic: if next calendar day is closed, capacity is needed same day
  const adjustedCapacityNeededByDay = useMemo(() => {
    if (!data) return null;

    // Initialize capacity needed for weekdays only
    const capacityNeeded = {};
    WEEKDAYS.forEach(day => {
      capacityNeeded[day] = { GREEN: 0, YELLOW: 0, AMBER: 0, RED: 0, total: 0 };
    });

    // Day indices: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const dayToIndex = {};
    DAYS_ORDER.forEach((day, i) => dayToIndex[day] = i);
    const indexToDay = DAYS_ORDER;

    const isOpenDay = (dayIdx) => dayIdx >= 0 && dayIdx <= 4;

    // Helper to get nth open day from a starting day
    const getNthOpenDay = (startDayIndex, n) => {
      if (n === 0) {
        return isOpenDay(startDayIndex) ? startDayIndex : 0;
      }
      let current = startDayIndex;
      let count = 0;
      while (count < n) {
        current = (current + 1) % 7;
        if (isOpenDay(current)) count++;
      }
      return current;
    };

    // Process each day's demand and distribute to capacity days
    DAYS_ORDER.forEach(requestDay => {
      const dayIndex = dayToIndex[requestDay];

      // Skip weekend requests if toggle is OFF
      if (!acceptWeekendRequests && !isOpenDay(dayIndex)) {
        return;
      }

      const demand = data.demandByDayUrgency[requestDay];

      // Calculate target days for each urgency
      ['RED', 'AMBER', 'YELLOW', 'GREEN'].forEach(urgency => {
        let targetDayIndex;
        let effectiveUrgency = urgency; // Track if urgency gets upgraded

        switch (urgency) {
          case 'RED':
            // Same open day - if request on weekend, moves to Monday
            targetDayIndex = isOpenDay(dayIndex) ? dayIndex : 0;
            break;
          case 'AMBER':
            // AMBER = next CALENDAR day appointment
            // If next calendar day is closed, patient needs same-day capacity instead
            const nextCalendarDay = (dayIndex + 1) % 7;
            if (isOpenDay(nextCalendarDay)) {
              // Next day is open - capacity needed there
              targetDayIndex = nextCalendarDay;
            } else {
              // Next day is closed (weekend) - need same-day RED capacity
              // This upgrades AMBER to RED since they need same-day appointment
              targetDayIndex = isOpenDay(dayIndex) ? dayIndex : 0;
              effectiveUrgency = 'RED'; // Count as RED capacity needed
            }
            break;
          case 'YELLOW':
            // 3rd open day from request
            targetDayIndex = getNthOpenDay(dayIndex, 3);
            break;
          case 'GREEN':
            // 5th open day from request
            targetDayIndex = getNthOpenDay(dayIndex, 5);
            break;
          default:
            return;
        }

        const targetDay = indexToDay[targetDayIndex];
        if (isOpenDay(targetDayIndex) && capacityNeeded[targetDay]) {
          capacityNeeded[targetDay][effectiveUrgency] += demand[urgency];
          capacityNeeded[targetDay].total += demand[urgency];
        }
      });
    });

    // Calculate averages using numWeeks
    const numWeeks = data.numWeeks || 1;
    Object.keys(capacityNeeded).forEach(day => {
      capacityNeeded[day].avgGREEN = Math.round(capacityNeeded[day].GREEN / numWeeks);
      capacityNeeded[day].avgYELLOW = Math.round(capacityNeeded[day].YELLOW / numWeeks);
      capacityNeeded[day].avgAMBER = Math.round(capacityNeeded[day].AMBER / numWeeks);
      capacityNeeded[day].avgRED = Math.round(capacityNeeded[day].RED / numWeeks);
      capacityNeeded[day].avgTotal = Math.round(capacityNeeded[day].total / numWeeks);
    });

    return capacityNeeded;
  }, [data, acceptWeekendRequests]);

  // Slot gap analysis - uses adjustedCapacityNeededByDay (where slots are actually needed)
  // Only shows weekdays since practices are closed on weekends
  const slotGapAnalysis = useMemo(() => {
    if (!data || !adjustedCapacityNeededByDay) return null;

    const analysis = WEEKDAYS.map(day => {
      const needed = adjustedCapacityNeededByDay[day]; // Capacity needed on this day (adjusted for weekend logic)
      const currentCapacity = slotCapacity[day];        // Current slots configured

      return {
        day,
        needed: {
          GREEN: needed.avgGREEN,
          YELLOW: needed.avgYELLOW,
          AMBER: needed.avgAMBER,
          RED: needed.avgRED,
          total: needed.avgTotal,
        },
        capacity: {
          GREEN: currentCapacity.GREEN,
          YELLOW: currentCapacity.YELLOW,
          AMBER: currentCapacity.AMBER,
          RED: currentCapacity.RED,
          total: currentCapacity.GREEN + currentCapacity.YELLOW + currentCapacity.AMBER + currentCapacity.RED,
        },
        gap: {
          GREEN: needed.avgGREEN - currentCapacity.GREEN,
          YELLOW: needed.avgYELLOW - currentCapacity.YELLOW,
          AMBER: needed.avgAMBER - currentCapacity.AMBER,
          RED: needed.avgRED - currentCapacity.RED,
          total: needed.avgTotal - (currentCapacity.GREEN + currentCapacity.YELLOW + currentCapacity.AMBER + currentCapacity.RED),
        },
      };
    });

    return analysis;
  }, [data, slotCapacity, adjustedCapacityNeededByDay]);

  // Render upload form
  if (!data) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Activity size={28} />
              Triage Slot Analysis
              <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full font-bold bg-white/20 text-white">
                Beta
              </span>
            </h2>
            <p className="text-sm text-purple-100 mt-1">
              Optimise your triage slots based on demand patterns
            </p>
          </div>
        </Card>

        {/* Upload Form */}
        <div className="max-w-2xl mx-auto">
          <Card className="mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mx-auto mb-4">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Upload your Triage Data</h3>
              <p className="text-slate-500 text-sm">
                Upload one or more Rapid Health Smart Triage exports to analyse your demand patterns and optimise slot allocation.
              </p>
              <p className="text-amber-600 text-xs mt-2 flex items-center justify-center gap-1">
                <AlertCircle size={14} />
                Only Rapid Health Smart Triage exports are currently supported
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-purple-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="triage-file-upload"
                disabled={isLoading}
              />
              <label
                htmlFor="triage-file-upload"
                className="cursor-pointer"
              >
                <FileText size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-slate-400 text-sm">
                  XLSX or XLS files (single or multiple)
                </p>
              </label>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-purple-600">
                <Loader2 size={20} className="animate-spin" />
                <span>Processing data...</span>
              </div>
            )}
          </Card>

          {/* Example Data Button */}
          <div className="flex justify-center">
            <button
              onClick={loadExampleData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all font-medium shadow-sm hover:shadow"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              See Example
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render analysis dashboard
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Activity size={28} />
            Triage Slot Analysis
            <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full font-bold bg-white/20 text-white">
              Beta
            </span>
          </h2>
          <p className="text-sm text-purple-100 mt-1">
            {data.tenants.join(', ')} | {dateRangeText} | {data.totalSubmissions.toLocaleString()} total submissions
          </p>
        </div>
      </Card>

      {/* File info and actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <FileText size={16} />
          <span>{files.join(', ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateShareLink}
            disabled={shareLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {shareLoading ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {shareLoading ? 'Generating...' : 'Share'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          data={data}
          requestTypeFilter={requestTypeFilter}
          setRequestTypeFilter={setRequestTypeFilter}
        />
      )}

      {activeTab === 'slots' && (
        <SlotAnalysisTab
          data={data}
          slotCapacity={slotCapacity}
          setSlotCapacity={setSlotCapacity}
          updateSlotCapacity={updateSlotCapacity}
          slotGapAnalysis={slotGapAnalysis}
          showSlotSettings={showSlotSettings}
          setShowSlotSettings={setShowSlotSettings}
          acceptWeekendRequests={acceptWeekendRequests}
          setAcceptWeekendRequests={setAcceptWeekendRequests}
          adjustedCapacityNeededByDay={adjustedCapacityNeededByDay}
        />
      )}

      {activeTab === 'timing' && (
        <TimingTab data={data} />
      )}

      {activeTab === 'pathways' && (
        <PathwaysTab data={data} />
      )}

      {activeTab === 'urgency' && (
        <UrgencyTab data={data} />
      )}

      {activeTab === 'opportunities' && (
        <OpportunitiesTab data={data} />
      )}

      {activeTab === 'nonauto-inbox' && (
        <NonAutomatedInboxTab data={data} />
      )}

      <ShareModal
        isOpen={shareUrl !== null || shareType === 'excel'}
        onClose={() => {
          setShareUrl(null);
          setShareType('firebase');
          setShareExpiresAt(null);
        }}
        shareUrl={shareUrl}
        shareType={shareType}
        expiresAt={shareExpiresAt}
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

// === OVERVIEW TAB ===
function OverviewTab({ data, requestTypeFilter, setRequestTypeFilter }) {
  // Get filtered data based on request type
  const filteredByDay = requestTypeFilter === 'All' ? data.byDayOfWeek : data.byRequestType[requestTypeFilter]?.byDay || {};
  const filteredByHour = requestTypeFilter === 'All' ? data.byHour : data.byRequestType[requestTypeFilter]?.byHour || {};
  const filteredSlotTypes = requestTypeFilter === 'All' ? data.slotTypeCounts : data.byRequestType[requestTypeFilter]?.slotTypes || {};
  const filteredTotal = requestTypeFilter === 'All' ? data.totalSubmissions : data.byRequestType[requestTypeFilter]?.total || 0;

  return (
    <div className="space-y-6">
      {/* Request Type Filter */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Filter by Request Type</h3>
            <p className="text-sm text-slate-500">View metrics for specific request types</p>
          </div>
          <select
            value={requestTypeFilter}
            onChange={(e) => setRequestTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            <option value="All">All Request Types</option>
            {data.requestTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">{filteredTotal.toLocaleString()}</p>
          <p className="text-sm text-slate-500">{requestTypeFilter === 'All' ? 'Total Submissions' : `${requestTypeFilter} Submissions`}</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">{data.medicalSubmissions.toLocaleString()}</p>
          <p className="text-sm text-slate-500">Medical Requests</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">{data.numWeeks}</p>
          <p className="text-sm text-slate-500">Weeks of Data</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">
            {data.avgResolutionMins !== null ? `${Math.floor(data.avgResolutionMins / 60)}h ${data.avgResolutionMins % 60}m` : 'N/A'}
          </p>
          <p className="text-sm text-slate-500">Avg Resolution Time</p>
        </Card>
      </div>

      {/* Slot Type Distribution */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Slot Type Distribution {requestTypeFilter !== 'All' && `(${requestTypeFilter})`}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(filteredSlotTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([slotType, count]) => {
              const total = Object.values(filteredSlotTypes).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
              return (
                <div key={slotType} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-2xl font-bold text-slate-900">{count.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">{slotType === '-' ? 'Not Specified' : slotType}</p>
                  <p className="text-xs text-slate-400">{pct}%</p>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Urgency Distribution */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Urgency Distribution (Medical Requests)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['GREEN', 'YELLOW', 'AMBER', 'RED'].map(urgency => {
            const count = data.urgencyCounts[urgency];
            const pct = data.totalUrgency > 0 ? (count / data.totalUrgency * 100).toFixed(1) : 0;
            const colors = URGENCY_COLORS[urgency];
            return (
              <div key={urgency} className={`p-4 rounded-lg ${colors.bg} border-l-4 ${colors.border}`}>
                <p className={`text-2xl font-bold ${colors.text}`}>{count.toLocaleString()}</p>
                <p className={`text-sm ${colors.text}`}>{urgency} ({pct}%)</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Submissions by Day */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Submissions by Day of Week {requestTypeFilter !== 'All' && `(${requestTypeFilter})`}
        </h3>
        <div className="h-64">
          <Bar
            data={{
              labels: DAYS_ORDER,
              datasets: [{
                label: 'Submissions',
                data: DAYS_ORDER.map(d => filteredByDay[d] || 0),
                backgroundColor: '#8b5cf6',
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } },
              },
            }}
          />
        </div>
      </Card>

      {/* Submissions by Hour */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Submissions by Hour of Day {requestTypeFilter !== 'All' && `(${requestTypeFilter})`}
        </h3>
        <div className="h-64">
          <Bar
            data={{
              labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
              datasets: [{
                label: 'Submissions',
                data: Array.from({ length: 24 }, (_, i) => filteredByHour[i] || 0),
                backgroundColor: '#6366f1',
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } },
              },
            }}
          />
        </div>
      </Card>
    </div>
  );
}

// Local storage key for saved configurations
const CONFIG_STORAGE_KEY = 'triage-slot-configs';

// === SLOT ANALYSIS TAB ===
function SlotAnalysisTab({ data, slotCapacity, setSlotCapacity, updateSlotCapacity, slotGapAnalysis, showSlotSettings, setShowSlotSettings, acceptWeekendRequests, setAcceptWeekendRequests, adjustedCapacityNeededByDay }) {
  const [showSavedConfigs, setShowSavedConfigs] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [newConfigName, setNewConfigName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load saved configurations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        setSavedConfigs(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load saved configurations:', e);
    }
  }, []);

  // Save configuration to localStorage
  const saveConfiguration = () => {
    const newConfig = {
      id: Date.now(),
      name: newConfigName.trim() || null,
      timestamp: new Date().toISOString(),
      slotCapacity: slotCapacity,
      acceptWeekendRequests: acceptWeekendRequests,
    };

    const updatedConfigs = [newConfig, ...savedConfigs].slice(0, 20); // Keep max 20 configs
    setSavedConfigs(updatedConfigs);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedConfigs));
    setNewConfigName('');
    setShowSaveDialog(false);
  };

  // Load a saved configuration
  const loadConfiguration = (config) => {
    setSlotCapacity(config.slotCapacity);
    setAcceptWeekendRequests(config.acceptWeekendRequests);
  };

  // Delete a saved configuration
  const deleteConfiguration = (configId) => {
    const updatedConfigs = savedConfigs.filter(c => c.id !== configId);
    setSavedConfigs(updatedConfigs);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedConfigs));
  };

  // Format timestamp for display
  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex gap-4">
      {/* Main Content */}
      <div className={`flex-1 space-y-6 transition-all duration-300 ${showSavedConfigs ? 'mr-0' : ''}`}>
        {/* Practice Configuration */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Practice Configuration</h3>
              <p className="text-sm text-slate-500">Configure your practice settings and slot capacity</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSavedConfigs(!showSavedConfigs)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Saved Configurations"
              >
                <History size={16} />
                <span className="hidden sm:inline">Saved</span>
                {savedConfigs.length > 0 && (
                  <span className="bg-purple-100 text-purple-600 text-xs px-1.5 py-0.5 rounded-full">
                    {savedConfigs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowSlotSettings(!showSlotSettings)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                {showSlotSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showSlotSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>
          </div>

          {showSlotSettings && (
            <div className="space-y-6">
              {/* Save Configuration Button */}
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                {showSaveDialog ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      placeholder="Configuration name (optional)"
                      value={newConfigName}
                      onChange={(e) => setNewConfigName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && saveConfiguration()}
                    />
                    <button
                      onClick={saveConfiguration}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowSaveDialog(false); setNewConfigName(''); }}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-purple-700">Save current configuration for later use</span>
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      <Save size={14} />
                      Save Configuration
                    </button>
                  </>
                )}
              </div>

              {/* Weekend Requests Toggle */}
              <div className="p-4 bg-slate-50 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptWeekendRequests}
                    onChange={(e) => setAcceptWeekendRequests(e.target.checked)}
                    className="mt-1 w-5 h-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-medium text-slate-900">Accept requests on weekends</span>
                    <p className="text-sm text-slate-500 mt-1">
                      Enable this if your practice allows patients to submit online requests on Saturday and Sunday.
                      When disabled, weekend requests are excluded from calculations, meaning Monday Amber slots will show 0
                      (since Amber requests require submission the day before).
                    </p>
                  </div>
                </label>
              </div>

              {/* Slot Capacity Table */}
              <div>
                <h4 className="font-medium text-slate-700 mb-3">Slot Capacity per Day</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-medium text-slate-600">Day</th>
                        <th className="text-center py-2 px-3 font-medium text-green-600">Green</th>
                        <th className="text-center py-2 px-3 font-medium text-yellow-600">Yellow</th>
                        <th className="text-center py-2 px-3 font-medium text-amber-600">Amber</th>
                        <th className="text-center py-2 px-3 font-medium text-red-600">Red</th>
                      </tr>
                    </thead>
                    <tbody>
                      {WEEKDAYS.map(day => (
                        <tr key={day} className="border-b border-slate-100">
                          <td className="py-2 px-3 font-medium text-slate-700">{day}</td>
                          {['GREEN', 'YELLOW', 'AMBER', 'RED'].map(urgency => (
                            <td key={urgency} className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                value={slotCapacity[day][urgency]}
                                onChange={(e) => updateSlotCapacity(day, urgency, e.target.value)}
                                className="w-16 px-2 py-1 text-center border border-slate-200 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Card>

      {/* Capacity Needed vs Available Analysis */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Slots Needed vs Available</h3>
        <p className="text-sm text-slate-500 mb-4">
          Capacity needed is calculated based on when appointments are required, not when requests are submitted.
          Amber urgency means the patient needs to be seen the next calendar day - if that day is closed (e.g., Saturday),
          same-day capacity is needed instead.
          {!acceptWeekendRequests && ' Weekend requests are excluded since your practice doesn\'t accept them.'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-700">Day</th>
                <th colSpan="4" className="text-center py-3 px-3 font-semibold text-slate-700 bg-slate-50">Your Slots</th>
                <th colSpan="4" className="text-center py-3 px-3 font-semibold text-slate-700 bg-purple-50">Avg Slots Needed</th>
                <th colSpan="4" className="text-center py-3 px-3 font-semibold text-slate-700 bg-amber-50">Gap</th>
              </tr>
              <tr className="border-b border-slate-200">
                <th></th>
                <th className="text-center py-2 px-2 text-xs font-medium text-green-600 bg-slate-50">G</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-yellow-600 bg-slate-50">Y</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-amber-600 bg-slate-50">A</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-red-600 bg-slate-50">R</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-green-600 bg-purple-50">G</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-yellow-600 bg-purple-50">Y</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-amber-600 bg-purple-50">A</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-red-600 bg-purple-50">R</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-green-600 bg-amber-50">G</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-yellow-600 bg-amber-50">Y</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-amber-600 bg-amber-50">A</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-red-600 bg-amber-50">R</th>
              </tr>
            </thead>
            <tbody>
              {slotGapAnalysis.map(row => (
                <tr key={row.day} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-3 font-medium text-slate-700">{row.day}</td>
                  {/* Current slots */}
                  <td className="text-center py-3 px-2 bg-slate-50">{row.capacity.GREEN}</td>
                  <td className="text-center py-3 px-2 bg-slate-50">{row.capacity.YELLOW}</td>
                  <td className="text-center py-3 px-2 bg-slate-50">{row.capacity.AMBER}</td>
                  <td className="text-center py-3 px-2 bg-slate-50">{row.capacity.RED}</td>
                  {/* Capacity Needed */}
                  <td className="text-center py-3 px-2 bg-purple-50">{row.needed.GREEN}</td>
                  <td className="text-center py-3 px-2 bg-purple-50">{row.needed.YELLOW}</td>
                  <td className="text-center py-3 px-2 bg-purple-50">{row.needed.AMBER}</td>
                  <td className="text-center py-3 px-2 bg-purple-50">{row.needed.RED}</td>
                  {/* Gap */}
                  <td className={`text-center py-3 px-2 font-medium ${row.gap.GREEN > 0 ? 'text-red-600 bg-red-50' : row.gap.GREEN < 0 ? 'text-green-600 bg-green-50' : 'bg-amber-50'}`}>
                    {row.gap.GREEN > 0 ? `+${row.gap.GREEN}` : row.gap.GREEN}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${row.gap.YELLOW > 0 ? 'text-red-600 bg-red-50' : row.gap.YELLOW < 0 ? 'text-green-600 bg-green-50' : 'bg-amber-50'}`}>
                    {row.gap.YELLOW > 0 ? `+${row.gap.YELLOW}` : row.gap.YELLOW}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${row.gap.AMBER > 0 ? 'text-red-600 bg-red-50' : row.gap.AMBER < 0 ? 'text-green-600 bg-green-50' : 'bg-amber-50'}`}>
                    {row.gap.AMBER > 0 ? `+${row.gap.AMBER}` : row.gap.AMBER}
                  </td>
                  <td className={`text-center py-3 px-2 font-medium ${row.gap.RED > 0 ? 'text-red-600 bg-red-50' : row.gap.RED < 0 ? 'text-green-600 bg-green-50' : 'bg-amber-50'}`}>
                    {row.gap.RED > 0 ? `+${row.gap.RED}` : row.gap.RED}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Positive values (+)</strong> in the Gap column indicate you need more slots.
              <strong> Negative values (-)</strong> indicate you have surplus capacity.
              Friday Amber requests need same-day (Friday) capacity since Saturday is closed.
              {acceptWeekendRequests
                ? ' Weekend requests are included and redistributed to weekdays.'
                : ' Monday Amber shows 0 because no requests are submitted on Sunday.'}
            </span>
          </p>
        </div>
      </Card>

      {/* Recommended Slots */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recommended Slot Configuration</h3>
        <p className="text-sm text-slate-500 mb-4">
          Based on when capacity is actually needed (accounting for urgency timing and practice closures), here are the recommended slots:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">Day</th>
                <th className="text-center py-2 px-3 font-medium text-green-600">Green</th>
                <th className="text-center py-2 px-3 font-medium text-yellow-600">Yellow</th>
                <th className="text-center py-2 px-3 font-medium text-amber-600">Amber</th>
                <th className="text-center py-2 px-3 font-medium text-red-600">Red</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {adjustedCapacityNeededByDay && WEEKDAYS.map(day => {
                const needed = adjustedCapacityNeededByDay[day];
                // Add 10% buffer to recommendations
                const recommended = {
                  GREEN: Math.ceil(needed.avgGREEN * 1.1),
                  YELLOW: Math.ceil(needed.avgYELLOW * 1.1),
                  AMBER: Math.ceil(needed.avgAMBER * 1.1),
                  RED: Math.ceil(needed.avgRED * 1.1),
                };
                const total = recommended.GREEN + recommended.YELLOW + recommended.AMBER + recommended.RED;

                return (
                  <tr key={day} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700">{day}</td>
                    <td className="text-center py-2 px-3 text-green-600 font-medium">{recommended.GREEN}</td>
                    <td className="text-center py-2 px-3 text-yellow-600 font-medium">{recommended.YELLOW}</td>
                    <td className="text-center py-2 px-3 text-amber-600 font-medium">{recommended.AMBER}</td>
                    <td className="text-center py-2 px-3 text-red-600 font-medium">{recommended.RED}</td>
                    <td className="text-center py-2 px-3 font-bold text-slate-700">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          * Recommendations include a 10% buffer above average need to account for variability.
          Red=same day, Amber=next calendar day (or same day if next day closed), Yellow=3rd open day, Green=5th open day.
          {!acceptWeekendRequests && ' Weekend requests excluded.'}
        </p>
      </Card>
      </div>

      {/* Saved Configurations Sidebar */}
      {showSavedConfigs && (
        <div className="w-80 flex-shrink-0">
          <Card className="sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <History size={18} />
                Saved Configurations
              </h3>
              <button
                onClick={() => setShowSavedConfigs(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {savedConfigs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No saved configurations</p>
                <p className="text-xs text-slate-400 mt-1">Save your current settings to access them later</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {savedConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        {config.name ? (
                          <p className="font-medium text-slate-900 truncate">{config.name}</p>
                        ) : (
                          <p className="font-medium text-slate-500 italic">Unnamed</p>
                        )}
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock size={10} />
                          {formatTimestamp(config.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteConfiguration(config.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete configuration"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">
                      <span className={config.acceptWeekendRequests ? 'text-green-600' : 'text-slate-400'}>
                        {config.acceptWeekendRequests ? '✓ Weekend requests' : '✗ No weekend requests'}
                      </span>
                    </div>
                    <button
                      onClick={() => loadConfiguration(config)}
                      className="w-full py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      Load Configuration
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// === TIMING TAB ===
function TimingTab({ data }) {
  // Calculate max value for heatmap scaling
  const maxHeatmapValue = useMemo(() => {
    let max = 0;
    DAYS_ORDER.forEach(day => {
      for (let h = 0; h < 24; h++) {
        if (data.heatmapData[day][h] > max) {
          max = data.heatmapData[day][h];
        }
      }
    });
    return max;
  }, [data]);

  const getHeatmapColor = (value) => {
    if (value === 0) return 'bg-slate-100';
    const intensity = value / maxHeatmapValue;
    if (intensity < 0.25) return 'bg-purple-100';
    if (intensity < 0.5) return 'bg-purple-200';
    if (intensity < 0.75) return 'bg-purple-400';
    return 'bg-purple-600';
  };

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Submissions Heatmap (Day × Hour)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-2 px-1 font-medium text-slate-600">Day</th>
                {Array.from({ length: 24 }, (_, i) => (
                  <th key={i} className="text-center py-2 px-0.5 font-medium text-slate-500" style={{ minWidth: '24px' }}>
                    {i}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS_ORDER.map(day => (
                <tr key={day}>
                  <td className="py-1 px-1 font-medium text-slate-700">{day.slice(0, 3)}</td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const value = data.heatmapData[day][h];
                    return (
                      <td
                        key={h}
                        className={`py-1 px-0.5 text-center ${getHeatmapColor(value)} ${value > maxHeatmapValue * 0.5 ? 'text-white' : 'text-slate-600'}`}
                        title={`${day} ${h}:00 - ${value} submissions`}
                      >
                        {value > 0 ? value : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
          <span>Intensity:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-slate-100 rounded"></div>
            <span>0</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-100 rounded"></div>
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-300 rounded"></div>
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-600 rounded"></div>
            <span>High</span>
          </div>
        </div>
      </Card>

      {/* Rolling 7-day Average */}
      {data.rolling7Day.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Rolling 7-Day Average</h3>
          <div className="h-64">
            <Line
              data={{
                labels: data.rolling7Day.map(d => {
                  const date = new Date(d.date);
                  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                }),
                datasets: [{
                  label: '7-Day Avg',
                  data: data.rolling7Day.map(d => d.value),
                  borderColor: '#8b5cf6',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  fill: true,
                  tension: 0.4,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </Card>
      )}

      {/* Resolution Time */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Time to Resolution (Medical Requests)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-slate-900">
              {data.avgResolutionMins !== null
                ? `${Math.floor(data.avgResolutionMins / 60)}h ${data.avgResolutionMins % 60}m`
                : 'N/A'}
            </p>
            <p className="text-sm text-slate-500">Average Resolution Time</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-slate-900">
              {data.medianResolutionMins !== null
                ? `${Math.floor(data.medianResolutionMins / 60)}h ${data.medianResolutionMins % 60}m`
                : 'N/A'}
            </p>
            <p className="text-sm text-slate-500">Median Resolution Time</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// === PATHWAYS TAB ===
function PathwaysTab({ data }) {
  return (
    <div className="space-y-6">
      {/* Pareto Analysis */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Pareto Analysis (Top Symptoms)</h3>
        <p className="text-sm text-slate-500 mb-4">Top symptoms account for the majority of demand</p>

        <div className="h-80">
          <Bar
            data={{
              labels: data.paretoData.map(d => d.symptom),
              datasets: [
                {
                  type: 'bar',
                  label: 'Count',
                  data: data.paretoData.map(d => d.count),
                  backgroundColor: '#8b5cf6',
                  borderRadius: 4,
                  yAxisID: 'y',
                },
                {
                  type: 'line',
                  label: 'Cumulative %',
                  data: data.paretoData.map(d => d.cumulative),
                  borderColor: '#f59e0b',
                  backgroundColor: 'transparent',
                  yAxisID: 'y1',
                  tension: 0.4,
                  pointRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  position: 'left',
                  grid: { color: '#f1f5f9' },
                },
                y1: {
                  beginAtZero: true,
                  position: 'right',
                  max: 100,
                  grid: { display: false },
                  ticks: {
                    callback: (value) => `${value}%`,
                  },
                },
                x: {
                  grid: { display: false },
                  ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                  },
                },
              },
            }}
          />
        </div>

        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-700">
            <strong>Top 10 symptoms account for {data.paretoData.length >= 10 ? data.paretoData[9].cumulative.toFixed(0) : 'N/A'}%</strong> of all medical requests.
            Focus optimization efforts on these high-volume pathways.
          </p>
        </div>
      </Card>

      {/* Seasonal Comparison */}
      {data.months.length > 1 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Seasonal Comparison ({data.months.join(' vs ')})</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Symptom</th>
                  {data.months.map(m => (
                    <th key={m} className="text-center py-2 px-3 font-medium text-slate-600">{m}</th>
                  ))}
                  <th className="text-center py-2 px-3 font-medium text-slate-600">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.paretoData.slice(0, 10).map(({ symptom }) => {
                  const counts = data.months.map(m => data.byMonthSymptom[m][symptom] || 0);
                  const change = counts.length >= 2 && counts[0] > 0
                    ? ((counts[counts.length - 1] - counts[0]) / counts[0] * 100).toFixed(0)
                    : null;

                  return (
                    <tr key={symptom} className="border-b border-slate-100">
                      <td className="py-2 px-3 font-medium text-slate-700">{symptom}</td>
                      {counts.map((count, i) => (
                        <td key={i} className="text-center py-2 px-3 text-slate-600">{count.toLocaleString()}</td>
                      ))}
                      <td className={`text-center py-2 px-3 font-medium ${
                        change === null ? 'text-slate-400' :
                        parseFloat(change) > 0 ? 'text-red-600' :
                        parseFloat(change) < 0 ? 'text-green-600' : 'text-slate-600'
                      }`}>
                        {change === null ? '-' : `${change > 0 ? '+' : ''}${change}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* All Symptoms Table */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">All Symptoms by Volume</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">#</th>
                <th className="text-left py-2 px-3 font-medium text-slate-600">Symptom</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">Count</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.symptomCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([symptom, count], i) => {
                  const total = Object.values(data.symptomCounts).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={symptom} className="border-b border-slate-100">
                      <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-700">{symptom}</td>
                      <td className="text-right py-2 px-3 text-slate-600">{count.toLocaleString()}</td>
                      <td className="text-right py-2 px-3 text-slate-600">{(count / total * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// === URGENCY TAB ===
function UrgencyTab({ data }) {
  return (
    <div className="space-y-6">
      {/* Urgency Donut */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Overall Urgency Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64">
            <Doughnut
              data={{
                labels: ['Green', 'Yellow', 'Amber', 'Red'],
                datasets: [{
                  data: [
                    data.urgencyCounts.GREEN,
                    data.urgencyCounts.YELLOW,
                    data.urgencyCounts.AMBER,
                    data.urgencyCounts.RED,
                  ],
                  backgroundColor: [
                    URGENCY_COLORS.GREEN.chart,
                    URGENCY_COLORS.YELLOW.chart,
                    URGENCY_COLORS.AMBER.chart,
                    URGENCY_COLORS.RED.chart,
                  ],
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right' },
                },
              }}
            />
          </div>
          <div className="space-y-3">
            {['GREEN', 'YELLOW', 'AMBER', 'RED'].map(urgency => {
              const count = data.urgencyCounts[urgency];
              const pct = data.totalUrgency > 0 ? (count / data.totalUrgency * 100).toFixed(1) : 0;
              const colors = URGENCY_COLORS[urgency];
              return (
                <div key={urgency} className={`p-3 rounded-lg ${colors.bg} border-l-4 ${colors.border}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${colors.text}`}>{urgency}</span>
                    <span className={`font-bold ${colors.text}`}>{count.toLocaleString()} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Automation Rate by Urgency */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Automation Rate by Urgency (Medical Requests)</h3>
        <p className="text-sm text-slate-500 mb-4">
          Percentage of medical requests that were automatically processed by the triage system for each urgency level.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['GREEN', 'YELLOW', 'AMBER', 'RED'].map(urgency => {
            const autoData = data.automationByUrgency[urgency];
            const colors = URGENCY_COLORS[urgency];
            return (
              <div key={urgency} className={`p-4 rounded-lg ${colors.bg} border-l-4 ${colors.border}`}>
                <p className={`text-3xl font-bold ${colors.text}`}>{autoData.percentage.toFixed(1)}%</p>
                <p className={`text-sm ${colors.text}`}>{urgency} Automated</p>
                <p className={`text-xs ${colors.text} opacity-75 mt-1`}>
                  {autoData.automated.toLocaleString()} / {autoData.total.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Higher automation rates indicate pathways that can be processed without manual clinician review.
              Consider reviewing pathways with low automation rates for potential optimization.
            </span>
          </p>
        </div>
      </Card>

      {/* Urgency by Day */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Urgency by Day of Week</h3>
        <div className="h-64">
          <Bar
            data={{
              labels: DAYS_ORDER,
              datasets: [
                {
                  label: 'Green',
                  data: DAYS_ORDER.map(d => data.urgencyByDay[d].GREEN),
                  backgroundColor: URGENCY_COLORS.GREEN.chart,
                  stack: 'stack1',
                },
                {
                  label: 'Yellow',
                  data: DAYS_ORDER.map(d => data.urgencyByDay[d].YELLOW),
                  backgroundColor: URGENCY_COLORS.YELLOW.chart,
                  stack: 'stack1',
                },
                {
                  label: 'Amber',
                  data: DAYS_ORDER.map(d => data.urgencyByDay[d].AMBER),
                  backgroundColor: URGENCY_COLORS.AMBER.chart,
                  stack: 'stack1',
                },
                {
                  label: 'Red',
                  data: DAYS_ORDER.map(d => data.urgencyByDay[d].RED),
                  backgroundColor: URGENCY_COLORS.RED.chart,
                  stack: 'stack1',
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top' } },
              scales: {
                y: { beginAtZero: true, stacked: true, grid: { color: '#f1f5f9' } },
                x: { stacked: true, grid: { display: false } },
              },
            }}
          />
        </div>
      </Card>

      {/* Urgency by Hour */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Urgency by Hour of Day</h3>
        <div className="h-64">
          <Bar
            data={{
              labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
              datasets: [
                {
                  label: 'Green',
                  data: Array.from({ length: 24 }, (_, i) => data.urgencyByHour[i].GREEN),
                  backgroundColor: URGENCY_COLORS.GREEN.chart,
                  stack: 'stack1',
                },
                {
                  label: 'Yellow',
                  data: Array.from({ length: 24 }, (_, i) => data.urgencyByHour[i].YELLOW),
                  backgroundColor: URGENCY_COLORS.YELLOW.chart,
                  stack: 'stack1',
                },
                {
                  label: 'Amber',
                  data: Array.from({ length: 24 }, (_, i) => data.urgencyByHour[i].AMBER),
                  backgroundColor: URGENCY_COLORS.AMBER.chart,
                  stack: 'stack1',
                },
                {
                  label: 'Red',
                  data: Array.from({ length: 24 }, (_, i) => data.urgencyByHour[i].RED),
                  backgroundColor: URGENCY_COLORS.RED.chart,
                  stack: 'stack1',
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top' } },
              scales: {
                y: { beginAtZero: true, stacked: true, grid: { color: '#f1f5f9' } },
                x: { stacked: true, grid: { display: false } },
              },
            }}
          />
        </div>
      </Card>

      {/* Urgency by Symptom */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Urgency by Symptom (Top 15)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">Symptom</th>
                <th className="text-center py-2 px-3 font-medium text-green-600">Green</th>
                <th className="text-center py-2 px-3 font-medium text-yellow-600">Yellow</th>
                <th className="text-center py-2 px-3 font-medium text-amber-600">Amber</th>
                <th className="text-center py-2 px-3 font-medium text-red-600">Red</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.urgencyBySymptom)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 15)
                .map(([symptom, urgencies]) => (
                  <tr key={symptom} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700">{symptom}</td>
                    <td className="text-center py-2 px-3 text-green-600">{urgencies.GREEN}</td>
                    <td className="text-center py-2 px-3 text-yellow-600">{urgencies.YELLOW}</td>
                    <td className="text-center py-2 px-3 text-amber-600">{urgencies.AMBER}</td>
                    <td className="text-center py-2 px-3 text-red-600">{urgencies.RED}</td>
                    <td className="text-right py-2 px-3 font-bold text-slate-700">{urgencies.total.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// === AUTOMATION OPPORTUNITIES TAB ===
function OpportunitiesTab({ data }) {
  const [expandedPathways, setExpandedPathways] = useState(new Set());

  const togglePathway = (pathway) => {
    setExpandedPathways(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pathway)) {
        newSet.delete(pathway);
      } else {
        newSet.add(pathway);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
      {/* All Pathways - Non-Automated Requests */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">All Pathways - Non-Automated Requests</h3>
        <p className="text-sm text-slate-500 mb-4">
          All medical pathways showing the number of requests that were not automatically processed.
          Click on a row to see the breakdown by urgency level.
        </p>

        <div className="overflow-x-auto max-h-[32rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600 w-8"></th>
                <th className="text-left py-2 px-3 font-medium text-slate-600">Pathway</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">Total Requests</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">Not Automated</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">% Not Automated</th>
              </tr>
            </thead>
            <tbody>
              {data.pathwayAutomationList.map((pathway) => {
                const isExpanded = expandedPathways.has(pathway.pathway);
                return (
                  <React.Fragment key={pathway.pathway}>
                    <tr
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => togglePathway(pathway.pathway)}
                    >
                      <td className="py-2 px-3 text-slate-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-700">{pathway.pathway}</td>
                      <td className="text-center py-2 px-3 text-slate-600">{pathway.total.toLocaleString()}</td>
                      <td className="text-center py-2 px-3 font-medium text-red-600">{pathway.notAutomated.toLocaleString()}</td>
                      <td className="text-center py-2 px-3">
                        <span className={`font-medium ${pathway.notAutomatedPct >= 50 ? 'text-red-600' : pathway.notAutomatedPct >= 25 ? 'text-amber-600' : 'text-green-600'}`}>
                          {pathway.notAutomatedPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                    {isExpanded && pathway.byUrgency.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan="5" className="py-2 px-3">
                          <div className="ml-6 border-l-2 border-slate-200 pl-4">
                            <p className="text-xs font-medium text-slate-500 mb-2">Breakdown by Urgency:</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {pathway.byUrgency.map(urg => {
                                const colors = URGENCY_COLORS[urg.urgency];
                                return (
                                  <div key={urg.urgency} className={`p-2 rounded ${colors.bg} border-l-2 ${colors.border}`}>
                                    <p className={`text-xs font-medium ${colors.text}`}>{urg.urgency}</p>
                                    <p className="text-sm text-slate-700">
                                      <span className="font-medium">{urg.notAutomated}</span>
                                      <span className="text-slate-400"> / {urg.total}</span>
                                    </p>
                                    <p className={`text-xs ${urg.notAutomatedPct >= 50 ? 'text-red-600' : urg.notAutomatedPct >= 25 ? 'text-amber-600' : 'text-green-600'}`}>
                                      {urg.notAutomatedPct.toFixed(1)}% not automated
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              Click on any pathway to expand and see the breakdown by urgency level.
              Pathways with high volumes of non-automated requests may benefit from review.
            </span>
          </p>
        </div>
      </Card>

      {/* Existing Non-Automated Pathways Analysis */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Non-Automated Pathways with Appointments</h3>
        <p className="text-sm text-slate-500 mb-4">
          Adult medical requests where the pathway is not automated but patients often receive appointments anyway.
          These are opportunities to update pathways for automatic appointment booking.
        </p>

        {data.pathwayOpportunities.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle size={48} className="mx-auto mb-2 text-green-500" />
            <p>No significant automation opportunities found.</p>
            <p className="text-sm">All high-volume pathways appear to be well-optimized.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Pathway</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Total Requests</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Given Appointment</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Appointment Rate</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pathwayOpportunities.slice(0, 20).map((pathway) => {
                    const priority = pathway.appointmentRate >= 70 ? 'High' :
                                    pathway.appointmentRate >= 40 ? 'Medium' : 'Low';
                    const priorityColor = priority === 'High' ? 'text-red-600 bg-red-50' :
                                         priority === 'Medium' ? 'text-amber-600 bg-amber-50' :
                                         'text-green-600 bg-green-50';

                    return (
                      <tr key={pathway.pathway} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-medium text-slate-700">{pathway.pathway}</td>
                        <td className="text-center py-2 px-3 text-slate-600">{pathway.total}</td>
                        <td className="text-center py-2 px-3 text-slate-600">{pathway.withAppointment}</td>
                        <td className="text-center py-2 px-3 font-medium text-purple-600">
                          {pathway.appointmentRate.toFixed(0)}%
                        </td>
                        <td className="text-center py-2 px-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColor}`}>
                            {priority}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 flex items-start gap-2">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>High priority pathways</strong> have appointment rates of 70% or higher.
                  Consider updating these in your triage system to enable automatic appointment booking,
                  reducing clinician review time for routine requests.
                </span>
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Summary Stats */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Automation Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-slate-900">{data.pathwayOpportunities.length}</p>
            <p className="text-sm text-slate-500">Non-Automated Pathways</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-red-600">
              {data.pathwayOpportunities.filter(p => p.appointmentRate >= 70).length}
            </p>
            <p className="text-sm text-slate-500">High Priority</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-amber-600">
              {data.pathwayOpportunities.filter(p => p.appointmentRate >= 40 && p.appointmentRate < 70).length}
            </p>
            <p className="text-sm text-slate-500">Medium Priority</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// === NON-AUTOMATED INBOX TAB ===
function NonAutomatedInboxTab({ data }) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [selectedUrgency, setSelectedUrgency] = useState('ALL');
  const inboxData = data.nonAutomatedInboxData;

  const toggleItem = (key) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Filter pathway+urgency list by selected urgency
  const filteredPathwayUrgency = selectedUrgency === 'ALL'
    ? inboxData.pathwayUrgencySlotTypeList
    : inboxData.pathwayUrgencySlotTypeList.filter(item => item.urgency === selectedUrgency);

  return (
    <div className="space-y-6">
      {/* Overview metrics */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Non-Automated Request Analysis</h3>
        <p className="text-sm text-slate-500 mb-4">
          Analyse how clinicians manually triage requests - which slot types they assign compared to the automated urgency recommendation.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-slate-700">{inboxData.totalNonAutomated.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Non-Automated Requests</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-purple-600">{inboxData.pathwayUrgencySlotTypeList.length}</p>
            <p className="text-sm text-slate-500">Pathway + Urgency Combinations</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-amber-600">{inboxData.pathwayUrgencySlotTypeList.filter(p => p.hasVariation).length}</p>
            <p className="text-sm text-slate-500">With Multiple Slot Types</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <p className="text-3xl font-bold text-red-600">{inboxData.outlierCount.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Urgency Mismatches</p>
          </div>
        </div>
      </Card>

      {/* Urgency → Slot Type breakdown */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Clinician Slot Type Decisions by Urgency</h3>
        <p className="text-sm text-slate-500 mb-4">
          What slot types are clinicians assigning to non-automated requests for each urgency level?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['RED', 'AMBER', 'YELLOW', 'GREEN'].map(urg => {
            const urgData = inboxData.urgencyToSlotType[urg];
            const colors = URGENCY_COLORS[urg];
            return (
              <div key={urg} className={`p-4 rounded-lg border-l-4 ${colors.bg} ${colors.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`font-bold ${colors.text}`}>{urg}</h4>
                  <span className="text-sm text-slate-500">{urgData.total} requests</span>
                </div>
                {urgData.slotTypeList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No data</p>
                ) : (
                  <div className="space-y-2">
                    {urgData.slotTypeList.slice(0, 5).map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 truncate flex-1 mr-2" title={st.slotType}>{st.slotType}</span>
                        <span className={`font-medium ${colors.text}`}>{st.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                    {urgData.slotTypeList.length > 5 && (
                      <p className="text-xs text-slate-400">+{urgData.slotTypeList.length - 5} more...</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Pathway + Urgency → Slot Type breakdown */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Pathway + Urgency Combinations</h3>
            <p className="text-sm text-slate-500">
              See which slot types clinicians assign for each pathway and urgency combination.
              Sorted by variation score (combinations where clinicians assign different slot types).
            </p>
          </div>
          <select
            value={selectedUrgency}
            onChange={(e) => setSelectedUrgency(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-sm"
          >
            <option value="ALL">All Urgencies</option>
            <option value="RED">RED Only</option>
            <option value="AMBER">AMBER Only</option>
            <option value="YELLOW">YELLOW Only</option>
            <option value="GREEN">GREEN Only</option>
          </select>
        </div>

        <div className="overflow-x-auto max-h-[32rem]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600 w-8"></th>
                <th className="text-left py-2 px-3 font-medium text-slate-600">Pathway</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">Urgency</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">Requests</th>
                <th className="text-left py-2 px-3 font-medium text-slate-600">Top Slot Type</th>
                <th className="text-center py-2 px-3 font-medium text-slate-600">Variation</th>
              </tr>
            </thead>
            <tbody>
              {filteredPathwayUrgency.map((item) => {
                const key = `${item.pathway}|||${item.urgency}`;
                const isExpanded = expandedItems.has(key);
                const colors = URGENCY_COLORS[item.urgency] || { bg: 'bg-slate-100', text: 'text-slate-700' };
                return (
                  <React.Fragment key={key}>
                    <tr
                      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${item.hasVariation ? 'bg-amber-50/50' : ''}`}
                      onClick={() => toggleItem(key)}
                    >
                      <td className="py-2 px-3 text-slate-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-700">{item.pathway}</td>
                      <td className="text-center py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${colors.bg} ${colors.text}`}>
                          {item.urgency}
                        </span>
                      </td>
                      <td className="text-center py-2 px-3 text-slate-600">{item.total}</td>
                      <td className="py-2 px-3 text-slate-600">
                        <span className="truncate block max-w-[200px]" title={item.topSlotType}>{item.topSlotType}</span>
                        <span className="text-xs text-slate-400">({item.topSlotTypePct.toFixed(0)}%)</span>
                      </td>
                      <td className="text-center py-2 px-3">
                        {item.hasVariation ? (
                          <span className="text-amber-600 font-medium">{item.variationScore.toFixed(0)}%</span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && item.slotTypeList.length > 0 && (
                      <tr className="bg-slate-50">
                        <td colSpan="6" className="py-3 px-3">
                          <div className="ml-6 border-l-2 border-slate-200 pl-4">
                            <p className="text-xs font-medium text-slate-500 mb-2">All Slot Types Assigned:</p>
                            <div className="space-y-1">
                              {item.slotTypeList.map((st, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-sm">
                                  <div className="w-32 bg-slate-200 rounded-full h-2">
                                    <div
                                      className="bg-purple-500 h-2 rounded-full"
                                      style={{ width: `${st.percentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="font-medium text-slate-700">{st.percentage.toFixed(1)}%</span>
                                  <span className="text-slate-600">{st.slotType}</span>
                                  <span className="text-slate-400">({st.count})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPathwayUrgency.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Inbox size={48} className="mx-auto mb-2 text-slate-300" />
            <p>No pathway + urgency combinations found with sufficient data.</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700 flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              High variation scores indicate inconsistent clinician decisions - the same pathway + urgency combination
              results in different slot type assignments. This may indicate training needs or pathway ambiguity.
            </span>
          </p>
        </div>
      </Card>

      {/* Urgency Mismatches / Outliers */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Urgency Mismatches</h3>
        <p className="text-sm text-slate-500 mb-4">
          Cases where the slot type assigned by the clinician implies a different urgency than what the automation recommended.
          For example, an AMBER urgency request given a RED slot type.
        </p>

        {inboxData.outlierList.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle size={48} className="mx-auto mb-2 text-green-500" />
            <p>No significant urgency mismatches detected.</p>
            <p className="text-sm">Clinicians are generally assigning slot types matching the automated urgency.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[24rem]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Pathway</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Recommended</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600"></th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Assigned</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600">Count</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Slot Types Used</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxData.outlierList.slice(0, 30).map((item, idx) => {
                    const recColors = URGENCY_COLORS[item.recommendedUrgency] || {};
                    const assColors = URGENCY_COLORS[item.assignedUrgency] || {};
                    const isUpgrade = item.direction === 'upgraded';
                    return (
                      <tr key={idx} className={`border-b border-slate-100 ${isUpgrade ? 'bg-red-50/50' : 'bg-green-50/50'}`}>
                        <td className="py-2 px-3 font-medium text-slate-700">{item.pathway}</td>
                        <td className="text-center py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${recColors.bg} ${recColors.text}`}>
                            {item.recommendedUrgency}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">
                          {isUpgrade ? (
                            <ArrowUpRight size={16} className="text-red-500 mx-auto" title="Upgraded urgency" />
                          ) : (
                            <ArrowDownRight size={16} className="text-green-500 mx-auto" title="Downgraded urgency" />
                          )}
                        </td>
                        <td className="text-center py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${assColors.bg} ${assColors.text}`}>
                            {item.assignedUrgency}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3 font-medium text-slate-700">{item.count}</td>
                        <td className="py-2 px-3 text-slate-600">
                          <span className="truncate block max-w-[250px]" title={item.slotTypeList.map(st => st.slotType).join(', ')}>
                            {item.slotTypeList.slice(0, 2).map(st => st.slotType).join(', ')}
                            {item.slotTypeList.length > 2 && ` +${item.slotTypeList.length - 2} more`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight size={16} className="text-red-500" />
                  <span className="font-medium text-red-700">Upgraded</span>
                </div>
                <p className="text-sm text-red-600">
                  {inboxData.outlierList.filter(o => o.direction === 'upgraded').reduce((sum, o) => sum + o.count, 0)} requests
                  given higher urgency slot types than recommended
                </p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight size={16} className="text-green-500" />
                  <span className="font-medium text-green-700">Downgraded</span>
                </div>
                <p className="text-sm text-green-600">
                  {inboxData.outlierList.filter(o => o.direction === 'downgraded').reduce((sum, o) => sum + o.count, 0)} requests
                  given lower urgency slot types than recommended
                </p>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
