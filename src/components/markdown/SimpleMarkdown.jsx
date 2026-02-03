import React from 'react';
import { CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react';

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
    shimmer: 'from-transparent via-emerald-200/30 to-transparent',
  },
  'improvement': {
    icon: AlertTriangle,
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    bgGradient: 'from-amber-50 to-orange-50',
    border: 'border-amber-200',
    titleColor: 'text-amber-800',
    bulletColor: 'text-amber-500',
    boldColor: 'text-amber-900',
    shimmer: 'from-transparent via-amber-200/30 to-transparent',
  },
  'actions': {
    icon: Lightbulb,
    gradient: 'from-purple-500 via-indigo-500 to-purple-600',
    bgGradient: 'from-purple-50 to-indigo-50',
    border: 'border-purple-200',
    titleColor: 'text-purple-800',
    bulletColor: 'text-purple-500',
    boldColor: 'text-purple-900',
    shimmer: 'from-transparent via-purple-200/30 to-transparent',
  },
  'default': {
    icon: null,
    gradient: 'from-slate-500 to-slate-600',
    bgGradient: 'from-slate-50 to-slate-100',
    border: 'border-slate-200',
    titleColor: 'text-slate-800',
    bulletColor: 'text-slate-500',
    boldColor: 'text-slate-900',
    shimmer: 'from-transparent via-slate-200/30 to-transparent',
  },
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

// Themed section wrapper component
const ThemedSection = ({ title, children, theme }) => {
  const config = sectionThemes[theme] || sectionThemes.default;
  const Icon = config.icon;

  return (
    <div className={`relative overflow-hidden rounded-xl border ${config.border} bg-gradient-to-br ${config.bgGradient} mb-6`}>
      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r ${config.shimmer}`} />
      </div>

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
      </div>
    </div>
  );
};

// Simple markdown renderer for AI-generated analysis text
// Supports themed sections, bullet points, and bold text
const SimpleMarkdown = ({ text }) => {
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

    // Check if this is a section heading (starts with # or is a known section title)
    const isHashHeading = trimmed.startsWith('##') || trimmed.startsWith('#');
    const cleanText = trimmed.replace(/^#+\s*/, '');
    const detectedTheme = detectSectionTheme(cleanText);
    const isKnownSection = detectedTheme !== 'default';

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

  // Render sections
  return (
    <div className="space-y-4">
      {/* Add shimmer keyframes via style tag */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {sections.map((section, sectionIndex) => {
        const theme = sectionThemes[section.theme] || sectionThemes.default;

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
            <ThemedSection key={sectionIndex} title={section.title} theme={section.theme}>
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
