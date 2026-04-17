import { verifyAdminToken } from './_lib/verifyAdminToken.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body || {};
  const result = verifyAdminToken(token);
  if (!result.valid) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.status(200).json({ valid: true });
}
