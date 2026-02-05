import React, { useState, useEffect, useCallback } from 'react';
import { X, Lock, Key, Users, RefreshCw, Download, Plus, Copy, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CAIP-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const AdminPanel = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState('codes');

  // Practice usage state
  const [practices, setPractices] = useState([]);
  const [practicesLoading, setPracticesLoading] = useState(false);
  const [practicesError, setPracticesError] = useState('');

  // Beta codes state
  const [betaCodes, setBetaCodes] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [generateCount, setGenerateCount] = useState(1);

  const configuredPassword = (import.meta && import.meta.env && (import.meta.env.VITE_ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD)) || '';

  const handleLogin = (e) => {
    e.preventDefault();
    if (!configuredPassword) {
      setPasswordError('Admin password not configured.');
      return;
    }
    if (password !== configuredPassword) {
      setPasswordError('Incorrect password.');
      return;
    }
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

  const fetchBetaCodes = useCallback(async () => {
    setCodesLoading(true);
    setCodesError('');
    try {
      const snapshot = await getDocs(collection(db, 'beta-access-codes'));
      const data = snapshot.docs.map(d => ({ code: d.id, ...d.data() }));
      data.sort((a, b) => {
        if (a.used !== b.used) return a.used ? 1 : -1;
        const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
        const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
        return bTime - aTime;
      });
      setBetaCodes(data);
    } catch (error) {
      const msg = String(error?.message || '');
      if (error?.code === 'permission-denied' || /missing or insufficient permissions/i.test(msg)) {
        setCodesError('Blocked by Firestore rules. Allow read access for beta-access-codes.');
      } else {
        setCodesError('Failed to load beta codes.');
      }
    } finally {
      setCodesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      fetchBetaCodes();
      fetchPracticeUsage();
    }
  }, [authed, fetchBetaCodes, fetchPracticeUsage]);

  const handleGenerateCodes = async () => {
    setGenerating(true);
    try {
      const newCodes = [];
      for (let i = 0; i < generateCount; i++) {
        const code = generateCode();
        const docRef = doc(db, 'beta-access-codes', code);
        await setDoc(docRef, {
          createdAt: Timestamp.now(),
          used: false,
          label: '',
        });
        newCodes.push({ code, createdAt: { toDate: () => new Date() }, used: false, label: '' });
      }
      setBetaCodes(prev => [...newCodes, ...prev]);
    } catch (error) {
      setCodesError('Failed to generate codes. Check Firestore rules.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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

  const handleExportCodes = () => {
    const lines = betaCodes.map(c => [
      c.code,
      c.used ? 'Used' : 'Available',
      c.usedBy || '',
      c.used ? formatTimestamp(c.usedAt) : '',
      formatTimestamp(c.createdAt),
      c.label || ''
    ].join('\t'));
    const content = ['Code\tStatus\tUsed By (ODS)\tUsed At\tCreated\tLabel', ...lines].join('\n');
    downloadFile(content, 'caip-beta-codes.txt', 'text/plain');
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

  if (!isOpen) return null;

  const usedCount = betaCodes.filter(c => c.used).length;
  const availableCount = betaCodes.filter(c => !c.used).length;

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
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg">
            <Shield className="text-white" size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Admin Panel</h3>
            <p className="text-sm text-slate-500">Manage beta access and usage</p>
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
              {passwordError && (
                <p className="text-xs text-red-600">{passwordError}</p>
              )}
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
                onClick={() => setActiveTab('codes')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'codes'
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Key size={14} className="inline mr-1.5 -mt-0.5" />
                Beta Access Codes
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'usage'
                    ? 'border-slate-800 text-slate-800'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users size={14} className="inline mr-1.5 -mt-0.5" />
                Practice Usage
              </button>
            </div>

            {/* Beta Access Codes Tab */}
            {activeTab === 'codes' && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-800">{betaCodes.length}</p>
                    <p className="text-xs text-slate-500">Total Codes</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{availableCount}</p>
                    <p className="text-xs text-emerald-600">Available</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{usedCount}</p>
                    <p className="text-xs text-amber-600">Used</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600">Generate</label>
                    <select
                      value={generateCount}
                      onChange={(e) => setGenerateCount(Number(e.target.value))}
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    >
                      {[1, 3, 5, 10].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleGenerateCodes}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                      <Plus size={14} />
                      {generating ? 'Generating...' : 'New Codes'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={fetchBetaCodes}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      <RefreshCw size={12} />
                      Refresh
                    </button>
                    <button
                      onClick={handleExportCodes}
                      disabled={betaCodes.length === 0}
                      className={`flex items-center gap-1 text-xs ${betaCodes.length === 0 ? 'text-slate-300' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      <Download size={12} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Codes Table */}
                {codesLoading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Loading codes...</p>
                ) : codesError ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">{codesError}</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2">Code</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Used By</th>
                          <th className="text-left px-3 py-2">Used At</th>
                          <th className="text-left px-3 py-2">Created</th>
                          <th className="text-left px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {betaCodes.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 text-slate-500 text-center">
                              No beta codes yet. Generate some above.
                            </td>
                          </tr>
                        )}
                        {betaCodes.map((c) => (
                          <tr key={c.code} className={`border-t border-slate-100 ${c.used ? 'bg-slate-50 opacity-60' : ''}`}>
                            <td className="px-3 py-2 font-mono text-slate-800 font-medium">{c.code}</td>
                            <td className="px-3 py-2">
                              {c.used ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                                  Used
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                                  Available
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{c.usedBy || '-'}</td>
                            <td className="px-3 py-2 text-slate-500">{c.used ? formatTimestamp(c.usedAt) : '-'}</td>
                            <td className="px-3 py-2 text-slate-500">{formatTimestamp(c.createdAt)}</td>
                            <td className="px-3 py-2">
                              {!c.used && (
                                <button
                                  onClick={() => handleCopyCode(c.code)}
                                  className="text-slate-400 hover:text-slate-600 transition-colors"
                                  title="Copy code"
                                >
                                  {copiedCode === c.code ? (
                                    <CheckCircle size={14} className="text-emerald-500" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

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
                            <td colSpan={5} className="px-3 py-4 text-slate-500 text-center">
                              No practice usage recorded yet.
                            </td>
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
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
