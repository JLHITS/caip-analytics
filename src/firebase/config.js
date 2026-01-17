import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Analytics (only in browser, not during SSR/build)
let analytics = null;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// Analytics event tracking helper
export const trackEvent = (eventName, params = {}) => {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
};

// Pre-defined tracking functions for common events
export const trackPageView = (pageName) => trackEvent('page_view', { page_name: pageName });
export const trackDataSourceSelected = (source) => trackEvent('data_source_selected', { source });
export const trackTabView = (tab, subTab = null) => trackEvent('tab_view', { tab, sub_tab: subTab });
export const trackPracticeLookup = (odsCode, source) => trackEvent('practice_lookup', { ods_code: odsCode, source });
export const trackExport = (type) => trackEvent('export', { type });
export const trackImport = () => trackEvent('import_dashboard');
export const trackDisclaimerAccepted = () => trackEvent('disclaimer_accepted');
export const trackShareCreated = (type) => trackEvent('share_created', { type });
export const trackAIAnalysis = () => trackEvent('ai_analysis_requested');
