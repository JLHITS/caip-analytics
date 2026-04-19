import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';

const SUBS_COLLECTION = 'emailSubscriptions';
const DISPATCH_COLLECTION = 'notificationDispatches';

export function normaliseEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@nhs\.(net|uk)$/i.test(email) && email.length <= 254;
}

export function generateToken(bytes = 24) {
  return randomBytes(bytes).toString('hex');
}

/**
 * Create or update a subscription keyed by email.
 * Merges new preferences rather than overwriting. Always creates a fresh
 * verification token so verify links in older emails are invalidated.
 */
export async function upsertSubscription({
  email,
  practices = [],
  wantsAIAnalysis = false,
  subscribedToNews = false,
  subscribedToAllDataReleases = false,
  signupSource = 'unknown',
}) {
  const db = getAdminDb();
  const normalised = normaliseEmail(email);

  const existingSnap = await db.collection(SUBS_COLLECTION)
    .where('email', '==', normalised)
    .limit(1)
    .get();

  const verificationToken = generateToken(16);
  const now = FieldValue.serverTimestamp();

  if (!existingSnap.empty) {
    const docRef = existingSnap.docs[0].ref;
    const existing = existingSnap.docs[0].data();
    const mergedPractices = Array.from(new Set([
      ...(existing.practices || []),
      ...practices,
    ]));
    await docRef.update({
      practices: mergedPractices,
      wantsAIAnalysis: wantsAIAnalysis || existing.wantsAIAnalysis || false,
      subscribedToNews: subscribedToNews || existing.subscribedToNews || false,
      subscribedToAllDataReleases: subscribedToAllDataReleases || existing.subscribedToAllDataReleases || false,
      verificationToken,
      updatedAt: now,
      metadata: { signupSource },
    });
    return { id: docRef.id, email: normalised, verificationToken, alreadyExisted: true, verified: existing.verified === true };
  }

  const unsubscribeToken = generateToken(24);
  const docRef = await db.collection(SUBS_COLLECTION).add({
    email: normalised,
    verified: false,
    verificationToken,
    unsubscribeToken,
    practices,
    wantsAIAnalysis,
    subscribedToNews,
    subscribedToAllDataReleases,
    createdAt: now,
    verifiedAt: null,
    lastNotifiedAt: {},
    metadata: { signupSource },
  });
  return { id: docRef.id, email: normalised, verificationToken, alreadyExisted: false, verified: false };
}

export async function findByVerificationToken(token) {
  if (!token) return null;
  const db = getAdminDb();
  const snap = await db.collection(SUBS_COLLECTION)
    .where('verificationToken', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function markVerified(docId) {
  const db = getAdminDb();
  await db.collection(SUBS_COLLECTION).doc(docId).update({
    verified: true,
    verifiedAt: FieldValue.serverTimestamp(),
    verificationToken: FieldValue.delete(),
  });
}

export async function findByUnsubscribeToken(token) {
  if (!token) return null;
  const db = getAdminDb();
  const snap = await db.collection(SUBS_COLLECTION)
    .where('unsubscribeToken', '==', token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Soft unsubscribe: clear all preference flags and mark unverified so no further
 * emails are sent. Preserves the doc as an audit trail.
 */
export async function unsubscribeById(docId) {
  const db = getAdminDb();
  await db.collection(SUBS_COLLECTION).doc(docId).update({
    verified: false,
    practices: [],
    wantsAIAnalysis: false,
    subscribedToNews: false,
    subscribedToAllDataReleases: false,
    unsubscribedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Return verified subscribers matching the given criteria.
 *   type: 'data-release'   → practice subs for odsCode OR subscribedToAllDataReleases
 *   type: 'news-blast'     → subscribedToNews === true
 *   type: 'all-data'       → subscribedToAllDataReleases === true
 */
export async function querySubscribers({ type, odsCode = null }) {
  const db = getAdminDb();
  const snap = await db.collection(SUBS_COLLECTION).where('verified', '==', true).get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (type === 'news-blast') {
    return all.filter(s => s.subscribedToNews);
  }
  if (type === 'all-data') {
    return all.filter(s => s.subscribedToAllDataReleases);
  }
  if (type === 'data-release') {
    return all.filter(s =>
      s.subscribedToAllDataReleases ||
      (odsCode && Array.isArray(s.practices) && s.practices.includes(odsCode))
    );
  }
  return [];
}

export async function countSubscribers() {
  const db = getAdminDb();
  const snap = await db.collection(SUBS_COLLECTION).get();
  let verified = 0, unverified = 0, news = 0, practiceScoped = 0, allData = 0;
  snap.docs.forEach(d => {
    const s = d.data();
    if (s.verified) verified++; else unverified++;
    if (s.verified && s.subscribedToNews) news++;
    if (s.verified && Array.isArray(s.practices) && s.practices.length > 0) practiceScoped++;
    if (s.verified && s.subscribedToAllDataReleases) allData++;
  });
  return { total: snap.size, verified, unverified, news, practiceScoped, allData };
}

export async function listAllSubscribers() {
  const db = getAdminDb();
  const snap = await db.collection(SUBS_COLLECTION).orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      email: data.email,
      verified: data.verified,
      practices: data.practices || [],
      wantsAIAnalysis: !!data.wantsAIAnalysis,
      subscribedToNews: !!data.subscribedToNews,
      subscribedToAllDataReleases: !!data.subscribedToAllDataReleases,
      createdAt: data.createdAt?.toMillis?.() ?? null,
      verifiedAt: data.verifiedAt?.toMillis?.() ?? null,
      signupSource: data.metadata?.signupSource || null,
    };
  });
}

export async function logDispatch(entry) {
  const db = getAdminDb();
  const docRef = await db.collection(DISPATCH_COLLECTION).add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function updateDispatch(dispatchId, updates) {
  const db = getAdminDb();
  await db.collection(DISPATCH_COLLECTION).doc(dispatchId).update({
    ...updates,
    completedAt: FieldValue.serverTimestamp(),
  });
}

export async function listDispatches(limit = 20) {
  const db = getAdminDb();
  const snap = await db.collection(DISPATCH_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      createdAt: data.createdAt?.toMillis?.() ?? null,
      completedAt: data.completedAt?.toMillis?.() ?? null,
    };
  });
}

export async function markLastNotified(docIds, field) {
  if (!docIds.length) return;
  const db = getAdminDb();
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  docIds.forEach(id => {
    const ref = db.collection(SUBS_COLLECTION).doc(id);
    batch.update(ref, { [`lastNotifiedAt.${field}`]: now });
  });
  await batch.commit();
}
