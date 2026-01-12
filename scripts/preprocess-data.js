/**
 * Pre-process XLSX files to JSON for faster runtime loading
 * Run with: node scripts/preprocess-data.js
 *
 * This script converts the large XLSX files to optimized JSON,
 * reducing load time by 10-20x in the browser.
 */

import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const ASSETS_DIR = join(ROOT_DIR, 'src', 'assets');
const OUTPUT_DIR = join(ROOT_DIR, 'public', 'data');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Starting XLSX to JSON preprocessing...\n');

// ============================================
// APPOINTMENTS DATA
// ============================================

function parseAppointmentsFile(filePath) {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Extract month from Table 1 title
  const table1Sheet = workbook.Sheets['Table 1'];
  const table1Raw = XLSX.utils.sheet_to_json(table1Sheet, { header: 1 });

  let dataMonth = 'Unknown';
  for (let i = 0; i < Math.min(15, table1Raw.length); i++) {
    const row = table1Raw[i];
    if (row && row[0]) {
      const titleText = String(row[0]);
      const monthMatch = titleText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
      if (monthMatch) {
        dataMonth = `${monthMatch[1]} ${monthMatch[2]}`;
        break;
      }
    }
  }

  // Parse Table 1: Summary data
  const { practices: table1Practices, national: table1National } = parseTable1(table1Raw);

  // Parse Table 2a: Booking wait times
  const table2aSheet = workbook.Sheets['Table 2a'];
  const table2aRaw = table2aSheet ? XLSX.utils.sheet_to_json(table2aSheet, { header: 1 }) : [];
  const { data: bookingWaitData, national: bookingWaitNational } = parseTable2a(table2aRaw);

  // Parse Table 3a: Appointment categories
  const table3aSheet = workbook.Sheets['Table 3a'];
  const table3aRaw = table3aSheet ? XLSX.utils.sheet_to_json(table3aSheet, { header: 1 }) : [];
  const { data: categoryData, national: categoryNational, categories: categoryHeaders } = parseTable3a(table3aRaw);

  // Parse Table 4: Appointment modes
  const table4Sheet = workbook.Sheets['Table 4'];
  const table4Raw = table4Sheet ? XLSX.utils.sheet_to_json(table4Sheet, { header: 1 }) : [];
  const { data: modesData, national: modesNational } = parseTable4(table4Raw);

  // Parse Table 5: Staff breakdown
  const table5Sheet = workbook.Sheets['Table 5'];
  const table5Raw = table5Sheet ? XLSX.utils.sheet_to_json(table5Sheet, { header: 1 }) : [];
  const { data: staffData, national: staffNational } = parseTable5(table5Raw);

  // Parse Table 6: Appointment status
  const table6Sheet = workbook.Sheets['Table 6'];
  const table6Raw = table6Sheet ? XLSX.utils.sheet_to_json(table6Sheet, { header: 1 }) : [];
  const { data: statusData, national: statusNational } = parseTable6(table6Raw);

  // Merge all data
  const practices = table1Practices.map(practice => {
    const odsCode = practice.odsCode;
    return {
      ...practice,
      categoryBreakdown: categoryData[odsCode] || null,
      bookingWait: bookingWaitData[odsCode] || null,
      appointmentModes: modesData[odsCode] || null,
      staffBreakdown: staffData[odsCode] || null,
      appointmentStatus: statusData[odsCode] || null,
    };
  });

  // Apply data corrections
  const DATA_CORRECTIONS = {
    'C82040': { icbCode: 'QT1', icbName: 'NHS NOTTINGHAM AND NOTTINGHAMSHIRE INTEGRATED CARE BOARD' }
  };

  const correctedPractices = practices.map(practice => {
    if (DATA_CORRECTIONS[practice.odsCode]) {
      return { ...practice, ...DATA_CORRECTIONS[practice.odsCode] };
    }
    return practice;
  });

  return {
    dataMonth,
    practices: correctedPractices,
    national: {
      ...table1National,
      categoryBreakdown: categoryNational,
      categoryHeaders,
      bookingWait: bookingWaitNational,
      appointmentModes: modesNational,
      staffBreakdown: staffNational,
      appointmentStatus: statusNational,
    },
  };
}

function parseTable1(rawData) {
  const practices = [];
  let national = null;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('GP_CODE') || String(cell).includes('APPOINTMENTS'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return { practices: [], national: null };

  const dataStartRow = headerRowIndex + 1;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = {
        totalAppointments: Number(row[8]) || 0,
        listSize: Number(row[9]) || 0,
        appointmentsPer1000: Number(row[10]) || 0,
      };
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    practices.push({
      odsCode,
      gpName,
      supplier: String(row[3] || '').trim(),
      pcnCode: String(row[4] || '').trim(),
      pcnName: String(row[5] || '').trim(),
      subICBCode: String(row[6] || '').trim(),
      subICBName: String(row[7] || '').trim(),
      totalAppointments: Number(row[8]) || 0,
      listSize: Number(row[9]) || 0,
      appointmentsPer1000: Number(row[10]) || 0,
    });
  }

  return { practices, national };
}

function parseTable2a(rawData) {
  const data = {};
  let national = null;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('Same_Day') || String(cell).includes('Same Day'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return { data: {}, national: null };

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();

    // Column indices: 8=Same_Day, 9=1_Day, 10=2-7_Days, 11=8-14_Days, 12=15-21_Days, 13=22-28_Days, 14=>28_Days, 15=Unknown
    const sameDay = Number(row[8]) || 0;
    const oneDay = Number(row[9]) || 0;
    const twoToSevenDays = Number(row[10]) || 0;
    const eightToFourteenDays = Number(row[11]) || 0;
    const fifteenToTwentyOneDays = Number(row[12]) || 0;
    const twentyTwoToTwentyEightDays = Number(row[13]) || 0;
    const moreThan28Days = Number(row[14]) || 0;
    const unknown = Number(row[15]) || 0;

    const total = sameDay + oneDay + twoToSevenDays + eightToFourteenDays +
      fifteenToTwentyOneDays + twentyTwoToTwentyEightDays + moreThan28Days + unknown;

    const waitData = {
      sameDay,
      oneDay,
      twoToSevenDays,
      eightToFourteenDays,
      fifteenToTwentyOneDays,
      twentyTwoToTwentyEightDays,
      moreThan28Days,
      unknown,
      total,
      sameDayPct: total > 0 ? (sameDay / total) * 100 : 0,
      oneToSevenDaysPct: total > 0 ? ((oneDay + twoToSevenDays) / total) * 100 : 0,
      eightToFourteenDaysPct: total > 0 ? (eightToFourteenDays / total) * 100 : 0,
      fifteenToTwentyOneDaysPct: total > 0 ? (fifteenToTwentyOneDays / total) * 100 : 0,
      twentyTwoToTwentyEightDaysPct: total > 0 ? (twentyTwoToTwentyEightDays / total) * 100 : 0,
      twentyEightPlusDaysPct: total > 0 ? (moreThan28Days / total) * 100 : 0,
      withinWeekPct: total > 0 ? ((sameDay + oneDay + twoToSevenDays) / total) * 100 : 0,
    };

    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = waitData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = waitData;
  }

  return { data, national };
}

function parseTable3a(rawData) {
  const data = {};
  let national = null;
  let categories = [];

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(25, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('GP_CODE') || String(cell).includes('GP_CODE'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return { data: {}, national: null, categories: [] };

  const headerRow = rawData[headerRowIndex] || [];
  const baseHeaders = new Set([
    'Month',
    'GP_CODE',
    'GP_NAME',
    'SUPPLIER',
    'PCN_CODE',
    'PCN_NAME',
    'SUB_ICB_LOCATION_CODE',
    'SUB_ICB_LOCATION_NAME',
    'SUB_ICB_CODE',
    'SUB_ICB_NAME',
  ]);

  categories = headerRow
    .map((cell, idx) => ({ label: String(cell || '').trim(), idx }))
    .filter(item => item.label && !baseHeaders.has(item.label))
    .map(item => item);

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    const categoryCounts = {};
    categories.forEach(({ label, idx }) => {
      categoryCounts[label] = Number(row[idx]) || 0;
    });

    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = categoryCounts;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;
    if (gpName.toLowerCase() === 'unmapped') continue;

    data[odsCode] = categoryCounts;
  }

  return { data, national, categories: categories.map(item => item.label) };
}

function parseTable4(rawData) {
  const data = {};
  let national = null;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('Face-to-Face') || String(cell).includes('Telephone'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return { data: {}, national: null };

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();

    // Column indices: 8=Face-to-Face, 9=Home_Visit, 10=Telephone, 11=Video, 12=Unknown
    const faceToFace = Number(row[8]) || 0;
    const homeVisit = Number(row[9]) || 0;
    const telephone = Number(row[10]) || 0;
    const video = Number(row[11]) || 0;
    const unknown = Number(row[12]) || 0;
    const total = faceToFace + homeVisit + telephone + video + unknown;

    const modesData = {
      faceToFace,
      homeVisit,
      telephone,
      video,
      unknown,
      total,
      faceToFacePct: total > 0 ? (faceToFace / total) * 100 : 0,
      homeVisitPct: total > 0 ? (homeVisit / total) * 100 : 0,
      telephonePct: total > 0 ? (telephone / total) * 100 : 0,
      videoPct: total > 0 ? (video / total) * 100 : 0,
    };

    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = modesData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = modesData;
  }

  return { data, national };
}

function parseTable5(rawData) {
  const data = {};
  let national = null;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('GP_CODE'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return { data: {}, national: null };

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();

    // Column indices: 8=GP, 9=Other_Practice_staff, 10=Unknown
    const gpAppointments = Number(row[8]) || 0;
    const otherStaffAppointments = Number(row[9]) || 0;
    const unknownStaff = Number(row[10]) || 0;
    const total = gpAppointments + otherStaffAppointments + unknownStaff;

    const staffData = {
      gpAppointments,
      otherStaffAppointments,
      unknownStaff,
      total,
      gpPct: total > 0 ? (gpAppointments / total) * 100 : 0,
      otherStaffPct: total > 0 ? (otherStaffAppointments / total) * 100 : 0,
      gpToOtherRatio: otherStaffAppointments > 0 ? gpAppointments / otherStaffAppointments : null,
    };

    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = staffData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = staffData;
  }

  return { data, national };
}

function parseTable6(rawData) {
  const data = {};
  let national = null;

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell) === 'Attended' || String(cell) === 'DNA')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return { data: {}, national: null };

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();

    // Column indices: 8=Attended, 9=DNA, 10=Unknown
    const attended = Number(row[8]) || 0;
    const dna = Number(row[9]) || 0;
    const unknownStatus = Number(row[10]) || 0;
    const total = attended + dna + unknownStatus;

    const statusData = {
      attended,
      dna,
      unknownStatus,
      total,
      attendedPct: total > 0 ? (attended / total) * 100 : 0,
      dnaPct: total > 0 ? (dna / total) * 100 : 0,
    };

    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = statusData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = statusData;
  }

  return { data, national };
}

// ============================================
// TELEPHONY DATA
// ============================================

function parseTelephonyFile(filePath) {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const table3Sheet = workbook.Sheets['Table 3'];
  const table3Raw = XLSX.utils.sheet_to_json(table3Sheet, { header: 1 });

  let dataMonth = 'October 2025';
  const titleRow = table3Raw.find(row => row[0] && String(row[0]).match(/(October|November|December|January)/));
  if (titleRow) {
    const monthMatch = String(titleRow[0]).match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
    if (monthMatch) dataMonth = `${monthMatch[1]} ${monthMatch[2]}`;
  }

  const practices = [];
  let nationalData = null;

  for (let i = 12; i < table3Raw.length; i++) {
    const row = table3Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = row[1];
    const gpName = row[2];

    if (row[0] === 'Total' && !odsCode && !gpName) {
      nationalData = {
        inboundCalls: Number(row[11]) || 0,
        answered: Number(row[13]) || 0,
        answeredPct: Number(row[14]) || 0,
        endedDuringIVR: Number(row[15]) || 0,
        endedDuringIVRPct: Number(row[16]) || 0,
        callbackRequested: Number(row[17]) || 0,
        callbackRequestedPct: Number(row[18]) || 0,
        missed: Number(row[20]) || 0,
        missedPct: Number(row[21]) || 0,
        callbackMade: Number(row[23]) || 0,
        callbackMadePct: Number(row[24]) || 0,
      };
      continue;
    }

    if (!odsCode && !gpName) continue;
    if (String(gpName).toLowerCase() === 'unmapped') continue;

    practices.push({
      odsCode: String(odsCode || '').trim(),
      gpName: String(gpName || '').trim(),
      pcnCode: String(row[3] || '').trim(),
      pcnName: String(row[4] || '').trim(),
      subICBCode: String(row[5] || '').trim(),
      subICBName: String(row[6] || '').trim(),
      icbCode: String(row[7] || '').trim(),
      icbName: String(row[8] || '').trim(),
      regionCode: String(row[9] || '').trim(),
      regionName: String(row[10] || '').trim(),
      inboundCalls: Number(row[11]) || 0,
      answered: Number(row[13]) || 0,
      answeredPct: Number(row[14]) || 0,
      endedDuringIVR: Number(row[15]) || 0,
      endedDuringIVRPct: Number(row[16]) || 0,
      callbackRequested: Number(row[17]) || 0,
      callbackRequestedPct: Number(row[18]) || 0,
      missed: Number(row[20]) || 0,
      missedPct: Number(row[21]) || 0,
      callbackMade: Number(row[23]) || 0,
      callbackMadePct: Number(row[24]) || 0,
    });
  }

  // Parse Table 4 for wait times
  const table4Sheet = workbook.Sheets['Table 4'];
  const table4Raw = XLSX.utils.sheet_to_json(table4Sheet, { header: 1 });
  const table4Data = {};

  for (let i = 5; i < table4Raw.length; i++) {
    const row = table4Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    if (!odsCode && !gpName) continue;
    if (gpName.toLowerCase() === 'unmapped') continue;

    table4Data[odsCode] = {
      lessThan1Min: Number(row[15]) || 0,
      lessThan1MinPct: Number(row[16]) || 0,
      oneToTwoMin: Number(row[17]) || 0,
      oneToTwoMinPct: Number(row[18]) || 0,
      twoToThreeMin: Number(row[19]) || 0,
      twoToThreeMinPct: Number(row[20]) || 0,
      threeToFourMin: Number(row[21]) || 0,
      threeToFourMinPct: Number(row[22]) || 0,
      durationLessThan1Min: Number(row[24]) || 0,
      durationLessThan1MinPct: Number(row[25]) || 0,
      durationOneToTwoMin: Number(row[26]) || 0,
      durationOneToTwoMinPct: Number(row[27]) || 0,
      durationTwoToFiveMin: Number(row[28]) || 0,
      durationTwoToFiveMinPct: Number(row[29]) || 0,
      durationFivePlusMin: Number(row[30]) || 0,
      durationFivePlusMinPct: Number(row[31]) || 0,
    };
  }

  // Parse Table 5 for missed call wait times
  const table5Sheet = workbook.Sheets['Table 5'];
  const table5Raw = table5Sheet ? XLSX.utils.sheet_to_json(table5Sheet, { header: 1 }) : [];
  const table5Data = {};

  for (let i = 5; i < table5Raw.length; i++) {
    const row = table5Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    if (!odsCode && !gpName) continue;
    if (gpName.toLowerCase() === 'unmapped') continue;

    // Missed call wait time columns (columns 15-22 for wait times before giving up)
    table5Data[odsCode] = {
      lessThan1Min: Number(row[15]) || 0,
      lessThan1MinPct: Number(row[16]) || 0,
      oneToTwoMin: Number(row[17]) || 0,
      oneToTwoMinPct: Number(row[18]) || 0,
      twoToThreeMin: Number(row[19]) || 0,
      twoToThreeMinPct: Number(row[20]) || 0,
      threeToFourMin: Number(row[21]) || 0,
      threeToFourMinPct: Number(row[22]) || 0,
    };
  }

  // Merge wait time data - use waitTimeData and missedWaitData to match component expectations
  const enrichedPractices = practices.map(p => ({
    ...p,
    waitTimeData: table4Data[p.odsCode] || null,
    missedWaitData: table5Data[p.odsCode] || null,
  }));

  return { dataMonth, practices: enrichedPractices, national: nationalData };
}

// ============================================
// ONLINE CONSULTATIONS DATA
// ============================================

function parseOCFile(filePath) {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const table2Sheet = workbook.Sheets['Table 2'];
  const table2Raw = XLSX.utils.sheet_to_json(table2Sheet, { header: 1 });

  let dataMonth = 'Unknown';
  const titleRow = table2Raw[9];
  if (titleRow && titleRow[0]) {
    const monthMatch = String(titleRow[0]).match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
    if (monthMatch) dataMonth = `${monthMatch[1]} ${monthMatch[2]}`;
  }

  const headerRow = table2Raw[11] || [];
  const hasParticipationColumn = headerRow.length > 18 && String(headerRow[18] || '').toLowerCase().includes('participation');

  const DATA_CORRECTIONS = {
    'C82040': { icbCode: 'QT1', icbName: 'NHS NOTTINGHAM AND NOTTINGHAMSHIRE INTEGRATED CARE BOARD' }
  };

  const practices = [];
  let nationalTotals = { totalSubmissions: 0, clinicalSubmissions: 0, adminSubmissions: 0, otherSubmissions: 0, totalPatients: 0, participatingPractices: 0 };

  for (let i = 12; i < table2Raw.length; i++) {
    const row = table2Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    if (!odsCode || !gpName || gpName.toLowerCase() === 'unmapped') continue;

    const submissions = Number(row[12]) || 0;
    const clinicalSubmissions = Number(row[13]) || 0;
    const adminSubmissions = Number(row[14]) || 0;
    const otherSubmissions = Number(row[15]) || 0;
    const listSize = Number(row[16]) || 0;
    const ratePer1000 = Number(row[17]) || 0;
    const rawParticipation = row[18];
    const participation = hasParticipationColumn
      ? (String(rawParticipation).trim() === '*' ? 1 : (Number(rawParticipation) || 0))
      : (submissions > 0 ? 1 : 0);

    const practiceData = {
      odsCode,
      gpName,
      pcnCode: String(row[3] || '').trim(),
      pcnName: String(row[4] || '').trim(),
      subICBCode: String(row[5] || '').trim(),
      subICBName: String(row[6] || '').trim(),
      icbCode: String(row[7] || '').trim(),
      icbName: String(row[8] || '').trim(),
      regionCode: String(row[9] || '').trim(),
      regionName: String(row[10] || '').trim(),
      suppliers: String(row[11] || '').split(',').map(s => s.trim()).filter(s => s),
      submissions,
      clinicalSubmissions,
      adminSubmissions,
      otherSubmissions,
      listSize,
      ratePer1000,
      participation,
      clinicalPct: submissions > 0 ? clinicalSubmissions / submissions : 0,
      adminPct: submissions > 0 ? adminSubmissions / submissions : 0,
      otherPct: submissions > 0 ? otherSubmissions / submissions : 0,
      // Per 1000 rates for each type
      clinicalPer1000: listSize > 0 ? (clinicalSubmissions / listSize) * 1000 : 0,
      adminPer1000: listSize > 0 ? (adminSubmissions / listSize) * 1000 : 0,
      otherPer1000: listSize > 0 ? (otherSubmissions / listSize) * 1000 : 0,
    };

    if (DATA_CORRECTIONS[odsCode]) Object.assign(practiceData, DATA_CORRECTIONS[odsCode]);

    practices.push(practiceData);

    if (participation === 1) {
      nationalTotals.totalSubmissions += submissions;
      nationalTotals.clinicalSubmissions += clinicalSubmissions;
      nationalTotals.adminSubmissions += adminSubmissions;
      nationalTotals.otherSubmissions += otherSubmissions;
      nationalTotals.totalPatients += listSize;
      nationalTotals.participatingPractices++;
    }
  }

  const national = {
    ...nationalTotals,
    avgSubmissionsPerPractice: nationalTotals.participatingPractices > 0 ? nationalTotals.totalSubmissions / nationalTotals.participatingPractices : 0,
    avgRatePer1000: nationalTotals.totalPatients > 0 ? (nationalTotals.totalSubmissions / nationalTotals.totalPatients) * 1000 : 0,
    clinicalPct: nationalTotals.totalSubmissions > 0 ? nationalTotals.clinicalSubmissions / nationalTotals.totalSubmissions : 0,
    adminPct: nationalTotals.totalSubmissions > 0 ? nationalTotals.adminSubmissions / nationalTotals.totalSubmissions : 0,
    otherPct: nationalTotals.totalSubmissions > 0 ? nationalTotals.otherSubmissions / nationalTotals.totalSubmissions : 0,
  };

  return { dataMonth, practices, national };
}

// ============================================
// MAIN PROCESSING
// ============================================

// Process Appointments
console.log('Processing Appointments data...');
const apptDir = join(ASSETS_DIR, 'appt');
const apptFiles = readdirSync(apptDir).filter(f => f.endsWith('.xlsx'));
const appointmentsData = {};

for (const file of apptFiles) {
  try {
    const filePath = join(apptDir, file);
    const data = parseAppointmentsFile(filePath);
    appointmentsData[data.dataMonth] = data;
    console.log(`  ✓ ${data.dataMonth} - ${data.practices.length} practices`);
  } catch (err) {
    console.error(`  ✗ Error parsing ${file}:`, err.message);
  }
}

writeFileSync(
  join(OUTPUT_DIR, 'appointments.json'),
  JSON.stringify(appointmentsData),
  'utf-8'
);
console.log(`  Saved appointments.json (${Object.keys(appointmentsData).length} months)\n`);

// Process Telephony
console.log('Processing Telephony data...');
const telephonyFiles = readdirSync(ASSETS_DIR).filter(f => f.includes('Telephony') && f.endsWith('.xlsx'));
const telephonyData = {};

for (const file of telephonyFiles) {
  try {
    const filePath = join(ASSETS_DIR, file);
    const data = parseTelephonyFile(filePath);
    telephonyData[data.dataMonth] = data;
    console.log(`  ✓ ${data.dataMonth} - ${data.practices.length} practices`);
  } catch (err) {
    console.error(`  ✗ Error parsing ${file}:`, err.message);
  }
}

writeFileSync(
  join(OUTPUT_DIR, 'telephony.json'),
  JSON.stringify(telephonyData),
  'utf-8'
);
console.log(`  Saved telephony.json (${Object.keys(telephonyData).length} months)\n`);

// Process Online Consultations
console.log('Processing Online Consultations data...');
const ocFiles = readdirSync(ASSETS_DIR).filter(f => (f.includes('Online Consultation') || f.includes('OC Systems')) && f.endsWith('.xlsx'));
const ocData = {};

for (const file of ocFiles) {
  try {
    const filePath = join(ASSETS_DIR, file);
    const data = parseOCFile(filePath);
    ocData[data.dataMonth] = data;
    console.log(`  ✓ ${data.dataMonth} - ${data.practices.length} practices`);
  } catch (err) {
    console.error(`  ✗ Error parsing ${file}:`, err.message);
  }
}

writeFileSync(
  join(OUTPUT_DIR, 'online-consultations.json'),
  JSON.stringify(ocData),
  'utf-8'
);
console.log(`  Saved online-consultations.json (${Object.keys(ocData).length} months)\n`);

// Summary
console.log('='.repeat(50));
console.log('Preprocessing complete!');
console.log(`  Appointments: ${Object.keys(appointmentsData).length} months`);
console.log(`  Telephony: ${Object.keys(telephonyData).length} months`);
console.log(`  Online Consultations: ${Object.keys(ocData).length} months`);
console.log('='.repeat(50));
