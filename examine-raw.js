import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'assets', 'Cloud Based Telephony Publication Summary October 2025_v2.xlsx');
const fileBuffer = readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

// Look at Table 3 raw structure
console.log('='.repeat(100));
console.log('TABLE 3 RAW STRUCTURE');
console.log('='.repeat(100));

const table3 = workbook.Sheets['Table 3'];
const rawData = XLSX.utils.sheet_to_json(table3, { header: 1, defval: '' });

// Show first 20 rows to understand structure
for (let i = 0; i < 25; i++) {
  console.log(`\nRow ${i}:`);
  const row = rawData[i];
  row.forEach((cell, idx) => {
    if (cell !== '') {
      console.log(`  Col ${idx}: "${cell}"`);
    }
  });
}

// Now parse from a specific row
console.log('\n\n' + '='.repeat(100));
console.log('TRYING TO PARSE FROM ROW 11 (likely the header row)');
console.log('='.repeat(100));

const dataFromRow11 = XLSX.utils.sheet_to_json(table3, { range: 11 });
console.log('\nFirst 3 records:');
console.log(JSON.stringify(dataFromRow11.slice(0, 3), null, 2));

console.log('\nNational row:');
const national = dataFromRow11.find(r => Object.values(r).some(v => String(v).toLowerCase() === 'national'));
if (national) {
  console.log(JSON.stringify(national, null, 2));
}
