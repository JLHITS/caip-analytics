import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import Card from './Card';

// Display metric with icon, value, and optional subtext
// Used for key performance indicators on dashboard
const MetricCard = ({ title, value, subtext, icon: Icon, color = 'text-slate-700', info, className = '' }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, positionAbove: true });
  const infoRef = useRef(null);
  const tooltipRef = useRef(null);

  const calculatePosition = useCallback(() => {
    if (!infoRef.current) return;
    const rect = infoRef.current.getBoundingClientRect();
    const tooltipHeight = 100; // Approximate tooltip height
    const spaceAbove = rect.top;
    const positionAbove = spaceAbove > tooltipHeight + 16;

    setTooltipPosition({
      top: positionAbove ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 300),
      positionAbove
    });
  }, []);

  useEffect(() => {
    if (!showInfo) return;
    calculatePosition();
    const handleClickOutside = (event) => {
      if (infoRef.current && !infoRef.current.contains(event.target) &&
          tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setShowInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', calculatePosition, true);
    window.addEventListener('resize', calculatePosition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [showInfo, calculatePosition]);

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
                  <div
                    ref={tooltipRef}
                    className="fixed z-[9999] w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl"
                    style={{
                      top: tooltipPosition.top + 'px',
                      left: tooltipPosition.left + 'px',
                      transform: tooltipPosition.positionAbove ? 'translateY(-100%)' : 'none'
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
