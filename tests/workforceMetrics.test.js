import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

import { buildWorkforceDataset } from '../src/utils/workforceParser.js';
import {
  buildRoleTotals,
  calculateWorkforceTotals,
  calculateDerivedWorkforceMetrics,
  calculateCapacityModel,
} from '../src/utils/workforceMetrics.js';

const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'workforce-sample.csv');

const loadFixture = () => {
  const csvText = fs.readFileSync(fixturePath, 'utf8');
  return Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
};

test('buildWorkforceDataset parses sample workforce CSV', () => {
  const rows = loadFixture();
  const dataset = buildWorkforceDataset(rows, 'November 2025');

  assert.equal(dataset.practices.length, 2);
  assert.equal(dataset.dataMonth, 'November 2025');

  const practice = dataset.practices[0];
  assert.equal(practice.odsCode, 'A00001');
  assert.equal(practice.gpName, 'Test Practice One');
  assert.ok(practice.workforce.records.length > 5);
  assert.equal(Number(practice.workforce.totals.totalWteGP.toFixed(1)), 3.7);
});

test('calculateDerivedWorkforceMetrics returns expected ratios', () => {
  const rows = loadFixture();
  const dataset = buildWorkforceDataset(rows, 'November 2025');
  const practice = dataset.practices[0];

  const roleTotals = buildRoleTotals(practice.workforce.records);
  const totals = calculateWorkforceTotals(roleTotals, {
    arrsOtherWte: practice.workforce.totals.arrsOtherWte,
    arrsOtherHeadcount: practice.workforce.totals.arrsOtherHeadcount,
  });

  const derived = calculateDerivedWorkforceMetrics(totals, practice.listSize);
  assert.ok(Math.abs(derived.patientsPerGpWte - 2702.7) < 1);
  assert.ok(derived.gpWtePer1000 > 0.3);
});

test('calculateCapacityModel builds role capacities', () => {
  const rows = loadFixture();
  const dataset = buildWorkforceDataset(rows, 'November 2025');
  const practice = dataset.practices[0];

  const roleTotals = buildRoleTotals(practice.workforce.records);
  const totals = calculateWorkforceTotals(roleTotals, {
    arrsOtherWte: practice.workforce.totals.arrsOtherWte,
    arrsOtherHeadcount: practice.workforce.totals.arrsOtherHeadcount,
  });

  const capacity = calculateCapacityModel({
    roleTotals,
    totals,
    apptData: {
      staffBreakdown: { gpAppointments: 2000, otherStaffAppointments: 1000 },
    },
    assumptions: {
      workingDaysPerMonth: 20,
      appointmentsPerWtePerDay: {
        ...{
          GP_PARTNER: 25,
          GP_SALARIED: 25,
          GP_LOCUM: 25,
          GP_REGISTRAR: 20,
          NURSE: 18,
          HCA: 12,
          PHARMACIST: 18,
          PARAMEDIC: 20,
          PHYSIO: 16,
          MENTAL_HEALTH: 12,
          OTHER: 15,
        }
      },
    },
    month: 'November 2025',
  });

  assert.ok(capacity.totalTheoretical > 3000);
  assert.ok(Math.abs(capacity.totalTheoretical - 3974) < 5);
  assert.ok(capacity.roleCapacity.GP_PARTNER.theoretical > 900);
});
