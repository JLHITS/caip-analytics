import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'assets', 'Cloud Based Telephony Publication Summary October 2025_v2.xlsx');
const fileBuffer = readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

const table3Sheet = workbook.Sheets['Table 3'];
const table3Raw = XLSX.utils.sheet_to_json(table3Sheet, { header: 1 });

console.log('=== RUSHCLIFFE PCN DATA ===\n');

// Find all Rushcliffe PCN practices
const rushcliffePractices = [];
let totalInbound = 0;
let totalMissed = 0;
let totalMissedFromPct = 0;

for (let i = 12; i < table3Raw.length; i++) {
  const row = table3Raw[i];
  if (!row || row.length === 0) continue;

  const pcnName = String(row[4] || '').trim();

  if (pcnName.toLowerCase().includes('rushcliffe')) {
    const odsCode = String(row[1] || '').trim();
    const gpName = String(row[2] || '').trim();

    if (!odsCode || gpName.toLowerCase() === 'unmapped') continue;

    const inbound = Number(row[11]) || 0;
    const missed = Number(row[20]) || 0;
    const missedPct = Number(row[21]) || 0;

    console.log(`Practice: ${gpName} (${odsCode})`);
    console.log(`  Inbound: ${inbound}`);
    console.log(`  Missed (row[20]): ${missed}`);
    console.log(`  Missed % (row[21]): ${missedPct} -> ${(missedPct * 100).toFixed(2)}%`);
    console.log(`  Calculated from raw: ${inbound > 0 ? ((missed / inbound) * 100).toFixed(2) : 0}%`);
    console.log('');

    rushcliffePractices.push({ odsCode, gpName, inbound, missed, missedPct });
    totalInbound += inbound;
    totalMissed += missed;
    totalMissedFromPct += (missedPct * inbound);
  }
}

console.log('=== RUSHCLIFFE PCN TOTALS ===');
console.log(`Total Practices: ${rushcliffePractices.length}`);
console.log(`Total Inbound: ${totalInbound}`);
console.log(`Total Missed: ${totalMissed}`);
console.log(`Calculated Average (using row[20]): ${((totalMissed / totalInbound) * 100).toFixed(2)}%`);
console.log(`Calculated Average (using row[21]): ${((totalMissedFromPct / totalInbound) * 100).toFixed(2)}%`);
console.log('');
console.log('Expected: 5.35%');
console.log('App showing: 7.1%');
