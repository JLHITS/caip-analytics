import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone } from 'lucide-react';
import { listActiveNews } from '../../utils/newsStorage';

const CYCLE_INTERVAL = 8000; // 8 seconds

export default function Noticeboard() {
  const [items, setItems] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listActiveNews()
      .then(data => { if (mounted) { setItems(data); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Auto-cycle
  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % items.length);
    }, CYCLE_INTERVAL);
    return () => clearInterval(timer);
  }, [items.length]);

  const goTo = useCallback((index) => {
    setCurrent(index);
  }, []);

  if (loading || items.length === 0) return null;

  const item = items[current];

  return (
    <div className="relative overflow-hidden mt-8 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200/70 rounded-2xl shadow-sm hover:shadow-md transition-all">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-200/30 to-transparent rounded-bl-full" />
      <div className="relative px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 p-1.5 bg-amber-200/60 rounded-lg">
            <Megaphone size={16} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-amber-900 leading-tight">{item.headline}</h4>
            <p className="text-xs text-amber-800/80 mt-1 leading-relaxed">{item.body}</p>
          </div>
        </div>

        {/* Dot indicators */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all ${
                  i === current
                    ? 'w-5 h-1.5 bg-amber-500'
                    : 'w-1.5 h-1.5 bg-amber-300 hover:bg-amber-400'
                }`}
                aria-label={`News item ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
