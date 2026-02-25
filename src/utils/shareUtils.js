import { db } from '../firebase/config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import LZString from 'lz-string';

const COLLECTION_NAME = 'sharedDashboards';
const EXPIRY_DAYS = 30;
const MAX_SIZE_KB = 900;
const CLEANUP_PROBABILITY = 0.15;

// Rate limiting constants
const RATE_LIMIT_KEY = 'caip_share_rate_limit';
const RATE_LIMIT_MAX = 15; // Maximum shares per time window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if rate limit allows another share creation
 * @returns {Object} { allowed: boolean, remainingTime: number (ms), sharesRemaining: number }
 */
export const checkRateLimit = () => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();

    if (!stored) {
      return { allowed: true, remainingTime: 0, sharesRemaining: RATE_LIMIT_MAX };
    }

    const timestamps = JSON.parse(stored);
    // Filter to only keep timestamps within the window
    const recentTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

    if (recentTimestamps.length >= RATE_LIMIT_MAX) {
      // Find when the oldest timestamp will expire
      const oldestTimestamp = Math.min(...recentTimestamps);
      const remainingTime = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
      return {
        allowed: false,
        remainingTime,
        sharesRemaining: 0
      };
    }

    return {
      allowed: true,
      remainingTime: 0,
      sharesRemaining: RATE_LIMIT_MAX - recentTimestamps.length
    };
  } catch {
    // If localStorage fails, allow the action
    return { allowed: true, remainingTime: 0, sharesRemaining: RATE_LIMIT_MAX };
  }
};

/**
 * Record a share creation for rate limiting
 */
const recordShareCreation = () => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();

    let timestamps = stored ? JSON.parse(stored) : [];
    // Filter to only keep timestamps within the window, then add new one
    timestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    timestamps.push(now);

    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

/**
 * Generate a unique share ID using base58 encoding
 * @param {number} length - Length of the ID (default 8)
 * @returns {string} Random ID
 */
export const generateShareId = (length = 8) => {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // base58
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length];
  }

  return result;
};

/**
 * Create a shareable dashboard link stored in Firebase
 * @param {Object} shareData - Dashboard data to share
 * @param {string} dashboardType - 'demand-capacity' or 'triage-slots'
 * @returns {Promise<Object>} { shareUrl, shareId, expiresAt }
 * @throws {Error} if data is too large or operation fails
 */
export const createFirebaseShare = async (shareData, dashboardType) => {
  // Check rate limit first
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    const minutesRemaining = Math.ceil(rateLimit.remainingTime / 60000);
    throw new Error(`Rate limit exceeded. Please wait ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} before creating another share link.`);
  }

  try {
    const compressed = LZString.compressToBase64(JSON.stringify(shareData));

    const sizeKB = compressed.length / 1024;
    if (sizeKB > MAX_SIZE_KB) {
      throw new Error(`Dashboard too large (${sizeKB.toFixed(0)}KB). Maximum is ${MAX_SIZE_KB}KB. Use Excel export instead.`);
    }

    const now = Timestamp.now();
    const expiresAt = new Timestamp(
      now.seconds + (EXPIRY_DAYS * 24 * 60 * 60),
      now.nanoseconds
    );

    let shareId;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      shareId = generateShareId(8);
      const docRef = doc(db, COLLECTION_NAME, shareId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        break;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique share ID. Please try again.');
      }
    }

    const shareDoc = {
      data: compressed,
      type: dashboardType,
      createdAt: now,
      expiresAt: expiresAt,
      version: '0.5.18',
      views: 0,
      lastViewedAt: null,
    };

    await setDoc(doc(db, COLLECTION_NAME, shareId), shareDoc);

    // Record successful creation for rate limiting
    recordShareCreation();

    const shareUrl = `${window.location.origin}/shared/${shareId}`;

    return {
      shareUrl,
      shareId,
      expiresAt: expiresAt.toDate(),
    };
  } catch (error) {
    if (error.message.includes('too large') || error.message.includes('Rate limit')) {
      throw error;
    }
    throw new Error(`Failed to create share link: ${error.message}`);
  }
};

/**
 * Load a shared dashboard from Firebase
 * @param {string} shareId - The share ID to load
 * @returns {Promise<Object>} Dashboard data
 * @throws {Error} if link not found, expired, or invalid
 */
export const loadFirebaseShare = async (shareId) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, shareId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Share link not found. It may have expired or been deleted.');
    }

    const shareDoc = docSnap.data();
    const now = Timestamp.now();

    if (shareDoc.expiresAt.seconds < now.seconds) {
      await deleteDoc(docRef);
      throw new Error('This share link has expired (30 day limit).');
    }

    const views = shareDoc.views || 0;
    await setDoc(docRef, {
      ...shareDoc,
      views: views + 1,
      lastViewedAt: now,
    });

    const decompressed = LZString.decompressFromBase64(shareDoc.data);
    if (!decompressed) {
      throw new Error('Failed to decompress dashboard data. The link may be corrupted.');
    }

    const dashboardData = JSON.parse(decompressed);

    return {
      ...dashboardData,
      type: shareDoc.type,
      createdAt: shareDoc.createdAt.toDate(),
      expiresAt: shareDoc.expiresAt.toDate(),
      views: views + 1,
    };
  } catch (error) {
    if (error.message.includes('expired') || error.message.includes('not found') || error.message.includes('corrupted')) {
      throw error;
    }
    throw new Error(`Failed to load share link: ${error.message}`);
  }
};

/**
 * Clean up expired shares from Firestore
 * Deletes up to 50 expired documents per run
 * @returns {Promise<number>} Number of documents deleted
 */
export const cleanupExpiredShares = async () => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, COLLECTION_NAME),
      where('expiresAt', '<', now)
    );

    const querySnapshot = await getDocs(q);
    let deletedCount = 0;

    const deletePromises = [];
    querySnapshot.forEach((docSnapshot) => {
      if (deletedCount < 50) {
        deletePromises.push(deleteDoc(docSnapshot.ref));
        deletedCount++;
      }
    });

    await Promise.all(deletePromises);

    return deletedCount;
  } catch (error) {
    // Silently ignore permission errors — Firestore rules may not allow deletes
    if (import.meta.env.DEV) {
      console.warn('[Share Cleanup] Skipped:', error.code || error.message);
    }
    return 0;
  }
};

/**
 * Probabilistically run cleanup on app load
 * Runs with 15% probability to avoid excessive Firestore reads
 * @returns {Promise<void>}
 */
export const maybeCleanupExpiredShares = async () => {
  if (Math.random() < CLEANUP_PROBABILITY) {
    const deleted = await cleanupExpiredShares();
    if (deleted > 0) {
      if (import.meta.env.DEV) console.log(`Cleaned up ${deleted} expired share links`);
    }
  }
};

// === COMPARISON SET FUNCTIONS ===

const COMPARISON_COLLECTION = 'comparisonSets';
const MAX_PRACTICES_IN_COMPARISON = 15;

/**
 * Create a comparison set from multiple share IDs
 * @param {string[]} shareIds - Array of share IDs to include (max 15)
 * @param {string} name - Optional name for the comparison
 * @returns {Promise<Object>} { comparisonId, comparisonUrl, expiresAt }
 * @throws {Error} if validation fails or operation errors
 */
export const createComparisonSet = async (shareIds, name = '') => {
  // Validate input
  if (!Array.isArray(shareIds) || shareIds.length < 2) {
    throw new Error('A comparison requires at least 2 practices.');
  }

  if (shareIds.length > MAX_PRACTICES_IN_COMPARISON) {
    throw new Error(`Maximum ${MAX_PRACTICES_IN_COMPARISON} practices allowed in a comparison.`);
  }

  // Check rate limit
  const rateLimit = checkRateLimit();
  if (!rateLimit.allowed) {
    const minutesRemaining = Math.ceil(rateLimit.remainingTime / 60000);
    throw new Error(`Rate limit exceeded. Please wait ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} before creating another comparison.`);
  }

  try {
    // Validate all share IDs exist and are demand-capacity type
    const validationResults = await Promise.allSettled(
      shareIds.map(async (id) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          throw new Error(`Share '${id}' not found`);
        }
        const data = docSnap.data();
        if (data.type !== 'demand-capacity') {
          throw new Error(`Share '${id}' is not a Demand & Capacity dashboard`);
        }
        if (data.expiresAt.seconds < Timestamp.now().seconds) {
          throw new Error(`Share '${id}' has expired`);
        }
        return { id, valid: true };
      })
    );

    // Check for validation failures
    const failures = validationResults.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const errorMessages = failures.map(f => f.reason.message).join('; ');
      throw new Error(`Invalid shares: ${errorMessages}`);
    }

    // Generate comparison ID
    let comparisonId;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      comparisonId = generateShareId(8);
      const docRef = doc(db, COMPARISON_COLLECTION, comparisonId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        break;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique comparison ID. Please try again.');
      }
    }

    const now = Timestamp.now();
    const expiresAt = new Timestamp(
      now.seconds + (EXPIRY_DAYS * 24 * 60 * 60),
      now.nanoseconds
    );

    // Create comparison document
    const comparisonDoc = {
      shareIds,
      name: name || `Comparison ${new Date().toLocaleDateString()}`,
      createdAt: now,
      expiresAt,
      views: 0,
      lastViewedAt: null,
      practiceCount: shareIds.length,
    };

    await setDoc(doc(db, COMPARISON_COLLECTION, comparisonId), comparisonDoc);

    // Record creation for rate limiting
    recordShareCreation();

    const comparisonUrl = `${window.location.origin}/compare/${comparisonId}`;

    return {
      comparisonId,
      comparisonUrl,
      expiresAt: expiresAt.toDate(),
    };
  } catch (error) {
    if (error.message.includes('Rate limit') || error.message.includes('Invalid shares') || error.message.includes('requires at least')) {
      throw error;
    }
    throw new Error(`Failed to create comparison: ${error.message}`);
  }
};

/**
 * Load a comparison set from Firebase
 * @param {string} comparisonId - The comparison ID to load
 * @returns {Promise<Object>} { shareIds, name, createdAt, expiresAt, views, practiceCount }
 * @throws {Error} if not found or expired
 */
export const loadComparisonSet = async (comparisonId) => {
  try {
    const docRef = doc(db, COMPARISON_COLLECTION, comparisonId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Comparison not found. It may have expired or been deleted.');
    }

    const data = docSnap.data();
    const now = Timestamp.now();

    // Check expiry
    if (data.expiresAt.seconds < now.seconds) {
      await deleteDoc(docRef);
      throw new Error('This comparison has expired (30 day limit).');
    }

    // Update view count
    await setDoc(docRef, {
      ...data,
      views: (data.views || 0) + 1,
      lastViewedAt: now,
    });

    return {
      shareIds: data.shareIds,
      name: data.name,
      createdAt: data.createdAt.toDate(),
      expiresAt: data.expiresAt.toDate(),
      views: (data.views || 0) + 1,
      practiceCount: data.practiceCount || data.shareIds.length,
    };
  } catch (error) {
    if (error.message.includes('expired') || error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to load comparison: ${error.message}`);
  }
};

/**
 * Load all practice data for a comparison
 * @param {string[]} shareIds - Array of share IDs to load
 * @returns {Promise<Object>} { practices: Array, errors: Array }
 */
export const loadComparisonPractices = async (shareIds) => {
  const results = await Promise.allSettled(
    shareIds.map(async (shareId) => {
      const data = await loadFirebaseShare(shareId);
      return {
        shareId,
        ...data,
        // Flatten config fields for easier access
        surgeryName: data.config?.surgeryName || 'Unknown',
        odsCode: data.config?.odsCode || '',
        population: data.config?.population,
      };
    })
  );

  const practices = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      practices.push(result.value);
    } else {
      errors.push({
        shareId: shareIds[index],
        error: result.reason.message,
        status: result.reason.message.includes('expired') ? 'expired' : 'error',
      });
    }
  });

  return { practices, errors };
};
