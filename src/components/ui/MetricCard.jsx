import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import Card from './Card';

// Display metric with icon, value, and optional subtext
// Used for key performance indicators on dashboard
const MetricCard = ({ title, value, subtext, icon: Icon, color = 'text-slate-700', info, className = '' }) => {
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = (event) => {
      if (infoRef.current && !infoRef.current.contains(event.target)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  return (
    <Card className={`flex flex-col justify-between h-full ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider break-words leading-tight">{title}</p>
            {info && (
              <div ref={infoRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInfo(!showInfo)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Show metric description"
                >
                  <Info size={14} />
                </button>
                {showInfo && (
                  <div className="fixed z-[9999] w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl"
                    style={{
                      top: infoRef.current?.getBoundingClientRect().top - 8 + 'px',
                      left: Math.min(infoRef.current?.getBoundingClientRect().left || 0, window.innerWidth - 300) + 'px',
                      transform: 'translateY(-100%)'
                    }}
                  >
                    {info}
                  </div>
                )}
              </div>
            )}
          </div>
          <h3 className={`text-2xl font-bold mt-1 ${color}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-xl bg-slate-50 shrink-0 max-w-12 ${color}`}>
          {Icon && <Icon size={24} />}
        </div>
      </div>
      {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </Card>
  );
};

export default MetricCard;
