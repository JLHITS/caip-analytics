import React from 'react';
import { Sparkles, XCircle } from 'lucide-react';
import dataProcessingImage from '../../assets/dataprocessing.png';

// Info modal explaining data processing workflow
// Displays workflow diagram showing how data flows through the system
const DataProcessingModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-blue-600" size={20} />
            Data Processing Workflow
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 bg-slate-50 flex justify-center">
          <img src={dataProcessingImage} alt="Data Processing Workflow" className="rounded-xl shadow-sm border border-slate-200 max-w-full h-auto" />
        </div>
      </div>
    </div>
  );
};

export default DataProcessingModal;
