import { requireAdminToken } from './_lib/verifyAdminToken.js';
import { getAppUrl, sendEmail } from './_lib/sendEmail.js';
import {
  verificationEmail,
  practiceDataEmail,
  newsBlastEmail,
  allDataReleaseEmail,
} from './_lib/emailTemplates.js';

const VALID_TYPES = ['verification', 'practice-data', 'news-blast', 'all-data'];

const TEMPLATE_LABELS = {
  verification: 'Verification email',
  'practice-data': 'Practice data release email',
  'news-blast': 'News blast email',
  'all-data': 'All-data digest email',
};

function normaliseEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function buildTemplate(type, appUrl, email) {
  switch (type) {
    case 'verification':
      return verificationEmail({
        appUrl,
        verificationToken: 'test-verification-token',
        summary:
          '<strong>Practice:</strong> Riverside Medical Centre (C84025) - with AI analysis<br><strong>News &amp; platform updates</strong>',
      });
    case 'practice-data':
      return practiceDataEmail({
        appUrl,
        practiceName: 'Riverside Medical Centre',
        odsCode: 'C84025',
        dataset: 'appointments',
        month: 'April 2026',
        wantsAIAnalysis: true,
        unsubscribeToken: 'test-unsubscribe-token',
        email,
      });
    case 'news-blast':
      return newsBlastEmail({
        appUrl,
        headline: 'Test update from CAIP Analytics',
        newsBody:
          'This is a test platform update sent from the admin panel.\n\nUse this to confirm the layout, branding, and delivery are working as expected.',
        unsubscribeToken: 'test-unsubscribe-token',
        email,
      });
    case 'all-data':
      return allDataReleaseEmail({
        appUrl,
        dataset: 'appointments',
        month: 'April 2026',
        unsubscribeToken: 'test-unsubscribe-token',
        email,
      });
    default:
      throw new Error('Unsupported test email type.');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAdminToken(req, res)) return;

  const { type, email } = req.body || {};
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const normalisedEmail = normaliseEmail(email);
  if (!isValidEmail(normalisedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const template = buildTemplate(type, getAppUrl(), normalisedEmail);
    await sendEmail({
      to: normalisedEmail,
      subject: `[TEST] ${template.subject}`,
      html: template.html,
      text: template.text,
    });

    return res.status(200).json({
      ok: true,
      email: normalisedEmail,
      type,
      label: TEMPLATE_LABELS[type],
    });
  } catch (err) {
    console.error('send-test-email error', err);
    return res.status(500).json({ error: err.message || 'Failed to send test email.' });
  }
}
