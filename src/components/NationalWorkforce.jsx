import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, GitCompare, Info, LineChart, SlidersHorizontal, Table2, TrendingUp, Users } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import Card from './ui/Card';
import MetricCard from './ui/MetricCard';

import {
  ROLE_GROUPS,
  ROLE_LABELS,
  CLINICAL_ROLE_GROUPS,
  GP_ROLE_GROUPS,
  DEFAULT_APPOINTMENTS_PER_WTE_DAY,
} from '../utils/workforceSchema';
import {
  buildWorkforceDataset,
  inferMonthFromFilename,
  parseWorkforceDefinitionsRows,
  summarizeRoleMapping,
} from '../utils/workforceParser';
import {
  buildRoleTotals,
  calculateWorkforceTotals,
  calculateDerivedWorkforceMetrics,
  calculateFragilityFlags,
  calculateWorkforceDemandMetrics,
  calculateCapacityModel,
  calculateCapacityPressureScore,
  defaultCapacityAssumptions,
} from '../utils/workforceMetrics';
import { loadWorkforceData, loadWorkforceDefinitions } from '../data/dataLoader';
import { commonOptions, donutOptions } from '../constants/chartConfigs';
import { NHS_BLUE, NHS_GREEN, NHS_AMBER, NHS_RED, NHS_GREY, NHS_AQUA } from '../constants/colors';

import workforceCsvUrl from '../assets/workforce/1 General Practice – November 2025 Practice Level - Detailed.csv?url';
import workforceDefinitionsUrl from '../assets/workforce/0 General Practice Detailed Practice-Level CSV. Overall Definitions.xlsx?url';

const TAB_OPTIONS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'breakdown', label: 'Breakdown', icon: Table2 },
  { id: 'demand', label: 'Workforce vs Demand', icon: TrendingUp },
  { id: 'capacity', label: 'Capacity & Utilisation', icon: SlidersHorizontal },
  { id: 'risk', label: 'Risk & Planning', icon: AlertTriangle },
  { id: 'compare', label: 'Compare', icon: GitCompare },
  { id: 'forecasting', label: 'Forecasting', icon: LineChart, disabled: true, comingSoon: true },
];

const formatNumber = (value, decimals = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  if (decimals === 0) return Math.round(value).toLocaleString();
  return Number(value).toFixed(decimals);
};

const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(decimals)}%`;
};

const formatRatio = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(2)}:1`;
};

/**
 * National Spectrum Visualizer - Shows where a practice sits on the national workforce spectrum
 * Uses rainbow gradient matching the GP appointment spectrums (red=lowest → purple=highest)
 * For patients per WTE metrics, lower is better (more capacity per patient)
 */
const WorkforceSpectrumVisualizer = ({ value, allValues, label, rank, total, isLowerBetter = true }) => {
  const sortedValues = [...allValues].filter(v => v > 0).sort((a, b) => a - b);
  const belowCount = sortedValues.filter(v => v < value).length;
  const percentile = sortedValues.length > 0 ? (belowCount / sortedValues.length) * 100 : 50;

  // Rainbow gradient matching NationalDemandCapacity spectrum (red=lowest → purple=highest)
  const gradientStops = [
    { pos: 0, color: '#dc2626' },    // Red - lowest
    { pos: 15, color: '#ea580c' },   // Orange
    { pos: 30, color: '#f59e0b' },   // Amber
    { pos: 45, color: '#84cc16' },   // Lime
    { pos: 55, color: '#22c55e' },   // Green - good
    { pos: 65, color: '#14b8a6' },   // Teal
    { pos: 75, color: '#06b6d4' },   // Cyan
    { pos: 85, color: '#3b82f6' },   // Blue - better
    { pos: 92, color: '#8b5cf6' },   // Violet
    { pos: 100, color: '#a855f7' },  // Purple - highest
  ];

  // Get color at percentile
  const getColorAtPercentile = (pct) => {
    for (let i = gradientStops.length - 1; i >= 0; i--) {
      if (pct >= gradientStops[i].pos) {
        return gradientStops[i].color;
      }
    }
    return gradientStops[0].color;
  };

  const markerColor = getColorAtPercentile(percentile);

  // Get percentile values for markers
  const getPercentileValue = (p) => {
    const idx = Math.floor((p / 100) * (sortedValues.length - 1));
    return sortedValues[idx] || 0;
  };

  const p25 = getPercentileValue(25);
  const p50 = getPercentileValue(50);
  const p75 = getPercentileValue(75);

  return (
    <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-slate-700">{label}</h4>
        <div className="text-right">
          <span className="text-2xl font-bold" style={{ color: markerColor }}>
            {formatNumber(value, 0)}
          </span>
          {rank && total && (
            <p className="text-xs text-slate-500">Rank #{rank} of {total.toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Spectrum Bar */}
      <div className="relative mt-4 mb-6">
        <div
          className="h-4 rounded-full shadow-inner overflow-hidden"
          style={{
            background: `linear-gradient(to right, ${gradientStops.map(s => `${s.color} ${s.pos}%`).join(', ')})`
          }}
        />

        {/* Marker for practice position */}
        <div
          className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
          style={{ left: `${Math.max(2, Math.min(98, percentile))}%` }}
        >
          <div className="relative">
            <div
              className="w-6 h-6 -ml-3 rounded-full border-4 border-white shadow-lg"
              style={{ backgroundColor: markerColor }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `8px solid ${markerColor}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Percentile markers */}
      <div className="flex justify-between text-[10px] text-slate-400 px-1">
        <span>{isLowerBetter ? 'Best (lowest)' : 'Lowest'}</span>
        <span>p25: {formatNumber(p25, 0)}</span>
        <span>Median: {formatNumber(p50, 0)}</span>
        <span>p75: {formatNumber(p75, 0)}</span>
        <span>{isLowerBetter ? 'Worst (highest)' : 'Highest'}</span>
      </div>
    </div>
  );
};

const buildDefinitionTooltip = (definitions, columns = []) => {
  if (!definitions?.byColumn || columns.length === 0) return null;
  const lines = columns
    .map((column) => {
      const entry = definitions.byColumn[column];
      if (!entry) return column;
      const details = entry.description || entry.label || '';
      return details ? `${column}: ${details}` : column;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join(' | ') : null;
};

const loadWorkforceFromAssets = async () => {
  const csvResponse = await fetch(workforceCsvUrl);
  if (!csvResponse.ok) return null;
  const csvText = await csvResponse.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const filename = decodeURIComponent(workforceCsvUrl.split('/').pop() || '');
  const month = inferMonthFromFilename(filename) || 'Unknown';
  const dataset = buildWorkforceDataset(parsed.data, month);

  return {
    [month]: dataset,
    metadata: { months: [month], source: 'assets' },
  };
};

const loadDefinitionsFromAssets = async () => {
  const response = await fetch(workforceDefinitionsUrl);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const definitions = parseWorkforceDefinitionsRows(rows);
  return {
    generatedAt: new Date().toISOString(),
    sourceFile: 'assets',
    mapping: summarizeRoleMapping(),
    ...definitions,
  };
};

const NationalWorkforce = ({
  selectedPractice,
  selectedMonth,
  appointmentData,
  telephonyData,
  ocData,
  onLoadingChange,
  onMetricsChange,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [workforceData, setWorkforceData] = useState(null);
  const [definitions, setDefinitions] = useState(null);
  const [showDictionary, setShowDictionary] = useState(false);
  const [dictionaryFilter, setDictionaryFilter] = useState('');
  const [breakdownSort, setBreakdownSort] = useState({ field: 'wte', direction: 'desc' });
  const [breakdownFilter, setBreakdownFilter] = useState('');
  const [assumptions, setAssumptions] = useState(() => ({
    workingDaysPerMonth: defaultCapacityAssumptions.workingDaysPerMonth,
    appointmentsPerWtePerDay: { ...defaultCapacityAssumptions.appointmentsPerWtePerDay },
  }));

  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      setLoading(true);
      onLoadingChange?.(true);

      const [data, defs] = await Promise.all([
        loadWorkforceData(),
        loadWorkforceDefinitions(),
      ]);

      let finalData = data;
      let finalDefs = defs;

      if (!finalData) {
        finalData = await loadWorkforceFromAssets();
      }

      if (!finalDefs) {
        finalDefs = await loadDefinitionsFromAssets();
      }

      if (!isMounted) return;
      setWorkforceData(finalData);
      setDefinitions(finalDefs);
      setLoading(false);
      onLoadingChange?.(false);
    };

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [onLoadingChange]);

  const workforceMonths = useMemo(() => {
    if (!workforceData) return [];
    return Object.keys(workforceData).filter((key) => key !== 'metadata');
  }, [workforceData]);

  const latestWorkforceMonth = workforceMonths[workforceMonths.length - 1];
  const effectiveMonth = workforceMonths.includes(selectedMonth) ? selectedMonth : latestWorkforceMonth;
  const monthMismatch = selectedMonth && effectiveMonth && selectedMonth !== effectiveMonth;

  const monthData = effectiveMonth ? workforceData?.[effectiveMonth] : null;

  const practiceData = useMemo(() => {
    if (!selectedPractice || !monthData?.practices) return null;
    return monthData.practices.find((practice) => practice.odsCode === selectedPractice.odsCode) || null;
  }, [selectedPractice, monthData]);

  const roleTotals = useMemo(() => (
    buildRoleTotals(practiceData?.workforce?.records || [])
  ), [practiceData]);

  const totals = useMemo(() => (
    practiceData?.workforce?.totals
      ? calculateWorkforceTotals(roleTotals, {
        arrsOtherWte: practiceData.workforce.totals.arrsOtherWte,
        arrsOtherHeadcount: practiceData.workforce.totals.arrsOtherHeadcount,
      })
      : calculateWorkforceTotals(roleTotals)
  ), [practiceData, roleTotals]);

  const derivedMetrics = useMemo(() => (
    calculateDerivedWorkforceMetrics(totals, practiceData?.listSize || 0)
  ), [totals, practiceData]);

  const appointmentMonthData = appointmentData?.[selectedMonth] || appointmentData?.[effectiveMonth];
  const telephonyMonthData = telephonyData?.[selectedMonth] || telephonyData?.[effectiveMonth];
  const ocMonthData = ocData?.[selectedMonth] || ocData?.[effectiveMonth];

  const apptPractice = useMemo(() => (
    appointmentMonthData?.practices?.find((practice) => practice.odsCode === selectedPractice?.odsCode)
  ), [appointmentMonthData, selectedPractice]);

  const telephonyPractice = useMemo(() => (
    telephonyMonthData?.practices?.find((practice) => practice.odsCode === selectedPractice?.odsCode)
  ), [telephonyMonthData, selectedPractice]);

  const ocPractice = useMemo(() => (
    ocMonthData?.practices?.find((practice) => practice.odsCode === selectedPractice?.odsCode)
  ), [ocMonthData, selectedPractice]);

  const demandMetrics = useMemo(() => (
    calculateWorkforceDemandMetrics(totals, roleTotals, apptPractice, telephonyPractice, ocPractice)
  ), [totals, roleTotals, apptPractice, telephonyPractice, ocPractice]);

  const capacityModel = useMemo(() => (
    calculateCapacityModel({ roleTotals, totals, apptData: apptPractice, assumptions, month: selectedMonth })
  ), [roleTotals, totals, apptPractice, assumptions, selectedMonth]);

  const demandCapacityRatio = capacityModel?.totalTheoretical
    ? (capacityModel.totalActual / capacityModel.totalTheoretical)
    : null;

  const capacityPressureScore = useMemo(() => (
    calculateCapacityPressureScore({
      demandCapacityRatio,
      missedCallsPerAdminWte: demandMetrics.callsMissedPerAdminWte,
      ocPerGpWte: demandMetrics.ocPerGpWte,
    })
  ), [demandCapacityRatio, demandMetrics]);

  const fragilityFlags = useMemo(() => (
    calculateFragilityFlags(roleTotals)
  ), [roleTotals]);

  const mixData = useMemo(() => {
    const adminWte =
      roleTotals?.[ROLE_GROUPS.ADMIN]?.wte || 0;
    const receptionWte =
      roleTotals?.[ROLE_GROUPS.RECEPTION]?.wte || 0;
    const managerWte =
      roleTotals?.[ROLE_GROUPS.PRACTICE_MGR]?.wte || 0;

    return [
      { label: 'GP', value: totals?.totalWteGP || 0, color: NHS_BLUE },
      { label: 'Nurse', value: roleTotals?.[ROLE_GROUPS.NURSE]?.wte || 0, color: NHS_GREEN },
      { label: 'HCA', value: roleTotals?.[ROLE_GROUPS.HCA]?.wte || 0, color: NHS_AQUA },
      { label: 'Other Clinical', value: roleTotals?.[ROLE_GROUPS.OTHER]?.wte || 0, color: NHS_AMBER },
      { label: 'Admin/Reception', value: adminWte + receptionWte + managerWte, color: NHS_RED },
    ];
  }, [totals, roleTotals]);

  // Calculate national distribution for patients per WTE spectrum visualization
  const nationalWorkforceDistribution = useMemo(() => {
    if (!monthData?.practices || !selectedPractice) return null;

    const MIN_POPULATION = 1000; // Exclude small practices
    const MIN_GP_WTE = 0.5; // Exclude practices with negligible GP WTE

    // Calculate patients per GP WTE for all practices
    const allPracticeMetrics = monthData.practices
      .map((practice) => {
        const listSize = practice.listSize || 0;
        const gpWte = practice.workforce?.totals?.totalWteGP || 0;
        const clinicalWte = practice.workforce?.totals?.totalWteClinical || 0;

        if (listSize < MIN_POPULATION || gpWte < MIN_GP_WTE) return null;

        return {
          odsCode: practice.odsCode,
          patientsPerGpWte: gpWte > 0 ? listSize / gpWte : null,
          patientsPerClinicalWte: clinicalWte > 0 ? listSize / clinicalWte : null,
        };
      })
      .filter(Boolean);

    // Extract all values for spectrum
    const allPatientsPerGpWte = allPracticeMetrics
      .map((m) => m.patientsPerGpWte)
      .filter((v) => v !== null && v > 0);
    const allPatientsPerClinicalWte = allPracticeMetrics
      .map((m) => m.patientsPerClinicalWte)
      .filter((v) => v !== null && v > 0);

    // Calculate ranks (lower is better for patients per WTE)
    const sortedByGp = [...allPracticeMetrics]
      .filter((m) => m.patientsPerGpWte)
      .sort((a, b) => a.patientsPerGpWte - b.patientsPerGpWte);
    const gpRank = sortedByGp.findIndex((m) => m.odsCode === selectedPractice.odsCode) + 1;

    const sortedByClinical = [...allPracticeMetrics]
      .filter((m) => m.patientsPerClinicalWte)
      .sort((a, b) => a.patientsPerClinicalWte - b.patientsPerClinicalWte);
    const clinicalRank = sortedByClinical.findIndex((m) => m.odsCode === selectedPractice.odsCode) + 1;

    return {
      allPatientsPerGpWte,
      allPatientsPerClinicalWte,
      gpRank: gpRank > 0 ? gpRank : null,
      clinicalRank: clinicalRank > 0 ? clinicalRank : null,
      totalPractices: allPracticeMetrics.length,
    };
  }, [monthData, selectedPractice]);

  const dictionaryRows = useMemo(() => {
    const entries = definitions?.columns || [];
    if (!dictionaryFilter) return entries;
    const term = dictionaryFilter.toLowerCase();
    return entries.filter((entry) => (
      String(entry.column || '').toLowerCase().includes(term) ||
      String(entry.label || '').toLowerCase().includes(term) ||
      String(entry.description || '').toLowerCase().includes(term)
    ));
  }, [definitions, dictionaryFilter]);

  // Breakdown table data - sorted and filtered role data
  const breakdownTableData = useMemo(() => {
    const records = practiceData?.workforce?.records || [];
    if (records.length === 0) return [];

    // Build detailed breakdown including role labels
    const breakdown = records.map((record) => ({
      roleGroup: record.roleGroup,
      label: ROLE_LABELS[record.roleGroup] || record.roleGroup,
      wte: record.wte || 0,
      headcount: record.headcount,
      isGP: GP_ROLE_GROUPS.includes(record.roleGroup),
      isClinical: CLINICAL_ROLE_GROUPS.includes(record.roleGroup),
    }));

    // Filter
    let filtered = breakdown;
    if (breakdownFilter) {
      const term = breakdownFilter.toLowerCase();
      filtered = breakdown.filter((row) =>
        row.label.toLowerCase().includes(term) ||
        row.roleGroup.toLowerCase().includes(term)
      );
    }

    // Sort
    const { field, direction } = breakdownSort;
    const sorted = [...filtered].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle nulls
      if (aVal === null || aVal === undefined) aVal = -Infinity;
      if (bVal === null || bVal === undefined) bVal = -Infinity;

      // Handle strings
      if (typeof aVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [practiceData, breakdownSort, breakdownFilter]);

  const handleBreakdownSort = (field) => {
    setBreakdownSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Expose workforce metrics to parent component for cross-over display
  useEffect(() => {
    if (!onMetricsChange || !practiceData) {
      onMetricsChange?.(null);
      return;
    }

    // Calculate Appts + Medical OC per WTE metrics
    const gpAppts = apptPractice?.staffBreakdown?.gpAppointments || 0;
    const medicalOc = ocPractice?.clinicalSubmissions || 0;
    const totalAppts = apptPractice?.totalAppointments || 0;
    const gpWte = totals?.totalWteGP || 0;
    const clinicalWte = totals?.totalWteClinical || 0;
    const adminWte = totals?.totalWteNonClinical || 0;

    const crossoverMetrics = {
      // Core WTE values
      gpWte,
      clinicalWte,
      adminWte,
      totalWte: totals?.totalWte || 0,

      // Appointments per WTE
      appointmentsPerGpWte: demandMetrics.appointmentsPerGpWte,
      appointmentsPerClinicalWte: demandMetrics.appointmentsPerClinicalWte,

      // Appts + Medical OC per WTE (new combined metrics)
      gpApptsAndOcPerGpWte: gpWte > 0 ? (gpAppts + medicalOc) / gpWte : null,
      gpApptsAndOcPerClinicalWte: clinicalWte > 0 ? (gpAppts + medicalOc) / clinicalWte : null,
      totalApptsAndOcPerClinicalWte: clinicalWte > 0 ? (totalAppts + medicalOc) / clinicalWte : null,

      // Telephony per WTE
      callsAnsweredPerAdminWte: demandMetrics.callsAnsweredPerAdminWte,
      callsMissedPerAdminWte: demandMetrics.callsMissedPerAdminWte,

      // OC per WTE
      ocPerGpWte: demandMetrics.ocPerGpWte,
      ocPerClinicalWte: demandMetrics.ocPerClinicalWte,

      // Derived ratios
      patientsPerGpWte: derivedMetrics.patientsPerGpWte,
      patientsPerClinicalWte: derivedMetrics.patientsPerClinicalWte,

      // Capacity model
      capacityUtilization: capacityModel?.utilization,

      // Data availability
      hasWorkforceData: Boolean(practiceData),
    };

    onMetricsChange(crossoverMetrics);
  }, [onMetricsChange, practiceData, totals, demandMetrics, derivedMetrics, capacityModel, apptPractice, ocPractice]);

  if (loading) {
    return null;
  }

  if (!selectedPractice) {
    return (
      <Card className="text-center py-12">
        <Users size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-600">Select a practice to view workforce insights</h3>
        <p className="text-sm text-slate-400">Search for an ODS code or practice name above.</p>
      </Card>
    );
  }

  if (!practiceData) {
    return (
      <Card className="text-center py-12">
        <AlertTriangle size={42} className="mx-auto text-amber-400 mb-3" />
        <h3 className="text-lg font-semibold text-slate-700">Workforce data not available</h3>
        <p className="text-sm text-slate-500">
          This practice does not appear in the workforce dataset for {effectiveMonth || 'the selected month'}.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation - Pill-style secondary tabs matching other national data tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
        {TAB_OPTIONS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDisabled = tab.disabled;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                isDisabled
                  ? 'text-slate-400 cursor-not-allowed opacity-60'
                  : isActive
                  ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.comingSoon && (
                <span className="ml-1 text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                  Coming Soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Month alignment notice */}
      {monthMismatch && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          Workforce data shown for {effectiveMonth} (demand data selected: {selectedMonth})
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Total WTE"
              value={formatNumber(totals.totalWte, 1)}
              icon={Users}
              info="Total workforce WTE across clinical and non-clinical roles."
            />
            <MetricCard
              title="GP WTE"
              value={formatNumber(totals.totalWteGP, 2)}
              icon={Users}
              info={buildDefinitionTooltip(definitions, ['TOTAL_GP_FTE']) || 'Derived from GP partner, salaried, locum, and registrar WTE.'}
            />
            <MetricCard
              title="Admin WTE"
              value={formatNumber(totals.totalWteNonClinical, 2)}
              icon={Users}
              info={buildDefinitionTooltip(definitions, ['TOTAL_ADMIN_FTE']) || 'Non-clinical WTE across admin, reception, and management.'}
            />
            <MetricCard
              title="Patients / GP WTE"
              value={formatNumber(derivedMetrics.patientsPerGpWte, 0)}
              icon={Users}
              info="Registered patients per GP WTE (lower is better)."
            />
            <MetricCard
              title="Patients / Clinical WTE"
              value={formatNumber(derivedMetrics.patientsPerClinicalWte, 0)}
              icon={Users}
              info="Registered patients per total clinical WTE."
            />
          </div>

          {/* National Spectrum Visualizations for Patients per WTE */}
          {nationalWorkforceDistribution?.allPatientsPerGpWte?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkforceSpectrumVisualizer
                value={derivedMetrics.patientsPerGpWte}
                allValues={nationalWorkforceDistribution.allPatientsPerGpWte}
                label="Patients per GP WTE"
                rank={nationalWorkforceDistribution.gpRank}
                total={nationalWorkforceDistribution.totalPractices}
                isLowerBetter={true}
              />
              <WorkforceSpectrumVisualizer
                value={derivedMetrics.patientsPerClinicalWte}
                allValues={nationalWorkforceDistribution.allPatientsPerClinicalWte}
                label="Patients per Clinical WTE"
                rank={nationalWorkforceDistribution.clinicalRank}
                total={nationalWorkforceDistribution.totalPractices}
                isLowerBetter={true}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Workforce Mix (WTE)</h3>
              <div className="h-72">
                <Doughnut
                  data={{
                    labels: mixData.map((item) => item.label),
                    datasets: [
                      {
                        data: mixData.map((item) => item.value),
                        backgroundColor: mixData.map((item) => item.color),
                        borderWidth: 0,
                      },
                    ],
                  }}
                  options={donutOptions}
                />
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Key Workforce Ratios</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">GP WTE per 1,000 pts</span>
                  <span className="font-semibold text-slate-800">{formatNumber(derivedMetrics.gpWtePer1000, 2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Clinical WTE per 1,000 pts</span>
                  <span className="font-semibold text-slate-800">{formatNumber(derivedMetrics.clinicalWtePer1000, 2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Admin : Clinical ratio</span>
                  <span className="font-semibold text-slate-800">{formatRatio(derivedMetrics.adminToClinicalRatio)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Skill-mix index</span>
                  <span className="font-semibold text-slate-800">
                    {formatPercent(
                      derivedMetrics.skillMixIndex !== null && derivedMetrics.skillMixIndex !== undefined
                        ? derivedMetrics.skillMixIndex * 100
                        : null,
                      1
                    )}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-700">Workforce Data Dictionary</h3>
                <p className="text-xs text-slate-500">Definitions sourced from NHS England workforce metadata.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDictionary((prev) => !prev)}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {showDictionary ? 'Hide' : 'Show'} dictionary
              </button>
            </div>

            {showDictionary && (
              <div className="mt-4">
                <input
                  type="text"
                  value={dictionaryFilter}
                  onChange={(event) => setDictionaryFilter(event.target.value)}
                  placeholder="Search columns, descriptions..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
                />
                <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Column</th>
                        <th className="px-3 py-2 text-left">Label</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Units</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dictionaryRows.map((entry) => (
                        <tr key={entry.column} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{entry.column}</td>
                          <td className="px-3 py-2 text-slate-700">{entry.label}</td>
                          <td className="px-3 py-2 text-slate-500">{entry.description}</td>
                          <td className="px-3 py-2 text-slate-500">{entry.units || '-'}</td>
                          <td className="px-3 py-2 text-slate-400">{entry.comments || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'breakdown' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-semibold text-slate-700">Staff Breakdown by Role</h3>
                <p className="text-xs text-slate-500">
                  Latest workforce data for {effectiveMonth} - WTE and headcount by role category
                </p>
              </div>
              <input
                type="text"
                value={breakdownFilter}
                onChange={(e) => setBreakdownFilter(e.target.value)}
                placeholder="Filter roles..."
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-48"
              />
            </div>

            <div className="overflow-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th
                      className="px-4 py-3 text-left cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleBreakdownSort('label')}
                    >
                      <div className="flex items-center gap-1">
                        Role
                        {breakdownSort.field === 'label' && (
                          breakdownSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleBreakdownSort('wte')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        WTE
                        {breakdownSort.field === 'wte' && (
                          breakdownSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleBreakdownSort('headcount')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Headcount
                        {breakdownSort.field === 'headcount' && (
                          breakdownSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Category</th>
                    <th className="px-4 py-3 text-right">% of Total WTE</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownTableData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No role data available
                      </td>
                    </tr>
                  ) : (
                    breakdownTableData.map((row) => (
                      <tr key={row.roleGroup} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {formatNumber(row.wte, 2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {row.headcount !== null ? formatNumber(row.headcount, 0) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.isGP && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">GP</span>
                          )}
                          {row.isClinical && !row.isGP && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Clinical</span>
                          )}
                          {!row.isClinical && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Admin</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {totals.totalWte > 0 ? formatPercent((row.wte / totals.totalWte) * 100, 1) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr className="border-t-2 border-slate-200">
                    <td className="px-4 py-3 text-slate-700">Total</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {formatNumber(totals.totalWte, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {totals.totalHeadcount !== null ? formatNumber(totals.totalHeadcount, 0) : '-'}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <h4 className="text-sm font-semibold text-blue-700 mb-2">GP Roles</h4>
              <p className="text-2xl font-bold text-blue-600">{formatNumber(totals.totalWteGP, 2)} WTE</p>
              <p className="text-xs text-blue-500 mt-1">
                {totals.totalWte > 0 ? formatPercent((totals.totalWteGP / totals.totalWte) * 100, 1) : '-'} of total
              </p>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <h4 className="text-sm font-semibold text-green-700 mb-2">Clinical Roles</h4>
              <p className="text-2xl font-bold text-green-600">{formatNumber(totals.totalWteClinical, 2)} WTE</p>
              <p className="text-xs text-green-500 mt-1">
                {totals.totalWte > 0 ? formatPercent((totals.totalWteClinical / totals.totalWte) * 100, 1) : '-'} of total
              </p>
            </Card>
            <Card className="bg-slate-50 border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Non-Clinical Roles</h4>
              <p className="text-2xl font-bold text-slate-600">{formatNumber(totals.totalWteNonClinical, 2)} WTE</p>
              <p className="text-xs text-slate-500 mt-1">
                {totals.totalWte > 0 ? formatPercent((totals.totalWteNonClinical / totals.totalWte) * 100, 1) : '-'} of total
              </p>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'demand' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Appts per GP WTE"
              value={formatNumber(demandMetrics.appointmentsPerGpWte, 1)}
              icon={TrendingUp}
              info="GP appointments delivered per GP WTE (monthly)."
            />
            <MetricCard
              title="Appts per Clinical WTE"
              value={formatNumber(demandMetrics.appointmentsPerClinicalWte, 1)}
              icon={TrendingUp}
              info="Total appointments per total clinical WTE (monthly)."
            />
            <MetricCard
              title="Calls per Admin WTE"
              value={formatNumber(demandMetrics.callsAnsweredPerAdminWte, 1)}
              icon={Users}
              info="Answered calls per admin/reception WTE (monthly)."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Appointments per WTE</h3>
              <div className="h-64">
                <Bar
                  data={{
                    labels: ['GP', 'Non-GP clinical', 'Total clinical'],
                    datasets: [
                      {
                        label: 'Appointments per WTE',
                        data: [
                          demandMetrics.appointmentsPerGpWte || 0,
                          demandMetrics.appointmentsPerNonGpClinicalWte || 0,
                          demandMetrics.appointmentsPerClinicalWte || 0,
                        ],
                        backgroundColor: [NHS_BLUE, NHS_GREEN, NHS_AQUA],
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    ...commonOptions,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Non-GP appointments are derived from the appointment dataset's "other staff" category.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Digital & Telephony Load</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Missed calls per Admin WTE</span>
                  <span className="font-semibold text-slate-800">{formatNumber(demandMetrics.callsMissedPerAdminWte, 1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">OC submissions per GP WTE</span>
                  <span className="font-semibold text-slate-800">{formatNumber(demandMetrics.ocPerGpWte, 1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Clinical OC per GP WTE</span>
                  <span className="font-semibold text-slate-800">{formatNumber(demandMetrics.ocClinicalPerGpWte, 1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">OC per Clinical WTE</span>
                  <span className="font-semibold text-slate-800">{formatNumber(demandMetrics.ocPerClinicalWte, 1)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'capacity' && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={18} className="text-slate-500" />
              <h3 className="font-semibold text-slate-700">Capacity Assumptions</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Adjust these assumptions to model what-if scenarios. Changes will update the theoretical capacity calculations below.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-slate-500">Working days per month</span>
                <input
                  type="number"
                  min="15"
                  max="25"
                  value={assumptions.workingDaysPerMonth}
                  onChange={(event) => setAssumptions((prev) => ({
                    ...prev,
                    workingDaysPerMonth: Number(event.target.value || 0),
                  }))}
                  className="border border-slate-200 rounded-lg px-3 py-2"
                />
              </label>
              {Object.entries(DEFAULT_APPOINTMENTS_PER_WTE_DAY).map(([role, defaultValue]) => (
                <label key={role} className="flex flex-col gap-1">
                  <span className="text-slate-500">{ROLE_LABELS[role] || role} appts/WTE/day</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={assumptions.appointmentsPerWtePerDay[role] ?? defaultValue}
                    onChange={(event) => setAssumptions((prev) => ({
                      ...prev,
                      appointmentsPerWtePerDay: {
                        ...prev.appointmentsPerWtePerDay,
                        [role]: Number(event.target.value || 0),
                      },
                    }))}
                    className="border border-slate-200 rounded-lg px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </Card>

          {/* Capacity Summary - shows current calculations based on assumptions */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <h3 className="font-semibold text-slate-700 mb-4">Capacity Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 uppercase">Working Days</p>
                <p className="text-2xl font-bold text-blue-600">{capacityModel.workingDays}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Theoretical Capacity</p>
                <p className="text-2xl font-bold text-blue-600">{formatNumber(capacityModel.totalTheoretical, 0)}</p>
                <p className="text-xs text-slate-400">appointments</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Actual Appointments</p>
                <p className="text-2xl font-bold text-green-600">{formatNumber(capacityModel.totalActual, 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Utilisation</p>
                <p className={`text-2xl font-bold ${
                  capacityModel.utilization > 1 ? 'text-red-600' :
                  capacityModel.utilization > 0.85 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {formatPercent(capacityModel.utilization ? capacityModel.utilization * 100 : null, 0)}
                </p>
              </div>
            </div>
            {capacityModel.utilization > 1 && (
              <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg text-sm text-red-700">
                <strong>Over capacity:</strong> Actual appointments exceed theoretical capacity by {formatNumber((capacityModel.utilization - 1) * 100, 0)}%.
                Consider adjusting assumptions or reviewing workforce levels.
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Theoretical vs Actual Capacity</h3>
              <div className="h-72">
                <Bar
                  data={{
                    labels: ['GP', 'Non-GP clinical', 'Total'],
                    datasets: [
                      {
                        label: 'Theoretical capacity',
                        data: [
                          GP_ROLE_GROUPS.reduce((sum, group) => sum + (capacityModel.roleCapacity[group]?.theoretical || 0), 0),
                          CLINICAL_ROLE_GROUPS.filter((group) => !GP_ROLE_GROUPS.includes(group))
                            .reduce((sum, group) => sum + (capacityModel.roleCapacity[group]?.theoretical || 0), 0),
                          capacityModel.totalTheoretical || 0,
                        ],
                        backgroundColor: NHS_BLUE,
                        borderRadius: 6,
                      },
                      {
                        label: 'Actual appointments',
                        data: [
                          demandMetrics.gpAppointments || 0,
                          demandMetrics.otherAppointments || 0,
                          demandMetrics.totalAppointments || 0,
                        ],
                        backgroundColor: NHS_GREEN,
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    ...commonOptions,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Non-GP actual appointments are distributed by WTE across non-GP clinical roles.
              </p>
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Utilisation by Role</h3>
              <div className="h-72">
                <Bar
                  data={{
                    labels: Object.entries(capacityModel.roleCapacity)
                      .filter(([, value]) => value.wte > 0)
                      .map(([role]) => ROLE_LABELS[role] || role),
                    datasets: [
                      {
                        label: 'Utilisation %',
                        data: Object.entries(capacityModel.roleCapacity)
                          .filter(([, value]) => value.wte > 0)
                          .map(([, value]) => value.utilization ? value.utilization * 100 : 0),
                        backgroundColor: NHS_AMBER,
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    ...commonOptions,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, max: 150 } },
                  }}
                />
              </div>
              <div className="mt-3 text-xs text-slate-400">
                <p>Overall utilisation: {formatPercent(capacityModel.utilization ? capacityModel.utilization * 100 : null, 1)}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Capacity pressure score"
              value={capacityPressureScore}
              icon={AlertTriangle}
              info="Heuristic score blending demand/capacity ratio, missed calls per admin WTE, and OC per GP WTE."
            />
            <MetricCard
              title="Demand : Capacity ratio"
              value={formatNumber(demandCapacityRatio, 2)}
              icon={TrendingUp}
              info="Total appointments divided by theoretical capacity."
            />
            <MetricCard
              title="Admin to Clinical ratio"
              value={formatRatio(derivedMetrics.adminToClinicalRatio)}
              icon={Users}
              info="Non-clinical WTE relative to clinical WTE."
            />
          </div>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">Fragility Flags</h3>
            {fragilityFlags.length === 0 ? (
              <p className="text-sm text-slate-500">No single-point-of-failure flags detected.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {fragilityFlags.map((flag, index) => (
                  <li key={`${flag.roleGroup}-${index}`} className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle size={16} />
                    <span>{flag.message} (WTE {formatNumber(flag.wte, 2)}, HC {flag.headcount ?? 'N/A'})</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <Info size={18} className="text-slate-400 mt-1" />
              <div className="text-sm text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">Planning notes</p>
                <p>
                  Capacity pressure combines demand-to-capacity, telephony pressure, and digital demand. Adjust
                  assumptions in the Capacity tab to explore what-if scenarios. Future releases can extend this
                  with PCN/ICB benchmarking and scenario planning.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-6">
          <Card className="text-center py-12">
            <GitCompare size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-600">Practice Comparison</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
              Compare workforce metrics across multiple practices. This feature allows you to benchmark
              staffing levels, capacity, and demand metrics against peers.
            </p>
            <p className="text-xs text-slate-400 mt-4">
              Use the Demand & Capacity section for full comparison functionality with shareable links.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NationalWorkforce;
