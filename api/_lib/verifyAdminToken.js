import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify an admin HMAC token (format: "timestamp.signature").
 * Returns { valid: true } or { valid: false, error: string, status: number }.
 */
export function verifyAdminToken(token) {
  const tokenSecret = process.env.ADMIN_TOKEN_SECRET;
  if (!tokenSecret) {
    return { valid: false, error: 'Admin authentication not configured on server.', status: 500 };
  }
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is required.', status: 401 };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token.', status: 401 };
  }

  const [timestamp, signature] = parts;
  const expectedSignature = createHmac('sha256', tokenSecret).update(timestamp).digest('hex');

  let sigBuf, expBuf;
  try {
    sigBuf = Buffer.from(signature, 'hex');
    expBuf = Buffer.from(expectedSignature, 'hex');
  } catch {
    return { valid: false, error: 'Invalid token.', status: 401 };
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid token.', status: 401 };
  }

  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge > TOKEN_EXPIRY_MS) {
    return { valid: false, error: 'Token expired.', status: 401 };
  }

  return { valid: true };
}

/**
 * Convenience guard for API handlers. Reads token from `req.headers.authorization`
 * (Bearer scheme) or `req.body.adminToken`. Writes 401/500 and returns false if invalid.
 */
export function requireAdminToken(req, res) {
  const authHeader = req.headers?.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || req.body?.adminToken;

  const result = verifyAdminToken(token);
  if (!result.valid) {
    res.status(result.status).json({ error: result.error });
    return false;
  }
  return true;
}
