// Brevo (formerly Sendinblue) transactional email wrapper.
// Uses Brevo's REST API directly via fetch — no SDK dependency required.
// Docs: https://developers.brevo.com/reference/sendtransacemail

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function getApiKey() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY env var is not set.');
  return apiKey;
}

/**
 * Returns { email, name } for the From address.
 * Accepts BREVO_FROM_EMAIL as either a plain email ("alerts@caip.app")
 * or in "Name <email>" form. BREVO_FROM_NAME overrides the parsed name.
 */
export function getFromAddress() {
  const raw = process.env.BREVO_FROM_EMAIL || 'alerts@caip.app';
  const explicitName = process.env.BREVO_FROM_NAME;
  const match = raw.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (match) {
    return { name: explicitName || match[1], email: match[2] };
  }
  return { name: explicitName || 'CAIP Analytics', email: raw.trim() };
}

export function getAppUrl() {
  return (process.env.APP_URL || 'https://caip.app').replace(/\/$/, '');
}

/**
 * Send a single email via Brevo's transactional API.
 * Returns { id } on success or throws on failure.
 */
export async function sendEmail({ to, subject, html, text, headers }) {
  const sender = getFromAddress();
  const recipients = (Array.isArray(to) ? to : [to]).map(addr =>
    typeof addr === 'string' ? { email: addr } : addr
  );

  const body = {
    sender,
    to: recipients,
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
    ...(headers ? { headers } : {}),
  };

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': getApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.message || data?.code || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Brevo send failed (${res.status}): ${detail || 'unknown error'}`);
  }

  const data = await res.json().catch(() => ({}));
  return { id: data?.messageId || null };
}

/**
 * Send many emails sequentially with a small pause between batches to avoid
 * Brevo's rate limit (free tier: 10 req/sec on transactional). Captures
 * individual failures rather than aborting the whole run.
 *
 * Returns { sent, failed, failures: [{email, error}] }.
 */
export async function sendBatch(recipients, buildMessage, { concurrency = 4 } = {}) {
  const sent = [];
  const failures = [];

  for (let i = 0; i < recipients.length; i += concurrency) {
    const slice = recipients.slice(i, i + concurrency);
    await Promise.all(slice.map(async r => {
      try {
        const msg = buildMessage(r);
        await sendEmail(msg);
        sent.push(r.email);
      } catch (err) {
        failures.push({ email: r.email, error: err.message });
      }
    }));
    if (i + concurrency < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return { sent: sent.length, failed: failures.length, failures };
}
