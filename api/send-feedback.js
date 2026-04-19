const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const RECIPIENT = { email: 'jason.gomez@nhs.net', name: 'Jason Gomez' };
const SENDER = { email: 'noreply@caip.app', name: 'CAIP.app Feedback' };
const NHS_EMAIL_PATTERN = /^[^\s@]+@nhs\.(net|uk)$/i;
const ALLOWED_FEEDBACK_TYPES = new Set([
  'Bug Report',
  'Feature Request',
  'General Feedback',
  'Data Issue',
]);

const isNhsEmail = (email) => NHS_EMAIL_PATTERN.test(String(email || '').trim());

const cleanText = (value, maxLength = 1000) => (
  String(value || '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, maxLength)
);

const escapeHtml = (value) => (
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const formatRows = (entries) => entries
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([label, value]) => `
    <tr>
      <th style="text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#334155;">${escapeHtml(label)}</th>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#475569;">${escapeHtml(value)}</td>
    </tr>
  `)
  .join('');

const buildDiagnosticRows = (diagnosticData) => {
  if (!diagnosticData || typeof diagnosticData !== 'object') {
    return '';
  }

  return formatRows(Object.entries(diagnosticData).map(([key, value]) => [
    key,
    typeof value === 'object' ? JSON.stringify(value) : value,
  ]));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Brevo API key not configured on server.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }
  const feedbackType = ALLOWED_FEEDBACK_TYPES.has(body.feedbackType)
    ? body.feedbackType
    : 'General Feedback';
  const message = cleanText(body.message, 10000);
  const name = cleanText(body.name, 200);
  const email = cleanText(body.email, 320).toLowerCase();
  const practice = body.practice && typeof body.practice === 'object'
    ? {
        odsCode: cleanText(body.practice.odsCode, 20),
        practiceName: cleanText(body.practice.practiceName, 300),
        icb: cleanText(body.practice.icb, 300),
        pcn: cleanText(body.practice.pcn, 300),
      }
    : null;
  const diagnosticData = body.diagnosticData && typeof body.diagnosticData === 'object'
    ? body.diagnosticData
    : null;

  if (!message) {
    return res.status(400).json({ error: 'Feedback message is required.' });
  }

  if (email && !isNhsEmail(email)) {
    return res.status(400).json({
      error: 'Please use your NHS email address (@nhs.net or @nhs.uk)',
    });
  }

  const subjectParts = [`[CAIP.app] ${feedbackType}`];
  if (practice?.practiceName) {
    subjectParts.push(practice.practiceName);
  }
  const subject = subjectParts.join(' - ').replace(/[\r\n]+/g, ' ').slice(0, 180);

  const practiceRows = practice ? formatRows([
    ['Practice', practice.practiceName],
    ['ODS Code', practice.odsCode],
    ['PCN', practice.pcn],
    ['ICB', practice.icb],
  ]) : '';
  const diagnosticRows = buildDiagnosticRows(diagnosticData);

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 16px;color:#005eb8;">CAIP.app Feedback</h2>
      <table style="border-collapse:collapse;margin-bottom:18px;">
        ${formatRows([
          ['Feedback Type', feedbackType],
          ['Name', name || 'Not provided'],
          ['Email', email || 'Not provided'],
        ])}
      </table>

      ${practiceRows ? `
        <h3 style="margin:18px 0 8px;color:#1e293b;">Practice</h3>
        <table style="border-collapse:collapse;margin-bottom:18px;">${practiceRows}</table>
      ` : ''}

      <h3 style="margin:18px 0 8px;color:#1e293b;">Message</h3>
      <div style="white-space:pre-wrap;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc;color:#0f172a;">${escapeHtml(message)}</div>

      ${diagnosticRows ? `
        <h3 style="margin:18px 0 8px;color:#1e293b;">Diagnostic Data</h3>
        <table style="border-collapse:collapse;margin-bottom:18px;">${diagnosticRows}</table>
      ` : ''}
    </div>
  `;

  const payload = {
    sender: SENDER,
    to: [RECIPIENT],
    subject,
    htmlContent,
    ...(email ? { replyTo: { email, name: name || undefined } } : {}),
  };

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Brevo API error:', response.status, errorData);
      return res.status(response.status).json({
        error: errorData.message || `Brevo API error (${response.status})`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Feedback send error:', error.message);
    return res.status(500).json({ error: `Feedback failed: ${error.message}` });
  }
}
