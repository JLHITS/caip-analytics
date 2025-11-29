import React from 'react';
import { Upload, FileText, CheckCircle, Trash2, Plus } from 'lucide-react';

// File upload component with drag-drop support
// Supports both single and multiple file uploads
const FileInput = ({ label, helpText, accept, onChange, file, badge, disabled, onRemove, isMulti }) => {
  const hasFile = isMulti ? (file && file.length > 0) : !!file;

  return (
    <div className={`mb-6 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div className="flex justify-between items-baseline mb-2">
        <label className="block text-sm font-bold text-slate-700">{label}</label>
        {badge && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-semibold">{badge}</span>}
      </div>
      {helpText && <p className="text-xs text-slate-500 mb-3">{helpText}</p>}

      <div className="space-y-3">
        {/* Existing Files Display */}
        {hasFile && (
          <div className="space-y-2">
            {isMulti ? (
              file.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm group hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                      <FileText size={18} />
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{f.name}</span>
                  </div>
                  <button
                    onClick={() => onRemove(idx)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg shadow-sm ring-1 ring-green-500/20">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                    <CheckCircle size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                </div>
                <button
                  onClick={onRemove}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove file"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upload Area - Always show for multi, or if no file for single */}
        {(isMulti || !hasFile) && (
          <label className="block cursor-pointer group">
            <div className={`flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed rounded-xl transition-all ${isMulti && hasFile ? 'border-slate-300 bg-slate-50 hover:bg-white' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
              <input type="file" className="hidden" accept={accept} onChange={onChange} multiple={isMulti} disabled={disabled} />
              <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-blue-600 transition-colors">
                {isMulti && hasFile ? <Plus size={24} /> : <Upload size={24} />}
                <span className="text-sm font-medium">
                  {isMulti && hasFile ? 'Add another file' : 'Click to upload or drag and drop'}
                </span>
                <span className="text-xs text-slate-400">
                  {isMulti ? 'Supports multiple files' : 'Single file upload'}
                </span>
              </div>
            </div>
          </label>
        )}
      </div>
    </div>
  );
};

export default FileInput;
