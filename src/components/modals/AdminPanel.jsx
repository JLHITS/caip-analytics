import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Lock, Users, RefreshCw, Download, Shield, AlertTriangle,
  Sparkles, Trash2, Search, AlertCircle, CheckCircle, Megaphone,
  Plus, Edit3, Eye, EyeOff, Save, XCircle, Mail, Send
} from 'lucide-react';
import {
  listAllAnalyses,
  deleteAllAnalysesForPractice,
  clearAllAnalyses,
  listPracticeUsage,
} from '../../utils/caipAnalysisStorage';
import {
  listNews,
  createNews,
  updateNews,
  deleteNews,
  toggleNewsActive,
  seedDefaultNews,
} from '../../utils/newsStorage';

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

  // News state
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [editingNews, setEditingNews] = useState(null); // null | 'new' | newsId
  const [newsForm, setNewsForm] = useState({ headline: '', body: '', active: true, priority: 0 });
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsResult, setNewsResult] = useState(null);
  const [confirmDeleteNewsId, setConfirmDeleteNewsId] = useState(null);

  const [loginLoading, setLoginLoading] = useState(false);

  // Subscribers tab state
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState('');
  const [subStats, setSubStats] = useState(null);
  const [subscribers, setSubscribers] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [sendForm, setSendForm] = useState({
    type: 'data-release',           // 'data-release' | 'news-blast' | 'all-data'
    dataset: 'appointments',
    month: '',
    odsCode: '',
    practiceName: '',
    newsId: '',
  });
  const [sendDryRun, setSendDryRun] = useState(null); // { targeted }
  const [sendResult, setSendResult] = useState(null); // { type, message }
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [lastTestRecipient, setLastTestRecipient] = useState('');
  const [sendingTestType, setSendingTestType] = useState('');
  const [testEmailResult, setTestEmailResult] = useState(null);

  // On mount / open: check for existing session token
  useEffect(() => {
    if (!isOpen) return;
    const token = sessionStorage.getItem('adminToken');
    if (!token) return;
    fetch('/api/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => { if (r.ok) setAuthed(true); else sessionStorage.removeItem('adminToken'); })
      .catch(() => sessionStorage.removeItem('adminToken'));
  }, [isOpen]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) { setPasswordError('Please enter a password.'); return; }
    setLoginLoading(true);
    setPasswordError('');
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setPasswordError(data.error || 'Authentication failed.'); return; }
      sessionStorage.setItem('adminToken', data.token);
      setAuthed(true);
      setPassword('');
    } catch {
      setPasswordError('Unable to reach authentication server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchPracticeUsage = useCallback(async () => {
    setPracticesLoading(true);
    setPracticesError('');
    try {
      const data = await listPracticeUsage();
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

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      const data = await listNews();
      setNewsItems(data);
    } catch {
      setNewsError('Failed to load news items.');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const handleSaveNews = async () => {
    if (!newsForm.headline.trim() || !newsForm.body.trim()) return;
    setNewsSaving(true);
    setNewsResult(null);
    try {
      if (editingNews === 'new') {
        await createNews(newsForm);
        setNewsResult({ type: 'success', message: 'News item created.' });
      } else {
        await updateNews(editingNews, newsForm);
        setNewsResult({ type: 'success', message: 'News item updated.' });
      }
      setEditingNews(null);
      setNewsForm({ headline: '', body: '', active: true, priority: 0 });
      fetchNews();
    } catch (err) {
      setNewsResult({ type: 'error', message: err.message || 'Failed to save news.' });
    } finally {
      setNewsSaving(false);
    }
  };

  const handleDeleteNews = async (id) => {
    if (confirmDeleteNewsId !== id) { setConfirmDeleteNewsId(id); return; }
    try {
      await deleteNews(id);
      setConfirmDeleteNewsId(null);
      setNewsResult({ type: 'success', message: 'News item deleted.' });
      fetchNews();
    } catch {
      setNewsResult({ type: 'error', message: 'Failed to delete news item.' });
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await toggleNewsActive(id);
      fetchNews();
    } catch {
      setNewsResult({ type: 'error', message: 'Failed to toggle news status.' });
    }
  };

  const startEditNews = (item) => {
    setEditingNews(item.id);
    setNewsForm({ headline: item.headline, body: item.body, active: item.active, priority: item.priority || 0 });
    setNewsResult(null);
    setConfirmDeleteNewsId(null);
  };

  const startNewNews = () => {
    setEditingNews('new');
    setNewsForm({ headline: '', body: '', active: true, priority: 0 });
    setNewsResult(null);
    setConfirmDeleteNewsId(null);
  };

  const cancelEditNews = () => {
    setEditingNews(null);
    setNewsForm({ headline: '', body: '', active: true, priority: 0 });
  };

  const fetchSubscriptions = useCallback(async () => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) { setSubsError('Not authenticated.'); return; }
    setSubsLoading(true);
    setSubsError('');
    try {
      const res = await fetch('/api/subscriptions-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setSubsError(data.error || 'Failed to load subscriptions.'); return; }
      setSubStats(data.stats);
      setSubscribers(data.subscribers || []);
      setDispatches(data.dispatches || []);
    } catch {
      setSubsError('Unable to reach subscriptions API.');
    } finally {
      setSubsLoading(false);
    }
  }, []);

  const handleDryRun = async () => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) return;
    setSendResult(null);
    setSendDryRun(null);
    try {
      const payload = buildSendPayload(true);
      const res = await fetch('/api/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setSendResult({ type: 'error', message: data.error || 'Preview failed.' }); return; }
      setSendDryRun({ targeted: data.targeted });
    } catch {
      setSendResult({ type: 'error', message: 'Unable to reach send API.' });
    }
  };

  const buildSendPayload = (dryRun = false) => {
    const { type, dataset, month, odsCode, practiceName, newsId } = sendForm;
    if (type === 'news-blast') {
      const news = newsItems.find(n => n.id === newsId);
      return {
        type,
        newsId,
        headline: news?.headline || '',
        body: news?.body || '',
        dryRun,
      };
    }
    return { type, dataset, month, odsCode: odsCode.trim().toUpperCase() || null, practiceName: practiceName.trim() || null, dryRun };
  };

  const handleSendNotifications = async () => {
    if (!confirmSend) { setConfirmSend(true); return; }
    const token = sessionStorage.getItem('adminToken');
    if (!token) return;
    setSending(true);
    setSendResult(null);
    try {
      const payload = buildSendPayload(false);
      const res = await fetch('/api/send-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setSendResult({ type: 'error', message: data.error || 'Send failed.' }); return; }
      setSendResult({
        type: 'success',
        message: `Sent to ${data.sent}/${data.targeted}${data.failed > 0 ? ` — ${data.failed} failed` : ''}.`,
      });
      setConfirmSend(false);
      setSendDryRun(null);
      fetchSubscriptions();
    } catch {
      setSendResult({ type: 'error', message: 'Unable to reach send API.' });
    } finally {
      setSending(false);
    }
  };

  const handleExportSubscribers = () => {
    const verified = subscribers.filter(s => s.verified);
    const lines = verified.map(s => [
      s.email,
      (s.practices || []).join(';'),
      s.subscribedToNews ? 'yes' : 'no',
      s.subscribedToAllDataReleases ? 'yes' : 'no',
      s.wantsAIAnalysis ? 'yes' : 'no',
      s.signupSource || '',
      formatTimestamp(s.verifiedAt),
    ].join('\t'));
    const content = ['Email\tPractices\tNews\tAllData\tWantsAI\tSource\tVerified', ...lines].join('\n');
    downloadFile(content, 'caip-subscribers.txt', 'text/plain');
  };

  const handleSendTestEmail = async (type) => {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
      setTestEmailResult({ type: 'error', message: 'Not authenticated.' });
      return;
    }

    const promptLabel = {
      verification: 'Send test verification email to:',
      'practice-data': 'Send test practice data email to:',
      'news-blast': 'Send test news blast email to:',
      'all-data': 'Send test all-data digest email to:',
    };

    const requestedEmail = window.prompt(promptLabel[type] || 'Send test email to:', lastTestRecipient || '');
    if (requestedEmail === null) return;

    const email = requestedEmail.trim();
    if (!email) {
      setTestEmailResult({ type: 'error', message: 'Email address is required.' });
      return;
    }

    setSendingTestType(type);
    setTestEmailResult(null);

    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestEmailResult({ type: 'error', message: data.error || 'Failed to send test email.' });
        return;
      }

      setLastTestRecipient(data.email || email);
      setTestEmailResult({
        type: 'success',
        message: `${data.label || 'Test email'} sent to ${data.email || email}.`,
      });
    } catch {
      setTestEmailResult({ type: 'error', message: 'Unable to reach test email API.' });
    } finally {
      setSendingTestType('');
    }
  };

  useEffect(() => {
    if (authed) {
      fetchPracticeUsage();
      fetchAnalyses();
      fetchNews();
      fetchSubscriptions();
    }
  }, [authed, fetchPracticeUsage, fetchAnalyses, fetchNews, fetchSubscriptions]);

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
  const testEmailActions = [
    {
      id: 'verification',
      label: 'Verification email',
      description: 'Sends the confirmation email a user receives after subscribing.',
    },
    {
      id: 'practice-data',
      label: 'Practice data release',
      description: 'Sends a sample practice update with the AI analysis CTA enabled.',
    },
    {
      id: 'news-blast',
      label: 'News blast',
      description: 'Sends a sample platform update email from the admin tool.',
    },
    {
      id: 'all-data',
      label: 'All-data digest',
      description: 'Sends a sample national data release digest email.',
    },
  ];

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
            <p className="text-sm text-slate-500">Manage usage, content, subscribers and email testing</p>
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
                disabled={loginLoading}
                className="w-full py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
              >
                {loginLoading ? 'Verifying...' : 'Unlock'}
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
              <button
                onClick={() => setActiveTab('news')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'news' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Megaphone size={14} className="inline mr-1.5 -mt-0.5" />
                News
                {newsItems.filter(n => n.active).length > 0 && (
                  <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {newsItems.filter(n => n.active).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('subscribers')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'subscribers' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Mail size={14} className="inline mr-1.5 -mt-0.5" />
                Subscribers
                {subStats?.verified > 0 && (
                  <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {subStats.verified}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('testing')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'testing' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Send size={14} className="inline mr-1.5 -mt-0.5" />
                Testing
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

            {/* News Management Tab */}
            {activeTab === 'news' && (
              <div className="space-y-5">

                {/* Header with add button */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    {newsItems.length} news item{newsItems.length !== 1 ? 's' : ''} ({newsItems.filter(n => n.active).length} active)
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={fetchNews} className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800">
                      <RefreshCw size={12} /> Refresh
                    </button>
                    <button
                      onClick={startNewNews}
                      disabled={editingNews !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40"
                    >
                      <Plus size={14} /> Add News
                    </button>
                  </div>
                </div>

                {/* Result message */}
                {newsResult && (
                  <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                    newsResult.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {newsResult.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {newsResult.message}
                  </div>
                )}

                {/* Add/Edit form */}
                {editingNews !== null && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-900">
                      {editingNews === 'new' ? 'New News Item' : 'Edit News Item'}
                    </p>
                    <input
                      type="text"
                      value={newsForm.headline}
                      onChange={(e) => setNewsForm(f => ({ ...f, headline: e.target.value }))}
                      placeholder="Headline"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      maxLength={120}
                    />
                    <textarea
                      value={newsForm.body}
                      onChange={(e) => setNewsForm(f => ({ ...f, body: e.target.value }))}
                      placeholder="Body text..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                      maxLength={500}
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={newsForm.active}
                          onChange={(e) => setNewsForm(f => ({ ...f, active: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        Active (visible to users)
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-700">
                        Priority:
                        <input
                          type="number"
                          value={newsForm.priority}
                          onChange={(e) => setNewsForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                          min={0}
                          max={99}
                        />
                        <span className="text-slate-400">(higher = shown first)</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveNews}
                        disabled={newsSaving || !newsForm.headline.trim() || !newsForm.body.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
                      >
                        <Save size={14} />
                        {newsSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEditNews}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <XCircle size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* News items list */}
                {newsLoading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Loading news...</p>
                ) : newsError ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">{newsError}</p>
                  </div>
                ) : newsItems.length === 0 ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-slate-500">No news items yet. Click "Add News" to create one.</p>
                    <button
                      onClick={async () => { await seedDefaultNews(); fetchNews(); setNewsResult({ type: 'success', message: 'Seeded default news item.' }); }}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Seed default news item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newsItems.map(item => (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          item.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-block w-2 h-2 rounded-full ${item.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                              <h4 className="text-sm font-bold text-slate-800 truncate">{item.headline}</h4>
                              {item.priority > 0 && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">P{item.priority}</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2">{item.body}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Created: {formatTimestamp(item.createdAt)}
                              {item.updatedAt && item.updatedAt.seconds !== item.createdAt?.seconds && (
                                <> · Updated: {formatTimestamp(item.updatedAt)}</>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleToggleActive(item.id)}
                              className={`p-1.5 rounded-lg transition-colors ${item.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                              title={item.active ? 'Deactivate' : 'Activate'}
                            >
                              {item.active ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              onClick={() => startEditNews(item)}
                              disabled={editingNews !== null}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
                              title="Edit"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteNews(item.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                confirmDeleteNewsId === item.id
                                  ? 'bg-red-600 text-white'
                                  : 'text-red-500 hover:bg-red-50'
                              }`}
                              title={confirmDeleteNewsId === item.id ? 'Click again to confirm' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Testing Tab */}
            {activeTab === 'testing' && (
              <div className="space-y-5">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-900">Email testing</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Each button prompts for a destination email address, then sends a single admin-only test email.
                    No subscriber records are created or changed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {testEmailActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleSendTestEmail(action.id)}
                      disabled={!!sendingTestType}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{action.description}</p>
                        </div>
                        <div className="shrink-0 text-slate-400">
                          {sendingTestType === action.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Send size={16} />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {lastTestRecipient && (
                  <p className="text-xs text-slate-500">
                    Last recipient: <span className="font-medium text-slate-700">{lastTestRecipient}</span>
                  </p>
                )}

                {testEmailResult && (
                  <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                    testEmailResult.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testEmailResult.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {testEmailResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Subscribers Tab */}
            {activeTab === 'subscribers' && (
              <div className="space-y-5">

                {/* Stats cards */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-800">{subStats?.verified ?? '—'}</p>
                    <p className="text-xs text-blue-600">Verified</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-800">{subStats?.unverified ?? '—'}</p>
                    <p className="text-xs text-amber-600">Pending verify</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-800">{subStats?.news ?? '—'}</p>
                    <p className="text-xs text-emerald-600">News subscribers</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-800">{subStats?.practiceScoped ?? '—'}</p>
                    <p className="text-xs text-purple-600">Practice-scoped</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={fetchSubscriptions}
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                  <button
                    onClick={handleExportSubscribers}
                    disabled={subscribers.length === 0}
                    className={`flex items-center gap-1 text-xs ${subscribers.length === 0 ? 'text-slate-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    <Download size={12} /> Export verified (.txt)
                  </button>
                </div>

                {subsError && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">{subsError}</p>
                  </div>
                )}

                {/* Send notification form */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-900">Send notification</p>

                  <div className="flex flex-wrap gap-4 text-xs">
                    {[
                      { id: 'data-release', label: 'Practice data release' },
                      { id: 'all-data', label: 'All-data digest' },
                      { id: 'news-blast', label: 'News blast' },
                    ].map(opt => (
                      <label key={opt.id} className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="sendType"
                          checked={sendForm.type === opt.id}
                          onChange={() => { setSendForm(f => ({ ...f, type: opt.id })); setSendDryRun(null); setConfirmSend(false); }}
                          className="text-blue-600"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  {(sendForm.type === 'data-release' || sendForm.type === 'all-data') && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={sendForm.dataset}
                        onChange={(e) => { setSendForm(f => ({ ...f, dataset: e.target.value })); setSendDryRun(null); setConfirmSend(false); }}
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        <option value="appointments">Appointments</option>
                        <option value="telephony">Telephony</option>
                        <option value="oc">Online Consultations</option>
                        <option value="workforce">Workforce</option>
                      </select>
                      <input
                        type="text"
                        value={sendForm.month}
                        onChange={(e) => { setSendForm(f => ({ ...f, month: e.target.value })); setSendDryRun(null); setConfirmSend(false); }}
                        placeholder="Month e.g. January 2026"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  )}

                  {sendForm.type === 'data-release' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={sendForm.odsCode}
                        onChange={(e) => { setSendForm(f => ({ ...f, odsCode: e.target.value })); setSendDryRun(null); setConfirmSend(false); }}
                        placeholder="ODS code (e.g. C84025)"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 uppercase"
                      />
                      <input
                        type="text"
                        value={sendForm.practiceName}
                        onChange={(e) => setSendForm(f => ({ ...f, practiceName: e.target.value }))}
                        placeholder="Practice name (optional)"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  )}

                  {sendForm.type === 'news-blast' && (
                    <select
                      value={sendForm.newsId}
                      onChange={(e) => { setSendForm(f => ({ ...f, newsId: e.target.value })); setSendDryRun(null); setConfirmSend(false); }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Select a news item…</option>
                      {newsItems.map(n => (
                        <option key={n.id} value={n.id}>
                          {n.active ? '● ' : '○ '}{n.headline}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleDryRun}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-blue-300 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Eye size={14} /> Preview audience
                    </button>
                    <button
                      onClick={handleSendNotifications}
                      disabled={sending}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 ${
                        confirmSend
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Send size={14} />
                      {sending
                        ? 'Sending…'
                        : confirmSend
                          ? `Confirm — Send to ${sendDryRun?.targeted ?? '?'}`
                          : 'Send notification'}
                    </button>
                    {confirmSend && !sending && (
                      <button
                        onClick={() => { setConfirmSend(false); }}
                        className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {sendDryRun && (
                    <p className="text-xs text-blue-800">
                      <strong>{sendDryRun.targeted}</strong> verified subscriber{sendDryRun.targeted === 1 ? '' : 's'} match this notification.
                    </p>
                  )}

                  {sendResult && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                      sendResult.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {sendResult.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      {sendResult.message}
                    </div>
                  )}
                </div>

                {/* Dispatch history */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">Recent dispatches</p>
                  {subsLoading ? (
                    <p className="text-sm text-slate-500 py-4 text-center">Loading…</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-slate-600">
                          <tr>
                            <th className="text-left px-3 py-2">When</th>
                            <th className="text-left px-3 py-2">Type</th>
                            <th className="text-left px-3 py-2">Detail</th>
                            <th className="text-right px-3 py-2">Sent</th>
                            <th className="text-right px-3 py-2">Failed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dispatches.length === 0 && (
                            <tr><td colSpan={5} className="px-3 py-4 text-slate-500 text-center">No dispatches yet.</td></tr>
                          )}
                          {dispatches.map(d => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-500">{formatTimestamp(d.createdAt)}</td>
                              <td className="px-3 py-2 text-slate-700">{d.type}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {d.type === 'news-blast'
                                  ? (d.newsId || '—')
                                  : `${d.dataset || ''}${d.month ? ` · ${d.month}` : ''}${d.odsCode ? ` · ${d.odsCode}` : ''}`}
                              </td>
                              <td className="px-3 py-2 text-right text-emerald-700 font-medium">{d.emailsSent ?? 0}</td>
                              <td className={`px-3 py-2 text-right font-medium ${d.emailsFailed > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {d.emailsFailed ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Subscribers table */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2">All subscribers ({subscribers.length})</p>
                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2">Email</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Practices</th>
                          <th className="text-center px-3 py-2">News</th>
                          <th className="text-center px-3 py-2">All data</th>
                          <th className="text-left px-3 py-2">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscribers.length === 0 && (
                          <tr><td colSpan={6} className="px-3 py-4 text-slate-500 text-center">No subscribers yet.</td></tr>
                        )}
                        {subscribers.map(s => (
                          <tr key={s.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-800">{s.email}</td>
                            <td className="px-3 py-2">
                              {s.verified
                                ? <span className="text-emerald-700">Verified</span>
                                : <span className="text-amber-700">Pending</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-600 font-mono">
                              {(s.practices || []).join(', ') || '—'}
                            </td>
                            <td className="px-3 py-2 text-center">{s.subscribedToNews ? '✓' : ''}</td>
                            <td className="px-3 py-2 text-center">{s.subscribedToAllDataReleases ? '✓' : ''}</td>
                            <td className="px-3 py-2 text-slate-500">{s.signupSource || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
