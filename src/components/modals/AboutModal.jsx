import React from 'react';
import { Info, X, ExternalLink, Clock, Coffee, Shield, Sparkles } from 'lucide-react';
import { trackCoffeeClick } from '../../firebase/config';
import { NHS_BLUE } from '../../constants/colors';

const AboutModal = ({ isOpen, onClose, onOpenBugReport, onOpenAdmin, timesUsed = 0, caipAnalysisCount = 0 }) => {
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <div className="p-3 bg-white rounded-full border border-blue-100">
                <Clock className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-semibold">Times used across National Data tabs</p>
                <p className="text-2xl font-bold text-blue-900">
                  {Number(timesUsed || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
              <div className="p-3 bg-white rounded-full border border-purple-100">
                <Sparkles className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-purple-700 font-semibold">CAIP AI Analyses run</p>
                <p className="text-2xl font-bold text-purple-900">
                  {Number(caipAnalysisCount || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

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
            It is a tool that practice can use to provide data analytics and presentations of your local clinical system data,
            or nationally available data provided by NHS England. This app is completely free to use.
          </p>

{/* Hidden for now - set to true to re-enable */}
          {false && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
            <div className="p-3 bg-white rounded-full border border-yellow-100">
              <Coffee className="text-yellow-600" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-yellow-800 font-semibold">Support the project</p>
              <p className="text-xs text-yellow-700 mt-0.5">If you find CAIP.app useful, consider buying me a coffee!</p>
            </div>
            <a
              href="https://buymeacoffee.com/jgomez"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#FFDD00] hover:bg-[#ffce00] text-slate-900 text-sm font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2"
              onClick={() => trackCoffeeClick('about_modal')}
            >
              <Coffee size={16} />
              Buy me a coffee
            </a>
          </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">Supported platforms for LOCAL data demand and capacity analysis</p>
            <ul className="list-disc list-inside space-y-1 text-blue-900">
              <li>TPP SystmOne</li>
              <li>SystmConnect</li>
              <li>X-on Surgery Connect</li>
            </ul>
            <p className="text-sm text-blue-800 mt-3">
              All systems are supported for the National Data Extracts tab as it relies on NHS England data.
            </p>
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

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => {
              onClose();
              if (onOpenAdmin) onOpenAdmin();
            }}
            className="text-xs text-slate-300 hover:text-slate-500 transition-colors flex items-center gap-1"
          >
            <Shield size={10} />
            Admin
          </button>
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
