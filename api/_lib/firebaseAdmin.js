import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let cachedDb = null;

/**
 * Lazily initialise a Firebase Admin app singleton and return a Firestore instance.
 *
 * Requires env var FIREBASE_SERVICE_ACCOUNT containing either:
 *  - the full service account JSON as a string, OR
 *  - a base64-encoded service account JSON (recommended for Vercel env vars).
 */
export function getAdminDb() {
  if (cachedDb) return cachedDb;

  if (getApps().length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set.');
    }

    let serviceAccount;
    try {
      const jsonStr = raw.trim().startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf8');
      serviceAccount = JSON.parse(jsonStr);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT could not be parsed as JSON: ' + err.message);
    }

    initializeApp({ credential: cert(serviceAccount) });
  }

  cachedDb = getFirestore();
  return cachedDb;
}
