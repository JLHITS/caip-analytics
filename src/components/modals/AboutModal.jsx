import React from 'react';
import { Info, X, ExternalLink } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';

// About modal - displays information about CAIP.app
const AboutModal = ({ isOpen, onClose, onOpenBugReport }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <Info className="text-blue-500" size={28} />
          <h3 className="text-xl font-bold text-slate-800">About CAIP.app</h3>
        </div>

        <div className="space-y-4 text-slate-700 leading-relaxed">
          <p>
            CAIP.app was developed as part of the Capacity & Access improvement programme in{' '}
            <a
              href="https://www.rushcliffehealth.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              Rushcliffe PCN
              <ExternalLink size={14} />
            </a>{' '}
            and{' '}
            <a
              href="https://www.nottinghamwestpcn.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
            >
              Nottingham West PCN
              <ExternalLink size={14} />
            </a>{' '}
            by Jason Gomez & Dr Jamie Coleman.
          </p>

          <p>
            It is a tool that practices can use to provide analytics and data presentations of your local clinical system data,
            rather than unreliable national data sets for access metrics.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">Supported Platforms:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-900">
              <li>TPP SystmOne</li>
              <li>SystmConnect</li>
              <li>X-on Surgery Connect</li>
            </ul>
          </div>

          <p>
            If you wish to provide data extracts of other systems to help in the development of this app, please use the{' '}
            <button
              onClick={() => {
                onClose();
                onOpenBugReport();
              }}
              className="text-blue-600 hover:text-blue-700 font-medium underline"
            >
              report a bug
            </button>{' '}
            function to provide feedback.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-amber-900">
              <strong>Please note:</strong> This tool is for decision support only and does not constitute clinical advice.
              Data processing happens locally in your browser and no data is stored on our servers. However, AI analysis
              (if used) sends anonymized statistical data to third-party services (raw numbers with context descriptions).
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-white font-bold rounded-lg transition-colors shadow-sm"
            style={{ backgroundColor: NHS_BLUE }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
