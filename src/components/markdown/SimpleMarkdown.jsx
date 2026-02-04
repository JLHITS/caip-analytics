import React from 'react';
import { CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import PercentileGauge from '../charts/PercentileGauge';

// Section theme configurations for CAIP Analysis output
const sectionThemes = {
  'working': {
    icon: CheckCircle,
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    bgGradient: 'from-emerald-50 to-green-50',
    border: 'border-emerald-200',
    titleColor: 'text-emerald-800',
    bulletColor: 'text-emerald-500',
    boldColor: 'text-emerald-900',
  },
  'improvement': {
    icon: AlertTriangle,
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    bgGradient: 'from-amber-50 to-orange-50',
    border: 'border-amber-200',
    titleColor: 'text-amber-800',
    bulletColor: 'text-amber-500',
    boldColor: 'text-amber-900',
  },
  'actions': {
    icon: Lightbulb,
    gradient: 'from-purple-500 via-indigo-500 to-purple-600',
    bgGradient: 'from-purple-50 to-indigo-50',
    border: 'border-purple-200',
    titleColor: 'text-purple-800',
    bulletColor: 'text-purple-500',
    boldColor: 'text-purple-900',
  },
  'default': {
    icon: null,
    gradient: 'from-slate-500 to-slate-600',
    bgGradient: 'from-slate-50 to-slate-100',
    border: 'border-slate-200',
    titleColor: 'text-slate-800',
    bulletColor: 'text-slate-500',
    boldColor: 'text-slate-900',
  },
};

// Metric configurations for detection and display
const metricConfigs = [
  {
    key: 'gpApptOrOCPerDayPct',
    label: 'GP + OC per Day',
    unit: '%',
    higherIsBetter: true,
    keywords: ['gp appointment', 'gp appt', 'appointment rate', 'appointments per', 'medical oc', 'online consultation', 'patient contact'],
  },
  {
    key: 'sameDayPct',
    label: 'Same-Day Appts',
    unit: '%',
    higherIsBetter: true,
    keywords: ['same-day', 'same day', 'acute access', 'urgent appointment', 'on-the-day'],
  },
  {
    key: 'dnaRate',
    label: 'DNA Rate',
    unit: '%',
    higherIsBetter: false,
    keywords: ['dna', 'did not attend', 'no-show', 'missed appointment', 'attendance'],
  },
  {
    key: 'missedCallPct',
    label: 'Missed Call Rate',
    unit: '%',
    higherIsBetter: false,
    keywords: ['missed call', 'unanswered call', 'telephony', 'call answer', 'phone'],
  },
  {
    key: 'gpPerThousand',
    label: 'GPs per 1000',
    unit: '',
    higherIsBetter: true,
    keywords: ['gp per', 'workforce', 'staffing', 'fte', 'wte', 'capacity', 'gp ratio', 'clinician'],
  },
];

// Detect which metrics are mentioned in the section content
const detectMentionedMetrics = (contentLines, metrics, percentiles) => {
  if (!metrics || !percentiles) return [];

  // Combine all text content for searching
  const fullText = contentLines.map(c => c.line).join(' ').toLowerCase();

  const mentioned = [];
  for (const config of metricConfigs) {
    // Check if metric has valid data
    const value = metrics[config.key];
    const pctl = percentiles[`${config.key}Pctl`];
    if (value == null || isNaN(value) || pctl == null || isNaN(pctl)) continue;

    // Check if any keyword is mentioned in the content
    const isFound = config.keywords.some(keyword => fullText.includes(keyword));
    if (isFound) {
      mentioned.push({
        ...config,
        value,
        percentile: pctl,
      });
    }
  }

  return mentioned;
};

// Detect which theme to use based on section heading
const detectSectionTheme = (heading) => {
  const lower = heading.toLowerCase();
  if (lower.includes('working well') || lower.includes('strengths') || lower.includes('positive')) {
    return 'working';
  }
  if (lower.includes('improvement') || lower.includes('concerns') || lower.includes('challenges')) {
    return 'improvement';
  }
  if (lower.includes('action') || lower.includes('consideration') || lower.includes('recommendation')) {
    return 'actions';
  }
  return 'default';
};

// Inline gauge display for contextual metrics
const ContextualGauges = ({ mentionedMetrics }) => {
  if (!mentionedMetrics || mentionedMetrics.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/50">
      <p className="text-xs text-slate-500 mb-2 font-medium">Related metrics:</p>
      <div className="flex flex-wrap gap-2">
        {mentionedMetrics.map(metric => (
          <PercentileGauge
            key={metric.key}
            value={metric.value}
            percentile={metric.percentile}
            label={metric.label}
            unit={metric.unit}
            higherIsBetter={metric.higherIsBetter}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
};

// Themed section wrapper component
const ThemedSection = ({ title, children, theme, mentionedMetrics }) => {
  const config = sectionThemes[theme] || sectionThemes.default;
  const Icon = config.icon;

  return (
    <div className={`relative overflow-hidden rounded-xl border ${config.border} bg-gradient-to-br ${config.bgGradient} mb-6`}>
      {/* Header with gradient bar */}
      <div className={`relative flex items-center gap-3 px-4 py-3 border-b ${config.border}`}>
        <div className={`relative p-2 rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg`}>
          {/* Icon glow effect */}
          <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${config.gradient} blur-md opacity-50`} />
          {Icon && <Icon className="relative text-white" size={18} />}
        </div>
        <h3 className={`text-lg font-bold ${config.titleColor}`}>{title}</h3>
      </div>

      {/* Content */}
      <div className="relative px-4 py-4">
        {children}
        <ContextualGauges mentionedMetrics={mentionedMetrics} />
      </div>
    </div>
  );
};

// Simple markdown renderer for AI-generated analysis text
// Supports themed sections, bullet points, bold text, and contextual metric gauges
const SimpleMarkdown = ({ text, metrics, percentiles }) => {
  if (!text) return null;

  // Parse bold text within a line
  const parseBold = (line, boldColor = 'text-indigo-900') => {
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
        const clean = part.replace(/^[*]+|[*]+$/g, '');
        return <strong key={i} className={`font-bold ${boldColor}`}>{clean}</strong>;
      }
      return part;
    });
  };

  // Split text into sections based on headings
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let currentContent = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Bullet points are NEVER section headers - they're content
    const isBulletPoint = trimmed.startsWith('* ') || trimmed.startsWith('- ');

    // Check if this is a section heading (starts with # or is a known section title on its own line)
    const isHashHeading = trimmed.startsWith('##') || trimmed.startsWith('#');
    const cleanText = trimmed.replace(/^#+\s*/, '');

    // Only detect as section if it's NOT a bullet point and matches known section patterns
    // Section titles are typically short standalone lines like "Whats working well" or "Room for improvement"
    const isKnownSection = !isBulletPoint &&
                           cleanText.length < 50 &&
                           detectSectionTheme(cleanText) !== 'default';

    if (isHashHeading || isKnownSection) {
      // Save previous section if exists
      if (currentSection !== null || currentContent.length > 0) {
        sections.push({
          title: currentSection,
          theme: currentSection ? detectSectionTheme(currentSection) : 'default',
          content: [...currentContent],
        });
      }
      // Start new section
      currentSection = cleanText;
      currentContent = [];
    } else {
      currentContent.push({ line: trimmed, index });
    }
  });

  // Don't forget the last section
  if (currentSection !== null || currentContent.length > 0) {
    sections.push({
      title: currentSection,
      theme: currentSection ? detectSectionTheme(currentSection) : 'default',
      content: currentContent,
    });
  }

  // Track which metrics have been shown to avoid duplicates
  const shownMetrics = new Set();

  // Render sections
  return (
    <div className="space-y-4">
      {sections.map((section, sectionIndex) => {
        const theme = sectionThemes[section.theme] || sectionThemes.default;

        // Detect metrics mentioned in this section (only for themed sections, not default/preamble)
        let mentionedMetrics = [];
        if (section.theme !== 'default' && metrics && percentiles) {
          mentionedMetrics = detectMentionedMetrics(section.content, metrics, percentiles)
            .filter(m => !shownMetrics.has(m.key)); // Exclude already shown

          // Mark these as shown
          mentionedMetrics.forEach(m => shownMetrics.add(m.key));
        }

        const contentElements = section.content.map(({ line, index }) => {
          if (line.startsWith('* ') || line.startsWith('- ')) {
            return (
              <div key={index} className="flex items-start gap-2 ml-2 mb-2">
                <span className={`${theme.bulletColor} mt-1.5 font-bold`}>•</span>
                <p className="flex-1 text-slate-700">{parseBold(line.replace(/^[*-]\s*/, ''), theme.boldColor)}</p>
              </div>
            );
          }
          return (
            <p key={index} className="leading-relaxed text-slate-700 mb-2">
              {parseBold(line, theme.boldColor)}
            </p>
          );
        });

        // If this section has a title, wrap it in themed container
        if (section.title) {
          return (
            <ThemedSection
              key={sectionIndex}
              title={section.title}
              theme={section.theme}
              mentionedMetrics={mentionedMetrics}
            >
              {contentElements}
            </ThemedSection>
          );
        }

        // Content without a section header (preamble text)
        return (
          <div key={sectionIndex} className="space-y-2 text-slate-700 mb-4">
            {contentElements}
          </div>
        );
      })}
    </div>
  );
};

export default SimpleMarkdown;
