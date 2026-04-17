import { findByUnsubscribeToken, unsubscribeById } from './_lib/subscriptionStore.js';
import { getAppUrl } from './_lib/sendEmail.js';

/**
 * Handle unsubscribe links from emails.
 *
 * GET /api/unsubscribe?token=xxx[&email=yyy]
 *   → redirect to `${APP_URL}/?unsubscribeResult=success|invalid`
 *
 * POST /api/unsubscribe { token, email? }
 *   → JSON response (for one-click List-Unsubscribe-Post header clients)
 */
export default async function handler(req, res) {
  const appUrl = getAppUrl();
  const token = req.query?.token || req.body?.token;

  if (!token) {
    if (req.method === 'POST') return res.status(400).json({ error: 'Token required' });
    return res.redirect(302, `${appUrl}/?unsubscribeResult=invalid`);
  }

  try {
    const sub = await findByUnsubscribeToken(token);
    if (!sub) {
      if (req.method === 'POST') return res.status(404).json({ error: 'Subscription not found' });
      return res.redirect(302, `${appUrl}/?unsubscribeResult=invalid`);
    }
    await unsubscribeById(sub.id);
    if (req.method === 'POST') return res.status(200).json({ ok: true });
    return res.redirect(302, `${appUrl}/?unsubscribeResult=success`);
  } catch (err) {
    console.error('Unsubscribe error:', err);
    if (req.method === 'POST') return res.status(500).json({ error: 'Unsubscribe failed' });
    return res.redirect(302, `${appUrl}/?unsubscribeResult=invalid`);
  }
}
