/**
 * Index file for National Appointment Data (GPAD) files
 * Imports all XLSX files and exports them with month mapping
 */

// Import all GPAD files using Vite's ?url import for lazy loading
import apr23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_April_2023.xlsx?url';
import may23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_May_2023.xlsx?url';
import jun23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_June_2023.xlsx?url';
import jul23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_July_2023.xlsx?url';
import aug23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_August_2023.xlsx?url';
import sep23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_September_2023.xlsx?url';
import oct23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_October_2023.xlsx?url';
import nov23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_November_2023.xlsx?url';
import dec23 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_December_2023.xlsx?url';
import jan24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_January_2024.xlsx?url';
import feb24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_February_2024.xlsx?url';
import mar24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_March_2024.xlsx?url';
import apr24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_April_2024.xlsx?url';
import may24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_May_2024.xlsx?url';
import jun24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_June_2024.xlsx?url';
import jul24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_July_2024.xlsx?url';
import aug24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_August_2024.xlsx?url';
import sep24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_September_2024.xlsx?url';
import oct24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_October_2024.xlsx?url';
import nov24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_November_2024.xlsx?url';
import dec24 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_December_2024.xlsx?url';
import jan25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_January_2025.xlsx?url';
import feb25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_February_2025.xlsx?url';
import mar25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_March_2025.xlsx?url';
import apr25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_April_2025.xlsx?url';
import may25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_May_2025.xlsx?url';
import jun25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_June_2025.xlsx?url';
import jul25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_July_2025.xlsx?url';
import aug25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_August_2025.xlsx?url';
import sep25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_September_2025.xlsx?url';
import oct25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_October_2025.xlsx?url';
import nov25 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_November_2025.xlsx?url';

/**
 * Map of month strings to file URLs
 */
export const APPOINTMENT_FILES = {
  'April 2023': apr23,
  'May 2023': may23,
  'June 2023': jun23,
  'July 2023': jul23,
  'August 2023': aug23,
  'September 2023': sep23,
  'October 2023': oct23,
  'November 2023': nov23,
  'December 2023': dec23,
  'January 2024': jan24,
  'February 2024': feb24,
  'March 2024': mar24,
  'April 2024': apr24,
  'May 2024': may24,
  'June 2024': jun24,
  'July 2024': jul24,
  'August 2024': aug24,
  'September 2024': sep24,
  'October 2024': oct24,
  'November 2024': nov24,
  'December 2024': dec24,
  'January 2025': jan25,
  'February 2025': feb25,
  'March 2025': mar25,
  'April 2025': apr25,
  'May 2025': may25,
  'June 2025': jun25,
  'July 2025': jul25,
  'August 2025': aug25,
  'September 2025': sep25,
  'October 2025': oct25,
  'November 2025': nov25,
};

/**
 * Ordered array of all months (oldest to newest)
 */
export const MONTHS_ORDERED = [
  'April 2023',
  'May 2023',
  'June 2023',
  'July 2023',
  'August 2023',
  'September 2023',
  'October 2023',
  'November 2023',
  'December 2023',
  'January 2024',
  'February 2024',
  'March 2024',
  'April 2024',
  'May 2024',
  'June 2024',
  'July 2024',
  'August 2024',
  'September 2024',
  'October 2024',
  'November 2024',
  'December 2024',
  'January 2025',
  'February 2025',
  'March 2025',
  'April 2025',
  'May 2025',
  'June 2025',
  'July 2025',
  'August 2025',
  'September 2025',
  'October 2025',
  'November 2025',
];

/**
 * Ordered array of months (newest to oldest) for dropdown selectors
 */
export const MONTHS_NEWEST_FIRST = [...MONTHS_ORDERED].reverse();

/**
 * Priority months for initial loading (just the most recent for fast startup)
 */
export const PRIORITY_MONTHS = [
  'November 2025',
  // Additional months loaded on demand when user selects a practice
];

/**
 * Get file URL for a specific month
 */
export function getFileForMonth(month) {
  return APPOINTMENT_FILES[month] || null;
}

/**
 * Check if data is available for a specific month
 */
export function hasDataForMonth(month) {
  return month in APPOINTMENT_FILES;
}

/**
 * Get months in a range (inclusive)
 */
export function getMonthsInRange(startMonth, endMonth) {
  const startIdx = MONTHS_ORDERED.indexOf(startMonth);
  const endIdx = MONTHS_ORDERED.indexOf(endMonth);

  if (startIdx === -1 || endIdx === -1) return [];

  const [fromIdx, toIdx] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  return MONTHS_ORDERED.slice(fromIdx, toIdx + 1);
}

/**
 * Get the latest N months
 */
export function getLatestMonths(count = 3) {
  return MONTHS_NEWEST_FIRST.slice(0, count);
}

/**
 * Get months where all data sources overlap (appointments, telephony, OC)
 * Telephony: Oct-Nov 2025 only
 * OC: Apr 2024 onwards
 */
export const FULL_DATA_MONTHS = [
  'October 2025',
  'November 2025',
];

/**
 * Get months where appointments and OC overlap (telephony not required)
 */
export const APPT_OC_OVERLAP_MONTHS = MONTHS_ORDERED.filter(m => {
  const idx = MONTHS_ORDERED.indexOf(m);
  const apr2024Idx = MONTHS_ORDERED.indexOf('April 2024');
  return idx >= apr2024Idx;
});

export default {
  APPOINTMENT_FILES,
  MONTHS_ORDERED,
  MONTHS_NEWEST_FIRST,
  PRIORITY_MONTHS,
  FULL_DATA_MONTHS,
  APPT_OC_OVERLAP_MONTHS,
  getFileForMonth,
  hasDataForMonth,
  getMonthsInRange,
  getLatestMonths,
};
