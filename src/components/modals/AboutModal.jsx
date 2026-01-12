import React, { useState } from 'react';
import { Info, X, ExternalLink, Clock, Lock } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { NHS_BLUE } from '../../constants/colors';

// About modal - displays information about CAIP.app
const AboutModal = ({ isOpen, onClose, onOpenBugReport, timesUsed = 0 }) => {
  if (!isOpen) return null;
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminPractices, setAdminPractices] = useState([]);

  const configuredPassword = (import.meta && import.meta.env && (import.meta.env.VITE_ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD)) || '';

  const openAdminPrompt = () => {
    setAdminPassword('');
    setAdminError('');
    setShowAdminPrompt(true);
  };

  const closeAdminPrompt = () => {
    setShowAdminPrompt(false);
    setAdminError('');
  };

  const fetchPracticeUsage = async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const snapshot = await getDocs(collection(db, 'practiceUsage'));
      const practices = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      practices.sort((a, b) => (a.gpName || '').localeCompare(b.gpName || ''));
      setAdminPractices(practices);
    } catch (error) {
      const message = String(error?.message || '');
      if (error?.code === 'permission-denied' || /missing or insufficient permissions/i.test(message)) {
        setAdminError('Practice usage list blocked by Firestore rules. Allow read access for practiceUsage.');
      } else {
        setAdminError('Failed to load practice usage list.');
      }
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!configuredPassword) {
      setAdminError('Admin password not configured.');
      return;
    }
    if (adminPassword !== configuredPassword) {
      setAdminError('Incorrect password.');
      return;
    }
    setAdminError('');
    setAdminAuthed(true);
    setShowAdminPrompt(false);
    await fetchPracticeUsage();
  };

  const handleExportTxt = () => {
    const lines = adminPractices.map(practice => [
      practice.gpName || 'Unknown Practice',
      practice.odsCode || practice.id || '',
      practice.pcnName || '',
      practice.icbName || ''
    ].join('\t'));
    const content = ['Practice Name\tODS Code\tPCN\tICB', ...lines].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'caip-practice-usage.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <div className="p-3 bg-white rounded-full border border-blue-100">
              <Clock className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-blue-700 font-semibold">Times used across National Data tabs</p>
              <button
                type="button"
                onClick={openAdminPrompt}
                className="text-2xl font-bold text-blue-900 hover:text-blue-700 transition-colors"
                title="Admin access"
              >
                {Number(timesUsed || 0).toLocaleString()}
              </button>
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

        {showAdminPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-full max-w-xs">
              <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <Lock size={14} />
                Admin Access
              </h4>
              <form onSubmit={handleAdminSubmit} className="space-y-3">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {adminError && (
                  <p className="text-xs text-red-600">{adminError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAdminPrompt}
                    className="text-sm text-slate-600 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {adminAuthed && (
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Practice Usage List</h4>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchPracticeUsage}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleExportTxt}
                  disabled={adminPractices.length === 0}
                  className={`text-xs font-semibold ${adminPractices.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Export .txt
                </button>
              </div>
            </div>
            {adminLoading ? (
              <p className="text-sm text-slate-500">Loading practices...</p>
            ) : adminError ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {adminError}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="text-left px-3 py-2">Practice</th>
                      <th className="text-left px-3 py-2">ODS</th>
                      <th className="text-left px-3 py-2">PCN</th>
                      <th className="text-left px-3 py-2">ICB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPractices.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-3 text-slate-500 text-center">
                          No practice usage recorded yet.
                        </td>
                      </tr>
                    )}
                    {adminPractices.map((practice) => (
                      <tr key={practice.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-800">{practice.gpName || 'Unknown Practice'}</td>
                        <td className="px-3 py-2 text-slate-600">{practice.odsCode || practice.id}</td>
                        <td className="px-3 py-2 text-slate-600">{practice.pcnName || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{practice.icbName || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AboutModal;
