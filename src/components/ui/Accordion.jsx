import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

// Collapsible section component with animated expand/collapse
// Used for organizing content into expandable sections
const Accordion = ({ title, children, defaultOpen = false, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon size={20} className="text-slate-500" />}
          <span className="font-bold text-slate-700">{title}</span>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
