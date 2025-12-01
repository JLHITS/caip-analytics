import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'assets', 'Cloud Based Telephony Publication Summary October 2025_v2.xlsx');
const fileBuffer = readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

// Function to find the header row (skip empty/title rows)
function findHeaderRow(data) {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    // Look for rows that seem like headers (have 'Practice' or 'GP' in them)
    const rowStr = JSON.stringify(row).toLowerCase();
    if (rowStr.includes('practice') || rowStr.includes('gp')) {
      return i;
    }
  }
  return 0;
}

['Table 3', 'Table 4', 'Table 5'].forEach(sheetName => {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`${sheetName}`);
  console.log('='.repeat(100));

  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Find header row
  const headerRowIndex = findHeaderRow(rawData);
  console.log(`\nHeader row found at index: ${headerRowIndex}`);
  console.log('Headers:', rawData[headerRowIndex]);

  // Parse with headers
  const data = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    range: headerRowIndex
  });

  console.log(`\nTotal rows: ${data.length}`);
  console.log('\nColumn names:', Object.keys(data[0] || {}));

  // Find National row
  const nationalRow = data.find(row => {
    const values = Object.values(row).map(v => String(v).toLowerCase());
    return values.some(v => v === 'national');
  });

  if (nationalRow) {
    console.log('\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 NATIONAL ROW FOUND:');
    console.log(JSON.stringify(nationalRow, null, 2));
  }

  // Find Unmapped rows
  const unmappedCount = data.filter(row => {
    const values = Object.values(row).map(v => String(v).toLowerCase());
    return values.some(v => v === 'unmapped');
  }).length;
  console.log(`\n⚠️  Unmapped rows to exclude: ${unmappedCount}`);

  // Show first 5 practice rows (skip National/Unmapped)
  const practiceRows = data.filter(row => {
    const values = Object.values(row).map(v => String(v).toLowerCase());
    return !values.some(v => v === 'national' || v === 'unmapped' || v === '');
  }).slice(0, 5);

  console.log(`\n📋 First 5 practice rows:`);
  practiceRows.forEach((row, idx) => {
    console.log(`\nPractice ${idx + 1}:`);
    console.log(JSON.stringify(row, null, 2));
  });
});
