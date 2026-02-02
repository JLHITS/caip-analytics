/**
 * Test script to show what metrics would be collected for CAIP Analysis
 * without actually running the AI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRACTICE_ODS = 'C82040';
const MONTH = 'December 2025';

console.log(`\n${'='.repeat(80)}`);
console.log(`CAIP METRICS TEST FOR PRACTICE ${PRACTICE_ODS} - ${MONTH}`);
console.log(`${'='.repeat(80)}\n`);

// Load appointment data
const apptDataPath = path.join(__dirname, '../public/data/appointments/December_2025.json');
const apptData = JSON.parse(fs.readFileSync(apptDataPath, 'utf-8'));

// Load telephony data
const telDataPath = path.join(__dirname, '../public/data/telephony.json');
const telData = JSON.parse(fs.readFileSync(telDataPath, 'utf-8'));
const telMonth = telData[MONTH];

// Load OC data
const ocDataPath = path.join(__dirname, '../public/data/online-consultations.json');
const ocData = JSON.parse(fs.readFileSync(ocDataPath, 'utf-8'));
const ocMonth = ocData[MONTH];

// Load workforce data
const workforceDataPath = path.join(__dirname, '../public/data/workforce/December_2025.json');
const workforceData = JSON.parse(fs.readFileSync(workforceDataPath, 'utf-8'));

// Find practice in appointment data
const practice = apptData.practices.find(p => p.odsCode === PRACTICE_ODS);
if (!practice) {
  console.error(`Practice ${PRACTICE_ODS} not found in appointment data`);
  process.exit(1);
}

console.log('PRACTICE DETAILS:');
console.log(`  Name: ${practice.gpName}`);
console.log(`  ODS Code: ${practice.odsCode}`);
console.log(`  List Size: ${practice.listSize?.toLocaleString() || 'N/A'}`);
console.log(`  ICB: ${practice.icbName || 'N/A'}`);
console.log();

// Find telephony data for practice
const telPractice = telMonth?.practices?.find(p => p.odsCode === PRACTICE_ODS);
const hasTelephonyData = Boolean(telPractice);

// Find OC data for practice
const ocPractice = ocMonth?.practices?.find(p => p.odsCode === PRACTICE_ODS);
const hasOCData = Boolean(ocPractice);

// Find workforce data for practice
const workforcePractice = workforceData.practices.find(p => p.odsCode === PRACTICE_ODS);
const hasWorkforceData = Boolean(workforcePractice);

console.log('DATA AVAILABILITY:');
console.log(`  Appointments: ✓ Available`);
console.log(`  Telephony: ${hasTelephonyData ? '✓ Available' : '✗ Not available'}`);
console.log(`  Online Consultations: ${hasOCData ? '✓ Available' : '✗ Not available'}`);
console.log(`  Workforce: ${hasWorkforceData ? '✓ Available' : '✗ Not available'}`);
console.log();

// Calculate metrics
const listSize = practice.listSize || 10000;

// Appointment metrics (using correct field names from preprocessing)
const gpAppts = practice.staffBreakdown?.gpAppointments || 0;
const otherAppts = practice.staffBreakdown?.otherStaffAppointments || 0;
const totalAppts = practice.totalAppointments || 0;
const dna = practice.appointmentStatus?.dna || 0;
const sameDay = practice.bookingWait?.sameDay || 0;
const workingDays = 20; // December working days

// Telephony metrics
const inboundCalls = telPractice?.inboundCalls || 0;
const answeredCalls = telPractice?.answered || 0; // Field is 'answered' not 'answeredCalls'
const missedCalls = telPractice?.missed || 0; // Use direct 'missed' field

// OC metrics
const ocSubmissions = ocPractice?.totalSubmissions || 0; // Check field name
const ocClinicalSubmissions = ocPractice?.clinicalSubmissions || 0; // Check field name

// Calculate derived metrics
const gpApptsPerCall = hasTelephonyData && answeredCalls > 0
  ? gpAppts / (answeredCalls + (ocClinicalSubmissions || 0))
  : null;

const gpApptsPer1000 = (gpAppts / listSize) * 1000;
const gpApptOrOCPerDayPct = ((gpAppts + (ocClinicalSubmissions || 0)) / listSize / workingDays) * 100;
const otherApptPerDayPct = (otherAppts / listSize / workingDays) * 100;
const dnaPct = totalAppts > 0 ? (dna / totalAppts) * 100 : 0;
const sameDayPct = totalAppts > 0 ? (sameDay / totalAppts) * 100 : 0;

const inboundCallsPer1000 = hasTelephonyData ? (inboundCalls / listSize) * 1000 : null;
const answeredCallsPer1000 = hasTelephonyData ? (answeredCalls / listSize) * 1000 : null;
const missedCallsPer1000 = hasTelephonyData ? (missedCalls / listSize) * 1000 : null;
const missedCallPct = hasTelephonyData && inboundCalls > 0 ? (missedCalls / inboundCalls) * 100 : null;

const ocPer1000 = hasOCData ? (ocSubmissions / listSize) * 1000 : null;
const ocMedicalPct = hasOCData && ocSubmissions > 0 ? (ocClinicalSubmissions / ocSubmissions) * 100 : null;

// Workforce metrics
const gpWte = workforcePractice?.gp_total_fte || null;
const clinicalWte = workforcePractice?.total_clinical_fte || null;
const patientsPerGpWte = gpWte > 0 ? listSize / gpWte : null;
const patientsPerClinicalWte = clinicalWte > 0 ? listSize / clinicalWte : null;

// Calculate percentiles
function calculatePercentile(value, allValues) {
  if (value == null || !allValues?.length) return null;
  const validValues = allValues.filter(v => v != null && !isNaN(v));
  if (validValues.length === 0) return null;
  const sorted = [...validValues].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return Math.round((below / sorted.length) * 100);
}

// Collect national arrays for percentile calculations
const allPractices = apptData.practices;
const allTelPractices = telMonth?.practices || [];
const allOcPractices = ocMonth?.practices || [];
const allWorkforcePractices = workforceData.practices;

console.log('='.repeat(80));
console.log('APPOINTMENTS & DEMAND METRICS');
console.log('='.repeat(80));

// GP Appointments per unit of demand
const nationalGpApptsPerCall = allTelPractices
  .filter(p => {
    const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
    const pOc = allOcPractices.find(o => o.odsCode === p.odsCode);
    return pAppt && p.answeredCalls > 0;
  })
  .map(p => {
    const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
    const pOc = allOcPractices.find(o => o.odsCode === p.odsCode);
    const gp = pAppt.totalGPAppts || 0;
    const ans = p.answeredCalls;
    const ocClin = pOc?.clinical_submissions || 0;
    return gp / (ans + ocClin);
  })
  .filter(v => v != null && !isNaN(v));

console.log('\n1. GP appointments per unit of demand');
console.log(`   Value: ${gpApptsPerCall?.toFixed(2) || 'N/A'}`);
console.log(`   Percentile: ${calculatePercentile(gpApptsPerCall, nationalGpApptsPerCall) ?? 'N/A'}`);
console.log(`   Interpretation: For every call answered + medical OC, how many GP appointments delivered`);

// GP Appointments per 1000
const nationalGpApptsPer1000 = allPractices
  .filter(p => p.listSize > 0)
  .map(p => ((p.totalGPAppts || 0) / p.listSize) * 1000)
  .filter(v => !isNaN(v));

console.log('\n2. GP appointments per 1000 patients');
console.log(`   Value: ${gpApptsPer1000.toFixed(2)}`);
console.log(`   Percentile: ${calculatePercentile(gpApptsPer1000, nationalGpApptsPer1000)}`);
console.log(`   Interpretation: Volume of GP appointments per 1000 registered patients`);

// GP Appt or Medical OC per day %
const nationalGpApptOrOCPerDayPct = allPractices
  .filter(p => p.listSize > 0)
  .map(p => {
    const pOc = allOcPractices.find(o => o.odsCode === p.odsCode);
    const gpAppts = p.totalGPAppts || 0;
    const ocClin = pOc?.clinical_submissions || 0;
    return ((gpAppts + ocClin) / p.listSize / workingDays) * 100;
  })
  .filter(v => !isNaN(v));

console.log('\n3. % of patient population with a GP appointment or medical OC per working day');
console.log(`   Value: ${gpApptOrOCPerDayPct.toFixed(2)}%`);
console.log(`   Percentile: ${calculatePercentile(gpApptOrOCPerDayPct, nationalGpApptOrOCPerDayPct)}`);
console.log(`   Interpretation: Daily rate of patients seen by GP (face-to-face, phone, online)`);

// Non-GP clinical activity per day %
const nationalOtherApptPerDayPct = allPractices
  .filter(p => p.listSize > 0)
  .map(p => ((p.totalOtherClinicalAppts || 0) / p.listSize / workingDays) * 100)
  .filter(v => !isNaN(v));

console.log('\n4. % of patient population with a non-GP clinical appointment per working day');
console.log(`   Value: ${otherApptPerDayPct.toFixed(2)}%`);
console.log(`   Percentile: ${calculatePercentile(otherApptPerDayPct, nationalOtherApptPerDayPct)}`);
console.log(`   Interpretation: Daily rate of patients seen by nurses, pharmacists, allied health`);

// DNA Rate
const nationalDnaPct = allPractices
  .filter(p => (p.totalAppts || 0) > 0)
  .map(p => ((p.dnaCount || 0) / p.totalAppts) * 100)
  .filter(v => !isNaN(v));

console.log('\n5. DNA rate (all appointments)');
console.log(`   Value: ${dnaPct.toFixed(2)}%`);
console.log(`   Percentile: ${calculatePercentile(dnaPct, nationalDnaPct)}`);
console.log(`   Interpretation: Percentage of appointments where patient did not attend`);

// Same-day booking
const nationalSameDayPct = allPractices
  .filter(p => (p.totalAppts || 0) > 0)
  .map(p => ((p.sameDayCount || 0) / p.totalAppts) * 100)
  .filter(v => !isNaN(v));

console.log('\n6. Same-day booking percentage');
console.log(`   Value: ${sameDayPct.toFixed(2)}%`);
console.log(`   Percentile: ${calculatePercentile(sameDayPct, nationalSameDayPct)}`);
console.log(`   Interpretation: % of appointments booked on the same day as the appointment`);

console.log('\n' + '='.repeat(80));
console.log('TELEPHONY METRICS');
console.log('='.repeat(80));

if (hasTelephonyData) {
  // Inbound calls per 1000
  const nationalInboundCallsPer1000 = allTelPractices
    .filter(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt && pAppt.listSize > 0;
    })
    .map(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return (p.inboundCalls / pAppt.listSize) * 1000;
    })
    .filter(v => !isNaN(v));

  console.log('\n7. Inbound calls per 1000 patients');
  console.log(`   Value: ${inboundCallsPer1000.toFixed(2)}`);
  console.log(`   Percentile: ${calculatePercentile(inboundCallsPer1000, nationalInboundCallsPer1000)}`);
  console.log(`   Interpretation: Total call volume (answered + missed) per 1000 patients`);

  // Answered calls per 1000
  const nationalAnsweredCallsPer1000 = allTelPractices
    .filter(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt && pAppt.listSize > 0;
    })
    .map(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return (p.answeredCalls / pAppt.listSize) * 1000;
    })
    .filter(v => !isNaN(v));

  console.log('\n8. Answered calls per 1000 patients');
  console.log(`   Value: ${answeredCallsPer1000.toFixed(2)}`);
  console.log(`   Percentile: ${calculatePercentile(answeredCallsPer1000, nationalAnsweredCallsPer1000)}`);
  console.log(`   Interpretation: Successfully answered calls per 1000 patients`);

  // Missed calls per 1000
  const nationalMissedCallsPer1000 = allTelPractices
    .filter(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt && pAppt.listSize > 0;
    })
    .map(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      const missed = p.inboundCalls - p.answeredCalls;
      return (missed / pAppt.listSize) * 1000;
    })
    .filter(v => !isNaN(v));

  console.log('\n9. Missed calls per 1000 patients');
  console.log(`   Value: ${missedCallsPer1000.toFixed(2)}`);
  console.log(`   Percentile: ${calculatePercentile(missedCallsPer1000, nationalMissedCallsPer1000)}`);
  console.log(`   Interpretation: Unanswered/abandoned calls per 1000 patients`);

  // Missed call rate
  const nationalMissedCallPct = allTelPractices
    .filter(p => p.inboundCalls > 0)
    .map(p => {
      const missed = p.inboundCalls - p.answeredCalls;
      return (missed / p.inboundCalls) * 100;
    })
    .filter(v => !isNaN(v));

  console.log('\n10. Missed call rate (%)');
  console.log(`   Value: ${missedCallPct.toFixed(2)}%`);
  console.log(`   Percentile: ${calculatePercentile(missedCallPct, nationalMissedCallPct)}`);
  console.log(`   Interpretation: % of all inbound calls that were not answered`);
} else {
  console.log('\n  Telephony data not available for this practice');
}

console.log('\n' + '='.repeat(80));
console.log('ONLINE CONSULTATION METRICS');
console.log('='.repeat(80));

if (hasOCData) {
  // OC per 1000
  const nationalOcPer1000 = allOcPractices
    .filter(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt && pAppt.listSize > 0;
    })
    .map(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return (p.total_submissions / pAppt.listSize) * 1000;
    })
    .filter(v => !isNaN(v));

  console.log('\n11. Online consultation requests per 1000 patients');
  console.log(`   Value: ${ocPer1000.toFixed(2)}`);
  console.log(`   Percentile: ${calculatePercentile(ocPer1000, nationalOcPer1000)}`);
  console.log(`   Interpretation: Digital consultation submissions per 1000 patients`);

  // OC Medical %
  const nationalOcMedicalPct = allOcPractices
    .filter(p => p.total_submissions > 0)
    .map(p => (p.clinical_submissions / p.total_submissions) * 100)
    .filter(v => !isNaN(v));

  console.log('\n12. % of online consultations that are medical');
  console.log(`   Value: ${ocMedicalPct != null ? ocMedicalPct.toFixed(2) + '%' : 'N/A'}`);
  console.log(`   Percentile: ${calculatePercentile(ocMedicalPct, nationalOcMedicalPct) ?? 'N/A'}`);
  console.log(`   Interpretation: % of OC submissions classified as clinical/medical`);
} else {
  console.log('\n  Online consultation data not available for this practice');
}

console.log('\n' + '='.repeat(80));
console.log('WORKFORCE METRICS');
console.log('='.repeat(80));

if (hasWorkforceData) {
  // Patients per GP WTE
  const nationalPatientsPerGpWte = allWorkforcePractices
    .filter(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt && p.gp_total_fte > 0;
    })
    .map(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt.listSize / p.gp_total_fte;
    })
    .filter(v => !isNaN(v));

  console.log('\n13. Patients per GP WTE');
  console.log(`   Value: ${patientsPerGpWte ? patientsPerGpWte.toFixed(0) : 'N/A'}`);
  console.log(`   Percentile: ${calculatePercentile(patientsPerGpWte, nationalPatientsPerGpWte) ?? 'N/A'}`);
  console.log(`   Interpretation: Registered patients per full-time equivalent GP`);

  // Patients per Clinical WTE
  const nationalPatientsPerClinicalWte = allWorkforcePractices
    .filter(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt && p.total_clinical_fte > 0;
    })
    .map(p => {
      const pAppt = allPractices.find(a => a.odsCode === p.odsCode);
      return pAppt.listSize / p.total_clinical_fte;
    })
    .filter(v => !isNaN(v));

  console.log('\n14. Patients per clinical WTE');
  console.log(`   Value: ${patientsPerClinicalWte ? patientsPerClinicalWte.toFixed(0) : 'N/A'}`);
  console.log(`   Percentile: ${calculatePercentile(patientsPerClinicalWte, nationalPatientsPerClinicalWte) ?? 'N/A'}`);
  console.log(`   Interpretation: Registered patients per full-time equivalent clinical staff (all roles)`);

  // Show workforce breakdown
  console.log('\n   Workforce breakdown:');
  console.log(`     GP FTE: ${gpWte}`);
  console.log(`     Total Clinical FTE: ${clinicalWte}`);
  console.log(`     Nurses: ${workforcePractice.nurses_total_fte || 0}`);
  console.log(`     Direct Patient Care: ${workforcePractice.direct_patient_care_total_fte || 0}`);
} else {
  console.log('\n  Workforce data not available for this practice');
}

console.log('\n' + '='.repeat(80));
console.log('RAW DATA DUMP (for debugging)');
console.log('='.repeat(80));

console.log('\nAppointment data object:');
console.log(JSON.stringify(practice, null, 2));

if (hasTelephonyData) {
  console.log('\nTelephony data object:');
  console.log(JSON.stringify(telPractice, null, 2));
}

if (hasOCData) {
  console.log('\nOC data object:');
  console.log(JSON.stringify(ocPractice, null, 2));
}

if (hasWorkforceData) {
  console.log('\nWorkforce data object:');
  console.log(JSON.stringify(workforcePractice, null, 2));
}

console.log('\n' + '='.repeat(80));
console.log('RAW VALUES FOR VERIFICATION');
console.log('='.repeat(80));

console.log('\nAppointment raw values:');
console.log(`  Total GP Appointments: ${gpAppts.toLocaleString()}`);
console.log(`  Total Other Clinical Appointments: ${otherAppts.toLocaleString()}`);
console.log(`  Total All Appointments: ${totalAppts.toLocaleString()}`);
console.log(`  DNA Count: ${dna.toLocaleString()}`);
console.log(`  Same Day Count: ${sameDay.toLocaleString()}`);

if (hasTelephonyData) {
  console.log('\nTelephony raw values:');
  console.log(`  Inbound Calls: ${inboundCalls.toLocaleString()}`);
  console.log(`  Answered Calls: ${answeredCalls.toLocaleString()}`);
  console.log(`  Missed Calls: ${missedCalls.toLocaleString()}`);
}

if (hasOCData) {
  console.log('\nOnline Consultation raw values:');
  console.log(`  Total Submissions: ${ocSubmissions.toLocaleString()}`);
  console.log(`  Clinical Submissions: ${ocClinicalSubmissions.toLocaleString()}`);
  console.log(`  Admin Submissions: ${ocSubmissions - ocClinicalSubmissions}`);
}

console.log('\n' + '='.repeat(80));
console.log('END OF METRICS TEST');
console.log('='.repeat(80) + '\n');
