import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Loader2,
  MessageSquare,
  Search,
  Send,
  X,
} from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';
import { searchPracticeDirectory } from '../../utils/practiceDirectory';

const NHS_EMAIL_PATTERN = /^[^\s@]+@nhs\.(net|uk)$/i;

const FEEDBACK_TYPES = [
  {
    value: 'Bug Report',
    label: 'Bug Report',
    description: 'Something is not working as expected.',
  },
  {
    value: 'Feature Request',
    label: 'Feature Request',
    description: 'An idea that would make the app more useful.',
  },
  {
    value: 'General Feedback',
    label: 'General Feedback',
    description: 'Comments, questions, or suggestions.',
  },
  {
    value: 'Data Issue',
    label: 'Data Issue',
    description: 'A concern about national or local data outputs.',
  },
];

const PLACEHOLDERS = {
  'Bug Report': 'Please describe what happened, what you expected, and any steps needed to reproduce it.',
  'Feature Request': 'Describe the feature you would like to see and how it would help your work.',
  'General Feedback': 'Share your comments, questions, or suggestions about CAIP.app.',
  'Data Issue': 'Describe the data issue, including the practice, tab, metric, or month if relevant.',
};

const INTRO_COPY = {
  'Bug Report': 'Tell us about the problem you found. Diagnostic data will be included to help investigate it.',
  'Feature Request': 'Tell us what would improve CAIP.app for your work in primary care.',
  'General Feedback': 'Share feedback about CAIP.app, including what is useful or what could be clearer.',
  'Data Issue': 'Tell us what looks wrong or unclear in the data. Diagnostic data will be included to help investigate it.',
};

const DIAGNOSTIC_TYPES = new Set(['Bug Report', 'Data Issue']);
const EMAIL_ERROR = 'Please use your NHS email address (@nhs.net or @nhs.uk)';

const isNhsEmail = (value) => NHS_EMAIL_PATTERN.test(String(value || '').trim());

const formatPractice = (practice) => (
  practice ? `${practice.practiceName} (${practice.odsCode})` : ''
);

const getDiagnosticData = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const nav = window.navigator;
  return {
    browser: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };
};

const FeedbackModal = ({ isOpen, onClose }) => {
  const [feedbackType, setFeedbackType] = useState('General Feedback');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [practiceQuery, setPracticeQuery] = useState('');
  const [practiceResults, setPracticeResults] = useState([]);
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const practiceRef = useRef(null);
  const practiceInputRef = useRef(null);
  const closeTimerRef = useRef(null);

  const includeDiagnostics = DIAGNOSTIC_TYPES.has(feedbackType);
  const emailError = email.trim() && !isNhsEmail(email) ? EMAIL_ERROR : '';

  const resetForm = useCallback(() => {
    setFeedbackType('General Feedback');
    setMessage('');
    setName('');
    setEmail('');
    setPracticeQuery('');
    setPracticeResults([]);
    setSelectedPractice(null);
    setPracticeOpen(false);
    setPracticeError('');
    setSubmitted(false);
    setError(null);
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (practiceRef.current && !practiceRef.current.contains(event.target)) {
        setPracticeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const query = practiceQuery.trim();
    const selectedLabel = formatPractice(selectedPractice);

    if (
      query.length < 2 ||
      (selectedPractice && query === selectedLabel)
    ) {
      setPracticeResults([]);
      setPracticeLoading(false);
      setPracticeError('');
      return;
    }

    let cancelled = false;
    setPracticeLoading(true);
    setPracticeError('');

    const timeout = setTimeout(async () => {
      try {
        const results = await searchPracticeDirectory(query, 20);
        if (!cancelled) {
          setPracticeResults(results);
          setPracticeOpen(true);
        }
      } catch (searchError) {
        if (!cancelled) {
          console.error('Practice search failed:', searchError);
          setPracticeResults([]);
          setPracticeError('Practice search is unavailable right now.');
          setPracticeOpen(true);
        }
      } finally {
        if (!cancelled) {
          setPracticeLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [practiceQuery, selectedPractice]);

  if (!isOpen) return null;

  const handlePracticeSelect = (practice) => {
    setSelectedPractice(practice);
    setPracticeQuery(formatPractice(practice));
    setPracticeResults([]);
    setPracticeOpen(false);
    setPracticeError('');
  };

  const handlePracticeClear = () => {
    setSelectedPractice(null);
    setPracticeQuery('');
    setPracticeResults([]);
    setPracticeOpen(false);
    setPracticeError('');
    practiceInputRef.current?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (emailError || !message.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/send-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType,
          message,
          name,
          email,
          practice: selectedPractice,
          diagnosticData: includeDiagnostics ? getDiagnosticData() : null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send feedback.');
      }

      setSubmitted(true);
      closeTimerRef.current = setTimeout(() => {
        resetForm();
        onClose();
      }, 2500);
    } catch (submitError) {
      console.error('Failed to send feedback:', submitError);
      setError(`${submitError.message} Please try again or contact jason.gomez@nhs.net directly.`);
    } finally {
      setSubmitting(false);
    }
  };

  const diagnosticPreview = includeDiagnostics ? getDiagnosticData() : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close feedback form"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="text-blue-500" size={28} />
          <h3 className="text-xl font-bold text-slate-800">Share Feedback</h3>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="text-green-600 mb-3">
              <CheckCircle size={48} className="mx-auto" />
            </div>
            <p className="text-lg font-semibold text-slate-800">Thank you</p>
            <p className="text-slate-600">Your feedback has been sent successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-slate-600 mb-5 leading-relaxed text-sm">
              {INTRO_COPY[feedbackType]}
            </p>

            <div className="mb-5">
              <p className="block text-sm font-semibold text-slate-700 mb-2">
                Feedback Type <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEEDBACK_TYPES.map((type) => {
                  const isSelected = feedbackType === type.value;

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFeedbackType(type.value)}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{type.label}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">{type.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Feedback <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={PLACEHOLDERS[feedbackType]}
              />
            </div>

            <div className="mb-5" ref={practiceRef}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Practice (Optional)
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={practiceInputRef}
                  type="text"
                  value={practiceQuery}
                  onChange={(event) => {
                    setPracticeQuery(event.target.value);
                    setSelectedPractice(null);
                    setPracticeOpen(true);
                  }}
                  onFocus={() => practiceQuery.trim().length >= 2 && setPracticeOpen(true)}
                  className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search by practice name or ODS code"
                />
                {practiceLoading ? (
                  <Loader2
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin"
                  />
                ) : practiceQuery ? (
                  <button
                    type="button"
                    onClick={handlePracticeClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear practice search"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              {practiceOpen && practiceQuery.trim().length >= 2 && (
                <div className="relative">
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {practiceError ? (
                      <div className="p-3 text-sm text-red-700 bg-red-50 flex items-center gap-2">
                        <AlertCircle size={16} />
                        {practiceError}
                      </div>
                    ) : practiceResults.length > 0 ? (
                      practiceResults.map((practice) => (
                        <button
                          key={practice.odsCode}
                          type="button"
                          onClick={() => handlePracticeSelect(practice)}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-start gap-3"
                        >
                          <Building2 size={16} className="text-blue-500 mt-0.5 shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-800 truncate">
                              {practice.practiceName}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {practice.odsCode}
                              {practice.pcn ? ` | ${practice.pcn}` : ''}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : !practiceLoading ? (
                      <div className="p-3 text-center text-sm text-slate-500">
                        No practices found matching "{practiceQuery}"
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {selectedPractice && (
                <p className="mt-2 text-xs text-slate-500">
                  Selected: <span className="font-semibold text-slate-700">{selectedPractice.practiceName}</span> ({selectedPractice.odsCode})
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    emailError
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-slate-300 focus:ring-blue-500'
                  }`}
                  placeholder="your.name@nhs.net"
                />
                {emailError && (
                  <p className="mt-1 text-xs text-red-600">{emailError}</p>
                )}
              </div>
            </div>

            {includeDiagnostics && diagnosticPreview && (
              <div className="bg-slate-50 rounded-lg p-3 mb-6 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Diagnostic Data (Auto-collected)
                </p>
                <div className="text-xs text-slate-600 space-y-1">
                  <p><strong>Browser:</strong> {diagnosticPreview.browser.substring(0, 80)}...</p>
                  <p><strong>Platform:</strong> {diagnosticPreview.platform}</p>
                  <p><strong>Screen:</strong> {diagnosticPreview.screenResolution}</p>
                  <p><strong>URL:</strong> {diagnosticPreview.url}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim() || Boolean(emailError)}
                className="px-5 py-2.5 text-white font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: NHS_BLUE }}
                onMouseEnter={(event) => !submitting && (event.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(event) => !submitting && (event.currentTarget.style.opacity = '1')}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {submitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
