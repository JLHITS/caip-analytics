import {
  ROLE_GROUPS,
  ROLE_GROUP_ORDER,
  GP_ROLE_GROUPS,
  CLINICAL_ROLE_GROUPS,
  NON_CLINICAL_ROLE_GROUPS,
  ARRS_ROLE_GROUPS,
  DEFAULT_APPOINTMENTS_PER_WTE_DAY,
} from './workforceSchema.js';
import { getDaysInMonth } from './demandCapacityMetrics.js';

export const DEFAULT_WORKING_DAYS = 21;

export const defaultCapacityAssumptions = {
  workingDaysPerMonth: DEFAULT_WORKING_DAYS,
  appointmentsPerWtePerDay: { ...DEFAULT_APPOINTMENTS_PER_WTE_DAY },
};

export function buildRoleTotals(records = []) {
  const totals = {};
  records.forEach((record) => {
    if (!record?.roleGroup) return;
    totals[record.roleGroup] = {
      wte: record.wte ?? 0,
      headcount: record.headcount ?? null,
    };
  });
  return totals;
}

export function getRoleWte(roleTotals, roleGroup) {
  return roleTotals?.[roleGroup]?.wte || 0;
}

export function getRoleHeadcount(roleTotals, roleGroup) {
  const value = roleTotals?.[roleGroup]?.headcount;
  return value === null || value === undefined ? null : value;
}

export function calculateWorkforceTotals(roleTotals = {}, overrides = {}) {
  const sumGroupWte = (groups) => groups.reduce((sum, group) => sum + getRoleWte(roleTotals, group), 0);
  const sumGroupHeadcount = (groups) => {
    let total = 0;
    let hasValue = false;
    groups.forEach((group) => {
      const value = getRoleHeadcount(roleTotals, group);
      if (value === null) return;
      total += value;
      hasValue = true;
    });
    return hasValue ? total : null;
  };

  const totalWte = ROLE_GROUP_ORDER.reduce((sum, group) => sum + getRoleWte(roleTotals, group), 0);
  const totalWteGP = sumGroupWte(GP_ROLE_GROUPS);
  const totalWteClinical = sumGroupWte(CLINICAL_ROLE_GROUPS);
  const totalWteNonClinical = sumGroupWte(NON_CLINICAL_ROLE_GROUPS);
  const totalWteARRS = sumGroupWte(ARRS_ROLE_GROUPS) + (overrides.arrsOtherWte || 0);

  return {
    totalWte,
    totalWteGP,
    totalWteClinical,
    totalWteNonClinical,
    totalWteARRS,
    totalWteARRSRoles: sumGroupWte(ARRS_ROLE_GROUPS),
    arrsOtherWte: overrides.arrsOtherWte || 0,
    totalHeadcount: sumGroupHeadcount(ROLE_GROUP_ORDER),
    totalHeadcountGP: sumGroupHeadcount(GP_ROLE_GROUPS),
    totalHeadcountClinical: sumGroupHeadcount(CLINICAL_ROLE_GROUPS),
    totalHeadcountNonClinical: sumGroupHeadcount(NON_CLINICAL_ROLE_GROUPS),
    totalHeadcountARRS: overrides.arrsOtherHeadcount !== null && overrides.arrsOtherHeadcount !== undefined
      ? (sumGroupHeadcount(ARRS_ROLE_GROUPS) || 0) + overrides.arrsOtherHeadcount
      : sumGroupHeadcount(ARRS_ROLE_GROUPS),
  };
}

export function calculateDerivedWorkforceMetrics(totals, listSize) {
  const population = listSize || 0;
  const gpWte = totals?.totalWteGP || 0;
  const clinicalWte = totals?.totalWteClinical || 0;
  const nonClinicalWte = totals?.totalWteNonClinical || 0;
  const arrsWte = totals?.totalWteARRS || 0;

  return {
    patientsPerGpWte: gpWte > 0 ? population / gpWte : null,
    patientsPerClinicalWte: clinicalWte > 0 ? population / clinicalWte : null,
    gpWtePer1000: population > 0 ? (gpWte / population) * 1000 : null,
    clinicalWtePer1000: population > 0 ? (clinicalWte / population) * 1000 : null,
    adminToClinicalRatio: clinicalWte > 0 ? nonClinicalWte / clinicalWte : null,
    arrsPctClinical: clinicalWte > 0 ? (arrsWte / clinicalWte) * 100 : null,
    skillMixIndex: clinicalWte > 0 ? (clinicalWte - gpWte) / clinicalWte : null,
  };
}

export function calculateFragilityFlags(roleTotals, thresholds = {}) {
  const defaults = {
    gp: { minWte: 0.5, maxHeadcount: 1 },
    nurse: { minWte: 0.5, maxHeadcount: 1 },
    reception: { minWte: 0.5, maxHeadcount: 1 },
  };

  const config = { ...defaults, ...thresholds };

  const gpWte = GP_ROLE_GROUPS.reduce((sum, group) => sum + getRoleWte(roleTotals, group), 0);
  let gpHeadcountValue = 0;
  let gpHeadcountKnown = false;
  GP_ROLE_GROUPS.forEach((group) => {
    const value = getRoleHeadcount(roleTotals, group);
    if (value === null) return;
    gpHeadcountValue += value;
    gpHeadcountKnown = true;
  });
  const gpHeadcount = gpHeadcountKnown ? gpHeadcountValue : null;

  const nurseWte = getRoleWte(roleTotals, ROLE_GROUPS.NURSE);
  const nurseHeadcount = getRoleHeadcount(roleTotals, ROLE_GROUPS.NURSE);

  const receptionWte = getRoleWte(roleTotals, ROLE_GROUPS.RECEPTION);
  const receptionHeadcount = getRoleHeadcount(roleTotals, ROLE_GROUPS.RECEPTION);

  const flags = [];

  if (gpWte > 0 && ((gpHeadcount !== null && gpHeadcount <= config.gp.maxHeadcount) || gpWte <= config.gp.minWte)) {
    flags.push({
      roleGroup: 'GP',
      message: 'Single GP dependency risk',
      wte: gpWte,
      headcount: gpHeadcount,
    });
  }

  if (nurseWte > 0 && (nurseHeadcount !== null && nurseHeadcount <= config.nurse.maxHeadcount || nurseWte <= config.nurse.minWte)) {
    flags.push({
      roleGroup: ROLE_GROUPS.NURSE,
      message: 'Single nurse dependency risk',
      wte: nurseWte,
      headcount: nurseHeadcount,
    });
  }

  if (receptionWte > 0 && (receptionHeadcount !== null && receptionHeadcount <= config.reception.maxHeadcount || receptionWte <= config.reception.minWte)) {
    flags.push({
      roleGroup: ROLE_GROUPS.RECEPTION,
      message: 'Single reception dependency risk',
      wte: receptionWte,
      headcount: receptionHeadcount,
    });
  }

  return flags;
}

export function calculateWorkforceDemandMetrics(totals, roleTotals, apptData, telephonyData, ocData) {
  const gpAppointments = apptData?.staffBreakdown?.gpAppointments || 0;
  const otherAppointments = apptData?.staffBreakdown?.otherStaffAppointments || 0;
  const totalAppointments = apptData?.totalAppointments || (gpAppointments + otherAppointments);

  const gpWte = totals?.totalWteGP || 0;
  const clinicalWte = totals?.totalWteClinical || 0;
  const nonGpClinicalWte = Math.max(0, clinicalWte - gpWte);

  const adminWte =
    getRoleWte(roleTotals, ROLE_GROUPS.ADMIN) +
    getRoleWte(roleTotals, ROLE_GROUPS.RECEPTION) +
    getRoleWte(roleTotals, ROLE_GROUPS.PRACTICE_MGR);

  const answeredCalls = telephonyData?.answered || 0;
  const missedCalls = telephonyData?.missed || 0;

  const ocSubmissions = ocData?.submissions || ocData?.totalSubmissions || 0;
  const ocClinicalSubmissions = ocData?.clinicalSubmissions || 0;

  return {
    appointmentsPerGpWte: gpWte > 0 ? gpAppointments / gpWte : null,
    appointmentsPerClinicalWte: clinicalWte > 0 ? totalAppointments / clinicalWte : null,
    appointmentsPerNonGpClinicalWte: nonGpClinicalWte > 0 ? otherAppointments / nonGpClinicalWte : null,
    callsAnsweredPerAdminWte: adminWte > 0 ? answeredCalls / adminWte : null,
    callsMissedPerAdminWte: adminWte > 0 ? missedCalls / adminWte : null,
    ocPerGpWte: gpWte > 0 ? ocSubmissions / gpWte : null,
    ocClinicalPerGpWte: gpWte > 0 ? ocClinicalSubmissions / gpWte : null,
    ocPerClinicalWte: clinicalWte > 0 ? ocSubmissions / clinicalWte : null,
    totalAppointments,
    gpAppointments,
    otherAppointments,
    answeredCalls,
    missedCalls,
    ocSubmissions,
    ocClinicalSubmissions,
    adminWte,
  };
}

const distributeByWte = (total, roleTotals, groups) => {
  const wteTotals = groups.map((group) => ({ group, wte: getRoleWte(roleTotals, group) }));
  const totalWte = wteTotals.reduce((sum, item) => sum + item.wte, 0);
  if (!totalWte || total <= 0) {
    return Object.fromEntries(groups.map((group) => [group, 0]));
  }
  return Object.fromEntries(wteTotals.map((item) => [item.group, (total * item.wte) / totalWte]));
};

export function calculateCapacityModel({ roleTotals, totals, apptData, assumptions, month }) {
  const workingDays = assumptions?.workingDaysPerMonth || getDaysInMonth(month) || DEFAULT_WORKING_DAYS;
  const perWtePerDay = {
    ...DEFAULT_APPOINTMENTS_PER_WTE_DAY,
    ...(assumptions?.appointmentsPerWtePerDay || {}),
  };

  const gpAppointments = apptData?.staffBreakdown?.gpAppointments || 0;
  const otherAppointments = apptData?.staffBreakdown?.otherStaffAppointments || 0;

  const gpRoleActuals = distributeByWte(gpAppointments, roleTotals, GP_ROLE_GROUPS);
  const nonGpClinicalGroups = CLINICAL_ROLE_GROUPS.filter((group) => !GP_ROLE_GROUPS.includes(group));
  const nonGpRoleActuals = distributeByWte(otherAppointments, roleTotals, nonGpClinicalGroups);

  const roleCapacity = {};
  const totalTheoretical = CLINICAL_ROLE_GROUPS.reduce((sum, group) => {
    const wte = getRoleWte(roleTotals, group);
    const rate = perWtePerDay[group] || 0;
    const theoretical = wte * rate * workingDays;
    const actual = GP_ROLE_GROUPS.includes(group)
      ? (gpRoleActuals[group] || 0)
      : (nonGpRoleActuals[group] || 0);

    roleCapacity[group] = {
      wte,
      appointmentsPerWtePerDay: rate,
      theoretical,
      actual,
      utilization: theoretical > 0 ? actual / theoretical : null,
      unused: Math.max(0, theoretical - actual),
    };

    return sum + theoretical;
  }, 0);

  const totalActual = (totals?.totalWteClinical || 0) > 0 ? (gpAppointments + otherAppointments) : 0;
  const utilization = totalTheoretical > 0 ? totalActual / totalTheoretical : null;

  return {
    workingDays,
    perWtePerDay,
    roleCapacity,
    totalTheoretical,
    totalActual,
    utilization,
    unusedCapacity: Math.max(0, totalTheoretical - totalActual),
  };
}

export function calculateCapacityPressureScore({ demandCapacityRatio, missedCallsPerAdminWte, ocPerGpWte }) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const demandScore = clamp((demandCapacityRatio || 0) / 1.2, 0, 1.5);
  const missedScore = clamp((missedCallsPerAdminWte || 0) / 150, 0, 1.5);
  const ocScore = clamp((ocPerGpWte || 0) / 80, 0, 1.5);

  const weighted = (demandScore * 0.6 + missedScore * 0.25 + ocScore * 0.15) / 1.5;
  return Math.round(weighted * 100);
}

export default {
  buildRoleTotals,
  calculateWorkforceTotals,
  calculateDerivedWorkforceMetrics,
  calculateFragilityFlags,
  calculateWorkforceDemandMetrics,
  calculateCapacityModel,
  calculateCapacityPressureScore,
};
