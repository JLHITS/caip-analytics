import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import Card from './Card';

// Display metric with icon, value, and optional subtext
// Used for key performance indicators on dashboard
const MetricCard = ({ title, value, subtext, icon: Icon, color = 'text-slate-700', info }) => {
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
    <Card className="flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-start gap-1.5">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            {info && (
              <div ref={infoRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowInfo(!showInfo)}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Show metric description"
                >
                  <Info size={14} />
                </button>
                {showInfo && (
                  <div className="absolute left-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-lg">
                    {info}
                  </div>
                )}
              </div>
            )}
          </div>
          <h3 className={`text-2xl font-bold mt-1 ${color}`}>{value}</h3>
        </div>
        <div className={`p-3 rounded-xl bg-slate-50 ${color}`}>
          {Icon && <Icon size={24} />}
        </div>
      </div>
      {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </Card>
  );
};

export default MetricCard;
