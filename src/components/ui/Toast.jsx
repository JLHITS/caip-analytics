import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

/**
 * Toast notification component
 * @param {Object} props
 * @param {string} props.type - 'success' or 'error'
 * @param {string} props.message - Message to display
 * @param {Function} props.onClose - Callback when toast is closed
 * @param {number} props.duration - Auto-dismiss duration in ms (default 3000)
 */
const Toast = ({ type = 'success', message, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-green-50' : 'bg-red-50';
  const borderColor = isSuccess ? 'border-green-200' : 'border-red-200';
  const textColor = isSuccess ? 'text-green-800' : 'text-red-800';
  const iconColor = isSuccess ? 'text-green-600' : 'text-red-600';

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-5 duration-300"
      role="alert"
    >
      <div className={`flex items-start gap-3 ${bgColor} ${borderColor} border rounded-lg shadow-lg p-4 max-w-md`}>
        <div className={iconColor}>
          {isSuccess ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
        </div>
        <div className={`flex-1 ${textColor} text-sm font-medium leading-relaxed`}>
          {message}
        </div>
        <button
          onClick={onClose}
          className={`${textColor} hover:opacity-70 transition-opacity flex-shrink-0`}
          aria-label="Close notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
