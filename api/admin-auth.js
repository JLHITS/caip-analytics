import { createHmac } from 'crypto';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const tokenSecret = process.env.ADMIN_TOKEN_SECRET;

  if (!adminPassword || !tokenSecret) {
    return res.status(500).json({ error: 'Admin authentication not configured on server.' });
  }

  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Create a signed token: timestamp.hmacSignature
  const timestamp = Date.now().toString();
  const signature = createHmac('sha256', tokenSecret).update(timestamp).digest('hex');
  const token = `${timestamp}.${signature}`;

  return res.status(200).json({ token });
}
