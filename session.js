// Live table session backend — wraps Firebase Firestore so each player at
// the table can pick their own chicken on their own device and everyone
// converges on one shared team view. Loaded as an ES module (deferred by
// default) so it always finishes executing before any button click could
// reach into window.FLOCK_SESSION, regardless of script-tag order.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getFirestore, doc, setDoc, updateDoc, getDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const cfg = window.FLOCK_FIREBASE_CONFIG;
const configured = !!(cfg && cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY');
let db = null;
function getDb() {
  if (!configured) return null;
  if (!db) db = getFirestore(initializeApp(cfg));
  return db;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I/L)
function genCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function getPlayerId() {
  let id = localStorage.getItem('flockPlayerId');
  if (!id) {
    id = 'p-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('flockPlayerId', id);
  }
  return id;
}

async function createSession({ expansion, players, difficulty }) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const code = genCode();
  await setDoc(doc(database, 'sessions', code), {
    expansion, players, difficulty, predators: [], picks: {}, createdAt: Date.now(),
  });
  return code;
}

async function joinSession(code) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const snap = await getDoc(doc(database, 'sessions', code));
  return snap.exists() ? snap.data() : null;
}

async function submitPick(code, playerName, chickenName) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const playerId = getPlayerId();
  await updateDoc(doc(database, 'sessions', code), {
    [`picks.${playerId}`]: { name: playerName, chicken: chickenName, joinedAt: Date.now() },
  });
}

async function setKnownPredators(code, predators) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await updateDoc(doc(database, 'sessions', code), { predators });
}

function subscribe(code, callback) {
  const database = getDb();
  if (!database) return () => {};
  return onSnapshot(doc(database, 'sessions', code), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

window.FLOCK_SESSION = {
  isConfigured: () => configured,
  genCode, createSession, joinSession, submitPick, setKnownPredators, subscribe, getPlayerId,
};
