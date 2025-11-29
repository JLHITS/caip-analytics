// GP Performance Band Thresholds
// Based on NHS England access improvement guidance
// Thresholds represent appointments per patient population per day as a percentage

export const GP_PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 1.30,  // Blue band - >1.30%
  GOOD: 1.10,       // Green band - 1.10-1.30%
  ACCEPTABLE: 0.85, // Amber band - 0.85-1.10%
  // Below 0.85% = Red band - Needs improvement
};

// Sample data file URLs
export const SAMPLE_DATA_INFO = {
  appointment: 'AppointmentReport.csv',
  dna: 'DNA.csv',
  unused: 'Unused.csv',
  online: 'OnlineRequests.csv',
  telephony: ['aug.pdf', 'sep.pdf', 'oct.pdf']
};
