import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';

// Privacy consent dialog before AI analysis
// Ensures users understand data is sent to OpenAI for processing
const AIConsentModal = ({ isOpen, onClose, onProceed }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-amber-500" size={28} />
          <h3 className="text-xl font-bold text-slate-800">AI Analysis Privacy Notice</h3>
        </div>
        <p className="text-slate-600 mb-6 leading-relaxed">
          Clicking 'Proceed' will send <strong>anonymized statistical data</strong> from your dashboard to <strong>OpenAI</strong> for analysis.
          No patient-identifiable information is included. The analysis will generate insights about practice performance.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="px-5 py-2.5 text-white font-bold rounded-lg transition-colors shadow-sm"
            style={{ backgroundColor: NHS_BLUE }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            I Understand, Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConsentModal;
