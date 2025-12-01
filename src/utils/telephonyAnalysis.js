/**
 * Telephony Analysis Utilities
 * Provides ranking, percentile, and performance interpretation functions
 */

/**
 * Calculate national ranking for a practice based on missed call percentage
 * Lower missed call % = better ranking
 */
export function calculateNationalRanking(practice, allPractices) {
  // Sort practices by missed call % (ascending - lower is better)
  const sorted = [...allPractices].sort((a, b) => a.missedPct - b.missedPct);
  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;
  const percentile = ((rank / total) * 100).toFixed(1);

  return { rank, total, percentile };
}

/**
 * Calculate ICB ranking for a practice
 */
export function calculateICBRanking(practice, allPractices) {
  // Filter to practices in same ICB
  const icbPractices = allPractices.filter(p => p.icbCode === practice.icbCode);
  const sorted = [...icbPractices].sort((a, b) => a.missedPct - b.missedPct);
  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;
  const percentile = ((rank / total) * 100).toFixed(1);

  return { rank, total, percentile, icbName: practice.icbName };
}

/**
 * Calculate PCN ranking for a practice
 */
export function calculatePCNRanking(practice, allPractices) {
  // Filter to practices in same PCN
  const pcnPractices = allPractices.filter(p => p.pcnCode === practice.pcnCode);
  const sorted = [...pcnPractices].sort((a, b) => a.missedPct - b.missedPct);
  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;
  const percentile = ((rank / total) * 100).toFixed(1);

  return { rank, total, percentile, pcnName: practice.pcnName, practices: sorted };
}

/**
 * Get performance interpretation based on percentile
 * Lower percentile = better performance (for missed calls)
 */
export function getPerformanceInterpretation(percentile) {
  const pct = parseFloat(percentile);

  if (pct <= 5) {
    return { label: 'Excellent', emoji: '🌟', color: 'emerald', description: 'Top 5% nationally' };
  } else if (pct <= 10) {
    return { label: 'Great', emoji: '⭐', color: 'green', description: 'Top 10% nationally' };
  } else if (pct <= 25) {
    return { label: 'Good', emoji: '👍', color: 'lime', description: 'Top 25% nationally' };
  } else if (pct <= 50) {
    return { label: 'Above Average', emoji: '✓', color: 'blue', description: 'Above average performance' };
  } else if (pct <= 75) {
    return { label: 'Below Average', emoji: '⚠', color: 'yellow', description: 'Below average performance' };
  } else if (pct <= 90) {
    return { label: 'Poor', emoji: '⚠️', color: 'orange', description: 'Bottom 25% nationally' };
  } else if (pct <= 95) {
    return { label: 'Very Poor', emoji: '❌', color: 'red', description: 'Bottom 10% nationally' };
  } else {
    return { label: 'Amongst the Worst', emoji: '🔴', color: 'rose', description: 'Bottom 5% nationally' };
  }
}

/**
 * Calculate PCN averages for all PCNs
 */
export function calculatePCNAverages(allPractices) {
  const pcnMap = {};

  // Calculate national missed percentage
  const nationalMissedPct = getNationalMissedPct(allPractices);

  // Group practices by PCN
  allPractices.forEach(practice => {
    // Skip practices with blank/empty PCN codes or names
    if (!practice.pcnCode || !practice.pcnName || practice.pcnName.trim() === '') {
      return;
    }

    if (!pcnMap[practice.pcnCode]) {
      pcnMap[practice.pcnCode] = {
        pcnCode: practice.pcnCode,
        pcnName: practice.pcnName,
        icbCode: practice.icbCode,
        icbName: practice.icbName,
        practices: [],
        totalInboundCalls: 0,
        totalAnswered: 0,
        totalMissed: 0,
        totalEndedDuringIVR: 0,
      };
    }

    const pcn = pcnMap[practice.pcnCode];
    pcn.practices.push(practice);
    pcn.totalInboundCalls += practice.inboundCalls;
    pcn.totalAnswered += practice.answered;
    pcn.totalMissed += practice.missed;
    pcn.totalEndedDuringIVR += practice.endedDuringIVR;
  });

  // Calculate averages for each PCN
  const pcnAverages = Object.values(pcnMap).map(pcn => {
    const avgMissedPct = pcn.totalInboundCalls > 0 ? pcn.totalMissed / pcn.totalInboundCalls : 0;
    // Calculate calls saved for the PCN as a whole
    const callsSaved = pcn.totalInboundCalls > 0 ? (nationalMissedPct - avgMissedPct) * pcn.totalInboundCalls : 0;

    return {
      ...pcn,
      practiceCount: pcn.practices.length,
      avgMissedPct,
      avgAnsweredPct: pcn.totalInboundCalls > 0 ? pcn.totalAnswered / pcn.totalInboundCalls : 0,
      avgEndedDuringIVRPct: pcn.totalInboundCalls > 0 ? pcn.totalEndedDuringIVR / pcn.totalInboundCalls : 0,
      callsSaved,
    };
  });

  // Sort by missed call % (ascending - lower is better)
  return pcnAverages.sort((a, b) => a.avgMissedPct - b.avgMissedPct);
}

/**
 * Get PCN ranking nationally
 */
export function getPCNNationalRanking(pcnCode, pcnAverages) {
  const rank = pcnAverages.findIndex(p => p.pcnCode === pcnCode) + 1;
  const total = pcnAverages.length;
  const percentile = ((rank / total) * 100).toFixed(1);

  return { rank, total, percentile };
}

/**
 * Get PCN ranking within ICB
 */
export function getPCNICBRanking(pcnCode, icbCode, pcnAverages) {
  const icbPCNs = pcnAverages.filter(p => p.icbCode === icbCode);
  const rank = icbPCNs.findIndex(p => p.pcnCode === pcnCode) + 1;
  const total = icbPCNs.length;
  const percentile = total > 0 ? ((rank / total) * 100).toFixed(1) : 0;

  return { rank, total, percentile, pcns: icbPCNs };
}

/**
 * Calculate Calls Saved vs National Average
 * Positive = practice saved more calls than national average would predict
 * Negative = practice missed more calls than national average would predict
 * Formula: (National Missed % - Practice Missed %) × Practice Inbound Calls
 */
export function calculateCallsSaved(practice, nationalMissedPct) {
  if (!practice.inboundCalls || practice.inboundCalls === 0) return 0;
  return (nationalMissedPct - practice.missedPct) * practice.inboundCalls;
}

/**
 * Get national missed percentage from all practices
 */
export function getNationalMissedPct(allPractices) {
  const totalMissed = allPractices.reduce((sum, p) => sum + p.missed, 0);
  const totalCalls = allPractices.reduce((sum, p) => sum + p.inboundCalls, 0);
  return totalCalls > 0 ? totalMissed / totalCalls : 0;
}

/**
 * Get practice ranking based on Calls Saved metric
 * Higher is better (more calls saved)
 */
export function calculateCallsSavedRanking(practice, allPractices) {
  const nationalMissedPct = getNationalMissedPct(allPractices);
  const practiceCallsSaved = calculateCallsSaved(practice, nationalMissedPct);

  const practicesWithMetric = allPractices.map(p => ({
    ...p,
    callsSaved: calculateCallsSaved(p, nationalMissedPct)
  }));

  // Sort by metric (descending - higher is better)
  const sorted = [...practicesWithMetric].sort((a, b) => b.callsSaved - a.callsSaved);
  const rank = sorted.findIndex(p => p.odsCode === practice.odsCode) + 1;
  const total = sorted.length;
  const percentile = ((rank / total) * 100).toFixed(1);

  return { rank, total, percentile, callsSaved: practiceCallsSaved, practices: sorted };
}
