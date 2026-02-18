import React, { useMemo } from 'react';
import { Trophy, ChevronDown } from 'lucide-react';
import Card from './Card';

const PracticeCentricLeaderboard = ({
  rankedItems,
  selectedOdsCode,
  columns,
  windowSize = 10,
  title,
  odsCodeAccessor = 'odsCode',
  colorTheme = 'indigo',
}) => {
  const { displayRows, practiceRank, totalCount } = useMemo(() => {
    if (!rankedItems?.length || !selectedOdsCode) {
      return { displayRows: [], practiceRank: null, totalCount: 0 };
    }

    const total = rankedItems.length;
    const practiceIdx = rankedItems.findIndex(
      (p) => (typeof odsCodeAccessor === 'function' ? odsCodeAccessor(p) : p[odsCodeAccessor]) === selectedOdsCode
    );
    const rank = practiceIdx >= 0 ? practiceIdx + 1 : null;

    if (rank === null) {
      // Practice not found in ranking - just show top entries
      return {
        displayRows: rankedItems.slice(0, 5).map((item, i) => ({ item, rank: i + 1, type: 'normal' })),
        practiceRank: null,
        totalCount: total,
      };
    }

    const rows = [];

    // Always show #1
    rows.push({ item: rankedItems[0], rank: 1, type: 'top' });

    // Calculate window around practice
    const halfWindow = Math.floor(windowSize / 2);
    const windowStart = Math.max(1, practiceIdx - halfWindow);
    const windowEnd = Math.min(total, practiceIdx + halfWindow + 1);

    if (rank <= windowSize + 1) {
      // Practice is near the top - show continuous range from #2
      for (let i = 1; i < Math.max(windowEnd, rank + halfWindow); i++) {
        if (i < total) {
          rows.push({
            item: rankedItems[i],
            rank: i + 1,
            type: i === practiceIdx ? 'selected' : 'normal',
          });
        }
      }
    } else {
      // Practice is further down - show gap then window
      rows.push({ type: 'gap', gapSize: windowStart - 1 });

      for (let i = windowStart; i < windowEnd; i++) {
        if (i < total) {
          rows.push({
            item: rankedItems[i],
            rank: i + 1,
            type: i === practiceIdx ? 'selected' : 'normal',
          });
        }
      }

      // Show trailing gap if not at bottom
      if (windowEnd < total) {
        rows.push({ type: 'gap', gapSize: total - windowEnd });
      }
    }

    return { displayRows: rows, practiceRank: rank, totalCount: total };
  }, [rankedItems, selectedOdsCode, windowSize, odsCodeAccessor]);

  if (!rankedItems?.length) return null;

  const themeColors = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', header: 'bg-indigo-100', selected: 'bg-indigo-100 border-l-4 border-l-indigo-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', header: 'bg-blue-100', selected: 'bg-blue-100 border-l-4 border-l-blue-500' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', header: 'bg-green-100', selected: 'bg-green-100 border-l-4 border-l-green-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', header: 'bg-amber-100', selected: 'bg-amber-100 border-l-4 border-l-amber-500' },
  };
  const theme = themeColors[colorTheme] || themeColors.indigo;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Trophy size={18} className={theme.text} />
          {title}
        </h3>
        {practiceRank && (
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${theme.bg} ${theme.text}`}>
            Your rank: #{practiceRank} / {totalCount}
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden sm:rounded-lg">
            <table className="min-w-full text-sm">
              <thead className={`${theme.header} border-b-2 ${theme.border}`}>
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-700 w-16">Rank</th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`p-3 font-semibold text-slate-700 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, idx) => {
                  if (row.type === 'gap') {
                    return (
                      <tr key={`gap-${idx}`}>
                        <td colSpan={columns.length + 1} className="py-2 px-3">
                          <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                            <ChevronDown size={14} />
                            <span>{row.gapSize} practices</span>
                            <ChevronDown size={14} />
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const isTop = row.type === 'top';
                  const isSelected = row.type === 'selected';

                  return (
                    <tr
                      key={`row-${row.rank}`}
                      className={`border-b border-slate-100 ${
                        isSelected
                          ? `${theme.selected} font-semibold`
                          : isTop
                          ? 'bg-amber-50/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-medium">
                        {isTop ? (
                          <span className="inline-flex items-center gap-1">
                            <Trophy size={14} className="text-amber-500" />
                            {row.rank}
                          </span>
                        ) : (
                          row.rank
                        )}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`p-3 ${col.align === 'right' ? 'text-right' : ''} ${
                            col.truncate ? 'max-w-[200px] truncate' : ''
                          }`}
                        >
                          {col.render ? col.render(row.item, row.rank) : row.item[col.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PracticeCentricLeaderboard;
