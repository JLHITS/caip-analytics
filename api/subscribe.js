import { upsertSubscription, isValidEmail, normaliseEmail } from './_lib/subscriptionStore.js';
import { sendEmail, getAppUrl } from './_lib/sendEmail.js';
import { verificationEmail } from './_lib/emailTemplates.js';

// In-memory rate limit (per cold-start). Good enough for a public subscribe endpoint
// behind Vercel's serverless boundary; falls open on cold starts which is acceptable.
const rateLimits = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;

function rateLimitKey(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimits.get(key) || [];
  const recent = entry.filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return false;
  recent.push(now);
  rateLimits.set(key, recent);
  return true;
}

function buildSummary({ practices, practiceName, subscribedToNews, subscribedToAllDataReleases, wantsAIAnalysis }) {
  const lines = [];
  if (practices?.length && practiceName) {
    lines.push(`<strong>Practice:</strong> ${practiceName} (${practices[0]})${wantsAIAnalysis ? ' &mdash; with AI analysis' : ''}`);
  } else if (practices?.length) {
    lines.push(`<strong>Practices:</strong> ${practices.join(', ')}`);
  }
  if (subscribedToNews) lines.push(`<strong>News &amp; platform updates</strong>`);
  if (subscribedToAllDataReleases) lines.push(`<strong>All national data releases</strong>`);
  return lines.length ? lines.join('<br>') : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = rateLimitKey(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' });
  }

  const {
    email,
    practices,
    practiceName,
    wantsAIAnalysis = false,
    subscribedToNews = false,
    subscribedToAllDataReleases = false,
    signupSource = 'unknown',
    consent = false,
  } = req.body || {};

  const normalised = normaliseEmail(email);
  if (!isValidEmail(normalised)) {
    return res.status(400).json({ error: 'Please use your NHS email address (@nhs.net or @nhs.uk)' });
  }
  if (!consent) {
    return res.status(400).json({ error: 'Consent is required to subscribe.' });
  }

  const cleanPractices = Array.isArray(practices)
    ? practices.filter(p => typeof p === 'string' && p.length > 0 && p.length < 20)
    : [];
  const hasAnyPreference =
    cleanPractices.length > 0 || subscribedToNews || subscribedToAllDataReleases;
  if (!hasAnyPreference) {
    return res.status(400).json({ error: 'Select at least one thing to subscribe to.' });
  }

  try {
    const result = await upsertSubscription({
      email: normalised,
      practices: cleanPractices,
      wantsAIAnalysis: !!wantsAIAnalysis,
      subscribedToNews: !!subscribedToNews,
      subscribedToAllDataReleases: !!subscribedToAllDataReleases,
      signupSource,
    });

    // Even if they already existed and were verified, we re-send verification
    // so that a stale confirm link won't be used and so the new preferences
    // are confirmed intentionally.
    const summaryHtml = buildSummary({
      practices: cleanPractices,
      practiceName,
      subscribedToNews,
      subscribedToAllDataReleases,
      wantsAIAnalysis,
    });
    const template = verificationEmail({
      appUrl: getAppUrl(),
      verificationToken: result.verificationToken,
      summary: summaryHtml,
    });

    await sendEmail({
      to: normalised,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return res.status(200).json({
      ok: true,
      alreadyExisted: result.alreadyExisted,
      alreadyVerified: result.verified,
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong while subscribing. Please try again.' });
  }
}
