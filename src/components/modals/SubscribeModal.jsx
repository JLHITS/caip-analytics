import React, { useState, useEffect } from 'react';
import { Mail, X, Bell, Newspaper, Database, Sparkles, Check, AlertCircle } from 'lucide-react';
import { NHS_BLUE } from '../../constants/colors';
import { trackEvent } from '../../firebase/config';

/**
 * Email subscription modal.
 *
 * Props:
 *   isOpen, onClose           — standard modal control
 *   scope                     — 'practice' | 'news' | 'all-data' | 'general'
 *   odsCode, practiceName     — required when scope === 'practice'
 *   signupSource              — e.g. 'practice-dashboard', 'noticeboard', 'about-modal'
 */
const SubscribeModal = ({
  isOpen,
  onClose,
  scope = 'general',
  odsCode = null,
  practiceName = null,
  signupSource = 'unknown',
}) => {
  const [email, setEmail] = useState('');
  const [wantPractice, setWantPractice] = useState(scope === 'practice');
  const [wantAI, setWantAI] = useState(scope === 'practice');
  const [wantNews, setWantNews] = useState(scope === 'news');
  const [wantAllData, setWantAllData] = useState(scope === 'all-data');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setWantPractice(scope === 'practice');
    setWantAI(scope === 'practice');
    setWantNews(scope === 'news');
    setWantAllData(scope === 'all-data');
    setConsent(false);
    setEmail('');
    setSubmitted(false);
    setError(null);
  }, [isOpen, scope]);

  if (!isOpen) return null;

  const practiceAvailable = !!odsCode;
  const anySelected =
    (wantPractice && practiceAvailable) || wantNews || wantAllData;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!consent) {
      setError('Please tick the consent box to continue.');
      return;
    }
    if (!anySelected) {
      setError('Select at least one thing to subscribe to.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        email: email.trim(),
        practices: wantPractice && practiceAvailable ? [odsCode] : [],
        practiceName: wantPractice && practiceAvailable ? practiceName : null,
        wantsAIAnalysis: wantPractice && practiceAvailable && wantAI,
        subscribedToNews: wantNews,
        subscribedToAllDataReleases: wantAllData,
        signupSource,
        consent: true,
      };

      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Subscription failed.');
      }

      trackEvent('subscription_submitted', {
        scope,
        signup_source: signupSource,
        has_ai: payload.wantsAIAnalysis,
        has_news: payload.subscribedToNews,
        has_all_data: payload.subscribedToAllDataReleases,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not subscribe. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NHS_BLUE}15` }}>
            <Mail size={22} style={{ color: NHS_BLUE }} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Stay updated</h3>
        </div>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          Get an email when new data is released or when we post a platform update. You can unsubscribe in one click at any time.
        </p>

        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Check size={32} className="text-green-600" />
            </div>
            <p className="text-lg font-semibold text-slate-800 mb-1">Check your inbox</p>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              We've sent a confirmation email to <strong>{email}</strong>.
              Click the link inside to activate your subscription.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-white font-semibold rounded-lg"
              style={{ backgroundColor: NHS_BLUE }}
            >
              Got it
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@nhs.net"
              />
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm font-semibold text-slate-700">What would you like to receive?</p>

              {practiceAvailable && (
                <>
                  <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={wantPractice}
                      onChange={e => setWantPractice(e.target.checked)}
                      className="mt-0.5 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                        <Bell size={15} className="text-slate-500" />
                        Updates for <span className="font-semibold">{practiceName || odsCode}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                        Be notified when new monthly NHS data is available for this practice.
                      </p>
                    </div>
                  </label>

                  {wantPractice && (
                    <label className="flex items-start gap-3 p-3 ml-6 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors bg-slate-50/50">
                      <input
                        type="checkbox"
                        checked={wantAI}
                        onChange={e => setWantAI(e.target.checked)}
                        className="mt-0.5 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                          <Sparkles size={15} className="text-purple-500" />
                          Include CAIP AI analysis
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                          The email will include a one-click link that auto-generates the latest analysis for you.
                        </p>
                      </div>
                    </label>
                  )}
                </>
              )}

              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={wantNews}
                  onChange={e => setWantNews(e.target.checked)}
                  className="mt-0.5 w-4 h-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Newspaper size={15} className="text-slate-500" />
                    CAIP news &amp; platform updates
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    Product changes, new features, and the occasional sector update.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={wantAllData}
                  onChange={e => setWantAllData(e.target.checked)}
                  className="mt-0.5 w-4 h-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Database size={15} className="text-slate-500" />
                    All national data releases
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    For analysts and ICB teams — get notified on every monthly dataset drop.
                  </p>
                </div>
              </label>
            </div>

            <label className="flex items-start gap-2 mb-4 text-xs text-slate-600 leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4"
              />
              <span>
                I consent to receiving these emails. CAIP Analytics will use my email solely to send the
                updates I've selected. Emails are sent via Brevo on our behalf. I can unsubscribe in one
                click from any email.
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !email.trim() || !consent || !anySelected}
                className="px-5 py-2 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: NHS_BLUE }}
              >
                <Mail size={16} />
                {submitting ? 'Sending…' : 'Send confirmation email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SubscribeModal;
