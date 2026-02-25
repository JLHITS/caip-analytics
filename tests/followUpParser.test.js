import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFollowUpCSV,
  calculateOverallFollowUpRates,
  calculateSameGPFollowUpRates,
  calculateClinicianFollowUpRates,
  calculateMonthlyTrends,
} from '../src/utils/followUpParser.js';

function buildCsv(rows) {
  const header = 'Clinician,Appointment date,NHS number,First name,Surname,Organisation name';
  const lines = rows.map((row, idx) =>
    [row.clinician, row.date, row.nhs, `First${idx}`, `Last${idx}`, 'Test Org'].join(',')
  );
  return [header, ...lines].join('\n');
}

function parseRows(rows) {
  const data = parseFollowUpCSV(buildCsv(rows));
  assert.ok(data);
  return data;
}

test('overall follow-up rates use all source doctor appointments as denominator', () => {
  const data = parseRows([
    { clinician: 'Dr Alpha', date: '01-Jan-26', nhs: '1111111111' },
    { clinician: 'Dr Beta', date: '05-Jan-26', nhs: '1111111111' },
    { clinician: 'Dr Alpha', date: '02-Jan-26', nhs: '2222222222' },
  ]);

  const overall = calculateOverallFollowUpRates(data, 'all');

  assert.equal(overall.totalDoctorAppointments, 3);
  assert.equal(overall.denominator, 3);
  assert.equal(overall.followUp7, 1);
  assert.equal(overall.followUp14, 0);
  assert.equal(overall.followUp28, 0);
  assert.equal(overall.noFollowUp, 2);
  assert.ok(Math.abs(overall.rate7 - 33.33333333333333) < 1e-9);
});

test('same GP doctor breakdown rates are based on total doctor visits, not revisit-only pairs', () => {
  const data = parseRows([
    { clinician: 'Dr Alpha', date: '01-Jan-26', nhs: '1111111111' },
    { clinician: 'Dr Alpha', date: '05-Jan-26', nhs: '1111111111' },
    { clinician: 'Dr Alpha', date: '01-Jan-26', nhs: '2222222222' },
    { clinician: 'Dr Alpha', date: '01-Jan-26', nhs: '3333333333' },
    { clinician: 'Dr Alpha', date: '20-Feb-26', nhs: '3333333333' },
  ]);

  const sameGp = calculateSameGPFollowUpRates(data, 'all');
  const doctor = sameGp.doctorBreakdown.find(d => d.name === 'Dr Alpha');

  assert.ok(doctor);
  assert.equal(sameGp.totalSourceAppts, 5);
  assert.equal(sameGp.sameGP7, 1);
  assert.equal(doctor.totalVisits, 5);
  assert.equal(doctor.pairs, 2);
  assert.equal(doctor.followUp7, 1);
  assert.ok(Math.abs(doctor.rate7 - 20) < 1e-9);
  assert.ok(Math.abs(doctor.rate14 - 20) < 1e-9);
  assert.ok(Math.abs(doctor.rate28 - 20) < 1e-9);
});

test('clinician and monthly trend follow-ups use next doctor appointment (ignore non-doctor visits)', () => {
  const data = parseRows([
    { clinician: 'Dr Alpha', date: '01-Jan-26', nhs: '1111111111' },
    { clinician: 'Nurse Beth', date: '03-Jan-26', nhs: '1111111111' },
    { clinician: 'Dr Charlie', date: '10-Jan-26', nhs: '1111111111' },
  ]);

  const clinicianRates = calculateClinicianFollowUpRates(data, 'all');
  const drAlpha = clinicianRates.find(c => c.clinician === 'Dr Alpha');
  assert.ok(drAlpha);
  assert.equal(drAlpha.totalAppointments, 1);
  assert.equal(drAlpha.followUp7, 0);
  assert.equal(drAlpha.followUp14, 1);
  assert.equal(drAlpha.followUp28, 0);
  assert.equal(drAlpha.noFollowUp, 0);
  assert.ok(Math.abs(drAlpha.rate7 - 0) < 1e-9);
  assert.ok(Math.abs(drAlpha.rate14 - 100) < 1e-9);
  assert.ok(Math.abs(drAlpha.rate28 - 100) < 1e-9);

  const trends = calculateMonthlyTrends(data);
  assert.equal(trends.length, 1);
  assert.equal(trends[0].totalAppts, 2);
  assert.equal(trends[0].followUp7, 0);
  assert.equal(trends[0].followUp14, 1);
  assert.equal(trends[0].followUp28, 0);
  assert.ok(Math.abs(trends[0].rate7 - 0) < 1e-9);
  assert.ok(Math.abs(trends[0].rate14 - 50) < 1e-9);
  assert.ok(Math.abs(trends[0].rate28 - 50) < 1e-9);
});
