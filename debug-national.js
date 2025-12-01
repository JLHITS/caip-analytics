import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'assets', 'Cloud Based Telephony Publication Summary October 2025_v2.xlsx');
const fileBuffer = readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

// Parse Table 3 the same way as the parser
const table3Sheet = workbook.Sheets['Table 3'];
const table3Raw = XLSX.utils.sheet_to_json(table3Sheet, { header: 1 });

console.log('Looking for National row in Table 3...\n');

// Check rows 10-15 to find the national row
for (let i = 10; i < 16; i++) {
  const row = table3Raw[i];
  console.log(`Row ${i}:`);
  console.log(`  [0]: "${row[0]}"`);
  console.log(`  [1] (ODS): "${row[1]}"`);
  console.log(`  [2] (GP Name): "${row[2]}"`);
  console.log(`  [14] (answeredPct): ${row[14]}`);
  console.log(`  [16] (endedDuringIVRPct): ${row[16]}`);
  console.log(`  [21] (missedPct): ${row[21]}`);
  console.log('');

  // Use the NEW logic: row[0] === 'Total' and both ODS and GP name are empty
  if (row[0] === 'Total' && !row[1] && !row[2]) {
    console.log('✓ THIS IS THE NATIONAL ROW (new logic)!');
    console.log('National data:');
    console.log(`  Answered %: ${row[14]} -> ${(row[14] * 100).toFixed(1)}%`);
    console.log(`  Abandoned %: ${row[16]} -> ${(row[16] * 100).toFixed(1)}%`);
    console.log(`  Missed %: ${row[21]} -> ${(row[21] * 100).toFixed(1)}%`);
    console.log('');
  }
}
