/**
 * Test using the ACTUAL calculatePracticeMetrics function
 * to verify metrics are correct
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculatePracticeMetrics } from '../src/utils/demandCapacityMetrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRACTICE_ODS = 'C82040';
const MONTH = 'December 2025';

console.log(`\nTesting with ACTUAL calculatePracticeMetrics function\n`);
console.log(`Practice: ${PRACTICE_ODS}`);
console.log(`Month: ${MONTH}\n`);

// Load data
const apptData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../public/data/appointments/December_2025.json'),
  'utf-8'
));

const telData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../public/data/telephony.json'),
  'utf-8'
));

const ocData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../public/data/online-consultations.json'),
  'utf-8'
));

// Find practice data
const practice = apptData.practices.find(p => p.odsCode === PRACTICE_ODS);
const telPractice = telData[MONTH]?.practices?.find(p => p.odsCode === PRACTICE_ODS);
const ocPractice = ocData[MONTH]?.practices?.find(p => p.odsCode === PRACTICE_ODS);

if (!practice) {
  console.error('Practice not found!');
  process.exit(1);
}

// Calculate metrics using the ACTUAL function
const population = practice.listSize;
const metrics = calculatePracticeMetrics(
  practice,
  telPractice,
  ocPractice,
  population,
  MONTH
);

console.log('='.repeat(80));
console.log('CALCULATED METRICS (from calculatePracticeMetrics)');
console.log('='.repeat(80));
console.log();

console.log('Practice Info:');
console.log(`  Name: ${practice.gpName}`);
console.log(`  ODS Code: ${practice.odsCode}`);
console.log(`  List Size: ${population.toLocaleString()}`);
console.log();

console.log('Appointment Metrics:');
console.log(`  GP Appointments per 1000: ${metrics.gpApptsPer1000?.toFixed(2)}`);
console.log(`  GP Appt per Day %: ${metrics.gpApptPerDayPct?.toFixed(3)}%`);
console.log(`  GP Appt or OC per Day %: ${metrics.gpApptOrOCPerDayPct?.toFixed(3)}%`);
console.log(`  Other Clinical per Day %: ${metrics.otherApptPerDayPct?.toFixed(3)}%`);
console.log(`  DNA %: ${metrics.dnaPct?.toFixed(2)}%`);
console.log(`  Same Day %: ${metrics.sameDayPct?.toFixed(2)}%`);
console.log();

console.log('Telephony Metrics:');
console.log(`  Has Telephony Data: ${metrics.hasTelephonyData}`);
if (metrics.hasTelephonyData) {
  console.log(`  Calls per 1000: ${metrics.callsPer1000?.toFixed(2)}`);
  console.log(`  Missed Calls per 1000: ${metrics.missedCallsPer1000?.toFixed(2)}`);
  console.log(`  Missed Call %: ${metrics.missedCallPct?.toFixed(2)}%`);
  console.log(`  GP Appts per Demand: ${metrics.gpApptsPerCall?.toFixed(3)}`);
}
console.log();

console.log('Online Consultation Metrics:');
console.log(`  Has OC Data: ${metrics.hasOCData}`);
if (metrics.hasOCData) {
  console.log(`  OC Submissions (raw): ${ocPractice?.submissions}`);
  console.log(`  OC Clinical (raw): ${ocPractice?.clinicalSubmissions}`);
  console.log(`  OC data in metrics: ${JSON.stringify({
    ocSubmissions: metrics.ocSubmissions,
    ocClinicalSubmissions: metrics.ocClinicalSubmissions
  })}`);
}
console.log();

console.log('List Size:');
console.log(`  From practice: ${practice.listSize}`);
console.log(`  Used in metrics: ${metrics.listSize}`);
console.log();

console.log('='.repeat(80));
console.log('RAW INPUT DATA');
console.log('='.repeat(80));
console.log();

console.log('Appointment Data Fields:');
console.log(`  totalAppointments: ${practice.totalAppointments}`);
console.log(`  staffBreakdown.gpAppointments: ${practice.staffBreakdown?.gpAppointments}`);
console.log(`  staffBreakdown.otherStaffAppointments: ${practice.staffBreakdown?.otherStaffAppointments}`);
console.log(`  appointmentStatus.dna: ${practice.appointmentStatus?.dna}`);
console.log(`  bookingWait.sameDay: ${practice.bookingWait?.sameDay}`);
console.log();

if (telPractice) {
  console.log('Telephony Data Fields:');
  console.log(`  inboundCalls: ${telPractice.inboundCalls}`);
  console.log(`  answered: ${telPractice.answered}`);
  console.log(`  missed: ${telPractice.missed}`);
  console.log();
}

if (ocPractice) {
  console.log('OC Data Fields:');
  console.log(`  submissions: ${ocPractice.submissions}`);
  console.log(`  clinicalSubmissions: ${ocPractice.clinicalSubmissions}`);
  console.log(`  adminSubmissions: ${ocPractice.adminSubmissions}`);
  console.log();
}

console.log('='.repeat(80));
console.log('VERIFICATION COMPLETE');
console.log('='.repeat(80));
console.log();
