import React from 'react';

// Simple markdown renderer for AI-generated analysis text
// Supports headings (##, ###), bullet points (*, -), and bold text (**)
const SimpleMarkdown = ({ text }) => {
  if (!text) return null;

  const parseBold = (line) => {
    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
        const clean = part.replace(/^[*]+|[*]+$/g, '');
        return <strong key={i} className="font-bold text-indigo-900">{clean}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 text-slate-700">
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
          const cleanText = trimmed.replace(/^#+\s*/, '');
          return <h3 key={index} className="text-lg font-bold text-indigo-800 mt-6 mb-2 border-b border-indigo-100 pb-1">{cleanText}</h3>;
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={index} className="flex items-start gap-2 ml-2">
              <span className="text-indigo-500 mt-1.5">•</span>
              <p className="flex-1">{parseBold(trimmed.replace(/^[*-]\s*/, ''))}</p>
            </div>
          );
        }

        return <p key={index} className="leading-relaxed">{parseBold(trimmed)}</p>;
      })}
    </div>
  );
};

export default SimpleMarkdown;
