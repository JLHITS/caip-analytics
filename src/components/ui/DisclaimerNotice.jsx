import React from 'react';
import { AlertCircle } from 'lucide-react';

// Data processing disclaimer shown before dashboard generation
// Informs users about local processing and third-party AI services
const DisclaimerNotice = () => {
  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
      <div className="text-sm text-blue-900">
        <p className="font-medium mb-1">Important Information</p>
        <p>
          By generating the dashboard, I understand that this tool is for decision support only and does not constitute clinical advice.
          Data processing happens locally in your browser, but AI analysis (if used) sends anonymized statistical data to third-party services.
        </p>
      </div>
    </div>
  );
};

export default DisclaimerNotice;
