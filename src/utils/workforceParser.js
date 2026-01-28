import {
  ROLE_MAPPINGS,
  ROLE_LABELS,
  ROLE_GROUP_ORDER,
  GP_ROLE_GROUPS,
  CLINICAL_ROLE_GROUPS,
  NON_CLINICAL_ROLE_GROUPS,
  ARRS_ROLE_GROUPS,
  ARRS_OTHER_FTE_FIELDS,
  ARRS_OTHER_HC_FIELDS,
  parseNumber,
  sumFields,
  inferUnits,
  humanizeFieldName,
} from './workforceSchema.js';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const titleCaseMonth = (value) => {
  const lower = value.toLowerCase();
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === lower);
  return idx >= 0 ? MONTH_NAMES[idx] : value;
};

export function inferMonthFromFilename(filename) {
  const match = String(filename || '').match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (!match) return null;
  return `${titleCaseMonth(match[1])} ${match[2]}`;
}

export function parseWorkforceDefinitionsRows(rows = []) {
  if (!rows.length) {
    return { columns: [], byColumn: {} };
  }

  const header = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
  const indexMap = header.reduce((acc, name, idx) => {
    if (name) acc[name] = idx;
    return acc;
  }, {});

  const fieldIndex = indexMap['name of field'] ?? 1;
  const descIndex = indexMap['description'] ?? 2;
  const commentsIndex = indexMap['comments'] ?? 3;

  const columns = [];
  const byColumn = {};

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const column = String(row[fieldIndex] || '').trim();
    if (!column) continue;

    const description = String(row[descIndex] || '').trim();
    const comments = String(row[commentsIndex] || '').trim();
    const units = inferUnits(column);
    const label = description || humanizeFieldName(column);

    const entry = {
      column,
      label,
      description,
      comments,
      units,
    };

    columns.push(entry);
    byColumn[column] = entry;
  }

  return { columns, byColumn };
}

const cleanText = (value) => String(value || '').trim();

const isUnmapped = (value) => {
  const text = cleanText(value).toLowerCase();
  return text === 'unmapped' || text === 'na';
};

const buildRoleTotals = (records = []) => {
  const totals = {};
  records.forEach((record) => {
    if (!record?.roleGroup) return;
    totals[record.roleGroup] = {
      wte: record.wte ?? 0,
      headcount: record.headcount ?? null,
    };
  });
  return totals;
};

const sumRoleWte = (roleTotals, groups) => (
  groups.reduce((sum, group) => sum + (roleTotals[group]?.wte || 0), 0)
);

const sumRoleHeadcount = (roleTotals, groups) => {
  let total = 0;
  let hasValue = false;
  groups.forEach((group) => {
    const value = roleTotals[group]?.headcount;
    if (value === null || value === undefined) return;
    total += value;
    hasValue = true;
  });
  return hasValue ? total : null;
};

export function buildWorkforcePractice(row, month) {
  const odsCode = cleanText(row.PRAC_CODE);
  if (!odsCode || isUnmapped(odsCode)) return null;

  const gpName = cleanText(row.PRAC_NAME);
  if (!gpName || isUnmapped(gpName)) return null;

  const listSize = parseNumber(row.TOTAL_PATIENTS) ?? 0;

  const records = [];
  ROLE_MAPPINGS.forEach((mapping) => {
    const wte = sumFields(row, mapping.wteFields);
    const headcount = sumFields(row, mapping.headcountFields);
    if (wte === null && headcount === null) return;

    records.push({
      practiceCode: odsCode,
      month,
      roleGroup: mapping.roleGroup,
      wte: wte ?? 0,
      headcount: headcount ?? null,
      sourceFields: {
        wteColumns: mapping.wteFields,
        headcountColumns: mapping.headcountFields,
      },
    });
  });

  const roleTotals = buildRoleTotals(records);

  const totalWte = ROLE_GROUP_ORDER.reduce((sum, group) => sum + (roleTotals[group]?.wte || 0), 0);
  const totalWteGP = sumRoleWte(roleTotals, GP_ROLE_GROUPS);
  const totalWteClinical = sumRoleWte(roleTotals, CLINICAL_ROLE_GROUPS);
  const totalWteNonClinical = sumRoleWte(roleTotals, NON_CLINICAL_ROLE_GROUPS);
  const totalWteARRSRoles = sumRoleWte(roleTotals, ARRS_ROLE_GROUPS);
  const arrsOtherWte = sumFields(row, ARRS_OTHER_FTE_FIELDS) ?? 0;
  const totalWteARRS = totalWteARRSRoles + arrsOtherWte;

  const totalHeadcount = sumRoleHeadcount(roleTotals, ROLE_GROUP_ORDER);
  const totalHeadcountGP = sumRoleHeadcount(roleTotals, GP_ROLE_GROUPS);
  const totalHeadcountClinical = sumRoleHeadcount(roleTotals, CLINICAL_ROLE_GROUPS);
  const totalHeadcountNonClinical = sumRoleHeadcount(roleTotals, NON_CLINICAL_ROLE_GROUPS);
  const totalHeadcountARRSRoles = sumRoleHeadcount(roleTotals, ARRS_ROLE_GROUPS);
  const arrsOtherHeadcount = sumFields(row, ARRS_OTHER_HC_FIELDS);
  const totalHeadcountARRS =
    totalHeadcountARRSRoles !== null || arrsOtherHeadcount !== null
      ? (totalHeadcountARRSRoles || 0) + (arrsOtherHeadcount || 0)
      : null;

  return {
    odsCode,
    gpName,
    pcnCode: cleanText(row.PCN_CODE),
    pcnName: cleanText(row.PCN_NAME),
    subICBCode: cleanText(row.SUB_ICB_CODE),
    subICBName: cleanText(row.SUB_ICB_NAME),
    icbCode: cleanText(row.ICB_CODE),
    icbName: cleanText(row.ICB_NAME),
    regionCode: cleanText(row.REGION_CODE),
    regionName: cleanText(row.REGION_NAME),
    listSize,
    dataQuality: {
      gpSource: cleanText(row.GP_SOURCE),
      nurseSource: cleanText(row.NURSE_SOURCE),
      dpcSource: cleanText(row.DPC_SOURCE),
      adminSource: cleanText(row.ADMIN_SOURCE),
    },
    workforce: {
      month,
      records,
      totals: {
        totalWte,
        totalWteGP,
        totalWteClinical,
        totalWteNonClinical,
        totalWteARRS,
        totalWteARRSRoles,
        arrsOtherWte,
        totalHeadcount,
        totalHeadcountGP,
        totalHeadcountClinical,
        totalHeadcountNonClinical,
        totalHeadcountARRS,
        arrsOtherHeadcount,
      },
    },
  };
}

export function aggregateWorkforcePractices(practices = []) {
  const totals = {
    totalWte: 0,
    totalWteGP: 0,
    totalWteClinical: 0,
    totalWteNonClinical: 0,
    totalWteARRS: 0,
    totalWteARRSRoles: 0,
    arrsOtherWte: 0,
    totalHeadcount: 0,
    totalHeadcountGP: 0,
    totalHeadcountClinical: 0,
    totalHeadcountNonClinical: 0,
    totalHeadcountARRS: 0,
    arrsOtherHeadcount: 0,
  };
  const roleTotals = {};
  const listSizeTotal = practices.reduce((sum, practice) => sum + (practice.listSize || 0), 0);

  practices.forEach((practice) => {
    const practiceTotals = practice?.workforce?.totals || {};
    totals.totalWte += practiceTotals.totalWte || 0;
    totals.totalWteGP += practiceTotals.totalWteGP || 0;
    totals.totalWteClinical += practiceTotals.totalWteClinical || 0;
    totals.totalWteNonClinical += practiceTotals.totalWteNonClinical || 0;
    totals.totalWteARRS += practiceTotals.totalWteARRS || 0;
    totals.totalWteARRSRoles += practiceTotals.totalWteARRSRoles || 0;
    totals.arrsOtherWte += practiceTotals.arrsOtherWte || 0;
    totals.arrsOtherHeadcount += practiceTotals.arrsOtherHeadcount || 0;

    const headcountValue = practiceTotals.totalHeadcount;
    if (headcountValue !== null && headcountValue !== undefined) {
      totals.totalHeadcount += headcountValue;
    }
    const headcountGP = practiceTotals.totalHeadcountGP;
    if (headcountGP !== null && headcountGP !== undefined) {
      totals.totalHeadcountGP += headcountGP;
    }
    const headcountClinical = practiceTotals.totalHeadcountClinical;
    if (headcountClinical !== null && headcountClinical !== undefined) {
      totals.totalHeadcountClinical += headcountClinical;
    }
    const headcountNonClinical = practiceTotals.totalHeadcountNonClinical;
    if (headcountNonClinical !== null && headcountNonClinical !== undefined) {
      totals.totalHeadcountNonClinical += headcountNonClinical;
    }
    const headcountARRS = practiceTotals.totalHeadcountARRS;
    if (headcountARRS !== null && headcountARRS !== undefined) {
      totals.totalHeadcountARRS += headcountARRS;
    }

    (practice?.workforce?.records || []).forEach((record) => {
      if (!roleTotals[record.roleGroup]) {
        roleTotals[record.roleGroup] = { wte: 0, headcount: 0 };
      }
      roleTotals[record.roleGroup].wte += record.wte || 0;
      if (record.headcount !== null && record.headcount !== undefined) {
        roleTotals[record.roleGroup].headcount += record.headcount || 0;
      }
    });
  });

  return {
    practiceCount: practices.length,
    listSize: listSizeTotal,
    roleTotals,
    totals,
  };
}

export function buildWorkforceDataset(rows = [], month) {
  const practices = [];
  rows.forEach((row) => {
    const practice = buildWorkforcePractice(row, month);
    if (practice) practices.push(practice);
  });

  return {
    dataMonth: month,
    practices,
    national: aggregateWorkforcePractices(practices),
  };
}

export function getRoleLabel(roleGroup) {
  return ROLE_LABELS[roleGroup] || roleGroup;
}

export function summarizeRoleMapping() {
  return ROLE_MAPPINGS.map((mapping) => ({
    roleGroup: mapping.roleGroup,
    label: ROLE_LABELS[mapping.roleGroup] || mapping.roleGroup,
    wteFields: mapping.wteFields,
    headcountFields: mapping.headcountFields,
  }));
}
