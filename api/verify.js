import { findByVerificationToken, markVerified } from './_lib/subscriptionStore.js';
import { getAppUrl } from './_lib/sendEmail.js';

/**
 * Handle email verification links from the confirmation email.
 *
 * GET /api/verify?token=xxx
 *   → redirect to `${APP_URL}/?verifyResult=success|invalid|expired`
 *
 * We use a redirect instead of JSON so users clicking a link in their
 * mail client land back in the app with a friendly confirmation.
 */
export default async function handler(req, res) {
  const appUrl = getAppUrl();
  const token = req.query?.token || req.body?.token;

  if (!token) {
    return res.redirect(302, `${appUrl}/?verifyResult=invalid`);
  }

  try {
    const sub = await findByVerificationToken(token);
    if (!sub) {
      return res.redirect(302, `${appUrl}/?verifyResult=invalid`);
    }
    if (sub.verified) {
      // Already verified — still friendly, not an error
      return res.redirect(302, `${appUrl}/?verifyResult=success`);
    }
    await markVerified(sub.id);
    return res.redirect(302, `${appUrl}/?verifyResult=success`);
  } catch (err) {
    console.error('Verify error:', err);
    return res.redirect(302, `${appUrl}/?verifyResult=invalid`);
  }
}
