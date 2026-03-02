import { createHmac } from 'crypto';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tokenSecret = process.env.ADMIN_TOKEN_SECRET;
  if (!tokenSecret) {
    return res.status(500).json({ error: 'Admin authentication not configured on server.' });
  }

  const { token } = req.body || {};
  if (!token) {
    return res.status(401).json({ error: 'Token is required.' });
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const [timestamp, signature] = parts;
  const expectedSignature = createHmac('sha256', tokenSecret).update(timestamp).digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid token.' });
  }

  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge > TOKEN_EXPIRY_MS) {
    return res.status(401).json({ error: 'Token expired.' });
  }

  return res.status(200).json({ valid: true });
}
