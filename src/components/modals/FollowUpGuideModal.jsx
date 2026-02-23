import React from 'react';
import { X, Download, ChevronRight, MousePointer2, RefreshCw, Save, FileText, AlertTriangle, HelpCircle } from 'lucide-react';
import rptFileUrl from '../../assets/followup/finishedapptinlast12m.rpt?url';

const FollowUpGuideModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <HelpCircle className="text-emerald-600" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">How to Run the Follow Up Report</h3>
            <p className="text-sm text-slate-500">TPP SystmOne Clinical Reporting - Step by Step Guide</p>
          </div>
        </div>

        {/* Step 0: Download the .rpt file */}
        <div className="mb-8 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl">
          <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
            <Download size={18} />
            First: Import the Report Template
          </h4>
          <p className="text-sm text-emerald-700 mb-3">
            Download the .rpt file below and import it into TPP SystmOne Clinical Reporting.
            Go to <strong>Clinical Reporting &gt; Reports &gt; Import</strong> and select the downloaded file.
          </p>
          <a
            href={rptFileUrl}
            download="finishedapptinlast12m.rpt"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm"
          >
            <Download size={16} />
            Download Report File (.rpt)
          </a>
        </div>

        {/* Steps */}
        <div className="space-y-8">

          {/* Step 1: Right click > Breakdown Results */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <h4 className="font-bold text-slate-800">Right-click the imported report and press "Breakdown Results"</h4>
            </div>
            {/* Mock UI */}
            <div className="ml-11 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-xs text-slate-500 ml-2">SystmOne - Clinical Reporting</span>
              </div>
              <div className="p-4 bg-white">
                <div className="flex gap-4">
                  {/* Left panel - report tree */}
                  <div className="w-64 border border-slate-200 rounded bg-slate-50 p-2 text-xs">
                    <div className="flex items-center gap-1 py-1 text-slate-500">
                      <ChevronRight size={12} />
                      <span>My Reports</span>
                    </div>
                    <div className="flex items-center gap-1 py-1 pl-4 bg-blue-100 border border-blue-300 rounded text-blue-800 font-medium">
                      <FileText size={12} />
                      <span>Finished Appt in Last 12m</span>
                    </div>
                  </div>
                  {/* Right click context menu */}
                  <div className="border border-slate-300 rounded shadow-lg bg-white text-xs w-48">
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100">Run Report</div>
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100">Edit Report</div>
                    <div className="px-3 py-2 bg-blue-50 text-blue-700 font-bold border-b border-slate-100 flex items-center gap-2">
                      <MousePointer2 size={12} />
                      Breakdown Results
                    </div>
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100">Show Patients</div>
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600">Delete Report</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Expand Appointments > select fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <h4 className="font-bold text-slate-800">Expand "Appointments" and choose Item Count, Appointment Date and Clinician</h4>
            </div>
            {/* Mock UI */}
            <div className="ml-11 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-xs text-slate-500 ml-2">Breakdown Results</span>
              </div>
              <div className="p-4 bg-white">
                <p className="text-xs text-slate-500 mb-3">Select the fields to breakdown by:</p>
                <div className="border border-slate-200 rounded bg-slate-50 p-2 text-xs space-y-0.5 w-72">
                  <div className="flex items-center gap-1 py-1 text-slate-600">
                    <ChevronRight size={12} className="text-slate-400" />
                    <span>Demographics</span>
                  </div>
                  <div className="flex items-center gap-1 py-1 text-slate-800 font-medium">
                    <ChevronRight size={12} className="rotate-90 text-blue-500" />
                    <span>Appointments</span>
                  </div>
                  {/* Expanded children */}
                  <div className="pl-6 space-y-0.5">
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 bg-blue-500 rounded-sm flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span className="text-blue-700 font-medium">Item Count</span>
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 bg-blue-500 rounded-sm flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span className="text-blue-700 font-medium">Appointment Date</span>
                    </div>
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 bg-blue-500 rounded-sm flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span className="text-blue-700 font-medium">Clinician</span>
                    </div>
                    <div className="flex items-center gap-2 py-1 text-slate-500">
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-sm"></div>
                      <span>Appointment Type</span>
                    </div>
                    <div className="flex items-center gap-2 py-1 text-slate-500">
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-sm"></div>
                      <span>Location</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 py-1 text-slate-600">
                    <ChevronRight size={12} className="text-slate-400" />
                    <span>Medications</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Press Refresh */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <h4 className="font-bold text-slate-800">Press "Refresh" to run the report</h4>
            </div>
            {/* Mock UI */}
            <div className="ml-11 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-xs text-slate-500 ml-2">Clinical Reporting - Results</span>
              </div>
              <div className="p-4 bg-white">
                {/* Toolbar */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                  <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded font-medium text-xs shadow-sm hover:bg-blue-700">
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">Export</button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">Print</button>
                </div>
                {/* Results preview */}
                <div className="text-xs">
                  <div className="grid grid-cols-4 gap-px bg-slate-200">
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Clinician</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Appointment Date</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Item Count</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Organisation</div>
                    <div className="bg-white p-2 text-slate-600">Dr Sarah Mitchell</div>
                    <div className="bg-white p-2 text-slate-600">12-Jan-26</div>
                    <div className="bg-white p-2 text-slate-600">1</div>
                    <div className="bg-white p-2 text-slate-600">Example Surgery</div>
                    <div className="bg-slate-50 p-2 text-slate-600">Dr James Wright</div>
                    <div className="bg-slate-50 p-2 text-slate-600">09-Jan-26</div>
                    <div className="bg-slate-50 p-2 text-slate-600">1</div>
                    <div className="bg-slate-50 p-2 text-slate-600">Example Surgery</div>
                    <div className="bg-white p-2 text-slate-400">...</div>
                    <div className="bg-white p-2 text-slate-400">...</div>
                    <div className="bg-white p-2 text-slate-400">...</div>
                    <div className="bg-white p-2 text-slate-400">...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Right click > Show Patients */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
              <h4 className="font-bold text-slate-800">Right-click the report again and choose "Show Patients"</h4>
            </div>
            {/* Mock UI */}
            <div className="ml-11 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-xs text-slate-500 ml-2">SystmOne - Clinical Reporting</span>
              </div>
              <div className="p-4 bg-white">
                <div className="flex gap-4">
                  {/* Left panel */}
                  <div className="w-64 border border-slate-200 rounded bg-slate-50 p-2 text-xs">
                    <div className="flex items-center gap-1 py-1 text-slate-500">
                      <ChevronRight size={12} />
                      <span>My Reports</span>
                    </div>
                    <div className="flex items-center gap-1 py-1 pl-4 bg-blue-100 border border-blue-300 rounded text-blue-800 font-medium">
                      <FileText size={12} />
                      <span>Finished Appt in Last 12m</span>
                    </div>
                  </div>
                  {/* Context menu */}
                  <div className="border border-slate-300 rounded shadow-lg bg-white text-xs w-48">
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100">Run Report</div>
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100">Edit Report</div>
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 border-b border-slate-100">Breakdown Results</div>
                    <div className="px-3 py-2 bg-blue-50 text-blue-700 font-bold border-b border-slate-100 flex items-center gap-2">
                      <MousePointer2 size={12} />
                      Show Patients
                    </div>
                    <div className="px-3 py-1.5 hover:bg-slate-50 text-slate-600">Delete Report</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5: Save all Pages to CSV */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">5</div>
              <h4 className="font-bold text-slate-800">Press "Save all Pages to CSV"</h4>
            </div>
            {/* Mock UI */}
            <div className="ml-11 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-xs text-slate-500 ml-2">Patient List</span>
              </div>
              <div className="p-4 bg-white">
                {/* Toolbar with save button highlighted */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">Print</button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded text-xs border border-slate-200">Save Page</button>
                  <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded font-medium text-xs shadow-sm ring-2 ring-emerald-300 ring-offset-1">
                    <Save size={14} />
                    Save all Pages to CSV
                  </button>
                </div>
                {/* Patient list preview */}
                <div className="text-xs">
                  <div className="grid grid-cols-5 gap-px bg-slate-200">
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Clinician</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Appt Date</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Organisation</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">NHS Number</div>
                    <div className="bg-slate-100 p-2 font-bold text-slate-700">Patient Name</div>
                    <div className="bg-white p-2 text-slate-600">Dr S Mitchell</div>
                    <div className="bg-white p-2 text-slate-600">12-Jan-26</div>
                    <div className="bg-white p-2 text-slate-600">Example Surgery</div>
                    <div className="bg-white p-2 text-slate-600">700 123 4567</div>
                    <div className="bg-white p-2 text-slate-600">Smith, John</div>
                    <div className="bg-slate-50 p-2 text-slate-600">Dr J Wright</div>
                    <div className="bg-slate-50 p-2 text-slate-600">09-Jan-26</div>
                    <div className="bg-slate-50 p-2 text-slate-600">Example Surgery</div>
                    <div className="bg-slate-50 p-2 text-slate-600">700 234 5678</div>
                    <div className="bg-slate-50 p-2 text-slate-600">Jones, Sarah</div>
                  </div>
                  <p className="text-slate-400 mt-2 text-center">Page 1 of 24 | 5,832 patients</p>
                </div>
              </div>
            </div>
            {/* Row limit warning */}
            <div className="ml-11 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-bold mb-1">Hit a row limit error?</p>
                <p>If SystmOne shows a row limit warning, reduce the time frame on the report (e.g. 6 months instead of 12) and run it twice. Upload both CSV files to CAIP.app - they will be merged and deduplicated automatically.</p>
              </div>
            </div>
          </div>

          {/* Step 6: Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">6</div>
              <h4 className="font-bold text-slate-800">Upload the CSV to CAIP.app Follow Up Analysis</h4>
            </div>
            <div className="ml-11 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800">
                Close this guide and use the <strong>Choose CSV File(s)</strong> button to upload your saved CSV.
                You can select multiple files at once if you split the report into smaller timeframes.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            This guide is for TPP SystmOne users. Data is processed locally in your browser.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowUpGuideModal;
