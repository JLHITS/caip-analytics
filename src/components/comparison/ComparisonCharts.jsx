import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';
import Card from '../ui/Card';
import { extractChartData, sortMonthsChronologically } from '../../utils/comparisonUtils';
import { COMPARISON_COLORS } from '../../constants/colors';
import { gpBandOptions, percentageOptions, commonOptions } from '../../constants/chartConfigs';

/**
 * Multi-practice comparison charts component
 */
const ComparisonCharts = ({ practices, filteredMonths, networkAverages }) => {
  // Sort months chronologically
  const sortedMonths = useMemo(
    () => sortMonthsChronologically(filteredMonths),
    [filteredMonths]
  );

  // Create chart data for a given metric
  const createChartData = (metric, label) => {
    const chartData = extractChartData(practices, metric, sortedMonths);

    const datasets = chartData.map((practice, index) => ({
      label: practice.odsCode
        ? `${practice.surgeryName} (${practice.odsCode})`
        : practice.surgeryName,
      data: practice.data,
      borderColor: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
      spanGaps: true, // Connect lines across null values
    }));

    // Add network average line (dashed)
    if (networkAverages[metric]) {
      datasets.push({
        label: 'Network Average',
        data: sortedMonths.map(() => networkAverages[metric].mean),
        borderColor: '#64748b',
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
      });
    }

    return {
      labels: sortedMonths,
      datasets,
    };
  };

  // Custom chart options with tooltip showing all values
  const comparisonChartOptions = {
    ...commonOptions,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      ...commonOptions.plugins,
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
          font: { size: 11 },
        },
      },
      tooltip: {
        ...commonOptions.plugins?.tooltip,
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null || value === undefined) return `${context.dataset.label}: N/A`;
            return `${context.dataset.label}: ${value.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      ...commonOptions.scales,
      y: {
        ...commonOptions.scales?.y,
        beginAtZero: true,
      },
    },
  };

  // GP Band chart options (with performance bands)
  const gpCapacityOptions = {
    ...gpBandOptions,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      ...gpBandOptions.plugins,
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
          font: { size: 11 },
          filter: (item) => !item.text.includes('Band'), // Hide band labels
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null || value === undefined) return `${context.dataset.label}: N/A`;
            return `${context.dataset.label}: ${value.toFixed(2)}%`;
          },
        },
      },
    },
  };

  // Percentage chart options
  const pctChartOptions = {
    ...comparisonChartOptions,
    scales: {
      ...comparisonChartOptions.scales,
      y: {
        ...comparisonChartOptions.scales?.y,
        max: 100,
        ticks: {
          callback: (value) => `${value}%`,
        },
      },
    },
    plugins: {
      ...comparisonChartOptions.plugins,
      tooltip: {
        ...comparisonChartOptions.plugins?.tooltip,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null || value === undefined) return `${context.dataset.label}: N/A`;
            return `${context.dataset.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
  };

  if (sortedMonths.length === 0) {
    return (
      <Card className="text-center py-8">
        <BarChart3 className="mx-auto text-slate-300 mb-2" size={48} />
        <p className="text-slate-500">No months selected for comparison</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* GP Capacity Chart - Main KPI */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-emerald-600" />
          <h3 className="font-bold text-slate-700">GP Capacity per Day (%) - All Practices</h3>
        </div>
        <div className="h-80">
          <Line
            data={createChartData('gpTriageCapacityPerDayPct', 'GP Capacity %')}
            options={gpCapacityOptions}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Performance bands: Blue (&gt;1.30%), Green (1.10-1.30%), Amber (0.85-1.10%), Red (&lt;0.85%)
        </p>
      </Card>

      {/* Two-column layout for secondary charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Utilisation Chart */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Utilisation Rate (%)</h3>
          <div className="h-64">
            <Line
              data={createChartData('utilization', 'Utilisation')}
              options={pctChartOptions}
            />
          </div>
        </Card>

        {/* DNA Rate Chart */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-4">DNA Rate (%)</h3>
          <div className="h-64">
            <Line
              data={createChartData('allDNAPct', 'DNA Rate')}
              options={pctChartOptions}
            />
          </div>
        </Card>

        {/* Unused Capacity Chart */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Unused Capacity (%)</h3>
          <div className="h-64">
            <Line
              data={createChartData('allUnusedPct', 'Unused Capacity')}
              options={pctChartOptions}
            />
          </div>
        </Card>

        {/* Conversion Ratio Chart */}
        <Card>
          <h3 className="font-bold text-slate-700 mb-4">Conversion Ratio (Appts/Calls)</h3>
          <div className="h-64">
            <Line
              data={createChartData('conversionRatio', 'Conversion Ratio')}
              options={comparisonChartOptions}
            />
          </div>
        </Card>
      </div>

      {/* Total Appointments Chart */}
      <Card>
        <h3 className="font-bold text-slate-700 mb-4">Total Appointments per Month</h3>
        <div className="h-72">
          <Line
            data={createChartData('totalAppts', 'Total Appointments')}
            options={{
              ...comparisonChartOptions,
              scales: {
                ...comparisonChartOptions.scales,
                y: {
                  ...comparisonChartOptions.scales?.y,
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => value.toLocaleString(),
                  },
                },
              },
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default ComparisonCharts;
