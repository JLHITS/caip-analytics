import { requireAdminToken } from './_lib/verifyAdminToken.js';
import {
  querySubscribers,
  logDispatch,
  updateDispatch,
  markLastNotified,
} from './_lib/subscriptionStore.js';
import { sendBatch, getAppUrl } from './_lib/sendEmail.js';
import {
  practiceDataEmail,
  newsBlastEmail,
  allDataReleaseEmail,
} from './_lib/emailTemplates.js';

const VALID_TYPES = ['data-release', 'news-blast', 'all-data'];
const VALID_DATASETS = ['appointments', 'telephony', 'oc', 'workforce'];
const FAILURE_LOG_CAP = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAdminToken(req, res)) return;

  const {
    type,
    dataset = null,
    month = null,
    odsCode = null,
    practiceName = null,
    headline = null,
    body = null,
    newsId = null,
    dryRun = false,
  } = req.body || {};

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if ((type === 'data-release' || type === 'all-data') && !VALID_DATASETS.includes(dataset)) {
    return res.status(400).json({ error: `dataset must be one of: ${VALID_DATASETS.join(', ')}` });
  }
  if ((type === 'data-release' || type === 'all-data') && !month) {
    return res.status(400).json({ error: 'month is required for data releases.' });
  }
  if (type === 'data-release' && !odsCode) {
    return res.status(400).json({ error: 'odsCode is required for practice data releases.' });
  }
  if (type === 'news-blast' && (!headline || !body)) {
    return res.status(400).json({ error: 'headline and body are required for news blasts.' });
  }

  try {
    const recipients = await querySubscribers({ type, odsCode });
    const targeted = recipients.length;

    if (dryRun) {
      return res.status(200).json({ dryRun: true, targeted });
    }
    if (targeted === 0) {
      const dispatchId = await logDispatch({
        triggeredBy: 'admin',
        type,
        dataset,
        month,
        odsCode,
        practiceName,
        newsId,
        subscribersTargeted: 0,
        emailsSent: 0,
        emailsFailed: 0,
        failures: [],
      });
      await updateDispatch(dispatchId, {});
      return res.status(200).json({ dispatchId, targeted: 0, sent: 0, failed: 0 });
    }

    const dispatchId = await logDispatch({
      triggeredBy: 'admin',
      type,
      dataset,
      month,
      odsCode,
      practiceName,
      newsId,
      subscribersTargeted: targeted,
      emailsSent: 0,
      emailsFailed: 0,
      failures: [],
    });

    const appUrl = getAppUrl();

    const unsubscribeHeaders = (sub) => {
      const url = `${appUrl}/?unsubscribe=${encodeURIComponent(sub.unsubscribeToken)}&email=${encodeURIComponent(sub.email)}`;
      return {
        'List-Unsubscribe': `<${url}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    };

    const buildMessage = (sub) => {
      const headers = unsubscribeHeaders(sub);
      if (type === 'data-release') {
        const tpl = practiceDataEmail({
          appUrl,
          practiceName: practiceName || odsCode,
          odsCode,
          dataset,
          month,
          wantsAIAnalysis: !!sub.wantsAIAnalysis,
          unsubscribeToken: sub.unsubscribeToken,
          email: sub.email,
        });
        return { to: sub.email, ...tpl, headers };
      }
      if (type === 'news-blast') {
        const tpl = newsBlastEmail({
          appUrl,
          headline,
          newsBody: body,
          unsubscribeToken: sub.unsubscribeToken,
          email: sub.email,
        });
        return { to: sub.email, ...tpl, headers };
      }
      // all-data
      const tpl = allDataReleaseEmail({
        appUrl,
        dataset,
        month,
        unsubscribeToken: sub.unsubscribeToken,
        email: sub.email,
      });
      return { to: sub.email, ...tpl, headers };
    };

    const result = await sendBatch(recipients, buildMessage, { concurrency: 2 });

    const sentRecipients = recipients.filter(r => !result.failures.find(f => f.email === r.email));
    const lastNotifiedField = type === 'news-blast' ? 'news' : (dataset || 'data');
    await markLastNotified(sentRecipients.map(r => r.id), lastNotifiedField);

    await updateDispatch(dispatchId, {
      emailsSent: result.sent,
      emailsFailed: result.failed,
      failures: result.failures.slice(0, FAILURE_LOG_CAP),
    });

    return res.status(200).json({
      dispatchId,
      targeted,
      sent: result.sent,
      failed: result.failed,
      failures: result.failures,
    });
  } catch (err) {
    console.error('send-notifications error', err);
    return res.status(500).json({ error: err.message || 'Failed to send notifications.' });
  }
}
