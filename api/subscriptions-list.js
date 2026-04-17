import { requireAdminToken } from './_lib/verifyAdminToken.js';
import { countSubscribers, listAllSubscribers, listDispatches } from './_lib/subscriptionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAdminToken(req, res)) return;

  try {
    const [stats, subscribers, dispatches] = await Promise.all([
      countSubscribers(),
      listAllSubscribers(),
      listDispatches(20),
    ]);
    return res.status(200).json({ stats, subscribers, dispatches });
  } catch (err) {
    console.error('subscriptions-list error', err);
    return res.status(500).json({ error: err.message || 'Failed to load subscriptions.' });
  }
}
