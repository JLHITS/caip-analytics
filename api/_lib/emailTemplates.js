// Modern, branded HTML email templates for CAIP Analytics.
// Inline CSS only (email clients strip <style>). Table-based layout for
// Outlook/Office 365 compatibility. Mobile-responsive via inline media-query
// fallbacks. Every template returns { subject, html, text }.

const BRAND = {
  blue: '#005EB8',         // NHS Blue
  darkBlue: '#003087',     // NHS Dark Blue
  green: '#009639',        // NHS Green
  amber: '#ED8B00',        // NHS Amber
  purple: '#330072',       // NHS Purple
  aqua: '#00A9CE',         // NHS Aqua
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  white: '#ffffff',
};

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/* ----------------------------- Layout shell ----------------------------- */

function layout({ previewText = '', bodyHtml, footerHtml, accentColor }) {
  const accent = accentColor || BRAND.blue;
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>CAIP Analytics</title>
  <!--[if mso]>
  <style type="text/css">
    table, td, div, p, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.slate100};font-family:${FONT};color:${BRAND.slate900};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0px;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.slate100};opacity:0;">${previewText}</div>
  <div style="display:none;max-height:0px;overflow:hidden;">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.slate100};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header card -->
          <tr>
            <td style="padding:0 0 14px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.blue};background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.darkBlue} 100%);border-radius:14px;">
                <tr>
                  <td style="padding:22px 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle">
                          <span style="display:inline-block;background:rgba(255,255,255,0.16);color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">CAIP&nbsp;Analytics</span>
                          <div style="margin-top:8px;color:#ffffff;font-size:13px;line-height:1.4;opacity:0.92;">General practice appointment insights</div>
                        </td>
                        <td align="right" valign="middle" style="font-size:11px;color:#ffffff;opacity:0.78;">
                          caip.app
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main body card -->
          <tr>
            <td style="background:${BRAND.white};border:1px solid ${BRAND.slate200};border-radius:14px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
              <!-- Accent stripe -->
              <div style="height:4px;background:${accent};border-radius:14px 14px 0 0;line-height:4px;font-size:0;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:30px 32px 32px 32px;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${footerHtml ? `
          <!-- Footer -->
          <tr>
            <td style="padding:18px 28px 8px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;line-height:1.6;color:${BRAND.slate500};text-align:center;">
                    ${footerHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Brand signoff -->
          <tr>
            <td style="padding:14px 28px 0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size:11px;color:${BRAND.slate400};line-height:1.6;">
                    Built by Rushcliffe PCN &amp; Nottingham West PCN<br>
                    Free to use &middot; data processed locally in-browser
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ------------------------- Bulletproof button --------------------------- */

function button(label, href, color) {
  const bg = color || BRAND.blue;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;">
  <tr>
    <td align="center" bgcolor="${bg}" style="border-radius:10px;background:${bg};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">${label} &nbsp;&rarr;</a>
    </td>
  </tr>
</table>`;
}

function secondaryLink(label, href) {
  return `<a href="${href}" style="color:${BRAND.blue};text-decoration:none;font-weight:600;font-size:13px;">${label} &rarr;</a>`;
}

function divider() {
  return `<div style="height:1px;background:${BRAND.slate200};line-height:1px;font-size:0;margin:24px 0;">&nbsp;</div>`;
}

function infoTile({ label, value, accent }) {
  const c = accent || BRAND.blue;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.slate50};border:1px solid ${BRAND.slate200};border-left:3px solid ${c};border-radius:8px;">
  <tr>
    <td style="padding:12px 14px;">
      <div style="font-size:11px;color:${BRAND.slate500};text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${label}</div>
      <div style="font-size:15px;color:${BRAND.slate900};font-weight:600;margin-top:3px;">${value}</div>
    </td>
  </tr>
</table>`;
}

function unsubscribeFooter({ appUrl, unsubscribeToken, email }) {
  const unsubUrl = `${appUrl}/?unsubscribe=${encodeURIComponent(unsubscribeToken)}&email=${encodeURIComponent(email)}`;
  return `You're receiving this because you subscribed to updates at <a href="${appUrl}" style="color:${BRAND.blue};text-decoration:none;font-weight:600;">CAIP&nbsp;Analytics</a>.<br>
<a href="${unsubUrl}" style="color:${BRAND.slate500};text-decoration:underline;">Unsubscribe</a>
&nbsp;&middot;&nbsp;
<a href="${appUrl}" style="color:${BRAND.slate500};text-decoration:underline;">Open the app</a>`;
}

/* ----------------------------- Verification ----------------------------- */

export function verificationEmail({ appUrl, verificationToken, summary }) {
  const confirmUrl = `${appUrl}/?verify=${encodeURIComponent(verificationToken)}`;

  const body = `
    <div style="font-size:13px;color:${BRAND.blue};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">One more step</div>
    <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.slate900};">Confirm your subscription</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:${BRAND.slate700};">
      Tap the button below to confirm you'd like to receive these updates from CAIP&nbsp;Analytics. The link expires after a single use.
    </p>

    ${summary ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.slate50};border:1px solid ${BRAND.slate200};border-radius:10px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-size:11px;color:${BRAND.slate500};text-transform:uppercase;letter-spacing:0.6px;font-weight:600;margin-bottom:8px;">You'll receive</div>
          <div style="font-size:14px;line-height:1.7;color:${BRAND.slate900};">${summary}</div>
        </td>
      </tr>
    </table>` : ''}

    ${button('Confirm subscription', confirmUrl)}

    <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:${BRAND.slate500};">
      Button not working? Paste this link into your browser:<br>
      <a href="${confirmUrl}" style="color:${BRAND.blue};text-decoration:none;word-break:break-all;">${confirmUrl}</a>
    </p>

    ${divider()}

    <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.slate500};">
      <strong style="color:${BRAND.slate700};">Didn't ask to subscribe?</strong> No problem &mdash; just ignore this email and you won't hear from us.
    </p>
  `;

  return {
    subject: 'Confirm your CAIP Analytics subscription',
    html: layout({
      previewText: 'Confirm your subscription to CAIP Analytics — one click to activate.',
      bodyHtml: body,
      accentColor: BRAND.blue,
    }),
    text: `Confirm your CAIP Analytics subscription\n\nOpen this link to confirm:\n${confirmUrl}\n\nIf you didn't ask to subscribe, ignore this email.`,
  };
}

/* ------------------------ Practice data release ------------------------ */

const DATASET_LABELS = {
  appointments: 'Appointments',
  telephony: 'Telephony',
  oc: 'Online Consultations',
  workforce: 'Workforce',
};

const DATASET_DESCRIPTORS = {
  appointments: 'booking-to-attendance trends, modes, DNA rates and benchmarks',
  telephony: 'call volumes, answer rates, IVR drop-off and wait times',
  oc: 'submission volumes, supplier mix, clinical/admin split and trends',
  workforce: 'GP, nurse and DPC headcount, FTE and skill-mix trends',
};

export function practiceDataEmail({
  appUrl, practiceName, odsCode, dataset, month,
  wantsAIAnalysis, unsubscribeToken, email,
}) {
  const datasetLabel = DATASET_LABELS[dataset] || dataset;
  const descriptor = DATASET_DESCRIPTORS[dataset] || 'the latest figures';
  const practiceLink = `${appUrl}/?practice=${encodeURIComponent(odsCode)}`;
  const analysisLink = `${practiceLink}&autoAnalyze=true`;

  const body = `
    <div style="font-size:13px;color:${BRAND.green};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">New data released</div>
    <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.slate900};">
      ${month} ${datasetLabel} data is live
    </h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:${BRAND.slate700};">
      The latest ${datasetLabel.toLowerCase()} release for <strong style="color:${BRAND.slate900};">${practiceName}</strong> has just been published. Open CAIP&nbsp;Analytics to explore ${descriptor}.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
      <tr>
        <td width="50%" style="padding:0 6px 8px 0;" valign="top">
          ${infoTile({ label: 'Practice', value: `${practiceName}<br><span style="color:${BRAND.slate500};font-weight:500;font-size:13px;">${odsCode}</span>`, accent: BRAND.blue })}
        </td>
        <td width="50%" style="padding:0 0 8px 6px;" valign="top">
          ${infoTile({ label: 'Release', value: `${month}<br><span style="color:${BRAND.slate500};font-weight:500;font-size:13px;">${datasetLabel}</span>`, accent: BRAND.green })}
        </td>
      </tr>
    </table>

    ${wantsAIAnalysis ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#f5f3ff 0%,#eef2ff 100%);border:1px solid #ddd6fe;border-radius:12px;margin:0 0 22px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:11px;color:${BRAND.purple};font-weight:700;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px;">&#10024; CAIP AI Analysis</div>
          <div style="font-size:14px;line-height:1.6;color:${BRAND.slate900};margin-bottom:14px;">
            One tap to generate a fresh AI-written summary of this month's figures, trends and benchmark position.
          </div>
          ${button('Generate my AI analysis', analysisLink, BRAND.purple)}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${BRAND.slate500};text-align:center;">
      Or just ${secondaryLink('view the data without AI analysis', practiceLink)}
    </p>
    ` : `
    ${button('View ' + datasetLabel + ' data', practiceLink)}

    <p style="margin:14px 0 0 0;font-size:12px;line-height:1.6;color:${BRAND.slate500};">
      Tip: in CAIP&nbsp;Analytics you can opt-in to AI-written summaries from the practice dashboard for a one-tap deep dive next month.
    </p>
    `}

    ${divider()}

    <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.slate500};">
      Data source: NHS England open data &middot; updated monthly. CAIP&nbsp;Analytics is for decision support only and does not constitute clinical advice.
    </p>
  `;

  return {
    subject: `${month} ${datasetLabel} data is now live for ${practiceName}`,
    html: layout({
      previewText: `${month} ${datasetLabel.toLowerCase()} data for ${practiceName} is ready to explore.`,
      bodyHtml: body,
      footerHtml: unsubscribeFooter({ appUrl, unsubscribeToken, email }),
      accentColor: BRAND.green,
    }),
    text: `New ${datasetLabel} data for ${practiceName} (${odsCode})\n\nThe ${month} release has been published.\n\nView data: ${practiceLink}\n${wantsAIAnalysis ? `Generate AI analysis: ${analysisLink}\n` : ''}\nUnsubscribe: ${appUrl}/?unsubscribe=${unsubscribeToken}&email=${encodeURIComponent(email)}`,
  };
}

/* ------------------------------ News blast ----------------------------- */

export function newsBlastEmail({ appUrl, headline, newsBody, unsubscribeToken, email }) {
  const paragraphs = newsBody
    .split(/\n\n+/)
    .map(para => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:${BRAND.slate700};">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');

  const body = `
    <div style="font-size:13px;color:${BRAND.amber};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">&#128226; Platform update</div>
    <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.slate900};">${headline}</h1>

    ${paragraphs}

    <div style="margin-top:24px;">
      ${button('Open CAIP Analytics', appUrl)}
    </div>
  `;

  return {
    subject: headline,
    html: layout({
      previewText: headline,
      bodyHtml: body,
      footerHtml: unsubscribeFooter({ appUrl, unsubscribeToken, email }),
      accentColor: BRAND.amber,
    }),
    text: `${headline}\n\n${newsBody}\n\nOpen CAIP Analytics: ${appUrl}\n\nUnsubscribe: ${appUrl}/?unsubscribe=${unsubscribeToken}&email=${encodeURIComponent(email)}`,
  };
}

/* -------------------- All-data release digest -------------------------- */

export function allDataReleaseEmail({ appUrl, dataset, month, unsubscribeToken, email }) {
  const datasetLabel = DATASET_LABELS[dataset] || dataset;
  const descriptor = DATASET_DESCRIPTORS[dataset] || 'the latest national figures';

  const body = `
    <div style="font-size:13px;color:${BRAND.aqua};font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">National release</div>
    <h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.slate900};">
      ${month} ${datasetLabel} data has been published
    </h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:${BRAND.slate700};">
      NHS England has released the latest ${datasetLabel.toLowerCase()} dataset. CAIP&nbsp;Analytics is updated with ${month} figures and ready to explore &mdash; including ${descriptor}.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px 0;">
      <tr>
        <td width="50%" style="padding:0 6px 0 0;" valign="top">
          ${infoTile({ label: 'Dataset', value: datasetLabel, accent: BRAND.aqua })}
        </td>
        <td width="50%" style="padding:0 0 0 6px;" valign="top">
          ${infoTile({ label: 'Coverage', value: month, accent: BRAND.blue })}
        </td>
      </tr>
    </table>

    ${button('Open CAIP Analytics', appUrl)}

    ${divider()}

    <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.slate500};">
      Want practice-specific alerts instead of every release? Open the app, find your practice and tap the bell icon to subscribe just to that one.
    </p>
  `;

  return {
    subject: `${month} ${datasetLabel} data released`,
    html: layout({
      previewText: `${month} ${datasetLabel} data is live in CAIP Analytics.`,
      bodyHtml: body,
      footerHtml: unsubscribeFooter({ appUrl, unsubscribeToken, email }),
      accentColor: BRAND.aqua,
    }),
    text: `${month} ${datasetLabel} data has been released.\n\nExplore in CAIP Analytics: ${appUrl}\n\nUnsubscribe: ${appUrl}/?unsubscribe=${unsubscribeToken}&email=${encodeURIComponent(email)}`,
  };
}
