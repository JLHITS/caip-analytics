/**
 * SystmConnect Analysis Dashboard
 * Comprehensive analytics for TPP SystmOne SystmConnect extracts
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, TrendingUp, BarChart3, PieChart, AlertTriangle, Info,
  Users, Activity, Target, FileText, Download, ChevronDown, ChevronUp,
  Filter, Settings, CheckCircle, XCircle, ArrowUp, ArrowDown, Percent,
  UserCheck, Briefcase, Phone, Stethoscope, ClipboardList, AlertCircle
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import Card from './ui/Card';
import { DEFAULT_OUTCOME_GROUPS, AGE_BANDS } from '../utils/systmConnectParser';
import { trackEvent, trackTabView, trackExport } from '../firebase/config';

// Days order for consistent display
const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
  { id: 'demand-clinical', label: 'Demand (Clinical)', icon: <Stethoscope size={16} /> },
  { id: 'demand-admin', label: 'Demand (Admin)', icon: <Briefcase size={16} />, requiresAdmin: true },
  { id: 'outcomes', label: 'Outcomes & Conversion', icon: <Target size={16} /> },
  { id: 'timeliness', label: 'Timeliness & SLA', icon: <Clock size={16} /> },
  { id: 'demographics', label: 'Demographics & Equity', icon: <Users size={16} /> },
  { id: 'operations', label: 'Operational Insights', icon: <Activity size={16} /> },
  { id: 'data-quality', label: 'Data Quality', icon: <AlertTriangle size={16} /> },
  { id: 'exports', label: 'Exports', icon: <Download size={16} /> },
];

// Chart colors
const CHART_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#64748b', '#84cc16', '#f97316'
];

// Format number with locale
const formatNumber = (n, decimals = 0) => {
  if (n === null || n === undefined) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// Format percentage
const formatPercent = (n, decimals = 1) => {
  if (n === null || n === undefined) return '-';
  return `${n.toFixed(decimals)}%`;
};

// Format duration in minutes to readable string
const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

// KPI Card component
const KPICard = ({ label, value, subValue, icon: Icon, color = 'purple', trend, trendLabel }) => (
  <div className={`p-4 bg-${color}-50 rounded-xl border border-${color}-100`}>
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-xs text-${color}-600 font-medium uppercase tracking-wide`}>{label}</p>
        <p className={`text-2xl font-bold text-${color}-800 mt-1`}>{value}</p>
        {subValue && <p className={`text-xs text-${color}-500 mt-0.5`}>{subValue}</p>}
      </div>
      {Icon && (
        <div className={`p-2 bg-${color}-100 rounded-lg`}>
          <Icon size={20} className={`text-${color}-600`} />
        </div>
      )}
    </div>
    {trend !== undefined && (
      <div className={`mt-2 flex items-center gap-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        <span>{Math.abs(trend).toFixed(1)}% {trendLabel || ''}</span>
      </div>
    )}
  </div>
);

// Expandable instructions component
const Instructions = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-purple-700 hover:bg-purple-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Info size={16} />
          How to use this dashboard
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 text-sm text-purple-700 space-y-2">
          <p><strong>Filters:</strong> Use the filter panel to narrow down data by date range, request type, access method, and more. All charts update automatically.</p>
          <p><strong>List Size:</strong> Enter your practice list size to calculate per-1000 patient rates for benchmarking.</p>
          <p><strong>Outcome Mapping:</strong> Outcomes are automatically grouped using keyword matching. Visit the Exports tab to download or customise the mapping.</p>
          <p><strong>Tabs:</strong> Navigate between tabs to explore different aspects of your triage data - demand patterns, outcomes, timeliness, demographics, and data quality.</p>
          <p><strong>Privacy:</strong> Patient names and IDs are never displayed. All data is aggregated for analysis.</p>
        </div>
      )}
    </div>
  );
};

// Filter Panel component
const FilterPanel = ({ data, filters, setFilters, listSize, setListSize }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-slate-700"
      >
        <span className="flex items-center gap-2 font-medium">
          <Filter size={18} />
          Filters & Settings
          {Object.values(filters).some(v => v && v !== 'All') && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Active</span>
          )}
        </span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Date Range */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Type</label>
            <select
              value={filters.type || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              <option value="Clinical">Clinical</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          {/* Access Method */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Access Method</label>
            <select
              value={filters.accessMethod || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, accessMethod: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              {data.uniqueAccessMethods.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Submission Source */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Source</label>
            <select
              value={filters.submissionSource || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, submissionSource: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              {data.uniqueSubmissionSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Outcome Group */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Outcome Group</label>
            <select
              value={filters.outcomeGroup || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, outcomeGroup: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              {data.uniqueOutcomeGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Sex */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Sex</label>
            <select
              value={filters.sex || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, sex: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          {/* Age Band */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Age Band</label>
            <select
              value={filters.ageBand || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, ageBand: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              {AGE_BANDS.map(b => (
                <option key={b.label} value={b.label}>{b.label}</option>
              ))}
            </select>
          </div>

          {/* Weekday/Weekend */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">Day Type</label>
            <select
              value={filters.dayType || 'All'}
              onChange={(e) => setFilters(f => ({ ...f, dayType: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            >
              <option value="All">All</option>
              <option value="Weekday">Weekdays only</option>
              <option value="Weekend">Weekends only</option>
            </select>
          </div>

          {/* List Size */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">List Size</label>
            <input
              type="number"
              value={listSize || ''}
              onChange={(e) => setListSize(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 10000"
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => setFilters({})}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

// Overview Tab
const OverviewTab = ({ data, filteredData }) => {
  const chartData = useMemo(() => {
    const sortedDates = Object.keys(filteredData.byDate).sort();
    return {
      labels: sortedDates.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }),
      datasets: [
        {
          label: 'Total Requests',
          data: sortedDates.map(d => filteredData.byDate[d].total),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: '7-day Average',
          data: sortedDates.map(d => {
            const rolling = filteredData.rolling7Day.find(r => r.date === d);
            return rolling ? rolling.value : null;
          }),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    };
  }, [filteredData]);

  const outcomeDonutData = useMemo(() => {
    const groups = Object.entries(filteredData.outcomeGroupCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return {
      labels: groups.map(([g]) => g),
      datasets: [{
        data: groups.map(([, count]) => count),
        backgroundColor: groups.map(([g]) => DEFAULT_OUTCOME_GROUPS[g]?.color || '#94a3b8'),
        borderWidth: 0,
      }],
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          label="Total Requests"
          value={formatNumber(filteredData.totalRequests)}
          subValue={filteredData.requestsPer1000 ? `${formatNumber(filteredData.requestsPer1000, 1)} per 1000` : null}
          icon={ClipboardList}
          color="purple"
        />
        <KPICard
          label="Clinical"
          value={formatNumber(filteredData.clinicalRequests)}
          subValue={formatPercent(filteredData.totalRequests > 0 ? (filteredData.clinicalRequests / filteredData.totalRequests) * 100 : 0)}
          icon={Stethoscope}
          color="blue"
        />
        <KPICard
          label="Admin"
          value={formatNumber(filteredData.adminRequests)}
          subValue={formatPercent(filteredData.totalRequests > 0 ? (filteredData.adminRequests / filteredData.totalRequests) * 100 : 0)}
          icon={Briefcase}
          color="slate"
        />
        <KPICard
          label="Completion Rate"
          value={formatPercent(filteredData.completionRate)}
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          label="Outcome Rate"
          value={formatPercent(filteredData.outcomeRate)}
          icon={Target}
          color="amber"
        />
        <KPICard
          label="Appt Conversion"
          value={formatPercent(filteredData.appointmentConversionRate)}
          subValue={`${formatNumber(filteredData.appointmentRequests)} appointments`}
          icon={Calendar}
          color="emerald"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-600" />
            Daily Volume Trend
          </h3>
          <div className="h-64">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'top', labels: { usePointStyle: true } },
                },
                scales: {
                  y: { beginAtZero: true },
                },
              }}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <PieChart size={18} className="text-purple-600" />
            Outcome Distribution
          </h3>
          <div className="h-64">
            <Doughnut
              data={outcomeDonutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right', labels: { usePointStyle: true, font: { size: 11 } } },
                },
              }}
            />
          </div>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard
          label="Median Lead Time"
          value={formatDuration(filteredData.medianLeadTime)}
          icon={Clock}
          color="cyan"
        />
        <KPICard
          label="Median Time to Outcome"
          value={formatDuration(filteredData.medianTimeToOutcome)}
          icon={Clock}
          color="indigo"
        />
        <KPICard
          label="Peak Day"
          value={filteredData.peakDay?.day || '-'}
          subValue={filteredData.peakDay ? `${formatNumber(filteredData.peakDay.count)} requests` : null}
          icon={Calendar}
          color="rose"
        />
        <KPICard
          label="Peak Hour"
          value={filteredData.peakHour ? `${filteredData.peakHour.hour}:00` : '-'}
          subValue={filteredData.peakHour ? `${formatNumber(filteredData.peakHour.count)} requests` : null}
          icon={Clock}
          color="orange"
        />
        <KPICard
          label="Weekend Share"
          value={formatPercent(filteredData.weekendShare)}
          icon={Calendar}
          color="teal"
        />
        <KPICard
          label="Avoided Appts"
          value={formatPercent(filteredData.avoidedAppointmentRate)}
          icon={XCircle}
          color="lime"
        />
      </div>

      {/* Day of Week Chart */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-purple-600" />
          Requests by Day of Week
        </h3>
        <div className="h-48">
          <Bar
            data={{
              labels: DAYS_ORDER,
              datasets: [{
                label: 'Requests',
                data: DAYS_ORDER.map(d => filteredData.byDayOfWeek[d] || 0),
                backgroundColor: DAYS_ORDER.map((d, i) =>
                  d === 'Saturday' || d === 'Sunday' ? '#f59e0b' : '#8b5cf6'
                ),
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      </Card>
    </div>
  );
};

// Clinical Demand Tab
const ClinicalDemandTab = ({ filteredData }) => {
  const clinicalData = useMemo(() => {
    const types = Object.entries(filteredData.byClinicalProblemType)
      .sort((a, b) => b[1] - a[1]);
    return types;
  }, [filteredData]);

  const totalClinical = clinicalData.reduce((sum, [, count]) => sum + count, 0);

  // Calculate cumulative for Pareto
  let cumulative = 0;
  const paretoData = clinicalData.slice(0, 15).map(([type, count]) => {
    cumulative += count;
    return {
      type,
      count,
      percentage: (count / totalClinical) * 100,
      cumulative: (cumulative / totalClinical) * 100,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Clinical Requests"
          value={formatNumber(filteredData.clinicalRequests)}
          icon={Stethoscope}
          color="blue"
        />
        <KPICard
          label="Problem Types"
          value={formatNumber(clinicalData.length)}
          icon={ClipboardList}
          color="purple"
        />
        <KPICard
          label="Top Problem"
          value={clinicalData[0]?.[0] || '-'}
          subValue={clinicalData[0] ? `${formatNumber(clinicalData[0][1])} (${formatPercent((clinicalData[0][1] / totalClinical) * 100)})` : null}
          icon={TrendingUp}
          color="amber"
        />
        <KPICard
          label="Avg per Day"
          value={formatNumber(filteredData.clinicalRequests / Math.max(1, Object.keys(filteredData.byDate).length), 1)}
          icon={Calendar}
          color="green"
        />
      </div>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Clinical Problem Types (Pareto)</h3>
        <div className="h-80">
          <Bar
            data={{
              labels: paretoData.map(d => d.type.length > 20 ? d.type.substring(0, 20) + '...' : d.type),
              datasets: [
                {
                  type: 'bar',
                  label: 'Count',
                  data: paretoData.map(d => d.count),
                  backgroundColor: '#3b82f6',
                  borderRadius: 4,
                  yAxisID: 'y',
                },
                {
                  type: 'line',
                  label: 'Cumulative %',
                  data: paretoData.map(d => d.cumulative),
                  borderColor: '#ef4444',
                  backgroundColor: 'transparent',
                  yAxisID: 'y1',
                  tension: 0.4,
                  pointRadius: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { usePointStyle: true } },
              },
              scales: {
                y: { beginAtZero: true, position: 'left' },
                y1: {
                  beginAtZero: true,
                  max: 100,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: { callback: v => `${v}%` },
                },
              },
            }}
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">All Clinical Problem Types</h3>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">Problem Type</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">Count</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">%</th>
              </tr>
            </thead>
            <tbody>
              {clinicalData.map(([type, count], i) => (
                <tr key={type} className={i % 2 === 0 ? 'bg-slate-50' : ''}>
                  <td className="py-2 px-3 text-slate-700">{type}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatNumber(count)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatPercent((count / totalClinical) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Admin Demand Tab
const AdminDemandTab = ({ filteredData }) => {
  const adminData = useMemo(() => {
    const types = Object.entries(filteredData.byAdminActivityType)
      .sort((a, b) => b[1] - a[1]);
    return types;
  }, [filteredData]);

  const totalAdmin = adminData.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Admin Requests"
          value={formatNumber(filteredData.adminRequests)}
          icon={Briefcase}
          color="slate"
        />
        <KPICard
          label="Activity Types"
          value={formatNumber(adminData.length)}
          icon={ClipboardList}
          color="purple"
        />
        <KPICard
          label="Top Activity"
          value={adminData[0]?.[0] || '-'}
          subValue={adminData[0] ? `${formatNumber(adminData[0][1])}` : null}
          icon={TrendingUp}
          color="amber"
        />
        <KPICard
          label="% of Total"
          value={formatPercent(filteredData.totalRequests > 0 ? (filteredData.adminRequests / filteredData.totalRequests) * 100 : 0)}
          icon={Percent}
          color="blue"
        />
      </div>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Admin Activity Types</h3>
        <div className="h-64">
          <Bar
            data={{
              labels: adminData.slice(0, 10).map(([t]) => t.length > 25 ? t.substring(0, 25) + '...' : t),
              datasets: [{
                label: 'Count',
                data: adminData.slice(0, 10).map(([, c]) => c),
                backgroundColor: '#64748b',
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: { legend: { display: false } },
              scales: { x: { beginAtZero: true } },
            }}
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">All Admin Activity Types</h3>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-600">Activity Type</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">Count</th>
                <th className="text-right py-2 px-3 font-medium text-slate-600">%</th>
              </tr>
            </thead>
            <tbody>
              {adminData.map(([type, count], i) => (
                <tr key={type} className={i % 2 === 0 ? 'bg-slate-50' : ''}>
                  <td className="py-2 px-3 text-slate-700">{type}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatNumber(count)}</td>
                  <td className="py-2 px-3 text-right text-slate-600">{formatPercent((count / totalAdmin) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Outcomes Tab
const OutcomesTab = ({ filteredData }) => {
  const outcomeGroupData = useMemo(() => {
    return Object.entries(filteredData.outcomeGroupCounts)
      .sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  const appointmentSubtypeData = useMemo(() => {
    return Object.entries(filteredData.appointmentSubtypeCounts)
      .sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  // Funnel data
  const funnelData = [
    { label: 'Submitted', value: filteredData.totalRequests, color: '#8b5cf6' },
    { label: 'Completed', value: filteredData.completedRequests, color: '#3b82f6' },
    { label: 'Outcome Recorded', value: filteredData.outcomeRecordedRequests, color: '#22c55e' },
    { label: 'Appointment', value: filteredData.appointmentRequests, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KPICard label="Appt Conversion" value={formatPercent(filteredData.appointmentConversionRate)} icon={Calendar} color="green" />
        <KPICard label="Avoided Appts" value={formatPercent(filteredData.avoidedAppointmentRate)} icon={XCircle} color="lime" />
        <KPICard label="Timed Out" value={formatPercent(filteredData.timedOutRate)} icon={Clock} color="red" />
        <KPICard label="Signposting" value={formatPercent(filteredData.signpostingRate)} icon={ArrowUp} color="amber" />
        <KPICard label="Prescription" value={formatPercent(filteredData.prescriptionRate)} icon={FileText} color="purple" />
        <KPICard label="Advice" value={formatPercent(filteredData.adviceRate)} icon={Info} color="blue" />
      </div>

      {/* Funnel */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Conversion Funnel</h3>
        <div className="flex items-center justify-around py-4">
          {funnelData.map((item, i) => (
            <div key={item.label} className="flex items-center">
              <div className="text-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto"
                  style={{ backgroundColor: item.color }}
                >
                  {formatNumber(item.value)}
                </div>
                <p className="text-xs text-slate-600 mt-2 font-medium">{item.label}</p>
                {i > 0 && (
                  <p className="text-xs text-slate-400">
                    {formatPercent((item.value / funnelData[0].value) * 100)}
                  </p>
                )}
              </div>
              {i < funnelData.length - 1 && (
                <div className="mx-4 text-slate-300">→</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Outcome Groups</h3>
          <div className="space-y-2">
            {outcomeGroupData.map(([group, count]) => {
              const pct = (count / filteredData.totalRequests) * 100;
              const color = DEFAULT_OUTCOME_GROUPS[group]?.color || '#94a3b8';
              return (
                <div key={group} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm text-slate-700 flex-1 truncate">{group}</span>
                  <span className="text-sm text-slate-500 w-16 text-right">{formatNumber(count)}</span>
                  <span className="text-sm text-slate-400 w-14 text-right">{formatPercent(pct)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Appointment Subtypes</h3>
          {appointmentSubtypeData.length > 0 ? (
            <div className="h-64">
              <Doughnut
                data={{
                  labels: appointmentSubtypeData.map(([t]) => t),
                  datasets: [{
                    data: appointmentSubtypeData.map(([, c]) => c),
                    backgroundColor: CHART_COLORS,
                    borderWidth: 0,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right', labels: { usePointStyle: true, font: { size: 10 } } },
                  },
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No appointment data available</p>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Top 10 Raw Outcomes</h3>
        <div className="space-y-2">
          {filteredData.topOutcomes.map(([outcome, count], i) => (
            <div key={outcome} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-6">{i + 1}.</span>
              <span className="text-sm text-slate-700 flex-1 truncate">{outcome}</span>
              <span className="text-sm text-slate-500">{formatNumber(count)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// Timeliness Tab
const TimelinessTab = ({ filteredData }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Median Lead Time"
          value={formatDuration(filteredData.medianLeadTime)}
          subValue="Submission start → complete"
          icon={Clock}
          color="cyan"
        />
        <KPICard
          label="Median Time to Outcome"
          value={formatDuration(filteredData.medianTimeToOutcome)}
          subValue="Complete → outcome recorded"
          icon={Clock}
          color="indigo"
        />
        <KPICard
          label="Within 2 Hours"
          value={formatPercent(filteredData.slaMetrics?.within2h)}
          icon={Target}
          color="green"
        />
        <KPICard
          label="Within 24 Hours"
          value={formatPercent(filteredData.slaMetrics?.within24h)}
          icon={Target}
          color="blue"
        />
      </div>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">SLA Performance (Time to Outcome)</h3>
        <div className="grid grid-cols-5 gap-4 text-center">
          {[
            { label: '≤2h', key: 'within2h', color: '#22c55e' },
            { label: '≤4h', key: 'within4h', color: '#84cc16' },
            { label: '≤8h', key: 'within8h', color: '#f59e0b' },
            { label: '≤24h', key: 'within24h', color: '#3b82f6' },
            { label: '≤48h', key: 'within48h', color: '#8b5cf6' },
          ].map(sla => (
            <div key={sla.key} className="p-4 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">{sla.label}</p>
              <p className="text-2xl font-bold" style={{ color: sla.color }}>
                {formatPercent(filteredData.slaMetrics?.[sla.key])}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Requests by Hour of Day</h3>
        <div className="h-48">
          <Bar
            data={{
              labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
              datasets: [{
                label: 'Requests',
                data: Array.from({ length: 24 }, (_, i) => filteredData.byHour[i] || 0),
                backgroundColor: Array.from({ length: 24 }, (_, i) =>
                  i >= 8 && i < 18 ? '#8b5cf6' : '#cbd5e1'
                ),
                borderRadius: 2,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
        <p className="text-xs text-slate-500 text-center mt-2">Core hours (8am-6pm) highlighted</p>
      </Card>
    </div>
  );
};

// Demographics Tab
const DemographicsTab = ({ filteredData }) => {
  const ageBandData = Object.entries(filteredData.byAgeBand)
    .filter(([band]) => band !== 'Unknown')
    .map(([band, data]) => ({
      band,
      ...data,
      conversionRate: data.total > 0 ? (data.appointments / data.total) * 100 : 0,
      timedOutRate: data.total > 0 ? (data.timedOut / data.total) * 100 : 0,
    }));

  const sexData = Object.entries(filteredData.bySex)
    .filter(([sex]) => sex !== 'Unknown')
    .map(([sex, data]) => ({
      sex,
      ...data,
      conversionRate: data.total > 0 ? (data.appointments / data.total) * 100 : 0,
    }));

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Requests by Age Band</h3>
        <div className="h-64">
          <Bar
            data={{
              labels: ageBandData.map(d => d.band),
              datasets: [{
                label: 'Total Requests',
                data: ageBandData.map(d => d.total),
                backgroundColor: '#8b5cf6',
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Appointment Conversion by Age</h3>
          <div className="h-48">
            <Bar
              data={{
                labels: ageBandData.map(d => d.band),
                datasets: [{
                  label: 'Conversion Rate',
                  data: ageBandData.map(d => d.conversionRate),
                  backgroundColor: '#22c55e',
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: v => `${v}%` },
                  },
                },
              }}
            />
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Timed Out Rate by Age (Digital Exclusion Signal)</h3>
          <div className="h-48">
            <Bar
              data={{
                labels: ageBandData.map(d => d.band),
                datasets: [{
                  label: 'Timed Out Rate',
                  data: ageBandData.map(d => d.timedOutRate),
                  backgroundColor: '#ef4444',
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { callback: v => `${v}%` },
                  },
                },
              }}
            />
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Requests by Sex</h3>
        <div className="grid grid-cols-2 gap-4">
          {sexData.map(d => (
            <div key={d.sex} className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-800">{formatNumber(d.total)}</p>
              <p className="text-sm text-slate-600">{d.sex}</p>
              <p className="text-xs text-slate-400 mt-1">
                {formatPercent(d.conversionRate)} appointment conversion
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// Operational Insights Tab
const OperationsTab = ({ filteredData }) => {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Access Method Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48">
            <Doughnut
              data={{
                labels: Object.keys(filteredData.byAccessMethod),
                datasets: [{
                  data: Object.values(filteredData.byAccessMethod).map(d => d.total),
                  backgroundColor: CHART_COLORS,
                  borderWidth: 0,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right', labels: { usePointStyle: true, font: { size: 11 } } },
                },
              }}
            />
          </div>
          <div className="space-y-2">
            {Object.entries(filteredData.byAccessMethod).map(([method, data], i) => (
              <div key={method} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {method}
                </span>
                <span className="text-slate-500">
                  {formatNumber(data.total)} ({formatPercent(data.total > 0 ? (data.appointments / data.total) * 100 : 0)} appt)
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Response Preference Distribution</h3>
        <div className="h-48">
          <Bar
            data={{
              labels: Object.keys(filteredData.byResponsePreference),
              datasets: [{
                label: 'Requests',
                data: Object.values(filteredData.byResponsePreference).map(d => d.total),
                backgroundColor: '#8b5cf6',
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Heatmap: Requests by Day & Hour</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-1"></th>
                {Array.from({ length: 24 }, (_, i) => (
                  <th key={i} className="p-1 text-slate-500 font-normal">{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS_ORDER.map(day => {
                const maxVal = Math.max(...Object.values(filteredData.heatmapData[day]));
                return (
                  <tr key={day}>
                    <td className="p-1 text-slate-600 font-medium whitespace-nowrap">{day.slice(0, 3)}</td>
                    {Array.from({ length: 24 }, (_, h) => {
                      const val = filteredData.heatmapData[day][h] || 0;
                      const intensity = maxVal > 0 ? val / maxVal : 0;
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            className="w-full h-6 rounded-sm flex items-center justify-center text-[9px]"
                            style={{
                              backgroundColor: `rgba(139, 92, 246, ${intensity * 0.8 + 0.1})`,
                              color: intensity > 0.5 ? 'white' : '#64748b',
                            }}
                            title={`${day} ${h}:00 - ${val} requests`}
                          >
                            {val > 0 ? val : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// Data Quality Tab
const DataQualityTab = ({ dataQuality, filteredData }) => {
  const qualityMetrics = [
    { label: 'Total Rows Processed', value: dataQuality.totalRows, status: 'info' },
    { label: 'Missing Dates', value: dataQuality.missingDates, status: dataQuality.missingDates > 0 ? 'warning' : 'success' },
    { label: 'Invalid Durations', value: dataQuality.invalidDurations, status: dataQuality.invalidDurations > 0 ? 'warning' : 'success' },
    { label: 'Missing Outcomes', value: dataQuality.missingOutcomes, status: dataQuality.missingOutcomes > dataQuality.totalRows * 0.1 ? 'warning' : 'success' },
    { label: 'Missing Type', value: dataQuality.missingType, status: dataQuality.missingType > 0 ? 'warning' : 'success' },
  ];

  const statusColors = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          Data Quality Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {qualityMetrics.map(metric => (
            <div key={metric.label} className={`p-4 rounded-lg ${statusColors[metric.status]}`}>
              <p className="text-xs font-medium uppercase tracking-wide">{metric.label}</p>
              <p className="text-2xl font-bold mt-1">{formatNumber(metric.value)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Missingness by Key Fields</h3>
        <div className="space-y-3">
          {[
            { field: 'Submitted Date', missing: dataQuality.missingDates, total: dataQuality.totalRows },
            { field: 'Type', missing: dataQuality.missingType, total: dataQuality.totalRows },
            { field: 'Outcome', missing: dataQuality.missingOutcomes, total: dataQuality.totalRows },
          ].map(item => {
            const pct = item.total > 0 ? (item.missing / item.total) * 100 : 0;
            return (
              <div key={item.field}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.field}</span>
                  <span className="text-slate-500">{formatNumber(item.missing)} missing ({formatPercent(pct)})</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 10 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${100 - pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// Exports Tab
const ExportsTab = ({ data, filteredData }) => {
  const downloadCSV = useCallback((filename, headers, rows) => {
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadOutcomeMapping = useCallback(() => {
    const mapping = JSON.stringify(DEFAULT_OUTCOME_GROUPS, null, 2);
    const blob = new Blob([mapping], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'outcome-mapping.json';
    a.click();
    URL.revokeObjectURL(url);
    trackExport('systmconnect_outcome_mapping', 'json');
  }, []);

  const exportDailyVolumes = () => {
    const sortedDates = Object.keys(filteredData.byDate).sort();
    downloadCSV(
      'daily-volumes.csv',
      ['Date', 'Total', 'Clinical', 'Admin', 'Appointments'],
      sortedDates.map(d => [
        d,
        filteredData.byDate[d].total,
        filteredData.byDate[d].clinical,
        filteredData.byDate[d].admin,
        filteredData.byDate[d].appointments,
      ])
    );
    trackExport('systmconnect_daily_volumes', 'csv');
  };

  const exportOutcomeGroups = () => {
    downloadCSV(
      'outcome-groups.csv',
      ['Outcome Group', 'Count', 'Percentage'],
      Object.entries(filteredData.outcomeGroupCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([group, count]) => [
          group,
          count,
          ((count / filteredData.totalRequests) * 100).toFixed(2),
        ])
    );
    trackExport('systmconnect_outcome_groups', 'csv');
  };

  const exportSLASummary = () => {
    downloadCSV(
      'sla-summary.csv',
      ['SLA Threshold', 'Percentage Within'],
      Object.entries(filteredData.slaMetrics).map(([key, value]) => [
        key.replace('within', '≤').replace('h', ' hours'),
        value.toFixed(2),
      ])
    );
    trackExport('systmconnect_sla_summary', 'csv');
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Download size={18} className="text-purple-600" />
          Export Data
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={exportDailyVolumes}
            className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <FileText size={24} className="text-purple-600 mb-2" />
            <p className="font-medium text-slate-700">Daily Volumes</p>
            <p className="text-xs text-slate-500">CSV export of daily request counts</p>
          </button>
          <button
            onClick={exportOutcomeGroups}
            className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <FileText size={24} className="text-purple-600 mb-2" />
            <p className="font-medium text-slate-700">Outcome Groups</p>
            <p className="text-xs text-slate-500">Summary of outcome distributions</p>
          </button>
          <button
            onClick={exportSLASummary}
            className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <FileText size={24} className="text-purple-600 mb-2" />
            <p className="font-medium text-slate-700">SLA Summary</p>
            <p className="text-xs text-slate-500">Time to outcome SLA metrics</p>
          </button>
          <button
            onClick={downloadOutcomeMapping}
            className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <Settings size={24} className="text-purple-600 mb-2" />
            <p className="font-medium text-slate-700">Outcome Mapping</p>
            <p className="text-xs text-slate-500">JSON config for outcome groups</p>
          </button>
        </div>
      </Card>
    </div>
  );
};

// Main Component
export default function SystmConnectAnalysis({ data, dataQuality, onReset }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({});
  const [listSize, setListSize] = useState(null);

  // Track filter usage
  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    const activeFilters = Object.entries(newFilters).filter(([, v]) => v && v !== 'All').map(([k]) => k);
    if (activeFilters.length > 0) {
      trackEvent('systmconnect_filter_applied', { filters: activeFilters.join(',') });
    }
  }, []);

  // Filter rows based on current filters
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];

    return data.rows.filter(row => {
      // Date range
      if (filters.dateFrom && row.submittedDt) {
        const fromDate = new Date(filters.dateFrom);
        if (row.submittedDt < fromDate) return false;
      }
      if (filters.dateTo && row.submittedDt) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59);
        if (row.submittedDt > toDate) return false;
      }

      // Type
      if (filters.type && filters.type !== 'All' && row.type !== filters.type) return false;

      // Access Method
      if (filters.accessMethod && filters.accessMethod !== 'All' && row.accessMethod !== filters.accessMethod) return false;

      // Submission Source
      if (filters.submissionSource && filters.submissionSource !== 'All' && row.submissionSource !== filters.submissionSource) return false;

      // Outcome Group
      if (filters.outcomeGroup && filters.outcomeGroup !== 'All' && row.outcomeGroup !== filters.outcomeGroup) return false;

      // Sex
      if (filters.sex && filters.sex !== 'All' && row.sex !== filters.sex) return false;

      // Age Band
      if (filters.ageBand && filters.ageBand !== 'All' && row.ageBand !== filters.ageBand) return false;

      // Day Type
      if (filters.dayType === 'Weekday' && row.isWeekend) return false;
      if (filters.dayType === 'Weekend' && !row.isWeekend) return false;

      return true;
    });
  }, [data?.rows, filters]);

  // Recompute analytics for filtered rows
  const filteredData = useMemo(() => {
    if (!filteredRows.length) return data?.analyzed || {};

    // Recalculate all metrics for filtered data
    const totalRequests = filteredRows.length;
    const clinicalRequests = filteredRows.filter(r => r.type === 'Clinical').length;
    const adminRequests = filteredRows.filter(r => r.type === 'Admin').length;
    const completedRequests = filteredRows.filter(r => r.isCompleted).length;
    const outcomeRecordedRequests = filteredRows.filter(r => r.hasOutcomeRecorded).length;
    const appointmentRequests = filteredRows.filter(r => r.isAppointment).length;

    // Rates
    const completionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0;
    const outcomeRate = totalRequests > 0 ? (outcomeRecordedRequests / totalRequests) * 100 : 0;
    const appointmentConversionRate = totalRequests > 0 ? (appointmentRequests / totalRequests) * 100 : 0;
    const avoidedAppointmentRate = totalRequests > 0 ? ((totalRequests - appointmentRequests) / totalRequests) * 100 : 0;
    const requestsPer1000 = listSize ? (totalRequests / listSize) * 1000 : null;

    // Outcome groups
    const outcomeGroupCounts = {};
    filteredRows.forEach(r => {
      const group = r.outcomeGroup || 'Other / Unknown';
      outcomeGroupCounts[group] = (outcomeGroupCounts[group] || 0) + 1;
    });

    // Top outcomes
    const outcomeCounts = {};
    filteredRows.forEach(r => {
      if (r.outcome) outcomeCounts[r.outcome] = (outcomeCounts[r.outcome] || 0) + 1;
    });
    const topOutcomes = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Appointment subtypes
    const appointmentSubtypeCounts = {};
    filteredRows.filter(r => r.isAppointment).forEach(r => {
      const subtype = r.appointmentSubtype || 'Other Appointment';
      appointmentSubtypeCounts[subtype] = (appointmentSubtypeCounts[subtype] || 0) + 1;
    });

    // Timing
    const leadTimes = filteredRows.map(r => r.leadTimeMinutes).filter(v => v !== null && v >= 0).sort((a, b) => a - b);
    const medianLeadTime = leadTimes.length > 0 ? leadTimes[Math.floor(leadTimes.length / 2)] : null;

    const timeToOutcomes = filteredRows.map(r => r.timeToOutcomeMinutes).filter(v => v !== null && v >= 0).sort((a, b) => a - b);
    const medianTimeToOutcome = timeToOutcomes.length > 0 ? timeToOutcomes[Math.floor(timeToOutcomes.length / 2)] : null;

    // SLA metrics
    const slaMetrics = {};
    [2, 4, 8, 24, 48].forEach(hours => {
      const threshold = hours * 60;
      const withinSla = timeToOutcomes.filter(t => t <= threshold).length;
      slaMetrics[`within${hours}h`] = timeToOutcomes.length > 0 ? (withinSla / timeToOutcomes.length) * 100 : 0;
    });

    // By day of week
    const byDayOfWeek = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };
    filteredRows.forEach(r => { if (r.dow) byDayOfWeek[r.dow]++; });

    // By hour
    const byHour = {};
    for (let h = 0; h < 24; h++) byHour[h] = 0;
    filteredRows.forEach(r => { if (r.hourOfDay !== null) byHour[r.hourOfDay]++; });

    // Peak
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(byDayOfWeek).sort((a, b) => b[1] - a[1])[0];

    // Weekend share
    const weekendRequests = filteredRows.filter(r => r.isWeekend).length;
    const weekendShare = totalRequests > 0 ? (weekendRequests / totalRequests) * 100 : 0;

    // Heatmap
    const heatmapData = {};
    Object.keys(byDayOfWeek).forEach(day => {
      heatmapData[day] = {};
      for (let h = 0; h < 24; h++) heatmapData[day][h] = 0;
    });
    filteredRows.forEach(r => {
      if (r.dow && r.hourOfDay !== null) heatmapData[r.dow][r.hourOfDay]++;
    });

    // By date
    const byDate = {};
    filteredRows.forEach(r => {
      if (r.submittedDt) {
        const dateKey = r.submittedDt.toISOString().split('T')[0];
        if (!byDate[dateKey]) byDate[dateKey] = { total: 0, clinical: 0, admin: 0, appointments: 0 };
        byDate[dateKey].total++;
        if (r.type === 'Clinical') byDate[dateKey].clinical++;
        if (r.type === 'Admin') byDate[dateKey].admin++;
        if (r.isAppointment) byDate[dateKey].appointments++;
      }
    });

    // Rolling 7-day
    const sortedDates = Object.keys(byDate).sort();
    const rolling7Day = [];
    for (let i = 6; i < sortedDates.length; i++) {
      const window = sortedDates.slice(i - 6, i + 1);
      const avg = window.reduce((sum, d) => sum + byDate[d].total, 0) / 7;
      rolling7Day.push({ date: sortedDates[i], value: Math.round(avg * 10) / 10 });
    }

    // Demographics
    const byAgeBand = {};
    AGE_BANDS.forEach(b => byAgeBand[b.label] = { total: 0, appointments: 0, timedOut: 0 });
    byAgeBand['Unknown'] = { total: 0, appointments: 0, timedOut: 0 };
    filteredRows.forEach(r => {
      const band = r.ageBand || 'Unknown';
      if (byAgeBand[band]) {
        byAgeBand[band].total++;
        if (r.isAppointment) byAgeBand[band].appointments++;
        if (r.outcomeGroup === 'Timed out / No response') byAgeBand[band].timedOut++;
      }
    });

    const bySex = {};
    filteredRows.forEach(r => {
      const sex = r.sex || 'Unknown';
      if (!bySex[sex]) bySex[sex] = { total: 0, appointments: 0 };
      bySex[sex].total++;
      if (r.isAppointment) bySex[sex].appointments++;
    });

    // Specific rates
    const timedOutCount = filteredRows.filter(r => r.outcomeGroup === 'Timed out / No response').length;
    const timedOutRate = totalRequests > 0 ? (timedOutCount / totalRequests) * 100 : 0;
    const inappropriateCount = filteredRows.filter(r => r.outcomeGroup === 'Inappropriate / Rejected').length;
    const inappropriateRate = totalRequests > 0 ? (inappropriateCount / totalRequests) * 100 : 0;
    const signpostingCount = filteredRows.filter(r => r.outcomeGroup === 'Signposting / Redirect').length;
    const signpostingRate = totalRequests > 0 ? (signpostingCount / totalRequests) * 100 : 0;
    const prescriptionCount = filteredRows.filter(r => r.outcomeGroup === 'Prescription / Meds').length;
    const prescriptionRate = totalRequests > 0 ? (prescriptionCount / totalRequests) * 100 : 0;
    const adviceCount = filteredRows.filter(r => r.outcomeGroup === 'Advice / Self-care').length;
    const adviceRate = totalRequests > 0 ? (adviceCount / totalRequests) * 100 : 0;

    // Channel analysis
    const byAccessMethod = {};
    filteredRows.forEach(r => {
      const method = r.accessMethod || 'Unknown';
      if (!byAccessMethod[method]) byAccessMethod[method] = { total: 0, appointments: 0 };
      byAccessMethod[method].total++;
      if (r.isAppointment) byAccessMethod[method].appointments++;
    });

    const bySubmissionSource = {};
    filteredRows.forEach(r => {
      const source = r.submissionSource || 'Unknown';
      if (!bySubmissionSource[source]) bySubmissionSource[source] = { total: 0, appointments: 0 };
      bySubmissionSource[source].total++;
      if (r.isAppointment) bySubmissionSource[source].appointments++;
    });

    const byResponsePreference = {};
    filteredRows.forEach(r => {
      const pref = r.responsePreference || 'Unknown';
      if (!byResponsePreference[pref]) byResponsePreference[pref] = { total: 0, appointments: 0 };
      byResponsePreference[pref].total++;
      if (r.isAppointment) byResponsePreference[pref].appointments++;
    });

    const byClinicalProblemType = {};
    filteredRows.filter(r => r.type === 'Clinical').forEach(r => {
      const type = r.clinicalProblemType || 'Unknown';
      byClinicalProblemType[type] = (byClinicalProblemType[type] || 0) + 1;
    });

    const byAdminActivityType = {};
    filteredRows.filter(r => r.type === 'Admin').forEach(r => {
      const type = r.adminActivityType || 'Unknown';
      byAdminActivityType[type] = (byAdminActivityType[type] || 0) + 1;
    });

    return {
      ...data?.analyzed,
      totalRequests,
      clinicalRequests,
      adminRequests,
      completedRequests,
      outcomeRecordedRequests,
      appointmentRequests,
      completionRate,
      outcomeRate,
      appointmentConversionRate,
      avoidedAppointmentRate,
      requestsPer1000,
      outcomeGroupCounts,
      topOutcomes,
      appointmentSubtypeCounts,
      medianLeadTime,
      medianTimeToOutcome,
      slaMetrics,
      byDayOfWeek,
      byHour,
      peakHour: peakHour ? { hour: parseInt(peakHour[0]), count: peakHour[1] } : null,
      peakDay: peakDay ? { day: peakDay[0], count: peakDay[1] } : null,
      weekendShare,
      heatmapData,
      byDate,
      rolling7Day,
      byAgeBand,
      bySex,
      timedOutRate,
      inappropriateRate,
      signpostingRate,
      prescriptionRate,
      adviceRate,
      byAccessMethod,
      bySubmissionSource,
      byResponsePreference,
      byClinicalProblemType,
      byAdminActivityType,
    };
  }, [filteredRows, data?.analyzed, listSize]);

  // Available tabs (hide Admin if no admin data)
  const availableTabs = useMemo(() => {
    return TABS.filter(tab => {
      if (tab.requiresAdmin && !data?.analyzed?.hasAdminData) return false;
      return true;
    });
  }, [data?.analyzed?.hasAdminData]);

  // Date range text
  const dateRangeText = useMemo(() => {
    const min = data?.analyzed?.dateRange?.min;
    const max = data?.analyzed?.dateRange?.max;
    if (!min || !max) return '';
    return `${min.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} - ${max.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [data?.analyzed?.dateRange]);

  return (
    <div className="space-y-4">
      <Instructions />

      <FilterPanel
        data={data?.analyzed || {}}
        filters={filters}
        setFilters={handleFilterChange}
        listSize={listSize}
        setListSize={setListSize}
      />

      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
        <span>
          Showing {formatNumber(filteredRows.length)} of {formatNumber(data?.rows?.length || 0)} requests
          {dateRangeText && ` | ${dateRangeText}`}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              trackTabView('systmconnect', tab.id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab data={data} filteredData={filteredData} />}
      {activeTab === 'demand-clinical' && <ClinicalDemandTab filteredData={filteredData} />}
      {activeTab === 'demand-admin' && <AdminDemandTab filteredData={filteredData} />}
      {activeTab === 'outcomes' && <OutcomesTab filteredData={filteredData} />}
      {activeTab === 'timeliness' && <TimelinessTab filteredData={filteredData} />}
      {activeTab === 'demographics' && <DemographicsTab filteredData={filteredData} />}
      {activeTab === 'operations' && <OperationsTab filteredData={filteredData} />}
      {activeTab === 'data-quality' && <DataQualityTab dataQuality={dataQuality} filteredData={filteredData} />}
      {activeTab === 'exports' && <ExportsTab data={data} filteredData={filteredData} />}
    </div>
  );
}
