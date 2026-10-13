import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// ─── Firebase Project Configuration ─────────────────────────────────────────
// Values come from VITE_ env vars first; the literals below are the fallback
// so the app still works when running locally without a .env file.
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyBE5uj5jlhqWieGG6XREc1G4Q7-1rCEy7w",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "lyrical-plexus-748x0.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "lyrical-plexus-748x0",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "lyrical-plexus-748x0.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "462985518808",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:462985518808:web:d407bca2ad8ab5c77e41ad",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

// ─── App singleton ───────────────────────────────────────────────────────────
export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// ─── Auth (with email-verification security gate) ────────────────────────────
export const firebaseAuth = getAuth(firebaseApp);

// Connect to Auth Emulator when running locally for safe testing
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true"
) {
  connectAuthEmulator(firebaseAuth, "http://localhost:9099", {
    disableWarnings: false,
  });
}

// ─── Firestore database ──────────────────────────────────────────────────────
export const firebaseDb = getFirestore(firebaseApp);

// ─── Cloud Storage ───────────────────────────────────────────────────────────
export const firebaseStorage = getStorage(firebaseApp);

// ─── Analytics (only in production, browser must support it) ─────────────────
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(firebaseApp) : null
);
