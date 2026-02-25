/**
 * Utility functions for parsing and using PracPop (Practice Population) data
 * NHS Digital GP Practice Patient List data
 */

// Import the CSV files - Vite will handle these as raw text
import pracPopDecRaw from '../assets/PracPopDec.csv?raw';
import pracPopNovRaw from '../assets/PracPopNov.csv?raw';
import pracPopOctRaw from '../assets/PracPopOct.csv?raw';

/**
 * Parse PracPop CSV data into structured practice records
 * @param {string} csvContent - Raw CSV content
 * @returns {Array} Array of practice records with odsCode, postcode, population
 */
const parsePracPopCSV = (csvContent) => {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = lines[0].split(',');
  const codeIdx = header.findIndex(h => h.trim() === 'CODE');
  const postcodeIdx = header.findIndex(h => h.trim() === 'POSTCODE');
  const patientsIdx = header.findIndex(h => h.trim() === 'NUMBER_OF_PATIENTS');
  const sexIdx = header.findIndex(h => h.trim() === 'SEX');
  const ageIdx = header.findIndex(h => h.trim() === 'AGE');

  if (codeIdx === -1 || patientsIdx === -1) {
    console.error('PracPop CSV missing required columns');
    return [];
  }

  const practices = new Map();

  // Parse data rows, filtering for ALL/ALL totals only
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');

    // Skip if not total row (SEX=ALL, AGE=ALL)
    if (sexIdx !== -1 && cols[sexIdx]?.trim() !== 'ALL') continue;
    if (ageIdx !== -1 && cols[ageIdx]?.trim() !== 'ALL') continue;

    const odsCode = cols[codeIdx]?.trim();
    const postcode = postcodeIdx !== -1 ? cols[postcodeIdx]?.trim() : '';
    const population = parseInt(cols[patientsIdx]?.trim(), 10);

    if (odsCode && !isNaN(population)) {
      // Use Map to avoid duplicates (some practices may appear multiple times)
      if (!practices.has(odsCode) || practices.get(odsCode).population < population) {
        practices.set(odsCode, {
          odsCode,
          postcode,
          population,
        });
      }
    }
  }

  // Convert to array and sort by ODS code
  return Array.from(practices.values()).sort((a, b) =>
    a.odsCode.localeCompare(b.odsCode)
  );
};

/**
 * Get the latest PracPop data
 * Returns December data as it's the most recent
 */
let cachedPractices = null;

export const getPracPopData = () => {
  if (cachedPractices) {
    return cachedPractices;
  }

  // Use December data as it's the most recent
  cachedPractices = parsePracPopCSV(pracPopDecRaw);

  console.log(`=== POPULATION DATA LOADED === ${cachedPractices.length} practices`);
  return cachedPractices;
};

/**
 * Search practices by ODS code or postcode
 * @param {string} query - Search query
 * @param {number} limit - Max results to return (default 50)
 * @returns {Array} Matching practices
 */
export const searchPractices = (query, limit = 50) => {
  if (!query || query.length < 2) return [];

  const practices = getPracPopData();
  const queryUpper = query.toUpperCase();

  const matches = practices.filter(p =>
    p.odsCode.toUpperCase().includes(queryUpper) ||
    p.postcode.toUpperCase().includes(queryUpper)
  );

  return matches.slice(0, limit);
};

/**
 * Get a specific practice by ODS code
 * @param {string} odsCode - The ODS code to look up
 * @returns {Object|null} Practice record or null if not found
 */
export const getPracticeByODS = (odsCode) => {
  if (!odsCode) return null;

  const practices = getPracPopData();
  return practices.find(p => p.odsCode.toUpperCase() === odsCode.toUpperCase()) || null;
};

/**
 * Get total number of practices in dataset
 */
export const getPracticeCount = () => {
  return getPracPopData().length;
};

export default {
  getPracPopData,
  searchPractices,
  getPracticeByODS,
  getPracticeCount,
};
