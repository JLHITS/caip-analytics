import { db } from '../firebase/config';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';

const COLLECTION = 'news';

/**
 * Generate a short unique ID for news items
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Fetch all news items, sorted by createdAt descending
 */
export async function listNews() {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch only active news items, sorted by priority then createdAt desc
 */
export async function listActiveNews() {
  const all = await listNews();
  return all
    .filter(n => n.active)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

/**
 * Create a new news item
 */
export async function createNews({ headline, body, active = true, priority = 0 }) {
  const id = generateId();
  const data = {
    headline: headline.trim(),
    body: body.trim(),
    active,
    priority,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await setDoc(doc(db, COLLECTION, id), data);
  return { id, ...data };
}

/**
 * Update an existing news item
 */
export async function updateNews(id, updates) {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('News item not found');
  const current = snap.data();
  const merged = {
    ...current,
    ...updates,
    updatedAt: Timestamp.now(),
  };
  // Ensure headline/body are trimmed if provided
  if (merged.headline) merged.headline = merged.headline.trim();
  if (merged.body) merged.body = merged.body.trim();
  await setDoc(docRef, merged);
  return { id, ...merged };
}

/**
 * Delete a news item
 */
export async function deleteNews(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Seed default news items (call once to populate initial content)
 */
export async function seedDefaultNews() {
  const existing = await listNews();
  if (existing.length > 0) return existing.length; // Already seeded
  await createNews({
    headline: 'NHS England Data Delay',
    body: "NHS England have delayed the release of January's appointment data, meaning CAIP.app will not be updated with Jan 2026 data until 6th March 2026.",
    active: true,
    priority: 10,
  });
  return 1;
}

/**
 * Toggle a news item's active status
 */
export async function toggleNewsActive(id) {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('News item not found');
  const current = snap.data();
  const newActive = !current.active;
  await setDoc(docRef, { ...current, active: newActive, updatedAt: Timestamp.now() });
  return newActive;
}
