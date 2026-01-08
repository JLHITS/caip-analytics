import { db } from '../firebase/config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import LZString from 'lz-string';

const COLLECTION_NAME = 'sharedDashboards';
const EXPIRY_DAYS = 30;
const MAX_SIZE_KB = 900;
const CLEANUP_PROBABILITY = 0.15;

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

    const shareUrl = `${window.location.origin}/shared/${shareId}`;

    return {
      shareUrl,
      shareId,
      expiresAt: expiresAt.toDate(),
    };
  } catch (error) {
    if (error.message.includes('too large')) {
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
    console.error('Failed to cleanup expired shares:', error);
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
      console.log(`Cleaned up ${deleted} expired share links`);
    }
  }
};
