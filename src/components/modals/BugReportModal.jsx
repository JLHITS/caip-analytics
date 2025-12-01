import React, { useState } from 'react';
import { AlertTriangle, X, Send } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { NHS_BLUE } from '../../constants/colors';

// EmailJS configuration
const EMAILJS_SERVICE_ID = 'service_6a468bk';
const EMAILJS_TEMPLATE_ID = 'template_1e8eqws';
const EMAILJS_PUBLIC_KEY = '1RWDlXHnnioT_9mTP';

// Bug report modal - collects diagnostic data and sends bug reports via EmailJS
const BugReportModal = ({ isOpen, onClose }) => {
  const [bugDescription, setBugDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  // Collect diagnostic data
  const getDiagnosticData = () => {
    const nav = window.navigator;
    return {
      browser: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const diagnosticData = getDiagnosticData();

    // Format message with bug description and diagnostic data
    const formattedMessage = `
BUG REPORT
==========

Bug Description:
${bugDescription}

Contact Email: ${email || 'Not provided'}

Diagnostic Data:
----------------
Browser: ${diagnosticData.browser}
Platform: ${diagnosticData.platform}
Language: ${diagnosticData.language}
Screen Resolution: ${diagnosticData.screenResolution}
Window Size: ${diagnosticData.windowSize}
URL: ${diagnosticData.url}
Timestamp: ${diagnosticData.timestamp}
    `.trim();

    // Prepare template parameters for EmailJS
    const templateParams = {
      name: name || 'Anonymous',
      email: email || 'noreply@caip.app',
      message: formattedMessage
    };

    try {
      // Send email using EmailJS
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setBugDescription('');
        setName('');
        setEmail('');
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Failed to send bug report:', error);
      setError('Failed to send bug report. Please try again or contact us directly at jayleathen@gmail.com');
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
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-amber-500" size={28} />
          <h3 className="text-xl font-bold text-slate-800">Report a Bug</h3>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="text-green-600 mb-2">
              <Send size={48} className="mx-auto" />
            </div>
            <p className="text-lg font-semibold text-slate-800">Thank you!</p>
            <p className="text-slate-600">Your bug report has been sent successfully. We'll review it and get back to you if needed.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-slate-600 mb-4 leading-relaxed text-sm">
              Help us improve CAIP.app by reporting any bugs or issues you encounter.
              Diagnostic data will be automatically included to help us resolve the issue.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Bug Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                required
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Please describe the bug in detail, including steps to reproduce it..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-6 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Diagnostic Data (Auto-collected)
              </p>
              <div className="text-xs text-slate-600 space-y-1">
                <p><strong>Browser:</strong> {window.navigator.userAgent.substring(0, 60)}...</p>
                <p><strong>Platform:</strong> {window.navigator.platform}</p>
                <p><strong>Screen:</strong> {window.screen.width}x{window.screen.height}</p>
              </div>
            </div>

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
                disabled={submitting || !bugDescription.trim()}
                className="px-5 py-2.5 text-white font-bold rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: NHS_BLUE }}
                onMouseEnter={(e) => !submitting && (e.target.style.opacity = '0.9')}
                onMouseLeave={(e) => !submitting && (e.target.style.opacity = '1')}
              >
                <Send size={18} />
                {submitting ? 'Sending...' : 'Submit Bug Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BugReportModal;
