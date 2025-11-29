import { GP_BAND_RED, GP_BAND_AMBER, GP_BAND_GREEN, GP_BAND_BLUE } from './colors';

// Common chart configuration shared across all charts
// Provides consistent styling, tooltips, and interaction patterns
export const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: 20 },
  plugins: {
    legend: { position: 'bottom' },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 12,
      boxPadding: 6
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { color: '#64748b' }
    },
    x: {
      grid: { display: false },
      ticks: { color: '#64748b' }
    }
  },
  elements: {
    line: { tension: 0.4 },
    point: { radius: 4, hoverRadius: 6 }
  }
};

// PDF export version (no animations for better rendering)
export const pdfChartOptions = { ...commonOptions, animation: false };

// Percentage chart configuration with % formatting on y-axis
export const percentageOptions = {
  ...commonOptions,
  scales: {
    ...commonOptions.scales,
    y: {
      ...commonOptions.scales.y,
      min: 0,
      ticks: {
        color: '#64748b',
        callback: (v) => `${Number(v).toFixed(2)}%`
      }
    }
  }
};

export const pdfPercentageOptions = { ...percentageOptions, animation: false };

// Online request performance bands (5% threshold between red/green)
export const onlineRequestBandOptions = {
  ...commonOptions,
  scales: {
    ...commonOptions.scales,
    y: { ...commonOptions.scales.y, min: 0 }
  },
  plugins: {
    ...commonOptions.plugins,
    backgroundBands: {
      bands: [
        { from: 0, to: 5.0, color: GP_BAND_RED },    // <5% needs improvement
        { from: 5.0, to: 100, color: GP_BAND_GREEN }  // >5% good
      ]
    }
  }
};

// GP performance bands with four-tier system
// Red: <0.85%, Amber: 0.85-1.10%, Green: 1.10-1.30%, Blue: >1.30%
export const gpBandOptions = {
  ...percentageOptions,
  scales: {
    ...percentageOptions.scales,
    y: {
      ...percentageOptions.scales.y,
      min: 0,
      suggestedMax: 1.6
    }
  },
  plugins: {
    ...percentageOptions.plugins,
    backgroundBands: {
      bands: [
        { from: 0, to: 0.85, color: GP_BAND_RED },
        { from: 0.85, to: 1.10, color: GP_BAND_AMBER },
        { from: 1.10, to: 1.30, color: GP_BAND_GREEN },
        { from: 1.30, to: 5.00, color: GP_BAND_BLUE }
      ]
    }
  }
};

export const pdfGpBandOptions = { ...gpBandOptions, animation: false };

// Stacked percentage chart (totals to 100%)
export const stackedPercentageOptions = {
  ...percentageOptions,
  scales: {
    x: { ...commonOptions.scales.x, stacked: true },
    y: { ...percentageOptions.scales.y, stacked: true, max: 100 }
  }
};

export const pdfStackedPercentageOptions = { ...stackedPercentageOptions, animation: false };

// Ratio chart configuration (decimal values, no percentage)
export const ratioOptions = {
  ...commonOptions,
  scales: {
    ...commonOptions.scales,
    y: {
      ...commonOptions.scales.y,
      min: 0,
      ticks: {
        color: '#64748b',
        callback: (v) => Number(v).toFixed(2)
      }
    }
  }
};

export const pdfRatioOptions = { ...ratioOptions, animation: false };

// Utilization chart (percentage with 0-100% range)
export const utilizationOptions = {
  ...percentageOptions,
  scales: {
    ...percentageOptions.scales,
    y: { ...percentageOptions.scales.y, min: 0, max: 100 }
  }
};

export const pdfUtilizationOptions = { ...utilizationOptions, animation: false };

// Time chart configuration (formats values as minutes and seconds)
export const timeOptions = {
  ...commonOptions,
  scales: {
    ...commonOptions.scales,
    y: {
      ...commonOptions.scales.y,
      ticks: {
        color: '#64748b',
        callback: (v) => `${Math.floor(v / 60)}m ${v % 60}s`
      }
    }
  }
};

export const pdfTimeOptions = { ...timeOptions, animation: false };

// Donut/Pie chart configuration
export const donutOptions = {
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        boxWidth: 12,
        font: { size: 11 }
      }
    }
  }
};

// Helper function to create donut chart data with percentages in labels
export const createDonutData = (dataMap, colors) => {
  const labels = Object.keys(dataMap);
  const values = Object.values(dataMap);
  const total = values.reduce((acc, val) => acc + val, 0);
  const percentages = values.map(value => ((value / total) * 100).toFixed(1) + "%");

  return {
    labels: labels.map((l, i) => `${l} (${percentages[i]})`),
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderWidth: 0
    }]
  };
};

// Helper function to create line chart data
export const createChartData = (displayedData, label, dataKey, color, fill = true) => ({
  labels: displayedData?.map(d => d.month),
  datasets: [{
    label: label,
    data: displayedData?.map(d => d[dataKey]),
    borderColor: color,
    backgroundColor: fill ? `${color}20` : 'transparent',
    fill: fill,
  }]
});
