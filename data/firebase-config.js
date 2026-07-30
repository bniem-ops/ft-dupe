// Firebase Web SDK config for the "live table session" feature (session.js).
// This is NOT a secret — Firebase web config is meant to ship in the client;
// access control comes from Firestore Security Rules, not from hiding this
// object. Safe to commit.
//
// To go live:
//   1. https://console.firebase.google.com/ → Add project (free Spark plan
//      is plenty for this).
//   2. Build → Firestore Database → Create database (start in production
//      mode — the security rules below lock it down appropriately).
//   3. Project settings (gear icon) → General → "Your apps" → Add app → Web
//      (</>) → register it (no Firebase Hosting needed) → copy the
//      firebaseConfig object it gives you and paste the values below.
//   4. Firestore Database → Rules tab, paste:
//
//        rules_version = '2';
//        service cloud.firestore {
//          match /databases/{database}/documents {
//            match /sessions/{code} {
//              allow read, update: if true;
//              allow create: if request.resource.data.keys().hasAll(
//                ['expansion', 'players', 'difficulty', 'predators', 'picks', 'createdAt']
//              );
//              allow delete: if false;
//            }
//          }
//        }
//
//      Access is "knowledge of the join code" — the same trust model as a
//      Kahoot/Jackbox party code. Fine for a casual at-the-table companion
//      app with no sensitive data. Sessions aren't auto-expired; Firestore's
//      free-tier limits are far beyond what personal use needs.
//
// Until you do this, the "Host a live session" / "Join with a code" wizard
// options stay disabled and the app works exactly as before (local-only).
window.FLOCK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDzUNt-qEgKUr-OcC3-lfDlddTE1wVpEDU',
  authDomain: 'ft-strategy.firebaseapp.com',
  projectId: 'ft-strategy',
  storageBucket: 'ft-strategy.firebasestorage.app',
  messagingSenderId: '903974076107',
  appId: '1:903974076107:web:f07c12eb7aa1aced80e54e',
};