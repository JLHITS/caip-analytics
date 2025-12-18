import Papa from 'papaparse';

/**
 * Parse the practice population CSV file
 * Returns a map of ODS code -> patient count
 */
export async function parsePopulationData(csvUrl) {
  const response = await fetch(csvUrl);
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const populationMap = {};

        results.data.forEach(row => {
          // Only include rows where SEX=ALL and AGE=ALL (total population)
          if (row.SEX === 'ALL' && row.AGE === 'ALL' && row.CODE) {
            populationMap[row.CODE] = parseInt(row.NUMBER_OF_PATIENTS, 10) || 0;
          }
        });

        resolve(populationMap);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Calculate calls per 1000 patients
 */
export function calculatePer1000(calls, population) {
  if (!population || population === 0) return null;
  return (calls / population) * 1000;
}

/**
 * Get workload interpretation based on calls per 1000 patients
 */
export function getWorkloadInterpretation(callsPer1000, nationalAvgPer1000) {
  if (!callsPer1000 || !nationalAvgPer1000) return null;

  const ratio = callsPer1000 / nationalAvgPer1000;

  if (ratio >= 1.5) {
    return {
      label: 'Very High Demand',
      emoji: '🔥',
      color: 'red',
      description: 'Your call volume per patient is significantly above average. This may indicate high patient need or accessibility issues.'
    };
  } else if (ratio >= 1.2) {
    return {
      label: 'High Demand',
      emoji: '📈',
      color: 'orange',
      description: 'Your call volume per patient is above average. Consider whether additional capacity or alternative access routes are needed.'
    };
  } else if (ratio >= 0.8) {
    return {
      label: 'Average Demand',
      emoji: '✓',
      color: 'green',
      description: 'Your call volume per patient is typical for the national average.'
    };
  } else if (ratio >= 0.5) {
    return {
      label: 'Low Demand',
      emoji: '📉',
      color: 'blue',
      description: 'Your call volume per patient is below average. This could indicate good online access or different patient demographics.'
    };
  } else {
    return {
      label: 'Very Low Demand',
      emoji: '💤',
      color: 'slate',
      description: 'Your call volume per patient is significantly below average.'
    };
  }
}
