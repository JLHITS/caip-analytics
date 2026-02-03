/**
 * CAIP Analysis Storage Utilities
 *
 * Handles saving and loading CAIP analyses to/from Firebase.
 * Each analysis is cached by practice ODS code + month.
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
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

    console.log(`CAIP Analysis saved for ${odsCode} (${month})`);
    return true;
  } catch (error) {
    console.error('Error saving CAIP analysis:', error);
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
    console.error('Error loading CAIP analysis:', error);
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
    console.error('Error checking CAIP analysis status:', error);
    return { exists: false, isStale: false, analysis: null };
  }
}

export default {
  saveAnalysis,
  loadAnalysis,
  hasAnalysis,
  checkAnalysisStatus,
};
