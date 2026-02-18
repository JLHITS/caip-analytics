import React from 'react';
import { XCircle, FileSpreadsheet, Shield, Cpu, HardDrive, Brain, BarChart3, ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';

const steps = [
  {
    number: 1,
    title: 'Local Data Selection',
    description: 'You select your files from your computer. Data never leaves your device at this stage.',
    icon: FileSpreadsheet,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    details: ['CSV & PDF Files', 'Stays on your device'],
  },
  {
    number: 2,
    title: 'Privacy Guardrail',
    description: 'Instant scan. Blocks files containing personal identifiers (e.g., names) before processing.',
    icon: Shield,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    details: ['Blocks patient names', 'Automated scanning'],
  },
  {
    number: 3,
    title: 'In-Browser Processing',
    description: 'All number-crunching happens INSTANTLY within your web browser\'s memory. No file uploads to external servers.',
    icon: Cpu,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    details: ['100% local execution', 'No server uploads'],
    highlight: true,
  },
  {
    number: 4,
    title: 'Temporary Memory (RAM)',
    description: 'Data lives ONLY in your browser\'s temporary memory while the tab is active. It is volatile and not saved to disk.',
    icon: HardDrive,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    details: ['RAM only', 'Not saved to disk'],
  },
  {
    number: 5,
    title: 'Anonymous AI Insights',
    description: 'Only aggregated, anonymous summary totals are sent to the AI for insight generation. No raw data or identifiers are ever shared.',
    icon: Brain,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    details: ['Summary stats only', 'NOT original files'],
    optional: true,
  },
  {
    number: 6,
    title: 'Visualisation & Export',
    description: 'Your interactive dashboard and PDF reports are generated locally for you to view and save directly to your computer.',
    icon: BarChart3,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    details: ['Local dashboard', 'PDF export'],
  },
];

const DataProcessingModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Lock className="text-blue-600" size={20} />
              Secure Data Processing Workflow
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Applies to <span className="font-semibold text-blue-600">Local Data</span> options only</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Subtitle */}
        <div className="px-6 pt-5 pb-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-800 font-medium">
              Your data's journey: Compliant, Private, and processed 100% locally on your device.
            </p>
            <p className="text-xs text-blue-600 mt-1">No data is ever stored by us.</p>
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative">
                  <div
                    className={`rounded-xl border p-4 h-full ${
                      step.highlight
                        ? 'border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200'
                        : step.optional
                        ? 'border-purple-200 bg-purple-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Step number badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg ${step.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={20} className={step.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">STEP {step.number}</span>
                          {step.optional && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
                              OPTIONAL
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{step.title}</h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      {step.description}
                    </p>

                    {/* Detail tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {step.details.map((detail) => (
                        <span
                          key={detail}
                          className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full"
                        >
                          {detail}
                        </span>
                      ))}
                    </div>

                    {/* Highlight badge for step 3 */}
                    {step.highlight && (
                      <div className="mt-3 text-center">
                        <span className="text-[10px] font-bold px-2 py-1 bg-indigo-600 text-white rounded-full uppercase tracking-wider">
                          100% Local Execution
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Arrow between cards on large screens */}
                  {index < steps.length - 1 && index !== 2 && (
                    <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight size={16} className="text-slate-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Privacy Summary */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <EyeOff size={16} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-green-800">No Data Stored</p>
                <p className="text-[10px] text-green-600">Everything stays in browser memory</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Lock size={16} className="text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-800">100% Local Processing</p>
                <p className="text-[10px] text-blue-600">No server-side computation</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Eye size={16} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">AI Sees Totals Only</p>
                <p className="text-[10px] text-amber-600">Anonymous aggregated statistics</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataProcessingModal;
