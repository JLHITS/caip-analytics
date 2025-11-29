import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Confirmation dialog for resetting all dashboard data
// Prevents accidental data loss by requiring explicit confirmation
const ResetConfirmationModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4 text-amber-600">
          <AlertTriangle size={28} />
          <h3 className="text-xl font-bold text-slate-800">Reset Dashboard?</h3>
        </div>
        <p className="text-slate-600 mb-6">
          Are you sure you want to clear all data and return to the start? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            Yes, Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetConfirmationModal;
