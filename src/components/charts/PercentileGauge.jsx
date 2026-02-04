import React from 'react';

/**
 * PercentileGauge - A semicircle gauge showing where a value sits in the national percentile
 *
 * Props:
 * - value: The actual metric value
 * - percentile: The percentile rank (0-100)
 * - label: Display label for the metric
 * - unit: Unit suffix (e.g., "%", "/1000")
 * - higherIsBetter: Whether higher percentiles are positive (default true)
 * - size: 'sm' | 'md' | 'lg' (default 'md')
 */
const PercentileGauge = ({
  value,
  percentile,
  label,
  unit = '',
  higherIsBetter = true,
  size = 'md'
}) => {
  // Size configurations
  const sizes = {
    sm: { width: 100, height: 60, strokeWidth: 8, fontSize: 'text-xs', labelSize: 'text-[10px]' },
    md: { width: 140, height: 80, strokeWidth: 10, fontSize: 'text-sm', labelSize: 'text-xs' },
    lg: { width: 180, height: 100, strokeWidth: 12, fontSize: 'text-base', labelSize: 'text-sm' },
  };

  const config = sizes[size] || sizes.md;
  const { width, height, strokeWidth } = config;

  // Calculate arc parameters
  const radius = (width - strokeWidth) / 2;
  const centerX = width / 2;
  const centerY = height - 5;

  // Clamp percentile to 0-100
  const clampedPercentile = Math.max(0, Math.min(100, percentile || 0));

  // Calculate the angle for the percentile (180 degrees = full arc)
  const angle = (clampedPercentile / 100) * 180;
  const angleRad = (angle * Math.PI) / 180;

  // Calculate end point of the progress arc
  const endX = centerX - radius * Math.cos(angleRad);
  const endY = centerY - radius * Math.sin(angleRad);

  // Create arc path
  const backgroundArc = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;

  // Progress arc - handle edge cases
  let progressArc = '';
  if (clampedPercentile > 0) {
    const largeArcFlag = angle > 180 ? 1 : 0;
    progressArc = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  }

  // Color based on percentile and whether higher is better
  const getColor = () => {
    const effectivePercentile = higherIsBetter ? clampedPercentile : (100 - clampedPercentile);

    if (effectivePercentile >= 75) return { stroke: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50' }; // Green
    if (effectivePercentile >= 50) return { stroke: '#3b82f6', text: 'text-blue-600', bg: 'bg-blue-50' }; // Blue
    if (effectivePercentile >= 25) return { stroke: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50' }; // Amber
    return { stroke: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' }; // Red
  };

  const colors = getColor();

  // Format value for display
  const formatValue = (val) => {
    if (val == null || isNaN(val)) return 'N/A';
    if (typeof val === 'number') {
      return val >= 100 ? val.toFixed(0) : val.toFixed(1);
    }
    return val;
  };

  return (
    <div className={`flex flex-col items-center p-3 rounded-xl ${colors.bg} border border-slate-200`}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        {progressArc && (
          <path
            d={progressArc}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease-out',
            }}
          />
        )}

        {/* Percentile markers */}
        {[0, 25, 50, 75, 100].map((marker) => {
          const markerAngle = (marker / 100) * 180;
          const markerRad = (markerAngle * Math.PI) / 180;
          const innerRadius = radius - strokeWidth / 2 - 3;
          const markerX = centerX - innerRadius * Math.cos(markerRad);
          const markerY = centerY - innerRadius * Math.sin(markerRad);
          return (
            <circle
              key={marker}
              cx={markerX}
              cy={markerY}
              r={1.5}
              fill="#94a3b8"
            />
          );
        })}

        {/* Value text */}
        <text
          x={centerX}
          y={centerY - 15}
          textAnchor="middle"
          className={`font-bold ${config.fontSize} fill-slate-800`}
        >
          {formatValue(value)}{unit}
        </text>

        {/* Percentile text */}
        <text
          x={centerX}
          y={centerY - 2}
          textAnchor="middle"
          className={`font-semibold ${config.labelSize}`}
          fill={colors.stroke}
        >
          {clampedPercentile.toFixed(0)}th pctl
        </text>
      </svg>

      {/* Label */}
      <p className={`${config.labelSize} text-slate-600 text-center mt-1 font-medium leading-tight max-w-[120px]`}>
        {label}
      </p>
    </div>
  );
};

/**
 * KeyMetricsDisplay - Grid of percentile gauges for CAIP Analysis
 */
export const KeyMetricsDisplay = ({ metrics, percentiles }) => {
  if (!metrics || !percentiles) return null;

  // Define which metrics to show with their configurations
  const metricConfigs = [
    {
      key: 'gpApptOrOCPerDayPct',
      label: 'GP + OC per Day',
      unit: '%',
      higherIsBetter: true,
    },
    {
      key: 'sameDayPct',
      label: 'Same-Day Appts',
      unit: '%',
      higherIsBetter: true,
    },
    {
      key: 'dnaRate',
      label: 'DNA Rate',
      unit: '%',
      higherIsBetter: false,
    },
    {
      key: 'missedCallPct',
      label: 'Missed Call Rate',
      unit: '%',
      higherIsBetter: false,
    },
    {
      key: 'gpPerThousand',
      label: 'GPs per 1000',
      unit: '',
      higherIsBetter: true,
    },
  ];

  // Filter to only show metrics that have data
  const availableMetrics = metricConfigs.filter(config => {
    const value = metrics[config.key];
    const pctl = percentiles[`${config.key}Pctl`];
    return value != null && !isNaN(value) && pctl != null && !isNaN(pctl);
  });

  if (availableMetrics.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
        Key Metrics at a Glance
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {availableMetrics.map(config => (
          <PercentileGauge
            key={config.key}
            value={metrics[config.key]}
            percentile={percentiles[`${config.key}Pctl`]}
            label={config.label}
            unit={config.unit}
            higherIsBetter={config.higherIsBetter}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
};

export default PercentileGauge;
