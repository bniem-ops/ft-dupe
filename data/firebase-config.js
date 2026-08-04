// Firebase Web SDK config. This is NOT a secret — Firebase web config is
// meant to ship in the client; access control comes from Firestore
// Security Rules, not from hiding this object. Safe to commit.
//
// Points at a fresh "ft-dupe" project (not the old companion app's
// "ft-strategy" project — deliberately separate, per the earlier decision
// to not reuse that project for the real engine). Nothing in engine/ or
// ui/ reads Firestore yet; that's phase 8 (remote multiplayer sync) in
// docs/engine-plan.md, still not started. session.js (the only current
// consumer of this file, via `window.FLOCK_FIREBASE_CONFIG`) is itself
// orphaned right now — it was only loaded by the old app.js/index.html,
// deleted this session — so there's no live traffic hitting this project
// today regardless of what its Firestore rules are set to.
//
// The rules that used to be documented here were for the OLD companion
// app's pre-game team-picker schema (`sessions/{code}` with
// expansion/players/difficulty/predators/picks/createdAt) — not
// applicable to the real GameState shape (engine/src/types.ts), and the
// "trust model" question (open item in docs/engine-plan.md) isn't
// resolved yet either. Real rules get designed together in phase 8, once
// both of those are settled — not before.
window.FLOCK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD90r0nG4Dq3T4AdarFnihZe9NlrZ38Paw',
  authDomain: 'ft-dupe.firebaseapp.com',
  projectId: 'ft-dupe',
  storageBucket: 'ft-dupe.firebasestorage.app',
  messagingSenderId: '846522470051',
  appId: '1:846522470051:web:df598090ef84b1aea27916',
};