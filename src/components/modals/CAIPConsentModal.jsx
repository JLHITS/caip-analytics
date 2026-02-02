import React from 'react';
import { AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';

/**
 * CAIP Analysis Consent Modal
 *
 * Displays privacy notice before running AI analysis on national data.
 * Includes beta testing notice and link to feedback form.
 */
const CAIPConsentModal = ({ isOpen, onClose, onProceed, onOpenFeedback, practiceName }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient background */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">CAIP Analysis</h3>
            <p className="text-sm text-slate-500">AI-Powered Demand & Capacity Analysis</p>
          </div>
        </div>

        {/* Beta notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Beta Testing</p>
              <p className="text-amber-700">
                This feature is currently in beta testing. Analysis quality may vary and should be validated by clinical leads.
              </p>
            </div>
          </div>
        </div>

        {/* Practice info */}
        {practiceName && (
          <p className="text-sm text-slate-600 mb-3">
            Analysing: <strong>{practiceName}</strong>
          </p>
        )}

        {/* Privacy notice */}
        <div className="text-slate-600 mb-4 leading-relaxed text-sm space-y-2">
          <p>
            Clicking 'Proceed' will send <strong>anonymized practice metrics</strong> to{' '}
            <strong>Google AI (Gemini)</strong> for analysis. This includes:
          </p>
          <ul className="list-disc list-inside ml-2 text-slate-500">
            <li>Appointment, telephony, and online consultation statistics</li>
            <li>National percentile benchmarks</li>
            <li>Trend data over time</li>
          </ul>
          <p className="text-slate-500">
            <strong>No patient-identifiable information</strong> is included in the analysis.
          </p>
        </div>

        {/* Rate limiting notice */}
        <p className="text-xs text-slate-400 mb-4">
          Analysis results are saved and reused for 30 days to reduce API usage.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              className="px-5 py-2.5 text-white font-bold rounded-lg transition-all shadow-sm
                bg-gradient-to-r from-purple-600 to-indigo-600
                hover:from-purple-700 hover:to-indigo-700"
            >
              I Understand, Proceed
            </button>
          </div>

          {/* Feedback link */}
          {onOpenFeedback && (
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  onClose();
                  onOpenFeedback();
                }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
              >
                <ExternalLink size={12} />
                Have feedback about CAIP Analysis? Let us know
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CAIPConsentModal;
