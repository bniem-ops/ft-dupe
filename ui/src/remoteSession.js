// Firestore-backed session sync for remote play (docs/engine-plan.md). No
// local hotseat mode — every game is a session, joined by a 4-char code.
//
// Design: no server-side reducer. Every device runs the same engine calls
// it already runs locally (createGame/applyAction/endTurn/advanceDay);
// this module only ships the resulting state to sessions/{code} and
// delivers everyone's snapshots back via onSnapshot. Shared write access
// (any device with the code can write) per the resolved trust-model
// question — no security rules beyond that.
//
// One exception to "no transactions, last-write-wins": claiming a lobby
// seat. Two devices computing "the next open seat" independently and both
// writing could silently drop one of them from the game entirely — a much
// worse failure than the general last-write-wins tradeoff accepted
// elsewhere, so that one write goes through a Firestore transaction.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getFirestore, doc, setDoc, updateDoc, getDoc, onSnapshot, runTransaction,
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
    createdAt: Date.now(),
    hostConfig, // { playerCount, difficulty, eggspansion }
    seats: {}, // { [playerId]: { name } }, filled in by joinAndClaimSeat
    predators: null, // { regular: [n,n,n], boss } — set once, at Start Game
    dealtChickens: null, // { [playerId]: [name, name] } — set alongside predators
    chosenChicken: {}, // { [playerId]: name } — filled in as each player locks in
    state: null, // synced GameState — set once every seat has chosenChicken
    dayEndPending: false,
  });
  return code;
}

async function getSession(code) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const snap = await getDoc(doc(database, 'sessions', code));
  if (!snap.exists()) throw new Error(`No session found for code ${code}`);
  return snap.data();
}

// Claims the first open p1..pN seat for `name`, atomically. Throws if the
// session doesn't exist, is already full, or has already started (a game
// in progress shouldn't gain a new seat mid-draft/mid-play).
async function joinAndClaimSeat(code, name) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const ref = doc(database, 'sessions', code);
  return runTransaction(database, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error(`No session found for code ${code}`);
    const data = snap.data();
    if (data.predators) throw new Error('This game has already started');
    const seats = data.seats ?? {};
    let seatId = null;
    for (let i = 1; i <= data.hostConfig.playerCount; i++) {
      const candidate = `p${i}`;
      if (!seats[candidate]) {
        seatId = candidate;
        break;
      }
    }
    if (!seatId) throw new Error('This session is full');
    transaction.update(ref, { [`seats.${seatId}`]: { name } });
    return seatId;
  });
}

// Host-only, called once at Start Game: predators are already randomized
// and chickens already dealt by the time this is called (see setup.ts's
// randomizePredatorSelection/dealChickenChoices), this just publishes both
// so every device's snapshot listener moves them into the chicken draft.
async function startDraft(code, predators, dealtChickens) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await setDoc(doc(database, 'sessions', code), { predators, dealtChickens }, { merge: true });
}

// Each player only ever writes their own key here, so no transaction is
// needed — two different players never race on the same field.
async function lockInChicken(code, playerId, chickenName) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await updateDoc(doc(database, 'sessions', code), { [`chosenChicken.${playerId}`]: chickenName });
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
  getSession,
  joinAndClaimSeat,
  startDraft,
  lockInChicken,
  pushState,
  subscribe,
  getMySeat,
  setMySeat,
};
