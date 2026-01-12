import * as XLSX from 'xlsx';

// === EXPORT FUNCTIONS ===

/**
 * Export Demand & Capacity dashboard to Excel
 * @param {Object} data - All dashboard data
 * @returns {XLSX.Workbook} Excel workbook ready for download
 */
export const exportDemandCapacityToExcel = (data) => {
  const {
    processedData,
    config,
    forecastData,
    aiReport,
    rawOnlineData,
    rawStaffData,
    rawSlotData,
    rawCombinedData,
  } = data;

  const workbook = XLSX.utils.book_new();
  const timestamp = new Date().toISOString();

  // Sheet 1: Metadata
  const metadata = [
    ['CAIP Analytics Export'],
    ['Dashboard Type', 'Demand & Capacity'],
    ['Version', '0.6.0'],
    ['Export Date', timestamp],
    ['Surgery Name', config?.surgeryName || 'Unknown'],
    ['ODS Code', config?.odsCode || ''],
    [''],
    ['This file contains all data needed to restore your dashboard.'],
    ['Import this file in CAIP Analytics to restore the interactive dashboard.'],
  ];
  const metadataSheet = XLSX.utils.aoa_to_sheet(metadata);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

  // Sheet 2: Processed Data
  if (processedData) {
    const processedSheet = XLSX.utils.json_to_sheet(processedData);
    XLSX.utils.book_append_sheet(workbook, processedSheet, 'Processed Data');
  }

  // Sheet 3: Forecast Data
  if (forecastData && forecastData.labels) {
    // Convert forecast object to array format for Excel
    const forecastArray = forecastData.labels.map((label, index) => ({
      Month: label,
      'Total Appointments (Actual)': forecastData.appts?.actual?.[index] || null,
      'Total Appointments (Projected)': forecastData.appts?.projected?.[index] || null,
      'GP Appointments (Actual)': forecastData.gpAppts?.actual?.[index] || null,
      'GP Appointments (Projected)': forecastData.gpAppts?.projected?.[index] || null,
      'Inbound Calls (Actual)': forecastData.calls?.actual?.[index] || null,
      'Inbound Calls (Projected)': forecastData.calls?.projected?.[index] || null,
    }));
    const forecastSheet = XLSX.utils.json_to_sheet(forecastArray);
    XLSX.utils.book_append_sheet(workbook, forecastSheet, 'Forecast Data');
  }

  // Sheet 4: AI Report
  if (aiReport) {
    const aiReportData = [
      ['AI Analysis Report'],
      [''],
      [aiReport],
    ];
    const aiSheet = XLSX.utils.aoa_to_sheet(aiReportData);
    XLSX.utils.book_append_sheet(workbook, aiSheet, 'AI Report');
  }

  // Sheet 5: Configuration
  if (config) {
    const configData = Object.entries(config).map(([key, value]) => [key, value]);
    const configSheet = XLSX.utils.aoa_to_sheet([['Key', 'Value'], ...configData]);
    XLSX.utils.book_append_sheet(workbook, configSheet, 'Config');
  }

  // Sheet 6-9: Raw Data
  if (rawOnlineData && rawOnlineData.length > 0) {
    const rawOnlineSheet = XLSX.utils.json_to_sheet(rawOnlineData);
    XLSX.utils.book_append_sheet(workbook, rawOnlineSheet, 'Raw Online Data');
  }

  if (rawStaffData && rawStaffData.length > 0) {
    const rawStaffSheet = XLSX.utils.json_to_sheet(rawStaffData);
    XLSX.utils.book_append_sheet(workbook, rawStaffSheet, 'Raw Staff Data');
  }

  if (rawSlotData && rawSlotData.length > 0) {
    const rawSlotSheet = XLSX.utils.json_to_sheet(rawSlotData);
    XLSX.utils.book_append_sheet(workbook, rawSlotSheet, 'Raw Slot Data');
  }

  if (rawCombinedData && rawCombinedData.length > 0) {
    const rawCombinedSheet = XLSX.utils.json_to_sheet(rawCombinedData);
    XLSX.utils.book_append_sheet(workbook, rawCombinedSheet, 'Raw Combined Data');
  }

  return workbook;
};

/**
 * Export Triage Slot Analysis dashboard to Excel
 * @param {Object} data - All dashboard data
 * @returns {XLSX.Workbook} Excel workbook ready for download
 */
export const exportTriageSlotsToExcel = (data) => {
  const { data: analysisData, slotCapacity, acceptWeekendRequests, files } = data;

  const workbook = XLSX.utils.book_new();
  const timestamp = new Date().toISOString();

  // Sheet 1: Metadata
  const metadata = [
    ['CAIP Analytics Export'],
    ['Dashboard Type', 'Triage Slot Analysis'],
    ['Version', '0.5.18'],
    ['Export Date', timestamp],
    ['File Name', files?.[0] || 'Unknown'],
    ['Accept Weekend Requests', acceptWeekendRequests ? 'Yes' : 'No'],
    [''],
    ['This file contains all data needed to restore your dashboard.'],
    ['Import this file in CAIP Analytics to restore the interactive dashboard.'],
  ];
  const metadataSheet = XLSX.utils.aoa_to_sheet(metadata);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

  // Sheet 2: Analysis Data
  if (analysisData && analysisData.length > 0) {
    const analysisSheet = XLSX.utils.json_to_sheet(analysisData);
    XLSX.utils.book_append_sheet(workbook, analysisSheet, 'Analysis Data');
  }

  // Sheet 3: Slot Capacity
  if (slotCapacity) {
    const capacityData = Object.entries(slotCapacity).map(([day, value]) => [day, value]);
    const capacitySheet = XLSX.utils.aoa_to_sheet([['Day', 'Capacity'], ...capacityData]);
    XLSX.utils.book_append_sheet(workbook, capacitySheet, 'Slot Capacity');
  }

  // Sheet 4: Configuration
  const configData = [
    ['Accept Weekend Requests', acceptWeekendRequests ? 'Yes' : 'No'],
    ['Files', files?.join(', ') || 'Unknown'],
  ];
  const configSheet = XLSX.utils.aoa_to_sheet([['Key', 'Value'], ...configData]);
  XLSX.utils.book_append_sheet(workbook, configSheet, 'Config');

  return workbook;
};

// === IMPORT FUNCTIONS ===

/**
 * Validate Excel file is a valid CAIP Analytics export
 * @param {XLSX.Workbook} workbook - Parsed workbook
 * @param {string} expectedType - 'demand-capacity' or 'triage-slots'
 * @returns {boolean} true if valid
 * @throws {Error} with descriptive message if invalid
 */
export const validateExcelFile = (workbook, expectedType) => {
  // Check Metadata sheet exists
  if (!workbook.Sheets['Metadata']) {
    throw new Error('Invalid Excel file: Missing Metadata sheet');
  }

  const metadataSheet = workbook.Sheets['Metadata'];
  const metadataData = XLSX.utils.sheet_to_json(metadataSheet, { header: 1 });

  // Check it's a CAIP Analytics export
  if (metadataData[0]?.[0] !== 'CAIP Analytics Export') {
    throw new Error('This is not a CAIP Analytics export file');
  }

  // Check dashboard type matches
  const dashboardTypeRow = metadataData.find(row => row[0] === 'Dashboard Type');
  if (!dashboardTypeRow) {
    throw new Error('Invalid Excel file: Missing Dashboard Type');
  }

  const actualType = dashboardTypeRow[1];
  const expectedTypeDisplay = expectedType === 'demand-capacity' ? 'Demand & Capacity' : 'Triage Slot Analysis';

  if (actualType !== expectedTypeDisplay) {
    throw new Error(`This is a ${actualType} export, not ${expectedTypeDisplay}`);
  }

  // Check required sheets based on type
  if (expectedType === 'demand-capacity') {
    const requiredSheets = ['Metadata', 'Processed Data', 'Config'];
    const missingSheets = requiredSheets.filter(sheet => !workbook.Sheets[sheet]);
    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheet: ${missingSheets[0]}`);
    }
  } else if (expectedType === 'triage-slots') {
    const requiredSheets = ['Metadata', 'Analysis Data', 'Slot Capacity', 'Config'];
    const missingSheets = requiredSheets.filter(sheet => !workbook.Sheets[sheet]);
    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheet: ${missingSheets[0]}`);
    }
  }

  return true;
};

/**
 * Restore Demand & Capacity dashboard from Excel
 * @param {XLSX.Workbook} workbook - Parsed workbook
 * @returns {Object} State object to restore dashboard
 */
export const restoreDemandCapacityFromExcel = (workbook) => {
  // Parse Processed Data
  const processedData = workbook.Sheets['Processed Data']
    ? XLSX.utils.sheet_to_json(workbook.Sheets['Processed Data'])
    : null;

  // Parse Forecast Data and reconstruct object structure
  let forecastData = null;
  if (workbook.Sheets['Forecast Data']) {
    const forecastArray = XLSX.utils.sheet_to_json(workbook.Sheets['Forecast Data']);
    if (forecastArray.length > 0) {
      // Helper to safely extract numeric values, converting null/undefined to null
      const extractValues = (key) => forecastArray.map(row => {
        const val = row[key];
        return (val === null || val === undefined || val === '') ? null : val;
      });

      forecastData = {
        labels: forecastArray.map(row => row.Month || ''),
        hasData: true,
        appts: {
          actual: extractValues('Total Appointments (Actual)'),
          projected: extractValues('Total Appointments (Projected)'),
        },
        gpAppts: {
          actual: extractValues('GP Appointments (Actual)'),
          projected: extractValues('GP Appointments (Projected)'),
        },
        calls: {
          actual: extractValues('Inbound Calls (Actual)'),
          projected: extractValues('Inbound Calls (Projected)'),
        },
      };
    }
  }

  // Parse AI Report
  let aiReport = null;
  if (workbook.Sheets['AI Report']) {
    const aiSheetData = XLSX.utils.sheet_to_json(workbook.Sheets['AI Report'], { header: 1 });
    aiReport = aiSheetData[2]?.[0] || null;
  }

  // Parse Configuration
  let config = {};
  if (workbook.Sheets['Config']) {
    const configData = XLSX.utils.sheet_to_json(workbook.Sheets['Config']);
    configData.forEach(row => {
      config[row.Key] = row.Value;
    });
  }

  // Parse Raw Data
  const rawOnlineData = workbook.Sheets['Raw Online Data']
    ? XLSX.utils.sheet_to_json(workbook.Sheets['Raw Online Data'])
    : [];

  const rawStaffData = workbook.Sheets['Raw Staff Data']
    ? XLSX.utils.sheet_to_json(workbook.Sheets['Raw Staff Data'])
    : [];

  const rawSlotData = workbook.Sheets['Raw Slot Data']
    ? XLSX.utils.sheet_to_json(workbook.Sheets['Raw Slot Data'])
    : [];

  const rawCombinedData = workbook.Sheets['Raw Combined Data']
    ? XLSX.utils.sheet_to_json(workbook.Sheets['Raw Combined Data'])
    : [];

  return {
    processedData,
    config,
    forecastData,
    aiReport,
    rawOnlineData,
    rawStaffData,
    rawSlotData,
    rawCombinedData,
  };
};

/**
 * Restore Triage Slot Analysis dashboard from Excel
 * @param {XLSX.Workbook} workbook - Parsed workbook
 * @returns {Object} State object to restore dashboard
 */
export const restoreTriageSlotsFromExcel = (workbook) => {
  // Parse Analysis Data
  const data = workbook.Sheets['Analysis Data']
    ? XLSX.utils.sheet_to_json(workbook.Sheets['Analysis Data'])
    : [];

  // Parse Slot Capacity
  let slotCapacity = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };
  if (workbook.Sheets['Slot Capacity']) {
    const capacityData = XLSX.utils.sheet_to_json(workbook.Sheets['Slot Capacity']);
    capacityData.forEach(row => {
      slotCapacity[row.Day] = row.Capacity;
    });
  }

  // Parse Configuration
  let acceptWeekendRequests = false;
  let files = ['Imported Dashboard'];
  if (workbook.Sheets['Config']) {
    const configData = XLSX.utils.sheet_to_json(workbook.Sheets['Config']);
    configData.forEach(row => {
      if (row.Key === 'Accept Weekend Requests') {
        acceptWeekendRequests = row.Value === 'Yes';
      } else if (row.Key === 'Files') {
        files = [row.Value];
      }
    });
  }

  return {
    data,
    slotCapacity,
    acceptWeekendRequests,
    files,
  };
};

/**
 * Generate filename for Excel export
 * @param {string} type - 'demand-capacity' or 'triage-slots'
 * @param {string} identifier - Surgery name or file name
 * @returns {string} Filename with timestamp
 */
export const generateExcelFilename = (type, identifier) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '_');

  if (type === 'demand-capacity') {
    return `CAIP_DemandCapacity_${safeIdentifier}_${timestamp}.xlsx`;
  } else {
    return `CAIP_TriageSlots_${safeIdentifier}_${timestamp}.xlsx`;
  }
};
