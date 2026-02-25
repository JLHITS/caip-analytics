import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Lock, Users, RefreshCw, Download, Shield, AlertTriangle,
  Sparkles, Trash2, Search, AlertCircle, CheckCircle
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  listAllAnalyses,
  deleteAllAnalysesForPractice,
  clearAllAnalyses,
} from '../../utils/caipAnalysisStorage';

const AdminPanel = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState('usage');

  // Practice usage state
  const [practices, setPractices] = useState([]);
  const [practicesLoading, setPracticesLoading] = useState(false);
  const [practicesError, setPracticesError] = useState('');

  // CAIP analyses state
  const [analyses, setAnalyses] = useState([]);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [analysesError, setAnalysesError] = useState('');
  const [deleteSearch, setDeleteSearch] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null); // { type: 'success'|'error', message }
  const [clearingAll, setClearingAll] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const configuredPassword = (import.meta && import.meta.env &&
    (import.meta.env.VITE_ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD)) || '';

  const handleLogin = (e) => {
    e.preventDefault();
    if (!configuredPassword) { setPasswordError('Admin password not configured.'); return; }
    if (password !== configuredPassword) { setPasswordError('Incorrect password.'); return; }
    setAuthed(true);
    setPasswordError('');
    setPassword('');
  };

  const fetchPracticeUsage = useCallback(async () => {
    setPracticesLoading(true);
    setPracticesError('');
    try {
      const snapshot = await getDocs(collection(db, 'practiceUsage'));
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const aTime = a.lastUsed?.toDate?.() || a.lastUsed || 0;
        const bTime = b.lastUsed?.toDate?.() || b.lastUsed || 0;
        return bTime - aTime;
      });
      setPractices(data);
    } catch (error) {
      const msg = String(error?.message || '');
      if (error?.code === 'permission-denied' || /missing or insufficient permissions/i.test(msg)) {
        setPracticesError('Blocked by Firestore rules. Allow read access for practiceUsage.');
      } else {
        setPracticesError('Failed to load practice usage.');
      }
    } finally {
      setPracticesLoading(false);
    }
  }, []);

  const fetchAnalyses = useCallback(async () => {
    setAnalysesLoading(true);
    setAnalysesError('');
    try {
      const data = await listAllAnalyses();
      setAnalyses(data);
    } catch {
      setAnalysesError('Failed to load CAIP analyses.');
    } finally {
      setAnalysesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      fetchPracticeUsage();
      fetchAnalyses();
    }
  }, [authed, fetchPracticeUsage, fetchAnalyses]);

  const handleExportPractices = () => {
    const lines = practices.map(p => [
      p.gpName || 'Unknown',
      p.odsCode || p.id || '',
      p.pcnName || '',
      p.icbName || p.subICBName || '',
      formatTimestamp(p.lastUsed)
    ].join('\t'));
    const content = ['Practice Name\tODS Code\tPCN\tICB\tLast Used', ...lines].join('\n');
    downloadFile(content, 'caip-practice-usage.txt', 'text/plain');
  };

  const handleDeletePracticeAnalyses = async () => {
    const term = deleteSearch.trim();
    if (!term) return;
    setDeleting(true);
    setDeleteResult(null);
    try {
      // Find matching ODS codes in analyses list
      const matched = analyses.filter(a =>
        a.odsCode?.toLowerCase() === term.toLowerCase() ||
        a.practiceName?.toLowerCase().includes(term.toLowerCase())
      );
      if (matched.length === 0) {
        setDeleteResult({ type: 'error', message: `No analyses found for "${term}"` });
        return;
      }
      const odsCode = matched[0].odsCode;
      const count = await deleteAllAnalysesForPractice(odsCode);
      setDeleteResult({ type: 'success', message: `Deleted ${count} analysis record(s) for ${matched[0].practiceName || odsCode}` });
      setDeleteSearch('');
      fetchAnalyses();
    } catch {
      setDeleteResult({ type: 'error', message: 'Failed to delete analyses. Check Firestore permissions.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) { setConfirmClearAll(true); return; }
    setClearingAll(true);
    setDeleteResult(null);
    try {
      const count = await clearAllAnalyses();
      setDeleteResult({ type: 'success', message: `Cleared all ${count} stored AI analyses.` });
      setConfirmClearAll(false);
      fetchAnalyses();
    } catch {
      setDeleteResult({ type: 'error', message: 'Failed to clear analyses. Check Firestore permissions.' });
    } finally {
      setClearingAll(false);
    }
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp?.toDate?.() || new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Unique practices in analyses (for the search suggestions)
  const analysisPractices = [...new Map(analyses.map(a => [a.odsCode, a])).values()];
  const filteredSuggestions = deleteSearch.length > 1
    ? analysisPractices.filter(a =>
        a.odsCode?.toLowerCase().includes(deleteSearch.toLowerCase()) ||
        a.practiceName?.toLowerCase().includes(deleteSearch.toLowerCase())
      ).slice(0, 5)
    : [];

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
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg">
            <Shield className="text-white" size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Admin Panel</h3>
            <p className="text-sm text-slate-500">Manage usage and AI analysis cache</p>
          </div>
        </div>

        {!authed ? (
          <div className="max-w-xs mx-auto py-8">
            <div className="text-center mb-6">
              <Lock className="mx-auto text-slate-400 mb-2" size={32} />
              <p className="text-sm text-slate-600">Enter admin password to continue</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                autoFocus
              />
              {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
              >
                Unlock
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'usage' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users size={14} className="inline mr-1.5 -mt-0.5" />
                Practice Usage
              </button>
              <button
                onClick={() => setActiveTab('analyses')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'analyses' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles size={14} className="inline mr-1.5 -mt-0.5" />
                CAIP AI Analyses
                {analyses.length > 0 && (
                  <span className="ml-1.5 bg-purple-100 text-purple-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {analyses.length}
                  </span>
                )}
              </button>
            </div>

            {/* Practice Usage Tab */}
            {activeTab === 'usage' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">{practices.length} practices recorded</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={fetchPracticeUsage}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      <RefreshCw size={12} />
                      Refresh
                    </button>
                    <button
                      onClick={handleExportPractices}
                      disabled={practices.length === 0}
                      className={`flex items-center gap-1 text-xs ${practices.length === 0 ? 'text-slate-300' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      <Download size={12} />
                      Export .txt
                    </button>
                  </div>
                </div>

                {practicesLoading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Loading practices...</p>
                ) : practicesError ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">{practicesError}</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2">Practice</th>
                          <th className="text-left px-3 py-2">ODS</th>
                          <th className="text-left px-3 py-2">PCN</th>
                          <th className="text-left px-3 py-2">ICB</th>
                          <th className="text-left px-3 py-2">Last Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practices.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-slate-500 text-center">No practice usage recorded yet.</td>
                          </tr>
                        )}
                        {practices.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-800">{p.gpName || 'Unknown'}</td>
                            <td className="px-3 py-2 text-slate-600">{p.odsCode || p.id}</td>
                            <td className="px-3 py-2 text-slate-600">{p.pcnName || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{p.icbName || p.subICBName || '-'}</td>
                            <td className="px-3 py-2 text-slate-500">{formatTimestamp(p.lastUsed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CAIP AI Analyses Tab */}
            {activeTab === 'analyses' && (
              <div className="space-y-5">

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-800">{analyses.length}</p>
                    <p className="text-xs text-purple-600">Cached Analyses</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-800">{analysisPractices.length}</p>
                    <p className="text-xs text-slate-500">Unique Practices</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      onClick={fetchAnalyses}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      <RefreshCw size={12} />
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Delete practice analyses */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">Delete practice analysis</p>
                  <p className="text-xs text-amber-700">Search by practice name or ODS code. Deleting allows that practice to regenerate a fresh AI analysis.</p>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={deleteSearch}
                          onChange={(e) => { setDeleteSearch(e.target.value); setDeleteResult(null); setConfirmClearAll(false); }}
                          placeholder="Practice name or ODS code..."
                          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        {filteredSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                            {filteredSuggestions.map(a => (
                              <button
                                key={a.odsCode}
                                onClick={() => setDeleteSearch(a.odsCode)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                              >
                                <span className="font-medium text-slate-800">{a.practiceName}</span>
                                <span className="text-slate-400 ml-2">{a.odsCode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleDeletePracticeAnalyses}
                        disabled={!deleteSearch.trim() || deleting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {deleteResult && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                      deleteResult.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {deleteResult.type === 'success'
                        ? <CheckCircle size={13} />
                        : <AlertCircle size={13} />
                      }
                      {deleteResult.message}
                    </div>
                  )}
                </div>

                {/* Clear all analyses */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-900">Clear all AI analyses</p>
                  <p className="text-xs text-red-700">Permanently removes all {analyses.length} cached analyses from Firebase. All practices will need to regenerate.</p>
                  <button
                    onClick={handleClearAll}
                    disabled={clearingAll || analyses.length === 0}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 ${
                      confirmClearAll
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-white border border-red-300 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 size={14} />
                    {clearingAll ? 'Clearing...' : confirmClearAll ? 'Confirm — Delete All' : 'Clear All Analyses'}
                  </button>
                  {confirmClearAll && !clearingAll && (
                    <p className="text-xs text-red-600 font-medium">Click again to confirm. This cannot be undone.</p>
                  )}
                </div>

                {/* Analyses table */}
                {analysesLoading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Loading analyses...</p>
                ) : analysesError ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">{analysesError}</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2">Practice</th>
                          <th className="text-left px-3 py-2">ODS</th>
                          <th className="text-left px-3 py-2">Month</th>
                          <th className="text-left px-3 py-2">Generated</th>
                          <th className="text-left px-3 py-2">Prompt v</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-slate-500 text-center">No CAIP analyses stored yet.</td>
                          </tr>
                        )}
                        {analyses.map((a) => (
                          <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-800">{a.practiceName || 'Unknown'}</td>
                            <td className="px-3 py-2 text-slate-600 font-mono">{a.odsCode}</td>
                            <td className="px-3 py-2 text-slate-600">{a.month}</td>
                            <td className="px-3 py-2 text-slate-500">{formatTimestamp(a.generatedAt)}</td>
                            <td className="px-3 py-2 text-slate-400">{a.promptVersion || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
