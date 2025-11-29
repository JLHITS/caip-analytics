// Validate CSV data headers and check for privacy violations
// Prevents accidental upload of patient identifiable information
// Ensures GDPR compliance and data protection
export const validateHeaders = (data, requiredColumns, fileName, forbiddenColumns = []) => {
  if (!data || data.length === 0) {
    throw new Error(`The file "${fileName}" appears to be empty.`);
  }
  const headers = Object.keys(data[0]);

  // Check for missing required columns
  const missing = requiredColumns.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`The file "${fileName}" is missing required columns: ${missing.join(', ')}.`);
  }

  // Check for forbidden columns containing patient identifiable data
  // Blocks columns with: "Patient Name", "Name", "NHS Number"
  const foundForbidden = forbiddenColumns.filter(col =>
    headers.some(h => h.toLowerCase().includes(col.toLowerCase()))
  );
  if (foundForbidden.length > 0) {
    throw new Error(`PRIVACY ERROR: The file "${fileName}" contains disallowed columns: ${foundForbidden.join(', ')}. Please remove patient identifiable data.`);
  }
};
