# Monthly Data Update Process

This document describes the monthly process for updating CAIP.app with the latest NHS Digital data releases.

## Overview

Each month, NHS Digital releases new data for:
- **GP Appointments** (GPAD) - Practice level appointment statistics
- **GP Telephony** - Call volumes and answer rates
- **Online Consultations** (OC) - Digital consultation submissions
- **GP Workforce** - Staff headcount and FTE
- **Practice Population** (PracPop) - Registered patient counts

## Step 1: Download Data from NHS Digital

### Appointments (GPAD)
- Source: [NHS Digital GP Appointments Data](https://digital.nhs.uk/data-and-information/publications/statistical/appointments-in-general-practice)
- Download: `Annex 1 - Practice Level Breakdown Summary` XLSX file
- Rename to: `GPAD_Annex1_Practice_Level_Breakdown_Summary_{Month}_{Year}.xlsx`
- Place in: `src/assets/appt/`

### Telephony
- Source: [NHS Digital GP Telephony](https://digital.nhs.uk/data-and-information/publications/statistical/gp-telephony-data)
- Download: Practice-level telephony XLSX
- Rename to: `telephony_{Month}_{Year}.xlsx` (e.g., `telephony_December_2025.xlsx`)
- Place in: `src/assets/telephony/`

### Online Consultations
- Source: [NHS Digital Online Consultations](https://digital.nhs.uk/data-and-information/publications/statistical/online-consultation-in-general-practice)
- Download: Practice-level OC XLSX
- Rename to: `oc_{Month}_{Year}.xlsx` (e.g., `oc_December_2025.xlsx`)
- Place in: `src/assets/oc/`

### Workforce
- Source: [NHS Digital GP Workforce](https://digital.nhs.uk/data-and-information/publications/statistical/general-practice-workforce)
- Download: Practice-level workforce XLSX
- Rename to: `workforce_{Month}_{Year}.xlsx` (e.g., `workforce_December_2025.xlsx`)
- Place in: `src/assets/workforce/`

### Practice Population (Quarterly)
- Source: [NHS Digital Patients Registered at a GP Practice](https://digital.nhs.uk/data-and-information/publications/statistical/patients-registered-at-a-gp-practice)
- Download: Practice-level CSV with patient counts
- Rename to: `PracPop{Month}.csv` (e.g., `PracPopDec.csv`)
- Place in: `src/assets/`

## Step 2: Update Code References

### 2.1 Appointments Index (`src/assets/appt/index.js`)

Add import for new month:
```javascript
import jan26 from './GPAD_Annex1_Practice_Level_Breakdown_Summary_January_2026.xlsx?url';
```

Add to `APPOINTMENT_FILES`:
```javascript
'January 2026': jan26,
```

Add to `MONTHS_ORDERED`:
```javascript
'January 2026',
```

Update `PRIORITY_MONTHS` to latest month:
```javascript
export const PRIORITY_MONTHS = [
  'January 2026',
];
```

Update `FULL_DATA_MONTHS` if telephony/OC data available:
```javascript
export const FULL_DATA_MONTHS = [
  'October 2025',
  'November 2025',
  'December 2025',
  'January 2026',
];
```

### 2.2 Default Selected Month (`src/components/NationalDemandCapacity.jsx`)

Update the default state:
```javascript
const [selectedMonth, setSelectedMonth] = useState('January 2026');
```

### 2.3 CAIP Prompt Month Order (`src/utils/caipAnalysisPrompt.js`)

Add to `MONTH_ORDER` array:
```javascript
const MONTH_ORDER = [
  // ... existing months
  'January 2026'
];
```

### 2.4 Population Data (`src/utils/pracPopUtils.js`)

If new quarterly population data:
```javascript
import pracPopJanRaw from '../assets/PracPopJan.csv?raw';
```

Update `getPracPopData()` to use latest:
```javascript
cachedPractices = parsePracPopCSV(pracPopJanRaw);
```

### 2.5 Telephony Component (`src/components/NationalTelephony.jsx`)

Add imports for new data (preprocessing handles JSON):
```javascript
import janData from '../assets/data/telephony/january-2026.json';
import janPopData from '../assets/data/telephony/pop-january-2026.json';
```

Update `MONTH_DATA` and `MONTHS_ORDERED` arrays.

### 2.6 Workforce Index (`src/assets/workforce/index.js`)

Add import:
```javascript
import jan26 from './workforce_January_2026.xlsx?url';
```

Update `WORKFORCE_FILES` and `MONTHS_ORDERED`.

## Step 3: Run Preprocessing

Generate JSON from XLSX/CSV files:

```bash
npm run preprocess
```

This will:
- Convert appointment XLSX files to JSON in `src/assets/data/appointments/`
- Convert telephony XLSX files to JSON in `src/assets/data/telephony/`
- Convert OC XLSX files to JSON in `src/assets/data/online-consultations/`
- Convert workforce XLSX files to JSON in `src/assets/data/workforce/`

Verify output shows correct practice counts for new month.

## Step 4: Test Locally

```bash
npm run dev
```

Verify:
1. National Data page loads with new month as default
2. Appointments tab shows data for new month
3. Telephony tab shows data (if available)
4. Online Consultations tab shows data (if available)
5. Workforce tab shows data (if available)
6. Practice selection works correctly
7. CAIP Analysis (if enabled) generates correctly

## Step 5: Build and Deploy

```bash
npm run build
```

Check for build errors, then commit and push:

```bash
git add .
git commit -m "Add {Month} {Year} data updates"
git push
```

## Data Availability Notes

| Data Type | Typical Release | Coverage |
|-----------|-----------------|----------|
| Appointments | Monthly, ~6 weeks lag | All GP practices |
| Telephony | Monthly, ~6 weeks lag | Practices with cloud telephony |
| Online Consultations | Monthly, ~6 weeks lag | Practices using OC systems |
| Workforce | Monthly, ~6 weeks lag | All GP practices |
| Population | Quarterly | All GP practices |

## Troubleshooting

### Preprocessing fails
- Check file naming matches expected pattern
- Verify XLSX structure hasn't changed (check column headers)
- Look for encoding issues in CSV files

### Data not appearing
- Check imports are correct in index files
- Verify month strings match exactly (case-sensitive)
- Clear browser cache and reload

### Build fails
- Check for syntax errors in updated files
- Ensure all imports resolve correctly
- Run `npm run lint` to check for issues
