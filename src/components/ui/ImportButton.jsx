import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';

/**
 * Import button for Excel files
 * @param {Object} props
 * @param {Function} props.onImport - Callback with file parameter
 * @param {boolean} props.loading - Loading state
 * @param {string} props.label - Button label (default: "Import Dashboard")
 * @param {string} props.description - Optional description text
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.variant - 'primary' or 'secondary' (default: 'primary')
 */
const ImportButton = ({
  onImport,
  loading = false,
  label = 'Import Dashboard',
  description = 'Import from Excel (.xlsx)',
  disabled = false,
  variant = 'primary',
}) => {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (!loading && !disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  const isPrimary = variant === 'primary';

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className={`
          flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isPrimary
            ? 'text-white shadow-sm hover:opacity-90'
            : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
          }
        `}
        style={isPrimary ? { backgroundColor: NHS_BLUE } : {}}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Upload size={18} />
        )}
        <span>{loading ? 'Importing...' : label}</span>
      </button>
      {description && !loading && (
        <p className="text-xs text-slate-500 mt-2">{description}</p>
      )}
    </div>
  );
};

export default ImportButton;
