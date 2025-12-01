import * as XLSX from 'xlsx';

/**
 * Parse the National Telephony Excel file and extract Tables 3, 4, and 5
 * Returns structured data for practices, national averages, and metrics
 */
export function parseNationalTelephonyData(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  // Extract month from Table 3 title (e.g., "October 2025")
  const table3Sheet = workbook.Sheets['Table 3'];
  const table3Raw = XLSX.utils.sheet_to_json(table3Sheet, { header: 1 });

  // Look for the title row which contains the month
  const titleRow = table3Raw.find(row => row[0] && String(row[0]).includes('October') || String(row[0]).includes('November') || String(row[0]).includes('December') || String(row[0]).includes('January'));
  let dataMonth = 'October 2025';

  if (titleRow) {
    const titleText = String(titleRow[0]);
    // Extract just the month and year (e.g., "October 2025") from title like "Table 3: Summary... England, October 2025"
    const monthMatch = titleText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
    if (monthMatch) {
      dataMonth = `${monthMatch[1]} ${monthMatch[2]}`;
    }
  }

  // Find actual data start row (after headers at row 9-10, skip row 11, data starts row 12+)
  // Row 12 is "Total" (National), then practices start at row 14
  const practices = [];
  let nationalData = null;

  for (let i = 12; i < table3Raw.length; i++) {
    const row = table3Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = row[1];
    const gpName = row[2];

    // Check if this is the National row FIRST (before skipping empty rows)
    // National row has row[0] === "Total" and no ODS code/GP name
    if (row[0] === 'Total' && !odsCode && !gpName) {
      nationalData = {
        month: row[0],
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
      };
      continue; // Skip to next row after capturing national data
    }

    // Skip empty rows
    if (!odsCode && !gpName) continue;

    // Skip "Unmapped" practices
    if (String(gpName).toLowerCase() === 'unmapped') continue;

    // Process regular practice data
    const practiceData = {
      month: row[0],
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
    };

    practices.push(practiceData);
  }

  // Parse Table 4 (Answered Calls - Wait Time and Duration)
  const table4Sheet = workbook.Sheets['Table 4'];
  const table4Raw = XLSX.utils.sheet_to_json(table4Sheet, { header: 1 });
  const table4Data = {};
  let table4National = null;

  // Table 4 headers are at rows 2-4, data starts around row 6+
  // Find where actual practice data starts (look for ODS codes)
  for (let i = 5; i < table4Raw.length; i++) {
    const row = table4Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Check for National row FIRST (before skipping empty rows)
    if (row[0] === 'Total' && !odsCode && !gpName) {
      table4National = {
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
      continue;
    }

    if (!odsCode && !gpName) continue;
    if (gpName.toLowerCase() === 'unmapped') continue;

    const waitTimeData = {
      // Wait time bins (columns vary by table structure)
      lessThan1Min: Number(row[15]) || 0,
      lessThan1MinPct: Number(row[16]) || 0,
      oneToTwoMin: Number(row[17]) || 0,
      oneToTwoMinPct: Number(row[18]) || 0,
      twoToThreeMin: Number(row[19]) || 0,
      twoToThreeMinPct: Number(row[20]) || 0,
      threeToFourMin: Number(row[21]) || 0,
      threeToFourMinPct: Number(row[22]) || 0,
      // Duration bins
      durationLessThan1Min: Number(row[24]) || 0,
      durationLessThan1MinPct: Number(row[25]) || 0,
      durationOneToTwoMin: Number(row[26]) || 0,
      durationOneToTwoMinPct: Number(row[27]) || 0,
      durationTwoToFiveMin: Number(row[28]) || 0,
      durationTwoToFiveMinPct: Number(row[29]) || 0,
      durationFivePlusMin: Number(row[30]) || 0,
      durationFivePlusMinPct: Number(row[31]) || 0,
    };

    table4Data[odsCode] = waitTimeData;
  }

  // Parse Table 5 (Missed Calls - Wait Time)
  const table5Sheet = workbook.Sheets['Table 5'];
  const table5Raw = XLSX.utils.sheet_to_json(table5Sheet, { header: 1 });
  const table5Data = {};
  let table5National = null;

  // Similar structure to Table 4
  for (let i = 12; i < table5Raw.length; i++) {
    const row = table5Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Check for National row FIRST (before skipping empty rows)
    if (row[0] === 'Total' && !odsCode && !gpName) {
      table5National = {
        lessThan1Min: Number(row[14]) || 0,
        lessThan1MinPct: Number(row[15]) || 0,
        oneToTwoMin: Number(row[16]) || 0,
        oneToTwoMinPct: Number(row[17]) || 0,
        twoToThreeMin: Number(row[18]) || 0,
        twoToThreeMinPct: Number(row[19]) || 0,
        threePlusMin: Number(row[20]) || 0,
        threePlusMinPct: Number(row[21]) || 0,
      };
      continue;
    }

    if (!odsCode && !gpName) continue;
    if (gpName.toLowerCase() === 'unmapped') continue;

    const missedWaitData = {
      lessThan1Min: Number(row[14]) || 0,
      lessThan1MinPct: Number(row[15]) || 0,
      oneToTwoMin: Number(row[16]) || 0,
      oneToTwoMinPct: Number(row[17]) || 0,
      twoToThreeMin: Number(row[18]) || 0,
      twoToThreeMinPct: Number(row[19]) || 0,
      threePlusMin: Number(row[20]) || 0,
      threePlusMinPct: Number(row[21]) || 0,
    };

    table5Data[odsCode] = missedWaitData;
  }

  // Merge all data together
  const enrichedPractices = practices.map(practice => ({
    ...practice,
    waitTimeData: table4Data[practice.odsCode] || null,
    missedWaitData: table5Data[practice.odsCode] || null,
  }));

  return {
    dataMonth,
    practices: enrichedPractices,
    national: {
      ...nationalData,
      waitTimeData: table4National,
      missedWaitData: table5National,
    },
  };
}

/**
 * Calculate the average/dominant wait time bin
 * Returns the bin with the highest percentage
 */
export function getAverageWaitTimeBin(waitTimeData) {
  if (!waitTimeData) return 'Unknown';

  const bins = [
    { label: 'Less than 1 minute', pct: waitTimeData.lessThan1MinPct || 0 },
    { label: '1-2 minutes', pct: waitTimeData.oneToTwoMinPct || 0 },
    { label: '2-3 minutes', pct: waitTimeData.twoToThreeMinPct || 0 },
  ];

  // Add 3+ or 3-4 depending on what's available
  if (waitTimeData.threeToFourMinPct !== undefined) {
    bins.push({ label: '3-4 minutes', pct: waitTimeData.threeToFourMinPct || 0 });
  }
  if (waitTimeData.threePlusMinPct !== undefined) {
    bins.push({ label: '3+ minutes', pct: waitTimeData.threePlusMinPct || 0 });
  }

  const maxBin = bins.reduce((max, bin) => bin.pct > max.pct ? bin : max, bins[0]);
  return maxBin.label;
}

/**
 * Calculate the average/dominant duration bin
 */
export function getAverageDurationBin(waitTimeData) {
  if (!waitTimeData) return 'Unknown';

  const bins = [
    { label: 'Less than 1 minute', pct: waitTimeData.durationLessThan1MinPct || 0 },
    { label: '1-2 minutes', pct: waitTimeData.durationOneToTwoMinPct || 0 },
    { label: '2-5 minutes', pct: waitTimeData.durationTwoToFiveMinPct || 0 },
    { label: '5+ minutes', pct: waitTimeData.durationFivePlusMinPct || 0 },
  ];

  const maxBin = bins.reduce((max, bin) => bin.pct > max.pct ? bin : max, bins[0]);
  return maxBin.label;
}
