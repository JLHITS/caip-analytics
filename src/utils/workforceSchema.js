export const ROLE_GROUPS = {
  GP_PARTNER: 'GP_PARTNER',
  GP_SALARIED: 'GP_SALARIED',
  GP_LOCUM: 'GP_LOCUM',
  GP_REGISTRAR: 'GP_REGISTRAR',
  NURSE: 'NURSE',
  HCA: 'HCA',
  PHARMACIST: 'PHARMACIST',
  PHARM_TECH: 'PHARM_TECH',
  PARAMEDIC: 'PARAMEDIC',
  PHYSIO: 'PHYSIO',
  MENTAL_HEALTH: 'MENTAL_HEALTH',
  RECEPTION: 'RECEPTION',
  ADMIN: 'ADMIN',
  PRACTICE_MGR: 'PRACTICE_MGR',
  OTHER: 'OTHER',
};

export const ROLE_LABELS = {
  [ROLE_GROUPS.GP_PARTNER]: 'GP Partner',
  [ROLE_GROUPS.GP_SALARIED]: 'GP Salaried',
  [ROLE_GROUPS.GP_LOCUM]: 'GP Locum',
  [ROLE_GROUPS.GP_REGISTRAR]: 'GP Registrar',
  [ROLE_GROUPS.NURSE]: 'Nurse',
  [ROLE_GROUPS.HCA]: 'Healthcare Assistant',
  [ROLE_GROUPS.PHARMACIST]: 'Pharmacist',
  [ROLE_GROUPS.PHARM_TECH]: 'Pharmacy Technician',
  [ROLE_GROUPS.PARAMEDIC]: 'Paramedic',
  [ROLE_GROUPS.PHYSIO]: 'Physiotherapist',
  [ROLE_GROUPS.MENTAL_HEALTH]: 'Mental Health / Talking Therapies',
  [ROLE_GROUPS.RECEPTION]: 'Reception / Telephonist',
  [ROLE_GROUPS.ADMIN]: 'Admin / Support',
  [ROLE_GROUPS.PRACTICE_MGR]: 'Practice Manager',
  [ROLE_GROUPS.OTHER]: 'Other Clinical (DPC)',
};

export const ROLE_GROUP_ORDER = [
  ROLE_GROUPS.GP_PARTNER,
  ROLE_GROUPS.GP_SALARIED,
  ROLE_GROUPS.GP_LOCUM,
  ROLE_GROUPS.GP_REGISTRAR,
  ROLE_GROUPS.NURSE,
  ROLE_GROUPS.HCA,
  ROLE_GROUPS.PHARMACIST,
  ROLE_GROUPS.PHARM_TECH,
  ROLE_GROUPS.PARAMEDIC,
  ROLE_GROUPS.PHYSIO,
  ROLE_GROUPS.MENTAL_HEALTH,
  ROLE_GROUPS.OTHER,
  ROLE_GROUPS.RECEPTION,
  ROLE_GROUPS.ADMIN,
  ROLE_GROUPS.PRACTICE_MGR,
];

export const GP_ROLE_GROUPS = [
  ROLE_GROUPS.GP_PARTNER,
  ROLE_GROUPS.GP_SALARIED,
  ROLE_GROUPS.GP_LOCUM,
  ROLE_GROUPS.GP_REGISTRAR,
];

export const CLINICAL_ROLE_GROUPS = [
  ROLE_GROUPS.GP_PARTNER,
  ROLE_GROUPS.GP_SALARIED,
  ROLE_GROUPS.GP_LOCUM,
  ROLE_GROUPS.GP_REGISTRAR,
  ROLE_GROUPS.NURSE,
  ROLE_GROUPS.HCA,
  ROLE_GROUPS.PHARMACIST,
  ROLE_GROUPS.PHARM_TECH,
  ROLE_GROUPS.PARAMEDIC,
  ROLE_GROUPS.PHYSIO,
  ROLE_GROUPS.MENTAL_HEALTH,
  ROLE_GROUPS.OTHER,
];

export const NON_CLINICAL_ROLE_GROUPS = [
  ROLE_GROUPS.RECEPTION,
  ROLE_GROUPS.ADMIN,
  ROLE_GROUPS.PRACTICE_MGR,
];

export const ARRS_ROLE_GROUPS = [
  ROLE_GROUPS.PHARMACIST,
  ROLE_GROUPS.PHARM_TECH,
  ROLE_GROUPS.PARAMEDIC,
  ROLE_GROUPS.PHYSIO,
  ROLE_GROUPS.MENTAL_HEALTH,
];

export const ROLE_MAPPINGS = [
  {
    roleGroup: ROLE_GROUPS.GP_PARTNER,
    wteFields: ['TOTAL_GP_SEN_PTNR_FTE', 'TOTAL_GP_PTNR_PROV_FTE'],
    headcountFields: ['TOTAL_GP_SEN_PTNR_HC', 'TOTAL_GP_PTNR_PROV_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.GP_SALARIED,
    wteFields: ['TOTAL_GP_SAL_BY_PRAC_FTE', 'TOTAL_GP_SAL_BY_OTH_FTE'],
    headcountFields: ['TOTAL_GP_SAL_BY_PRAC_HC', 'TOTAL_GP_SAL_BY_OTH_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.GP_LOCUM,
    wteFields: ['TOTAL_GP_LOCUM_VAC_FTE', 'TOTAL_GP_LOCUM_ABS_FTE', 'TOTAL_GP_LOCUM_OTH_FTE'],
    headcountFields: ['TOTAL_GP_LOCUM_VAC_HC', 'TOTAL_GP_LOCUM_ABS_HC', 'TOTAL_GP_LOCUM_OTH_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.GP_REGISTRAR,
    wteFields: [
      'TOTAL_GP_TRN_GR_ST1_FTE',
      'TOTAL_GP_TRN_GR_ST2_FTE',
      'TOTAL_GP_TRN_GR_ST3_FTE',
      'TOTAL_GP_TRN_GR_ST4_FTE',
      'TOTAL_GP_TRN_GR_OTH_FTE',
      'TOTAL_GP_TRN_GR_F1_2_FTE',
    ],
    headcountFields: [
      'TOTAL_GP_TRN_GR_ST1_HC',
      'TOTAL_GP_TRN_GR_ST2_HC',
      'TOTAL_GP_TRN_GR_ST3_HC',
      'TOTAL_GP_TRN_GR_ST4_HC',
      'TOTAL_GP_TRN_GR_OTH_HC',
      'TOTAL_GP_TRN_GR_F1_2_HC',
    ],
  },
  {
    roleGroup: ROLE_GROUPS.NURSE,
    wteFields: ['TOTAL_NURSES_FTE', 'TOTAL_DPC_NURSE_ASSOC_FTE', 'TOTAL_DPC_TRAINEE_NURSE_ASSOC_FTE'],
    headcountFields: ['TOTAL_NURSES_HC', 'TOTAL_DPC_NURSE_ASSOC_HC', 'TOTAL_DPC_TRAINEE_NURSE_ASSOC_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.HCA,
    wteFields: ['TOTAL_DPC_HCA_FTE', 'TOTAL_DPC_APP_HCA_FTE'],
    headcountFields: ['TOTAL_DPC_HCA_HC', 'TOTAL_DPC_APP_HCA_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.PHARMACIST,
    wteFields: ['TOTAL_DPC_PHARMA_FTE', 'TOTAL_DPC_ADV_PHARMA_PRAC_FTE', 'TOTAL_DPC_APP_PHARMA_FTE'],
    headcountFields: ['TOTAL_DPC_PHARMA_HC', 'TOTAL_DPC_ADV_PHARMA_PRAC_HC', 'TOTAL_DPC_APP_PHARMA_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.PHARM_TECH,
    wteFields: ['TOTAL_DPC_PHARMT_FTE', 'TOTAL_DPC_TRAINEE_PHARMT_FTE'],
    headcountFields: ['TOTAL_DPC_PHARMT_HC', 'TOTAL_DPC_TRAINEE_PHARMT_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.PARAMEDIC,
    wteFields: ['TOTAL_DPC_PARAMED_FTE', 'TOTAL_DPC_ADV_PARAMED_PRAC_FTE'],
    headcountFields: ['TOTAL_DPC_PARAMED_HC', 'TOTAL_DPC_ADV_PARAMED_PRAC_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.PHYSIO,
    wteFields: ['TOTAL_DPC_PHYSIO_FTE', 'TOTAL_DPC_ADV_PHYSIO_PRAC_FTE', 'TOTAL_DPC_APP_PHYSIO_FTE'],
    headcountFields: ['TOTAL_DPC_PHYSIO_HC', 'TOTAL_DPC_ADV_PHYSIO_PRAC_HC', 'TOTAL_DPC_APP_PHYSIO_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.MENTAL_HEALTH,
    wteFields: ['TOTAL_DPC_NHS_TALKING_THERA_FTE', 'TOTAL_DPC_TRAINEE_NHS_TALKING_THERA_FTE', 'TOTAL_DPC_THERA_COU_FTE'],
    headcountFields: ['TOTAL_DPC_NHS_TALKING_THERA_HC', 'TOTAL_DPC_TRAINEE_NHS_TALKING_THERA_HC', 'TOTAL_DPC_THERA_COU_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.RECEPTION,
    wteFields: ['TOTAL_ADMIN_RECEPT_FTE', 'TOTAL_ADMIN_TELEPH_FTE'],
    headcountFields: ['TOTAL_ADMIN_RECEPT_HC', 'TOTAL_ADMIN_TELEPH_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.ADMIN,
    wteFields: [
      'TOTAL_ADMIN_MED_SECRETARY_FTE',
      'TOTAL_ADMIN_ESTATES_ANC_FTE',
      'TOTAL_ADMIN_DT_LEAD_FTE',
      'TOTAL_ADMIN_OTH_FTE',
      'TOTAL_ADMIN_APP_FTE',
    ],
    headcountFields: [
      'TOTAL_ADMIN_MED_SECRETARY_HC',
      'TOTAL_ADMIN_ESTATES_ANC_HC',
      'TOTAL_ADMIN_DT_LEAD_HC',
      'TOTAL_ADMIN_OTH_HC',
      'TOTAL_ADMIN_APP_HC',
    ],
  },
  {
    roleGroup: ROLE_GROUPS.PRACTICE_MGR,
    wteFields: ['TOTAL_ADMIN_MANAGER_FTE', 'TOTAL_ADMIN_MANAGE_PTNR_FTE'],
    headcountFields: ['TOTAL_ADMIN_MANAGER_HC', 'TOTAL_ADMIN_MANAGE_PTNR_HC'],
  },
  {
    roleGroup: ROLE_GROUPS.OTHER,
    wteFields: [
      'TOTAL_DPC_ADV_DIETICIAN_PRAC_FTE',
      'TOTAL_DPC_ADV_PODIA_PRAC_FTE',
      'TOTAL_DPC_ADV_THERA_OCC_PRAC_FTE',
      'TOTAL_DPC_DIETICIAN_FTE',
      'TOTAL_DPC_DISPENSER_FTE',
      'TOTAL_DPC_GPA_FTE',
      'TOTAL_DPC_OST_FTE',
      'TOTAL_DPC_PHLEB_FTE',
      'TOTAL_DPC_PODIA_FTE',
      'TOTAL_DPC_PHYSICIAN_ASSOC_FTE',
      'TOTAL_DPC_THERA_OCC_FTE',
      'TOTAL_DPC_THERA_OTH_FTE',
      'TOTAL_DPC_APP_PHLEB_FTE',
      'TOTAL_DPC_APP_PHYSICIAN_ASSOC_FTE',
      'TOTAL_DPC_APP_OTH_FTE',
      'TOTAL_DPC_APPRENTICE_FTE',
      'TOTAL_DPC_HLTH_SPRT_WRK_FTE',
      'TOTAL_DPC_SPLW_FTE',
      'TOTAL_DPC_OTH_FTE',
    ],
    headcountFields: [
      'TOTAL_DPC_ADV_DIETICIAN_PRAC_HC',
      'TOTAL_DPC_ADV_PODIA_PRAC_HC',
      'TOTAL_DPC_ADV_THERA_OCC_PRAC_HC',
      'TOTAL_DPC_DIETICIAN_HC',
      'TOTAL_DPC_DISPENSER_HC',
      'TOTAL_DPC_GPA_HC',
      'TOTAL_DPC_OST_HC',
      'TOTAL_DPC_PHLEB_HC',
      'TOTAL_DPC_PODIA_HC',
      'TOTAL_DPC_PHYSICIAN_ASSOC_HC',
      'TOTAL_DPC_THERA_OCC_HC',
      'TOTAL_DPC_THERA_OTH_HC',
      'TOTAL_DPC_APP_PHLEB_HC',
      'TOTAL_DPC_APP_PHYSICIAN_ASSOC_HC',
      'TOTAL_DPC_APP_OTH_HC',
      'TOTAL_DPC_APPRENTICE_HC',
      'TOTAL_DPC_HLTH_SPRT_WRK_HC',
      'TOTAL_DPC_SPLW_HC',
      'TOTAL_DPC_OTH_HC',
    ],
  },
];

export const ARRS_OTHER_FTE_FIELDS = [
  'TOTAL_DPC_ADV_DIETICIAN_PRAC_FTE',
  'TOTAL_DPC_DIETICIAN_FTE',
  'TOTAL_DPC_ADV_PODIA_PRAC_FTE',
  'TOTAL_DPC_PODIA_FTE',
  'TOTAL_DPC_ADV_THERA_OCC_PRAC_FTE',
  'TOTAL_DPC_THERA_OCC_FTE',
  'TOTAL_DPC_PHYSICIAN_ASSOC_FTE',
  'TOTAL_DPC_APP_PHYSICIAN_ASSOC_FTE',
  'TOTAL_DPC_SPLW_FTE',
  'TOTAL_DPC_HLTH_SPRT_WRK_FTE',
  'TOTAL_DPC_THERA_OTH_FTE',
];

export const ARRS_OTHER_HC_FIELDS = [
  'TOTAL_DPC_ADV_DIETICIAN_PRAC_HC',
  'TOTAL_DPC_DIETICIAN_HC',
  'TOTAL_DPC_ADV_PODIA_PRAC_HC',
  'TOTAL_DPC_PODIA_HC',
  'TOTAL_DPC_ADV_THERA_OCC_PRAC_HC',
  'TOTAL_DPC_THERA_OCC_HC',
  'TOTAL_DPC_PHYSICIAN_ASSOC_HC',
  'TOTAL_DPC_APP_PHYSICIAN_ASSOC_HC',
  'TOTAL_DPC_SPLW_HC',
  'TOTAL_DPC_HLTH_SPRT_WRK_HC',
  'TOTAL_DPC_THERA_OTH_HC',
];

export const DEFAULT_APPOINTMENTS_PER_WTE_DAY = {
  [ROLE_GROUPS.GP_PARTNER]: 25,
  [ROLE_GROUPS.GP_SALARIED]: 25,
  [ROLE_GROUPS.GP_LOCUM]: 25,
  [ROLE_GROUPS.GP_REGISTRAR]: 20,
  [ROLE_GROUPS.NURSE]: 18,
  [ROLE_GROUPS.HCA]: 12,
  [ROLE_GROUPS.PHARMACIST]: 18,
  [ROLE_GROUPS.PHARM_TECH]: 14,
  [ROLE_GROUPS.PARAMEDIC]: 20,
  [ROLE_GROUPS.PHYSIO]: 16,
  [ROLE_GROUPS.MENTAL_HEALTH]: 12,
  [ROLE_GROUPS.OTHER]: 15,
};

export function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'N/A' || trimmed === '*') {
    return null;
  }
  const cleaned = trimmed.replace(/,/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function sumFields(row, fields = []) {
  let total = 0;
  let hasValue = false;

  fields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(row, field)) return;
    const parsed = parseNumber(row[field]);
    if (parsed !== null) {
      total += parsed;
      hasValue = true;
    }
  });

  return hasValue ? total : null;
}

export function inferUnits(column) {
  const name = String(column || '').toUpperCase();
  if (!name) return '';
  if (name.endsWith('_FTE') || name.endsWith('_WTE')) return 'WTE';
  if (name.endsWith('_HC')) return 'Headcount';
  if (name.includes('PATIENT')) return 'Patients';
  if (name.includes('RATE')) return 'Rate';
  return '';
}

export function humanizeFieldName(column) {
  const name = String(column || '').trim();
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .replace(/\b([A-Z])/g, (match) => match.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}
