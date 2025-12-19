import * as XLSX from 'xlsx';

/**
 * Parse the Online Consultations Excel file
 * Returns structured data for practices and national summary
 */
export function parseOnlineConsultationsData(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  // Parse Table 2 - Practice-level data
  const table2Sheet = workbook.Sheets['Table 2'];
  const table2Raw = XLSX.utils.sheet_to_json(table2Sheet, { header: 1 });

  // Extract month from title row (row 9)
  let dataMonth = 'Unknown';
  const titleRow = table2Raw[9];
  if (titleRow && titleRow[0]) {
    const titleText = String(titleRow[0]);
    // Extract month like "October 2025" from "Table 2: Submissions received by practices via Online Consultation Systems, October 2025"
    const monthMatch = titleText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
    if (monthMatch) {
      dataMonth = `${monthMatch[1]} ${monthMatch[2]}`;
    }
  }

  // Headers are at row 11 (index 11), data starts at row 12
  const headerRow = table2Raw[11] || [];
  // Check if file has participation column (older files from 2024 don't have it)
  const hasParticipationColumn = headerRow.length > 18 &&
    String(headerRow[18] || '').toLowerCase().includes('participation');

  // Data corrections for known mapping errors in NHS England source data
  const DATA_CORRECTIONS = {
    // Orchard Surgery should be mapped to NHS Nottingham and Nottinghamshire ICB
    'C82040': {
      icbCode: 'QT1',
      icbName: 'NHS NOTTINGHAM AND NOTTINGHAMSHIRE INTEGRATED CARE BOARD'
    }
  };

  const practices = [];
  let nationalTotals = {
    totalSubmissions: 0,
    clinicalSubmissions: 0,
    adminSubmissions: 0,
    otherSubmissions: 0,
    totalPatients: 0,
    participatingPractices: 0
  };

  for (let i = 12; i < table2Raw.length; i++) {
    const row = table2Raw[i];
    if (!row || row.length === 0) continue;

    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    // Skip empty rows or unmapped
    if (!odsCode || !gpName || gpName.toLowerCase() === 'unmapped') continue;

    const submissions = Number(row[12]) || 0;
    const clinicalSubmissions = Number(row[13]) || 0;
    const adminSubmissions = Number(row[14]) || 0;
    const otherSubmissions = Number(row[15]) || 0;
    const listSize = Number(row[16]) || 0;
    const ratePer1000 = Number(row[17]) || 0;
    // For older files without participation column, assume all practices with data are participating
    const participation = hasParticipationColumn ? (Number(row[18]) || 0) : (submissions > 0 ? 1 : 0);

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
      supplier: String(row[11] || '').trim(),
      suppliers: String(row[11] || '').split(',').map(s => s.trim()).filter(s => s),
      submissions,
      clinicalSubmissions,
      adminSubmissions,
      otherSubmissions,
      listSize,
      ratePer1000,
      participation,
      // Calculate percentages
      clinicalPct: submissions > 0 ? clinicalSubmissions / submissions : 0,
      adminPct: submissions > 0 ? adminSubmissions / submissions : 0,
      otherPct: submissions > 0 ? otherSubmissions / submissions : 0,
      // Calculate per 1000 rates for each type
      clinicalPer1000: listSize > 0 ? (clinicalSubmissions / listSize) * 1000 : 0,
      adminPer1000: listSize > 0 ? (adminSubmissions / listSize) * 1000 : 0,
      otherPer1000: listSize > 0 ? (otherSubmissions / listSize) * 1000 : 0,
    };

    // Apply any known data corrections
    if (DATA_CORRECTIONS[odsCode]) {
      Object.assign(practiceData, DATA_CORRECTIONS[odsCode]);
    }

    practices.push(practiceData);

    // Accumulate national totals
    if (participation === 1) {
      nationalTotals.totalSubmissions += submissions;
      nationalTotals.clinicalSubmissions += clinicalSubmissions;
      nationalTotals.adminSubmissions += adminSubmissions;
      nationalTotals.otherSubmissions += otherSubmissions;
      nationalTotals.totalPatients += listSize;
      nationalTotals.participatingPractices++;
    }
  }

  // Calculate national averages
  const national = {
    ...nationalTotals,
    avgSubmissionsPerPractice: nationalTotals.participatingPractices > 0
      ? nationalTotals.totalSubmissions / nationalTotals.participatingPractices
      : 0,
    avgRatePer1000: nationalTotals.totalPatients > 0
      ? (nationalTotals.totalSubmissions / nationalTotals.totalPatients) * 1000
      : 0,
    clinicalPct: nationalTotals.totalSubmissions > 0
      ? nationalTotals.clinicalSubmissions / nationalTotals.totalSubmissions
      : 0,
    adminPct: nationalTotals.totalSubmissions > 0
      ? nationalTotals.adminSubmissions / nationalTotals.totalSubmissions
      : 0,
    otherPct: nationalTotals.totalSubmissions > 0
      ? nationalTotals.otherSubmissions / nationalTotals.totalSubmissions
      : 0,
  };

  // Parse Table 3 - Time distribution (optional, for future use)
  const table3Sheet = workbook.Sheets['Table 3'];
  const table3Raw = XLSX.utils.sheet_to_json(table3Sheet, { header: 1 });
  const timeDistribution = {};

  // Headers at row 11, data starts at row 12
  const timeHeaders = table3Raw[11] || [];
  for (let i = 12; i < 19; i++) { // 7 days
    const row = table3Raw[i];
    if (row && row[0]) {
      const day = String(row[0]).trim();
      timeDistribution[day] = {
        '00:00-05:59': Number(row[1]) || 0,
        '06:00-07:59': Number(row[2]) || 0,
        '08:00-09:59': Number(row[3]) || 0,
        '10:00-11:59': Number(row[4]) || 0,
        '12:00-13:59': Number(row[5]) || 0,
        '14:00-15:59': Number(row[6]) || 0,
        '16:00-17:59': Number(row[7]) || 0,
        '18:00-23:59': Number(row[8]) || 0,
      };
    }
  }

  return {
    dataMonth,
    practices,
    national,
    timeDistribution
  };
}

/**
 * Get supplier statistics from practice data
 */
export function getSupplierStats(practices) {
  const supplierCounts = {};
  const supplierSubmissions = {};

  practices.forEach(practice => {
    practice.suppliers.forEach(supplier => {
      if (!supplierCounts[supplier]) {
        supplierCounts[supplier] = 0;
        supplierSubmissions[supplier] = 0;
      }
      supplierCounts[supplier]++;
      supplierSubmissions[supplier] += practice.submissions;
    });
  });

  return Object.entries(supplierCounts)
    .map(([name, count]) => ({
      name,
      practiceCount: count,
      totalSubmissions: supplierSubmissions[name]
    }))
    .sort((a, b) => b.practiceCount - a.practiceCount);
}

/**
 * Calculate PCN averages for online consultations
 */
export function calculateOCPCNAverages(practices) {
  const pcnData = {};

  practices.forEach(practice => {
    if (!practice.pcnCode || !practice.pcnName) return;

    if (!pcnData[practice.pcnCode]) {
      pcnData[practice.pcnCode] = {
        pcnCode: practice.pcnCode,
        pcnName: practice.pcnName,
        icbCode: practice.icbCode,
        icbName: practice.icbName,
        totalSubmissions: 0,
        clinicalSubmissions: 0,
        adminSubmissions: 0,
        otherSubmissions: 0,
        totalPatients: 0,
        practiceCount: 0,
        suppliers: new Set()
      };
    }

    const pcn = pcnData[practice.pcnCode];
    pcn.totalSubmissions += practice.submissions;
    pcn.clinicalSubmissions += practice.clinicalSubmissions;
    pcn.adminSubmissions += practice.adminSubmissions;
    pcn.otherSubmissions += practice.otherSubmissions;
    pcn.totalPatients += practice.listSize;
    pcn.practiceCount++;
    practice.suppliers.forEach(s => pcn.suppliers.add(s));
  });

  return Object.values(pcnData)
    .map(pcn => ({
      ...pcn,
      suppliers: Array.from(pcn.suppliers),
      avgRatePer1000: pcn.totalPatients > 0
        ? (pcn.totalSubmissions / pcn.totalPatients) * 1000
        : 0,
      avgSubmissionsPerPractice: pcn.practiceCount > 0
        ? pcn.totalSubmissions / pcn.practiceCount
        : 0,
      clinicalPct: pcn.totalSubmissions > 0
        ? pcn.clinicalSubmissions / pcn.totalSubmissions
        : 0,
      adminPct: pcn.totalSubmissions > 0
        ? pcn.adminSubmissions / pcn.totalSubmissions
        : 0,
    }))
    .sort((a, b) => b.avgRatePer1000 - a.avgRatePer1000);
}

/**
 * Calculate national ranking for a practice
 */
export function calculateOCNationalRanking(practice, allPractices) {
  const sorted = [...allPractices]
    .filter(p => p.participation === 1 && p.ratePer1000 > 0)
    .sort((a, b) => b.ratePer1000 - a.ratePer1000);

  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;
  const percentile = total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0;

  return { rank, total, percentile };
}

/**
 * Calculate ICB ranking for a practice
 */
export function calculateOCICBRanking(practice, allPractices) {
  const icbPractices = allPractices.filter(
    p => p.icbCode === practice.icbCode && p.participation === 1 && p.ratePer1000 > 0
  );

  const sorted = [...icbPractices].sort((a, b) => b.ratePer1000 - a.ratePer1000);
  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;
  const percentile = total > 0 ? Math.round(((total - rank + 1) / total) * 100) : 0;

  return { rank, total, percentile, practices: sorted };
}

/**
 * Calculate PCN ranking for a practice
 */
export function calculateOCPCNRanking(practice, allPractices) {
  const pcnPractices = allPractices.filter(
    p => p.pcnCode === practice.pcnCode && p.participation === 1
  );

  const sorted = [...pcnPractices].sort((a, b) => b.ratePer1000 - a.ratePer1000);
  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;

  return { rank, total, pcnName: practice.pcnName, practices: sorted };
}

/**
 * Simple linear regression for forecasting
 */
export function linearRegression(data) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  data.forEach((point, i) => {
    sumX += i;
    sumY += point;
    sumXY += i * point;
    sumX2 += i * i;
    sumY2 += point * point;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  data.forEach((point, i) => {
    const predicted = slope * i + intercept;
    ssTot += Math.pow(point - yMean, 2);
    ssRes += Math.pow(point - predicted, 2);
  });
  const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  return { slope, intercept, r2 };
}

/**
 * Forecast future values based on historical data
 */
export function forecastValues(historicalData, periodsAhead = 3) {
  const values = historicalData.map(d => d.value);
  const { slope, intercept, r2 } = linearRegression(values);

  const forecasts = [];
  const lastIndex = values.length - 1;

  for (let i = 1; i <= periodsAhead; i++) {
    const futureIndex = lastIndex + i;
    const predictedValue = slope * futureIndex + intercept;
    forecasts.push({
      periodOffset: i,
      value: Math.max(0, predictedValue), // Don't forecast negative values
      confidence: r2
    });
  }

  return {
    forecasts,
    trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
    monthlyChange: slope,
    r2
  };
}

/**
 * Get performance interpretation based on rate per 1000
 */
export function getOCPerformanceInterpretation(ratePer1000, nationalAvg) {
  const ratio = ratePer1000 / nationalAvg;

  if (ratio >= 1.5) {
    return {
      label: 'Very High Adoption',
      emoji: '🚀',
      color: 'green',
      description: 'Your practice has very high online consultation adoption, significantly above the national average.'
    };
  } else if (ratio >= 1.2) {
    return {
      label: 'High Adoption',
      emoji: '📈',
      color: 'teal',
      description: 'Your practice has above-average online consultation usage.'
    };
  } else if (ratio >= 0.8) {
    return {
      label: 'Average Adoption',
      emoji: '✓',
      color: 'blue',
      description: 'Your practice has typical online consultation usage, in line with the national average.'
    };
  } else if (ratio >= 0.5) {
    return {
      label: 'Below Average',
      emoji: '📉',
      color: 'orange',
      description: 'Your practice has lower online consultation usage compared to the national average.'
    };
  } else {
    return {
      label: 'Low Adoption',
      emoji: '⚠️',
      color: 'red',
      description: 'Your practice has significantly lower online consultation usage. Consider promoting digital access.'
    };
  }
}

/**
 * Get PCN ranking nationally for online consultations
 */
export function getOCPCNNationalRanking(pcnCode, pcnAverages) {
  const rank = pcnAverages.findIndex(p => p.pcnCode === pcnCode) + 1;
  const total = pcnAverages.length;
  const percentile = total > 0 ? ((rank / total) * 100).toFixed(1) : 0;

  return { rank, total, percentile };
}

/**
 * Get PCN ranking within ICB for online consultations
 */
export function getOCPCNICBRanking(pcnCode, icbCode, pcnAverages) {
  const icbPCNs = pcnAverages.filter(p => p.icbCode === icbCode);
  const rank = icbPCNs.findIndex(p => p.pcnCode === pcnCode) + 1;
  const total = icbPCNs.length;
  const percentile = total > 0 ? ((rank / total) * 100).toFixed(1) : 0;

  return { rank, total, percentile, pcns: icbPCNs };
}
