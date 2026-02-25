/**
 * CAIP Analysis Storage Utilities
 *
 * Handles saving and loading CAIP analyses to/from Firebase.
 * Each analysis is cached by practice ODS code + month.
 */

import { doc, getDoc, setDoc, getDocs, deleteDoc, Timestamp, collection } from 'firebase/firestore';
import { db } from '../firebase/config';

// Current prompt version - increment when prompt changes significantly
// v1.0 - Initial release
// v2.0 - Added practice model detection (Traditional/Hybrid/Total Triage),
//        GP-only metrics, same-day booking context-dependent interpretation
const PROMPT_VERSION = '2.0';

/**
 * Generate document ID for an analysis
 * @param {string} odsCode - Practice ODS code
 * @param {string} month - Month string (e.g., "November 2025")
 * @returns {string} Document ID
 */
function getDocumentId(odsCode, month) {
  // Sanitize the month string for use as document ID
  const sanitizedMonth = month.replace(/\s+/g, '_');
  return `${odsCode}_${sanitizedMonth}`;
}

/**
 * Save an analysis to Firebase
 *
 * @param {Object} params
 * @param {string} params.odsCode - Practice ODS code
 * @param {string} params.practiceName - Practice name
 * @param {string} params.month - Month string (e.g., "November 2025")
 * @param {string} params.analysis - The AI-generated analysis text
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveAnalysis({ odsCode, practiceName, month, analysis }) {
  try {
    const docId = getDocumentId(odsCode, month);
    const docRef = doc(db, 'caip-analyses', docId);

    await setDoc(docRef, {
      odsCode,
      practiceName,
      month,
      analysis,
      generatedAt: Timestamp.now(),
      promptVersion: PROMPT_VERSION,
    });

    return true;
  } catch (error) {
    // Only log errors in development
    if (import.meta.env.DEV) {
      console.error('[CAIP Cache] Error saving analysis:', error.code);
    }
    return false;
  }
}

/**
 * Load an analysis from Firebase
 *
 * @param {string} odsCode - Practice ODS code
 * @param {string} month - Month string (e.g., "November 2025")
 * @returns {Promise<Object|null>} Analysis object or null if not found
 */
export async function loadAnalysis(odsCode, month) {
  try {
    const docId = getDocumentId(odsCode, month);
    const docRef = doc(db, 'caip-analyses', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        odsCode: data.odsCode,
        practiceName: data.practiceName,
        month: data.month,
        analysis: data.analysis,
        generatedAt: data.generatedAt?.toDate() || null,
        promptVersion: data.promptVersion,
      };
    }

    return null;
  } catch (error) {
    // Only log errors in development
    if (import.meta.env.DEV) {
      console.error('[CAIP Cache] Error loading analysis:', error.code);
    }
    return null;
  }
}

/**
 * Check if an analysis exists for a practice/month
 *
 * @param {string} odsCode - Practice ODS code
 * @param {string} month - Month string (e.g., "November 2025")
 * @returns {Promise<boolean>} True if analysis exists
 */
export async function hasAnalysis(odsCode, month) {
  try {
    const docId = getDocumentId(odsCode, month);
    const docRef = doc(db, 'caip-analyses', docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking CAIP analysis:', error);
    return false;
  }
}

/**
 * Check if an analysis exists and is recent (within last 30 days)
 * Stale analyses can be regenerated
 *
 * @param {string} odsCode - Practice ODS code
 * @param {string} month - Month string (e.g., "November 2025")
 * @returns {Promise<{exists: boolean, isStale: boolean, analysis: Object|null}>}
 */
export async function checkAnalysisStatus(odsCode, month) {
  try {
    const analysis = await loadAnalysis(odsCode, month);

    if (!analysis) {
      return { exists: false, isStale: false, analysis: null };
    }

    // Check if analysis is older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const isStale = analysis.generatedAt && analysis.generatedAt < thirtyDaysAgo;

    // Also check if prompt version has changed
    const isOutdatedPrompt = analysis.promptVersion !== PROMPT_VERSION;

    return {
      exists: true,
      isStale: isStale || isOutdatedPrompt,
      analysis,
    };
  } catch (error) {
    // Silently fail - Firebase permissions may not be configured
    return { exists: false, isStale: false, analysis: null };
  }
}

/**
 * List all stored CAIP analyses
 * @returns {Promise<Array>} Array of analysis metadata objects
 */
export async function listAllAnalyses() {
  try {
    const snapshot = await getDocs(collection(db, 'caip-analyses'));
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      generatedAt: d.data().generatedAt?.toDate() || null,
    })).sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));
  } catch (error) {
    if (import.meta.env.DEV) console.error('[CAIP Cache] Error listing analyses:', error.code);
    return [];
  }
}

/**
 * Delete a single CAIP analysis by ODS code and month
 * @param {string} odsCode
 * @param {string} month
 * @returns {Promise<boolean>}
 */
export async function deleteAnalysis(odsCode, month) {
  try {
    const docId = getDocumentId(odsCode, month);
    await deleteDoc(doc(db, 'caip-analyses', docId));
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.error('[CAIP Cache] Error deleting analysis:', error.code);
    return false;
  }
}

/**
 * Delete all CAIP analyses for a specific ODS code (all months)
 * @param {string} odsCode
 * @returns {Promise<number>} Number of documents deleted
 */
export async function deleteAllAnalysesForPractice(odsCode) {
  try {
    const snapshot = await getDocs(collection(db, 'caip-analyses'));
    const toDelete = snapshot.docs.filter(d => d.data().odsCode === odsCode);
    await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
    return toDelete.length;
  } catch (error) {
    if (import.meta.env.DEV) console.error('[CAIP Cache] Error deleting practice analyses:', error.code);
    return 0;
  }
}

/**
 * Delete ALL CAIP analyses from Firebase
 * @returns {Promise<number>} Number of documents deleted
 */
export async function clearAllAnalyses() {
  try {
    const snapshot = await getDocs(collection(db, 'caip-analyses'));
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    return snapshot.docs.length;
  } catch (error) {
    if (import.meta.env.DEV) console.error('[CAIP Cache] Error clearing all analyses:', error.code);
    return 0;
  }
}

/**
 * List all practice usage records
 * @returns {Promise<Array>} Array of practice usage objects sorted by most recent
 */
export async function listPracticeUsage() {
  try {
    const snapshot = await getDocs(collection(db, 'practiceUsage'));
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => {
      const aTime = a.lastUsed?.toDate?.() || a.lastUsed || 0;
      const bTime = b.lastUsed?.toDate?.() || b.lastUsed || 0;
      return bTime - aTime;
    });
    return data;
  } catch (error) {
    if (error?.code === 'permission-denied') throw error;
    throw error;
  }
}

/**
 * Validate a beta access code
 * Checks if the code exists in Firestore and has not been used
 *
 * @param {string} code - The beta access code to validate
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function validateBetaCode(code) {
  try {
    const docRef = doc(db, 'beta-access-codes', code);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { valid: false, error: 'Code not found. Please check your code and try again.' };
    }

    const data = docSnap.data();
    if (data.used) {
      return { valid: false, error: 'This code has already been used.' };
    }

    return { valid: true, error: null };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Beta Code] Error validating code:', error.code);
    }
    return { valid: false, error: 'Unable to verify code. Please try again.' };
  }
}

/**
 * Mark a beta access code as used after successful analysis generation
 *
 * @param {string} code - The beta access code
 * @param {string} odsCode - The ODS code of the practice that used it
 * @returns {Promise<boolean>} True if marked successfully
 */
export async function consumeBetaCode(code, odsCode) {
  try {
    const docRef = doc(db, 'beta-access-codes', code);
    await setDoc(docRef, {
      used: true,
      usedAt: Timestamp.now(),
      usedBy: odsCode,
    }, { merge: true });
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Beta Code] Error consuming code:', error.code);
    }
    return false;
  }
}

export default {
  saveAnalysis,
  loadAnalysis,
  hasAnalysis,
  checkAnalysisStatus,
  listAllAnalyses,
  deleteAnalysis,
  deleteAllAnalysesForPractice,
  clearAllAnalyses,
  listPracticeUsage,
  validateBetaCode,
  consumeBetaCode,
};
