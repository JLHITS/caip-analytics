import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'assets', 'Cloud Based Telephony Publication Summary October 2025_v2.xlsx');

const fileBuffer = readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('📊 Sheet Names:', workbook.SheetNames);
console.log('\n');

// Examine each sheet
workbook.SheetNames.forEach(sheetName => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SHEET: ${sheetName}`);
  console.log('='.repeat(80));

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  // Show first 20 rows
  console.log('\nFirst 20 rows:');
  data.slice(0, 20).forEach((row, idx) => {
    console.log(`Row ${idx}:`, row);
  });

  // If it looks like a data table, show column headers
  if (data.length > 0) {
    console.log('\n📋 Analyzing structure...');
    console.log('Total rows:', data.length);
    console.log('Sample data with headers:');
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    console.log('First 3 records:', JSON.stringify(json.slice(0, 3), null, 2));

    // Look for 'National' row
    const nationalRow = json.find(row => row['GP Practice Name'] === 'National' || row['Practice Name'] === 'National');
    if (nationalRow) {
      console.log('\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 Found National averages:', JSON.stringify(nationalRow, null, 2));
    }

    // Look for 'Unmapped' rows
    const unmappedRows = json.filter(row => row['GP Practice Name'] === 'Unmapped' || row['Practice Name'] === 'Unmapped');
    console.log(`\n⚠️ Found ${unmappedRows.length} 'Unmapped' rows (will exclude)`);
  }
});
