import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = './src/assets/Submissions via OC Systems in General Practice - October 2025.xlsx';

const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

// Focus on Table 2 headers
const table2 = workbook.Sheets['Table 2'];
const table2Data = XLSX.utils.sheet_to_json(table2, { header: 1 });

console.log('=== TABLE 2 HEADER ROW ===');
const headerRow = table2Data[11];
headerRow.forEach((col, idx) => {
  console.log(`Column ${idx}: ${col}`);
});

console.log('\n=== SAMPLE DATA ROW ===');
const sampleRow = table2Data[12];
sampleRow.forEach((val, idx) => {
  console.log(`Column ${idx} (${headerRow[idx]}): ${val}`);
});
