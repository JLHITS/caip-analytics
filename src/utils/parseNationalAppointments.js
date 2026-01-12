import * as XLSX from 'xlsx';

/**
 * Parse the National GPAD Appointments Excel file
 * Extracts data from Tables 1, 2a, 4, 5, and 6
 * Returns structured data for practices and national aggregates
 */
export function parseNationalAppointmentsData(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  // Extract month from Table 1 title
  const table1Sheet = workbook.Sheets['Table 1'];
  const table1Raw = XLSX.utils.sheet_to_json(table1Sheet, { header: 1 });

  // Look for the title row which contains the month (usually in first few rows)
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

  // Parse Table 1: Summary data (total appointments, list size, rate per 1000)
  const { practices: table1Practices, national: table1National } = parseTable1(table1Raw);

  // Parse Table 2a: Booking wait times (Same Day appointments)
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

  // Parse Table 5: Staff breakdown (GP vs Other Practice Staff)
  const table5Sheet = workbook.Sheets['Table 5'];
  const table5Raw = table5Sheet ? XLSX.utils.sheet_to_json(table5Sheet, { header: 1 }) : [];
  const { data: staffData, national: staffNational } = parseTable5(table5Raw);

  // Parse Table 6: Appointment status (Attended, DNA, Unknown)
  const table6Sheet = workbook.Sheets['Table 6'];
  const table6Raw = table6Sheet ? XLSX.utils.sheet_to_json(table6Sheet, { header: 1 }) : [];
  const { data: statusData, national: statusNational } = parseTable6(table6Raw);

  // Merge all data together by ODS code
  const enrichedPractices = table1Practices.map(practice => {
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

  // Data corrections for known mapping errors
  const DATA_CORRECTIONS = {
    'C82040': {
      icbCode: 'QT1',
      icbName: 'NHS NOTTINGHAM AND NOTTINGHAMSHIRE INTEGRATED CARE BOARD'
    }
  };

  // Apply corrections
  const correctedPractices = enrichedPractices.map(practice => {
    if (DATA_CORRECTIONS[practice.odsCode]) {
      return {
        ...practice,
        ...DATA_CORRECTIONS[practice.odsCode]
      };
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

/**
 * Parse Table 1: Summary (Total appointments, List Size, Rate per 1000)
 * Columns: Month, GP_CODE, GP_NAME, SUPPLIER, PCN_CODE, PCN_NAME, SUB_ICB_LOCATION_CODE, SUB_ICB_LOCATION_NAME,
 *          APPOINTMENTS, List_Size, Appointments_per_1000_patients
 */
function parseTable1(rawData) {
  const practices = [];
  let national = null;

  // Find header row to determine column indices
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('GP_CODE') || String(cell).includes('APPOINTMENTS'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.warn('Could not find header row in Table 1');
    return { practices: [], national: null };
  }

  // Data typically starts 1-2 rows after headers
  const dataStartRow = headerRowIndex + 1;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Check for National/Total row
    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = {
        totalAppointments: Number(row[8]) || 0,
        listSize: Number(row[9]) || 0,
        appointmentsPer1000: Number(row[10]) || 0,
      };
      continue;
    }

    // Skip empty or unmapped rows
    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    const practiceData = {
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
    };

    practices.push(practiceData);
  }

  return { practices, national };
}

/**
 * Parse Table 2a: All appointments by booking-to-appointment time
 * Columns include: Same_Day, 1_Day, 2-7_Days, 8-14_Days, 15-21_Days, 22-28_Days, MoreThan28_Days, Unknown
 */
function parseTable2a(rawData) {
  const data = {};
  let national = null;

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('Same_Day') || String(cell).includes('Same Day'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { data: {}, national: null };
  }

  const dataStartRow = headerRowIndex + 1;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Extract booking wait data
    // Column indices: 8=Same_Day, 9=1_Day, 10=2-7_Days, 11=8-14_Days, 12=15-21_Days, 13=22-28_Days, 14=MoreThan28_Days, 15=Unknown
    const waitData = {
      sameDay: Number(row[8]) || 0,
      oneDay: Number(row[9]) || 0,
      twoToSevenDays: Number(row[10]) || 0,
      eightToFourteenDays: Number(row[11]) || 0,
      fifteenToTwentyOneDays: Number(row[12]) || 0,
      twentyTwoToTwentyEightDays: Number(row[13]) || 0,
      moreThan28Days: Number(row[14]) || 0,
      unknown: Number(row[15]) || 0,
    };

    // Calculate total for percentages
    const total = waitData.sameDay + waitData.oneDay + waitData.twoToSevenDays +
      waitData.eightToFourteenDays + waitData.fifteenToTwentyOneDays +
      waitData.twentyTwoToTwentyEightDays + waitData.moreThan28Days + waitData.unknown;

    waitData.total = total;
    waitData.sameDayPct = total > 0 ? (waitData.sameDay / total) * 100 : 0;
    waitData.withinWeekPct = total > 0 ? ((waitData.sameDay + waitData.oneDay + waitData.twoToSevenDays) / total) * 100 : 0;

    // Check for National row
    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = waitData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = waitData;
  }

  return { data, national };
}

/**
 * Parse Table 3a: Appointments by category
 * Columns include category names in the header row
 */
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

  if (headerRowIndex === -1) {
    return { data: {}, national: null, categories: [] };
  }

  const headerRow = rawData[headerRowIndex] || [];
  const baseHeaders = new Set([
    'Month',
    'Appointment Month Start Date',
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

/**
 * Parse Table 4: Appointments by delivery mode
 * Columns: Face-to-Face, Home_Visit, Telephone, Video_Conference_Online, Unknown
 */
function parseTable4(rawData) {
  const data = {};
  let national = null;

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell).includes('Face-to-Face') || String(cell).includes('Telephone'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { data: {}, national: null };
  }

  const dataStartRow = headerRowIndex + 1;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Extract mode data
    // Column indices: 8=Face-to-Face, 9=Home_Visit, 10=Telephone, 11=Video_Conference_Online, 12=Unknown
    const modesData = {
      faceToFace: Number(row[8]) || 0,
      homeVisit: Number(row[9]) || 0,
      telephone: Number(row[10]) || 0,
      video: Number(row[11]) || 0,
      unknown: Number(row[12]) || 0,
    };

    // Calculate total and percentages
    const total = modesData.faceToFace + modesData.homeVisit + modesData.telephone + modesData.video + modesData.unknown;
    modesData.total = total;
    modesData.faceToFacePct = total > 0 ? (modesData.faceToFace / total) * 100 : 0;
    modesData.homeVisitPct = total > 0 ? (modesData.homeVisit / total) * 100 : 0;
    modesData.telephonePct = total > 0 ? (modesData.telephone / total) * 100 : 0;
    modesData.videoPct = total > 0 ? (modesData.video / total) * 100 : 0;

    // Check for National row
    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = modesData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = modesData;
  }

  return { data, national };
}

/**
 * Parse Table 5: Appointments by HCP Type (GP vs Other Practice Staff)
 * Columns: GP, Other_Practice_staff, Unknown
 */
function parseTable5(rawData) {
  const data = {};
  let national = null;

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell) === 'GP' || String(cell).includes('Other_Practice_staff') || String(cell).includes('Other Practice staff'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { data: {}, national: null };
  }

  const dataStartRow = headerRowIndex + 1;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Extract staff breakdown data
    // Column indices: 8=GP, 9=Other_Practice_staff, 10=Unknown
    const staffData = {
      gpAppointments: Number(row[8]) || 0,
      otherStaffAppointments: Number(row[9]) || 0,
      unknown: Number(row[10]) || 0,
    };

    // Calculate total and percentages
    const total = staffData.gpAppointments + staffData.otherStaffAppointments + staffData.unknown;
    staffData.total = total;
    staffData.gpPct = total > 0 ? (staffData.gpAppointments / total) * 100 : 0;
    staffData.otherStaffPct = total > 0 ? (staffData.otherStaffAppointments / total) * 100 : 0;
    staffData.gpToOtherRatio = staffData.otherStaffAppointments > 0
      ? staffData.gpAppointments / staffData.otherStaffAppointments
      : null;

    // Check for National row
    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = staffData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = staffData;
  }

  return { data, national };
}

/**
 * Parse Table 6: Appointments by status (Attended, DNA, Unknown)
 * Columns: Attended, DNA, Unknown
 */
function parseTable6(rawData) {
  const data = {};
  let national = null;

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    if (row && row.some(cell => String(cell) === 'Attended' || String(cell) === 'DNA')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return { data: {}, national: null };
  }

  const dataStartRow = headerRowIndex + 1;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Extract status data
    // Column indices: 8=Attended, 9=DNA, 10=Unknown
    const statusData = {
      attended: Number(row[8]) || 0,
      dna: Number(row[9]) || 0,
      unknown: Number(row[10]) || 0,
    };

    // Calculate total and percentages
    const total = statusData.attended + statusData.dna + statusData.unknown;
    statusData.total = total;
    statusData.attendedPct = total > 0 ? (statusData.attended / total) * 100 : 0;
    statusData.dnaPct = total > 0 ? (statusData.dna / total) * 100 : 0;

    // Check for National row
    if (String(row[0]).toLowerCase().includes('total') || String(row[0]).toLowerCase().includes('england')) {
      national = statusData;
      continue;
    }

    if (!odsCode || odsCode.toLowerCase() === 'unmapped') continue;

    data[odsCode] = statusData;
  }

  return { data, national };
}

/**
 * Get a practice's data by ODS code from parsed data
 */
export function getPracticeByODSCode(parsedData, odsCode) {
  if (!parsedData || !parsedData.practices || !odsCode) return null;
  return parsedData.practices.find(p => p.odsCode.toUpperCase() === odsCode.toUpperCase()) || null;
}

/**
 * Search practices by name or ODS code
 */
export function searchAppointmentPractices(parsedData, query, limit = 50) {
  if (!parsedData || !parsedData.practices || !query || query.length < 2) return [];

  const queryUpper = query.toUpperCase();
  const matches = parsedData.practices.filter(p =>
    p.odsCode.toUpperCase().includes(queryUpper) ||
    p.gpName.toUpperCase().includes(queryUpper)
  );

  return matches.slice(0, limit);
}

/**
 * Calculate rankings for a metric
 */
export function calculateAppointmentRankings(practices, metric, direction = 'desc') {
  const validPractices = practices.filter(p => {
    const value = getNestedValue(p, metric);
    return value !== null && value !== undefined && !isNaN(value);
  });

  const sorted = [...validPractices].sort((a, b) => {
    const aVal = getNestedValue(a, metric);
    const bVal = getNestedValue(b, metric);
    return direction === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return sorted.map((p, index) => ({
    ...p,
    rank: index + 1,
    percentile: ((sorted.length - index) / sorted.length) * 100,
  }));
}

// Helper to get nested property values
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    current = current[part];
  }
  return current;
}

export default {
  parseNationalAppointmentsData,
  getPracticeByODSCode,
  searchAppointmentPractices,
  calculateAppointmentRankings,
};
