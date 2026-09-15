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
  initializeFirestore, doc, setDoc, updateDoc, getDoc, onSnapshot, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const cfg = window.FLOCK_FIREBASE_CONFIG;
const configured = !!(cfg && cfg.apiKey && cfg.apiKey !== 'YOUR_API_KEY');
let db = null;
// playtest-feedback.md 2026-09-14 "Grub Card Slug Effect": playing a card
// whose CardEffect doesn't need every param (most of them) leaves the
// unused fields as literal `undefined` in the dispatched action object
// (playerPanel.js's PlayCardControls/RailPlayPrompt build params that way
// on purpose, one flag per shape). That action rides along in
// state.actionLog, which toSyncedState below ships to Firestore as-is —
// and the Firestore SDK rejects any `undefined` field value in a setDoc
// unless told not to, throwing after the local engine effect had already
// applied (hence "the heart still healed" in that report). Rather than
// chase every params-builder call site, tell Firestore to just drop
// undefined fields, same as JSON.stringify already would.
function getDb() {
  if (!configured) return null;
  if (!db) db = initializeFirestore(initializeApp(cfg), { ignoreUndefinedProperties: true });
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
// whatever it rolls next. actionLog rides along (the right rail's log
// panel reads gameState.actionLog) capped at 500 entries as a defensive
// margin against Firestore's 1MiB doc cap — a full 3-season game is at
// most a few hundred actions, so this is well above what a real game
// needs, not a rolling window that'd actually trim live play.
export function toSyncedState(state) {
  const { players, difficulty, eggspansion, predators } = state.config;
  return { ...state, actionLog: state.actionLog.slice(-500), config: { players, difficulty, eggspansion, predators } };
}

export function fromSyncedDoc(syncedState) {
  return { ...syncedState, config: { ...syncedState.config, rng: () => Math.random() } };
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
    startingLocations: {}, // { [playerId]: Location } — set alongside chosenChicken, for chickens with mayChooseStartingLocation (Traveler, Free Range)
    state: null, // synced GameState — set once every seat has chosenChicken
    dayEndPending: false,
    dayEndReveal: null, // day-end overlay's reveal-step ledger — see pushState below
    pendingExchanges: {}, // { [playerId]: amount } — see setPendingExchange below
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
// needed — two different players never race on the same field. Written
// together since they're both decided at the same Lock In tap — startingLocation
// defaults to 'Coop' (the ability-gated check in setup.ts's createPlayer is a
// no-op for 'Coop' regardless of whether the chicken actually has
// mayChooseStartingLocation, so it's always safe to write).
async function lockInChicken(code, playerId, chickenName, startingLocation = 'Coop') {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await updateDoc(doc(database, 'sessions', code), {
    [`chosenChicken.${playerId}`]: chickenName,
    [`startingLocations.${playerId}`]: startingLocation,
  });
}

// Host-only, called live as they adjust flock size/Eggspansion/difficulty in
// the lobby (phase 5b) — hostConfig is no longer write-once at creation.
// Last-write-wins like everything else here; only the host ever writes it,
// so there's nothing to race against.
async function updateHostConfig(code, hostConfig) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await setDoc(doc(database, 'sessions', code), { hostConfig }, { merge: true });
}

// Advisory only (never gates Start Game) — each player only ever writes
// their own key, same non-racing reasoning as lockInChicken.
async function setReady(code, playerId, ready) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await updateDoc(doc(database, 'sessions', code), { [`seats.${playerId}.ready`]: ready });
}

// dayEndPending rides alongside `state` rather than being derived from it —
// it's transient UI-flow state (has this device finished the day's last
// player's turn and is now waiting on the Egg Exchange/Grub-discard
// prompt?), not something recoverable from GameState alone (currentPlayerIndex
// stays "last player" for that player's whole turn, not just its end).
//
// `dayEndReveal` (design_handoff_day_end/README.md) is the day-end
// overlay's second step's ledger data — same shape of transient flow
// state as dayEndPending, so it rides along the same way. `undefined`
// (the default — every existing call site that doesn't pass a 4th arg)
// leaves whatever's already in Firestore alone, same as
// ignoreUndefinedProperties already does for any other field; pass `null`
// explicitly to clear it, or the reveal object to set it.
async function pushState(code, gameState, dayEndPending, dayEndReveal) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  const payload = { state: toSyncedState(gameState), dayEndPending };
  if (dayEndReveal !== undefined) payload.dayEndReveal = dayEndReveal;
  await setDoc(doc(database, 'sessions', code), payload, { merge: true });
}

// playtest-feedback.md 2026-09-14 "Egg Exchange": the day-end Egg Exchange
// used to be plain per-device useState inside TurnControls — only the
// device that actually clicked Confirm ever sent anything, so any other
// player typing an amount into their own row was editing state nobody read.
// Each player now writes their own amount here as they type (their own key
// only, so no two players ever race on the same field), and the day's last
// player's Confirm reads this synced map instead of fabricating it from
// local-only state that only reflected their own edits.
async function setPendingExchange(code, playerId, amount) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await updateDoc(doc(database, 'sessions', code), { [`pendingExchanges.${playerId}`]: amount });
}

// Called once the day actually advances (never on cancel — a cancelled
// day-end returns to the board with whatever amounts were already entered
// still in place, ready to resubmit) so next time this comes up it starts
// from a clean slate instead of carrying stale amounts from today.
async function clearPendingExchanges(code) {
  const database = getDb();
  if (!database) throw new Error('Firebase not configured');
  await setDoc(doc(database, 'sessions', code), { pendingExchanges: {} }, { merge: true });
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

function clearMySeat(code) {
  localStorage.removeItem(`flockSeat:${code}`);
}

export const remoteSession = {
  isConfigured: () => configured,
  createSession,
  getSession,
  joinAndClaimSeat,
  updateHostConfig,
  setReady,
  startDraft,
  lockInChicken,
  pushState,
  setPendingExchange,
  clearPendingExchanges,
  subscribe,
  getMySeat,
  setMySeat,
  clearMySeat,
};
