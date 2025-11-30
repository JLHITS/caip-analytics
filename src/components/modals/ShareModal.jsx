import React, { useState } from 'react';
import { Share2, Copy, CheckCircle, X } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';

// Share URL modal - displays generated shareable link
// Allows users to copy the URL to share their dashboard
const ShareModal = ({ isOpen, onClose, shareUrl }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !shareUrl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <Share2 className="text-blue-500" size={28} />
          <h3 className="text-xl font-bold text-slate-800">Share Dashboard</h3>
        </div>

        <p className="text-slate-600 mb-4 leading-relaxed">
          Your dashboard has been encoded into a shareable URL. Anyone with this link can view your dashboard data.
          No data is stored on any server - everything is encoded in the URL itself.
        </p>

        <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Shareable Link</p>
            {copied && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle size={14} />
                Copied!
              </span>
            )}
          </div>
          <div className="bg-white rounded border border-slate-300 p-3 font-mono text-sm text-slate-700 break-all max-h-32 overflow-y-auto">
            {shareUrl}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Very long URLs may not work in all browsers or applications. If you encounter issues, try using a URL shortener service.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="px-5 py-2.5 text-white font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2"
            style={{ backgroundColor: NHS_BLUE }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
