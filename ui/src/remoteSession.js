// Firestore-backed session sync for remote play (docs/engine-plan.md phase
// 8). Replaces the orphaned root session.js, which drove the old companion
// app's pre-game-picker-only schema — this syncs the full GameState.
//
// Design: no server-side reducer. Every device runs the same engine calls
// it already runs locally (applyAction/endTurn/advanceDay/createGame);
// this module only ships the resulting state to sessions/{code} and
// delivers everyone's snapshots back via onSnapshot. Shared write access
// (any device with the code can write) per the resolved trust-model
// question — no security rules, no revision/transaction conflict
// handling, last-write-wins.
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

// config.rng/config.hooks are functions — not JSON-serializable, and
// don't need to be shared: a roll's *outcome* is already baked into the
// resulting state, so each device just keeps using its own local rng for
// whatever it rolls next. actionLog is dropped too (unbounded growth
// against Firestore's 1MiB doc cap; nothing in the UI reads it).
export function toSyncedState(state) {
  const { players, difficulty, eggspansion, predators } = state.config;
  const { actionLog, ...rest } = state;
  return { ...rest, config: { players, difficulty, eggspansion, predators } };
}

export function fromSyncedDoc(syncedState) {
  return { ...syncedState, config: { ...syncedState.config, rng: () => Math.random() }, actionLog: [] };
}

async function createSession(hostConfig) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const code = genCode();
  await setDoc(doc(database, 'sessions', code), {
    createdAt: Date.now(), hostConfig, claimedSeats: {}, state: null,
  });
  return code;
}

async function joinSession(code) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const snap = await getDoc(doc(database, 'sessions', code));
  if (!snap.exists()) throw new Error(`No session found for code ${code}`);
  return snap.data();
}

async function claimSeat(code, playerId, chickenName) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await updateDoc(doc(database, 'sessions', code), { [`claimedSeats.${playerId}`]: chickenName });
}

async function startGame(code, gameState) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await setDoc(doc(database, 'sessions', code), { state: toSyncedState(gameState), dayEndPending: false }, { merge: true });
}

// dayEndPending rides alongside `state` rather than being derived from it —
// it's transient UI-flow state (has this device finished the day's last
// player's turn and is now waiting on the Egg Exchange/Grub-discard
// prompt?), not something recoverable from GameState alone (currentPlayerIndex
// stays "last player" for that player's whole turn, not just its end).
async function pushState(code, gameState, dayEndPending) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await setDoc(doc(database, 'sessions', code), { state: toSyncedState(gameState), dayEndPending }, { merge: true });
}

function subscribe(code, callback) {
  const database = getDb();
  if (!database) return () => {};
  return onSnapshot(doc(database, 'sessions', code), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

function getMySeat(code) {
  return localStorage.getItem(`flockSeat:${code}`);
}

function setMySeat(code, playerId) {
  localStorage.setItem(`flockSeat:${code}`, playerId);
}

export const remoteSession = {
  isConfigured: () => configured,
  createSession,
  joinSession,
  claimSeat,
  startGame,
  pushState,
  subscribe,
  getMySeat,
  setMySeat,
};
