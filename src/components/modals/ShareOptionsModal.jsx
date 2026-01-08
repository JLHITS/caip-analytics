import React from 'react';
import { Share2, Download, Link2, Loader2, ChevronDown } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';

/**
 * Share options dropdown modal
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dropdown is open
 * @param {Function} props.onClose - Close dropdown
 * @param {Function} props.onExportExcel - Handler for Excel export
 * @param {Function} props.onGenerateLink - Handler for Firebase share link
 * @param {boolean} props.excelLoading - Loading state for Excel export
 * @param {boolean} props.linkLoading - Loading state for link generation
 */
const ShareOptionsModal = ({
  isOpen,
  onClose,
  onExportExcel,
  onGenerateLink,
  excelLoading = false,
  linkLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-lg shadow-xl border border-slate-200 min-w-[320px] animate-in slide-in-from-top-2 duration-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-slate-600" />
            <span className="font-semibold text-slate-700">Share Dashboard</span>
          </div>
        </div>

        {/* Options */}
        <div className="p-2">
          {/* Export to Excel */}
          <button
            onClick={onExportExcel}
            disabled={excelLoading || linkLoading}
            className="w-full flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex-shrink-0 mt-0.5">
              {excelLoading ? (
                <Loader2 size={20} className="text-blue-600 animate-spin" />
              ) : (
                <Download size={20} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-800 mb-0.5">Export to Excel</div>
              <div className="text-xs text-slate-500 leading-relaxed">
                Download .xlsx file for offline sharing and analysis
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="h-px bg-slate-100 my-2" />

          {/* Generate Share Link */}
          <button
            onClick={onGenerateLink}
            disabled={excelLoading || linkLoading}
            className="w-full flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex-shrink-0 mt-0.5">
              {linkLoading ? (
                <Loader2 size={20} className="text-blue-600 animate-spin" />
              ) : (
                <Link2 size={20} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-800 mb-0.5">Generate Share Link</div>
              <div className="text-xs text-slate-500 leading-relaxed">
                Create URL with 30-day expiry (max 900KB)
              </div>
            </div>
          </button>
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500 rounded-b-lg border-t border-slate-100">
          Excel files can be re-imported to restore the interactive dashboard
        </div>
      </div>
    </>
  );
};

export default ShareOptionsModal;
