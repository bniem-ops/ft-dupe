import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { html } from 'htm/preact';
import {
  createGame,
  applyAction,
  startTurn,
  endTurn,
  isLastPlayerOfDay,
  isLastDayOfPhase,
  advanceDay,
  useExtraActionToken,
  randomizePredatorSelection,
  dealChickenChoices,
  loadGrubCards,
  activeWeatherName,
  activeWeatherEffect,
  isImmuneToWeather,
  getActiveChickenAbilities,
  seasonCardList,
} from './engine.js';
import { Entry } from './components/entry.js';
import { SoloSetup } from './components/soloSetup.js';
import { Lobby } from './components/lobby.js';
import { ChickenDraft } from './components/chickenDraft.js';
import { remoteSession, fromSyncedDoc } from './remoteSession.js';
import { Board, playerColor } from './components/board.js';
import { PlayerPanel, AvatarStrip } from './components/playerPanel.js';
import { ActionBar } from './components/actionBar.js';
import { TurnControls } from './components/turnControls.js';
import { ProductionReveal } from './components/productionReveal.js';
import { TargetDossier } from './components/targetDossier.js';
import { ForesightPicker } from './components/foresightPicker.js';
import { MobilePlay } from './components/mobilePlay.js';
import { MobilePlayerSheet } from './components/mobilePlayerSheet.js';
import { DieRoll } from './components/dieRoll.js';

const SEASON_ORDER = ['Spring', 'Summer', 'Fall'];

// A short caption for the on-board die animation — null for any actionLog
// entry that isn't a roll (most of them), which the caller uses to skip
// non-roll entries entirely.
function rollCaption(entry) {
  if (entry.type === 'productionRoll') return 'Production';
  if (entry.type === 'weatherRoll') return entry.cardName;
  if (entry.type === 'combatRoll') {
    if (entry.kind === 'fogDodge') return 'Fog';
    if (entry.kind === 'evasion') return 'Evasion';
    return entry.targetName;
  }
  return null;
}
const SESSION_STORAGE_KEY = 'flockSessionCode';

// A refresh (or a reopened tab) shouldn't lose your place in a session —
// the actual GameState already lives in Firestore, so all that's missing
// client-side is which session code to reconnect to. Checked first
// against the URL (so a shared/bookmarked link also reconnects), then
// localStorage (so a bare refresh does too).
function readStoredSessionCode() {
  const fromUrl = new URLSearchParams(window.location.search).get('session');
  return fromUrl || localStorage.getItem(SESSION_STORAGE_KEY);
}

function persistSessionCode(code) {
  localStorage.setItem(SESSION_STORAGE_KEY, code);
  const url = new URL(window.location.href);
  url.searchParams.set('session', code);
  window.history.replaceState(null, '', url);
}

function clearStoredSessionCode() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  window.history.replaceState(null, '', url);
}

// Turns a raw dispatched Action into a short log sentence — actionLog only
// stores the action objects themselves (engine/src/types.ts), not text, so
// this is purely a UI presentation concern. Falls back to a generic label
// for the long tail of ability/loot actions rather than enumerating all of
// them here.
function formatLogEntry(action, playerNames) {
  const name = (id) => playerNames?.[id] ?? id;
  switch (action.type) {
    case 'move':
      return html`${name(action.playerId)} moved to <b>${action.destination}</b>.`;
    case 'attack':
    case 'attackWithCompanion':
      return html`${name(action.playerId)} attacked <b>${action.targetId}</b>.`;
    case 'forage':
      return html`${name(action.playerId)} foraged.`;
    case 'layEgg':
      return html`${name(action.playerId)} laid an <b>egg</b>.`;
    case 'heal':
      return html`${name(action.playerId)} healed ${action.amount}.`;
    case 'brood':
      return html`${name(action.playerId)} brooded ${name(action.targetPlayerId)}.`;
    case 'eat':
      return html`${name(action.playerId)} ate ${action.amount} food.`;
    case 'drawCard':
      return html`${name(action.playerId)} drew a <b>Bonus Card</b>.`;
    case 'playBonusCard':
      return html`${name(action.playerId)} played a <b>Bonus Card</b>.`;
    case 'useGrubReward':
      return html`${name(action.playerId)} used a <b>Grub Reward</b>.`;
    case 'productionRoll': {
      const methodNote = action.method === 'rerolled' ? ' (rerolled via Deus Eggs Machina)' : action.method === 'adjusted' ? ' (adjusted via Strategem)' : '';
      return action.gained
        ? html`${name(action.playerId)} rolled a <b>${action.roll}</b> for production (needed ${action.threshold}+)${methodNote} — gained ${action.eggAmount} egg${action.eggAmount > 1 ? 's' : ''}.`
        : html`${name(action.playerId)} rolled a <b>${action.roll}</b> for production (needed ${action.threshold}+)${methodNote} — no egg this time.`;
    }
    // Every roll made while resolving a single Attack — a Predator's own
    // effect roll, a Grub's defend roll, or Fog's dodge roll (see
    // engine/src/types.ts's CombatRollLogEntry). Multiple can ride along
    // one Attack (e.g. Fog's roll plus the target's own effect roll), each
    // its own log line, ahead of the plain "X attacked Y" line reducer.ts
    // appends for the Attack action itself.
    case 'combatRoll': {
      if (action.kind === 'fogDodge') {
        return action.triggered
          ? html`${name(action.playerId)} rolled a <b>${action.roll}</b> in the Fog — the attack missed entirely.`
          : html`${name(action.playerId)} rolled a <b>${action.roll}</b> in the Fog — no effect, the attack landed normally.`;
      }
      if (action.kind === 'evasion') {
        return action.triggered
          ? html`${name(action.playerId)} rolled a <b>${action.roll}</b> to dodge — the attack missed entirely.`
          : html`${name(action.playerId)} rolled a <b>${action.roll}</b> to dodge — no luck, the attack landed.`;
      }
      if (action.kind === 'revive') {
        return action.triggered
          ? html`${name(action.playerId)} rolled a <b>${action.roll}</b> — ${action.targetName} ${action.effectText}!`
          : html`${name(action.playerId)} rolled a <b>${action.roll}</b> for ${action.targetName}'s revive roll — it stays down.`;
      }
      // The stored effect text is inconsistently self-quoted already (some
      // are "4-6: heals 1 health", some aren't quoted at all) — shown bare,
      // same as the dossier's own effect card, rather than double-quoting it.
      const kindLabel = action.kind === 'grubDefend' ? "defend roll" : "effect roll";
      return action.triggered
        ? html`${name(action.playerId)} rolled a <b>${action.roll}</b> for ${action.targetName}'s ${kindLabel}${action.effectText ? html` — ${action.effectText}` : ''}`
        : html`${name(action.playerId)} rolled a <b>${action.roll}</b> for ${action.targetName}'s ${kindLabel} — no effect.`;
    }
    // Tornado's turn-start action-loss roll, Lightning Storm's turn-end
    // health-loss roll (see engine/src/types.ts's WeatherRollLogEntry).
    case 'weatherRoll':
      return action.triggered
        ? html`${name(action.playerId)} rolled a <b>${action.roll}</b> in the ${action.cardName} — ${action.effectText}.`
        : html`${name(action.playerId)} rolled a <b>${action.roll}</b> in the ${action.cardName} — no effect.`;
    // Superseded by the productionRoll entry the same dispatch also
    // appends (actions.ts's resolveProductionReveal) — the raw action
    // object has no roll value to show, so it'd just be a duplicate,
    // less-informative line. Filtered out wherever actionLog is rendered.
    case 'resolveProductionReveal':
      return null;
    default:
      return html`${name(action.playerId)} — ${action.type}.`;
  }
}

// Advances from `state` until either a living player's turn has started
// (production applied via startTurn) or the day has ended and needs the
// day-end prompt. Dead players are skipped entirely — startTurn doesn't
// check `alive` itself, and revival (Brood reviving mid-turn-cycle) is
// handled the next time this runs. Also stops early if the game just
// ended (e.g. an end-of-turn weather effect killed the last player).
function advanceToNextActor(state) {
  let s = state;
  if (s.gameOver) return { state: s, dayEnd: false };
  for (;;) {
    const playerId = s.turnOrder[s.currentPlayerIndex];
    const player = s.players.find((p) => p.id === playerId);
    if (player.alive) return { state: startTurn(s), dayEnd: false };
    if (isLastPlayerOfDay(s)) return { state: s, dayEnd: true };
    s = endTurn(s);
    if (s.gameOver) return { state: s, dayEnd: false };
  }
}

// Snapshots what advanceDay is about to do so the day-end reveal step can
// narrate it afterward (design_handoff_day_end/README.md "Engine / data
// changes required" #1) — advanceDay's own discard-and-redeal has already
// overwritten the discarded Grub's identity by the time `after` exists
// (turn.ts's performDailyGrubDiscard discards *and* deals a replacement in
// one pass), and everyone's pre-trade eggs/food are gone too, so both have
// to be read from `before`. Called with the state as it was right before
// advanceDay and the state it returned; nothing here re-derives anything
// advanceDay itself doesn't already compute — it just captures the same
// facts a second time, in a form the reveal can hang copy on.
function buildDayEndReveal(before, discardSide, exchanges, after) {
  const insideHasCard = !!before.grubDecks.inside.faceUp;
  const outsideHasCard = !!before.grubDecks.outside.faceUp;
  const effectiveSide =
    discardSide === 'inside' && !insideHasCard && outsideHasCard
      ? 'outside'
      : discardSide === 'outside' && !outsideHasCard && insideHasCard
        ? 'inside'
        : discardSide;
  const discardedFaceUp = before.grubDecks[effectiveSide].faceUp;
  const discardedGrub = discardedFaceUp
    ? { side: effectiveSide, cardName: loadGrubCards()[discardedFaceUp.cardId]?.name ?? null }
    : null;

  const exchangeApplies = isLastDayOfPhase(before.day) && !(before.season === 'Fall' && before.day === 7);
  const exchangeEntries = exchangeApplies
    ? before.players
        .filter((p) => p.alive)
        .map((p) => {
          const amount = exchanges.find((e) => e.playerId === p.id)?.amount ?? 0;
          const weatherEffect = activeWeatherEffect(before, p.id);
          const weatherName = activeWeatherName(before, p.id) ?? '';
          const rate = getActiveChickenAbilities(p.chickenName, p.stage).reduce((r, a) => a.eggExchangeRate ?? r, 1);
          let blockedReason = null;
          if (p.statusEffectsUntilNextEggExchange.includes('cannotParticipateInEggExchange')) {
            blockedReason = 'predator';
          } else if (
            weatherEffect?.skipNextEggExchange &&
            !isImmuneToWeather(p.chickenName, p.stage, weatherName, weatherEffect.positive ?? false) &&
            !p.pendingWeatherImmuneUntilNextTurn &&
            !p.permanentWeatherImmuneUntilNextCard
          ) {
            blockedReason = 'pouringRain';
          }
          const bonus = weatherEffect?.eggExchangeBonusFoodIfParticipating ?? 0;
          const food = blockedReason ? 0 : amount * rate + (amount > 0 ? bonus : 0);
          return { playerId: p.id, eggs: amount, food, rate, bonus: amount > 0 ? bonus : 0, blockedReason };
        })
    : [];

  const seasonRolledOver = after.season !== before.season;
  const predatorLevelUps = seasonRolledOver
    ? after.predators.filter((p, i) => !p.defeated && p.stage !== before.predators[i].stage).map((p) => p.name)
    : [];

  const personalCards = exchangeApplies
    ? after.players
        .filter((p) => p.alive && p.personalWeatherOverride)
        .map((p) => ({
          playerId: p.id,
          // The override carries its own season (usually `after.season`,
          // but read from the override itself to match how the engine's
          // own cardNameAt resolves it — see abilities/weather.ts).
          cardName:
            seasonCardList(p.personalWeatherOverride.season.toLowerCase(), after.config.eggspansion)[p.personalWeatherOverride.cardIndex]?.name ?? null,
        }))
    : [];

  return {
    day: after.day,
    season: after.season,
    phase: after.phase,
    fromSeason: before.season,
    fromWeather: activeWeatherName(before),
    toWeather: activeWeatherName(after),
    discardedGrub,
    exchanges: exchangeEntries,
    flashFloodFired: exchangeApplies && !!activeWeatherEffect(before)?.onPhaseEnd?.()?.discardAllFood,
    seasonRolledOver,
    predatorLevelUps,
    personalCards,
  };
}

function App() {
  const [screen, setScreen] = useState('entry');
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [dayEndPending, setDayEndPending] = useState(false);
  // { [playerId]: amount } — each player's own Egg Exchange amount for the
  // day-end dossier, synced via Firestore so it isn't just local state only
  // the submitting device ever reads (playtest-feedback.md 2026-09-14 "Egg
  // Exchange").
  const [pendingExchanges, setPendingExchangesState] = useState({});
  // The day-end reveal step's ledger data (README "dayEndReveal"), synced
  // alongside `state`/`dayEndPending` — null means the day-end overlay (if
  // showing at all) is still on the setup step. Dismissing the reveal is
  // deliberately NOT a synced write (see handleDismissDayEndReveal) — each
  // device dismisses on its own tap — so dismissedRevealKeyRef remembers
  // which reveal THIS device already dismissed, to stop the next unrelated
  // Firestore snapshot (which still carries the old dayEndPending/
  // dayEndReveal until the next real day-end opens) from resurrecting it.
  const [dayEndReveal, setDayEndReveal] = useState(null);
  const dismissedRevealKeyRef = useRef(null);
  const [pendingPick, setPendingPick] = useState(null);
  // Mobile UI state (≤900px — see styles.css's .mobile-play-*, design
  // mockups 7a-7c). Purely local presentation state, not synced.
  const [mobilePlayerSheetOpen, setMobilePlayerSheetOpen] = useState(false);
  // Desktop-only UI state (≥901px — see styles.css's .gs-side-panel/
  // .avatar-strip). Purely local presentation state, not synced.
  const [tableView, setTableView] = useState(false);
  // A Predator or Grub inspected read-only (no attack armed) — design
  // mockup 6a's dossier doubling as a reference card. Separate from
  // pendingPick since it's a non-committal peek, not part of the action
  // state machine. { targetType: 'predator'|'grub', targetId } | null.
  const [inspectingTarget, setInspectingTarget] = useState(null);

  // The on-board die animation (DieRoll) for the most recent roll — purely
  // presentational, driven by watching actionLog grow rather than by the
  // dispatch call sites themselves, so it fires the same way for rolls
  // made on another device too (multiplayer sync). `key` forces a fresh
  // mount (restarting the CSS animation) even if the roll value repeats.
  const [dieRoll, setDieRoll] = useState(null);
  // null until the first real actionLog is seen, so a fresh page load or a
  // reconnect-after-refresh (which arrives with a whole backlog already in
  // it) doesn't replay every past roll's animation at once — only entries
  // added *after* that point count as "new."
  const seenLogLengthRef = useRef(null);
  useEffect(() => {
    const log = gameState?.actionLog;
    if (!log) return;
    if (seenLogLengthRef.current === null) {
      seenLogLengthRef.current = log.length;
      return;
    }
    const prevLength = seenLogLengthRef.current;
    seenLogLengthRef.current = log.length;
    if (log.length <= prevLength) return; // e.g. a fresh game just started
    const newEntries = log.slice(prevLength);
    // Last-in-first-shown: if one dispatch logged more than one roll (Fog's
    // dodge roll alongside the target's own effect roll), the later one is
    // what actually decided the outcome.
    for (let i = newEntries.length - 1; i >= 0; i--) {
      const label = rollCaption(newEntries[i]);
      if (label) {
        setDieRoll({ roll: newEntries[i].roll, label, key: prevLength + i });
        return;
      }
    }
  }, [gameState?.actionLog?.length]);

  // Session state — every game is a session now, no local hotseat mode.
  // sessionCode is restored from the URL/localStorage (see
  // readStoredSessionCode) so a refresh reconnects instead of losing the
  // game — the subscribe effect below takes it from there the same way it
  // handles a fresh join.
  const [sessionCode, setSessionCode] = useState(() => readStoredSessionCode());
  const [hostConfig, setHostConfig] = useState(null);
  const [seats, setSeats] = useState({});
  const [predators, setPredators] = useState(null);
  const [dealtChickens, setDealtChickens] = useState(null);
  const [chosenChicken, setChosenChicken] = useState({});
  // { [playerId]: Location } — set alongside chosenChicken at Lock In, for
  // chickens with mayChooseStartingLocation (Traveler/Free Range). Defaults
  // to 'Coop' for everyone else.
  const [startingLocations, setStartingLocations] = useState({});
  const [myPlayerId, setMyPlayerId] = useState(null);
  // Derived, not stored: joinAndClaimSeat always hands the host seat 'p1'
  // (the session doc has no seats yet when handleHost claims the first
  // one), so this is a stable fact about the seat itself rather than
  // something that needs its own state to survive a refresh.
  const isHost = myPlayerId === 'p1';
  // Carries the name from the entry screen into soloSetup — solo needs a
  // difficulty/Eggspansion step in between, so the name can't be used to
  // create+claim a seat until that step submits.
  const [pendingName, setPendingName] = useState(null);
  // True only for a session actually created via the solo-setup flow
  // (handleStartSolo) — NOT derivable from hostConfig.playerCount === 1,
  // since a host can also drop a real multiplayer lobby's flock size to 1
  // while still expecting the normal lobby + explicit Start Game tap.
  const [soloFlow, setSoloFlow] = useState(false);
  // Guards the solo auto-start effect against firing twice (mirrors
  // finalizingRef below, same rapid-double-snapshot concern).
  const soloStartingRef = useRef(false);

  const playerNames = Object.fromEntries(Object.entries(seats).map(([id, s]) => [id, s.name]));

  // Guards the host's "everyone's locked in, call createGame() and
  // publish it" step against firing twice from two rapid snapshot events.
  const finalizingRef = useRef(false);

  // Single source of truth for screen routing once a session exists: every
  // snapshot re-derives which screen to show from the doc plus whether
  // *this device* has claimed a seat yet (myPlayerId is local/per-device,
  // everything else comes from the shared doc) — so a mid-flow refresh
  // recovers correctly the same way phase 8's game-screen sync did.
  useEffect(() => {
    if (!sessionCode) return undefined;
    const unsubscribe = remoteSession.subscribe(sessionCode, (doc) => {
      if (!doc) return;
      setHostConfig(doc.hostConfig ?? null);
      setSeats(doc.seats ?? {});
      setPredators(doc.predators ?? null);
      setDealtChickens(doc.dealtChickens ?? null);
      setChosenChicken(doc.chosenChicken ?? {});
      setStartingLocations(doc.startingLocations ?? {});

      // myPlayerId (React state) can lag one tick behind a join that just
      // succeeded, and is always null right after a page refresh — the
      // doc's snapshot can arrive before this device's own setMyPlayerId
      // call runs, or before it's ever run at all this page-load. Falling
      // back to the synchronous localStorage read (already written by the
      // Host/Join/Solo handler before setMyPlayerId, and durable across a
      // refresh unlike React state) avoids a spurious flash back to the
      // entry screen, and lets a refresh reconnect to a game already in
      // progress, not just a still-forming lobby/draft.
      const savedSeat = myPlayerId ?? remoteSession.getMySeat(sessionCode);
      if (!savedSeat) {
        // This device never claimed a seat in this session (a foreign/
        // stale link, or storage was cleared) — nothing to reconnect to.
        setScreen('entry');
        return;
      }
      if (!myPlayerId) setMyPlayerId(savedSeat);

      if (doc.state) {
        const synced = fromSyncedDoc(doc.state);
        setGameState(synced);
        const reveal = doc.dayEndReveal ?? null;
        const revealKey = reveal ? `${reveal.day}|${reveal.season}` : null;
        setDayEndReveal(reveal);
        setDayEndPending(dismissedRevealKeyRef.current && dismissedRevealKeyRef.current === revealKey ? false : !!doc.dayEndPending);
        setPendingExchangesState(doc.pendingExchanges ?? {});
        setScreen(synced.gameOver ? 'gameOver' : 'game');
        return;
      }

      if (!doc.predators) {
        // Solo skips the waiting-room lobby entirely — its one seat is
        // already filled the moment it's claimed, so jump straight to the
        // draft instead of rendering a lobby nobody else will ever join.
        // Gated on soloFlow (this device actually came from the solo-setup
        // step), not just a flock size of 1 — a real multiplayer lobby the
        // host shrinks to 1 player should still wait for an explicit Start.
        if (soloFlow && doc.hostConfig?.playerCount === 1 && !soloStartingRef.current) {
          soloStartingRef.current = true;
          startDraftFor(sessionCode, doc.hostConfig);
          return;
        }
        setScreen('lobby');
        return;
      }
      setScreen('chickenDraft');
    });
    return unsubscribe;
  }, [sessionCode, myPlayerId, soloFlow]);

  // A screen change always means something already handled whatever error
  // (if any) led to it — an error banner should never survive into a
  // different screen (e.g. an old "session is full" message bleeding onto
  // the live game board).
  useEffect(() => {
    setError(null);
  }, [screen]);

  // Once every seat has chosen a chicken, the host (only) builds the real
  // GameState and publishes it — every device (including this one) then
  // moves on via the snapshot handler above, same pattern as every other
  // state-producing step in this app.
  //
  // The `gameState` check matters beyond the obvious "don't redo finished
  // work": predators/dealtChickens/hostConfig/chosenChicken all stay
  // populated in the session doc forever once a game exists (nothing ever
  // clears them), and finalizingRef is a plain ref — it resets on every
  // page load same as any other component state. Without this check, the
  // host reloading mid-game (or after it's over) would re-run this whole
  // effect from that freshly-populated doc data and silently overwrite the
  // real, in-progress game with a brand-new createGame() call.
  useEffect(() => {
    if (!isHost || !predators || !dealtChickens || !hostConfig || finalizingRef.current || gameState) return;
    const seatIds = Object.keys(seats);
    if (seatIds.length < hostConfig.playerCount) return;
    if (!seatIds.every((id) => chosenChicken[id])) return;

    finalizingRef.current = true;
    try {
      const config = {
        players: seatIds.map((id) => ({
          id,
          chickenName: chosenChicken[id],
          startingLocation: startingLocations[id],
        })),
        difficulty: hostConfig.difficulty,
        eggspansion: hostConfig.eggspansion,
        rng: () => Math.random(),
        predators,
      };
      const created = createGame(config);
      const { state, dayEnd } = advanceToNextActor(created);
      remoteSession.pushState(sessionCode, state, dayEnd).catch((e) => setError(e.message));
    } catch (e) {
      setError(e.message);
      finalizingRef.current = false; // allow a retry if this was transient
    }
  }, [isHost, predators, dealtChickens, hostConfig, seats, chosenChicken, startingLocations, sessionCode, gameState]);

  // Every path that can produce a new GameState routes through this so a
  // gameOver result (win via a killing blow, loss via end-of-turn weather
  // or a Fall day 8 rollover) always reaches the end screen. Pushes to
  // Firestore; every device (including this one) then re-renders from
  // whatever onSnapshot delivers back, so this local setGameState is just
  // an optimistic preview, not the final word.
  function applyStateUpdate(next, dayEnd = dayEndPending, reveal) {
    setGameState(next);
    if (next.gameOver) setScreen('gameOver');
    remoteSession.pushState(sessionCode, next, dayEnd, reveal).catch((e) => setError(e.message));
    return next;
  }

  function dispatch(action) {
    try {
      applyStateUpdate(applyAction(gameState, action));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleEndTurn() {
    setPendingPick(null);
    if (!isLastPlayerOfDay(gameState)) {
      const { state, dayEnd } = advanceToNextActor(endTurn(gameState));
      // Clear any lingering reveal the moment a new day-end opens — `step`
      // in TurnControls is derived from dayEndReveal, so a stale one here
      // would show yesterday's ledger instead of today's setup step.
      applyStateUpdate(state, dayEnd, dayEnd ? null : undefined);
      setDayEndPending(dayEnd);
      if (dayEnd) setDayEndReveal(null);
    } else {
      setDayEndPending(true);
      setDayEndReveal(null);
      remoteSession.pushState(sessionCode, gameState, true, null).catch((e) => setError(e.message));
    }
  }

  // playtest-feedback.md 2026-09-14 "End Turn/Cancel": clicking End Turn as
  // the day's last player immediately shows the day-end dossier (grub
  // discard + Egg Exchange) with no way back — an accidental click there
  // stranded the player. Safe to just flip dayEndPending back off: unlike
  // handleDayEndSubmit, nothing about turn/action state was ever touched
  // when it was set (see the `else` branch of handleEndTurn below), so
  // canceling restores exactly the board the player was on, actions intact.
  function handleCancelDayEnd() {
    setDayEndPending(false);
    remoteSession.pushState(sessionCode, gameState, false).catch((e) => setError(e.message));
  }

  function handleDayEndSubmit({ discardSide, exchanges }) {
    try {
      const before = gameState;
      let s = advanceDay(before, { discardSide, exchanges });
      remoteSession.clearPendingExchanges(sessionCode).catch((e) => setError(e.message));
      setPendingExchangesState({});
      if (s.gameOver) {
        // Fall day 7 — advanceDay ends the game before the exchange block
        // ever runs, so there's no reveal to show; the outcome dossier
        // takes over instead (README "Fall day 7 — no day-end screen worth
        // designing").
        applyStateUpdate(s, false, null);
        setDayEndPending(false);
        setDayEndReveal(null);
        return;
      }
      const reveal = buildDayEndReveal(before, discardSide, exchanges, s);
      s = endTurn(s); // advanceDay doesn't reset currentPlayerIndex itself
      const { state } = advanceToNextActor(s);
      // The overlay stays up for the reveal step regardless of whether the
      // fresh day would itself immediately need another day-end prompt —
      // handleDismissDayEndReveal resolves that for real once the reveal
      // is dismissed, from whatever `state` looks like by then.
      applyStateUpdate(state, true, reveal);
      setDayEndPending(true);
      setDayEndReveal(reveal);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // Local-only dismissal (README "Dismissal"): the reveal is informational
  // and nothing at the table waits on it, so tapping past it never writes
  // to Firestore — it just stops showing it on this device, and records
  // which reveal was dismissed so the snapshot handler above doesn't
  // reopen the same one from a later, unrelated write. Recomputes whether
  // a day-end prompt is needed from the current state rather than trusting
  // a value stashed at submit time, since dismissal can happen well after.
  function handleDismissDayEndReveal() {
    dismissedRevealKeyRef.current = dayEndReveal ? `${dayEndReveal.day}|${dayEndReveal.season}` : null;
    setDayEndReveal(null);
    setDayEndPending(isLastPlayerOfDay(gameState));
  }

  // Optimistic-local + fire-and-forget sync, same pattern as everywhere
  // else here — each player only ever writes their own key (see
  // remoteSession.setPendingExchange), so there's nothing to race.
  function handleSetExchangeAmount(playerId, amount) {
    setPendingExchangesState((prev) => ({ ...prev, [playerId]: amount }));
    remoteSession.setPendingExchange(sessionCode, playerId, amount).catch((e) => setError(e.message));
  }

  function handleUseExtraAction(playerId) {
    try {
      applyStateUpdate(useExtraActionToken(gameState, playerId));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // Host and Join both claim a seat as part of the same tap now — there's
  // no separate nameEntry screen anymore, so this does what
  // handleCreateLobby + handleSubmitName used to do together.
  async function handleHost(name) {
    try {
      const code = await remoteSession.createSession({ playerCount: 4, eggspansion: false, difficulty: 4 });
      const seatId = await remoteSession.joinAndClaimSeat(code, name);
      remoteSession.setMySeat(code, seatId);
      setMyPlayerId(seatId);
      persistSessionCode(code);
      setSessionCode(code); // the subscribe effect above takes it from here
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleJoinByCode(name, code) {
    try {
      await remoteSession.getSession(code); // validates the code exists before committing to it
      const existingSeat = remoteSession.getMySeat(code);
      const seatId = existingSeat ?? (await remoteSession.joinAndClaimSeat(code, name));
      if (!existingSeat) remoteSession.setMySeat(code, seatId);
      setMyPlayerId(seatId);
      persistSessionCode(code);
      setSessionCode(code);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // Just remembers the name and moves to the difficulty/Eggspansion step —
  // the seat isn't claimed until that step submits (handleStartSolo).
  function handleGoToSoloSetup(name) {
    setPendingName(name);
    setScreen('soloSetup');
  }

  async function handleStartSolo(soloConfig) {
    try {
      setSoloFlow(true);
      const code = await remoteSession.createSession({ playerCount: 1, ...soloConfig });
      const seatId = await remoteSession.joinAndClaimSeat(code, pendingName);
      remoteSession.setMySeat(code, seatId);
      setMyPlayerId(seatId);
      persistSessionCode(code);
      setSessionCode(code);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // Forgets this device's session locally (localStorage + the URL) and
  // resets all session-derived state back to a clean slate — the shared
  // Firestore doc itself is untouched, so this only affects what *this*
  // device reconnects to on its next load, not the other seats. Used once
  // a game is over (or you want to bail on a lobby you're stuck in) so a
  // refresh doesn't keep reopening the same finished/abandoned game.
  function leaveSession() {
    if (sessionCode) remoteSession.clearMySeat(sessionCode);
    clearStoredSessionCode();
    setSessionCode(null);
    setHostConfig(null);
    setSeats({});
    setPredators(null);
    setDealtChickens(null);
    setChosenChicken({});
    setStartingLocations({});
    setMyPlayerId(null);
    setGameState(null);
    setDayEndPending(false);
    setPendingPick(null);
    setSoloFlow(false);
    setPendingName(null);
    soloStartingRef.current = false;
    finalizingRef.current = false;
    setError(null);
    setScreen('entry');
  }

  function handleUpdateHostConfig(partial) {
    const next = { ...hostConfig, ...partial };
    setHostConfig(next); // optimistic, same pattern as applyStateUpdate below
    remoteSession.updateHostConfig(sessionCode, next).catch((e) => setError(e.message));
  }

  function handleToggleReady(ready) {
    remoteSession.setReady(sessionCode, myPlayerId, ready).catch((e) => setError(e.message));
  }

  // Parametrized so the solo auto-start path (inside the subscribe
  // callback, before hostConfig state has necessarily caught up) and the
  // multiplayer host's explicit Start Game tap can share it.
  function startDraftFor(code, cfg) {
    try {
      const seatIds = Array.from({ length: cfg.playerCount }, (_, i) => `p${i + 1}`);
      const rng = () => Math.random();
      const predatorSelection = randomizePredatorSelection(cfg.difficulty, cfg.eggspansion, rng);
      const dealt = dealChickenChoices(seatIds, cfg.eggspansion, rng);
      remoteSession.startDraft(code, predatorSelection, dealt).catch((e) => setError(e.message));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleStartDraft() {
    startDraftFor(sessionCode, hostConfig);
  }

  function handleLockIn(chickenName, startingLocation) {
    remoteSession.lockInChicken(sessionCode, myPlayerId, chickenName, startingLocation).catch((e) => setError(e.message));
  }

  if (screen === 'entry') {
    return html`<${Entry} onHost=${handleHost} onJoin=${handleJoinByCode} onSolo=${handleGoToSoloSetup} error=${error} />`;
  }

  if (screen === 'soloSetup') {
    return html`<${SoloSetup} onStart=${handleStartSolo} error=${error} />`;
  }

  if (screen === 'lobby') {
    return html`<${Lobby}
      role=${isHost ? 'host' : 'guest'}
      code=${sessionCode}
      hostConfig=${hostConfig}
      seats=${seats}
      myPlayerId=${myPlayerId}
      onUpdateHostConfig=${handleUpdateHostConfig}
      onStart=${handleStartDraft}
      onToggleReady=${handleToggleReady}
      onLeave=${leaveSession}
      error=${error}
    />`;
  }

  if (screen === 'chickenDraft') {
    const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
    return html`<${ChickenDraft}
      predators=${predators}
      candidates=${dealtChickens[myPlayerId]}
      allCandidates=${dealtChickens}
      lockedIn=${chosenChicken[myPlayerId] ?? null}
      seatIds=${seatIds}
      seats=${seats}
      chosenChicken=${chosenChicken}
      myPlayerId=${myPlayerId}
      onLockIn=${handleLockIn}
    />`;
  }

  if (screen === 'gameOver') {
    const won = gameState.won;
    const predatorsDefeated = gameState.predators.filter((p) => p.defeated).length;
    const survivors = gameState.players.filter((p) => p.alive).length;
    return html`
      <div class="dossier-backdrop">
        <div class=${`dossier-panel kind-${won ? 'victory' : 'loss'}`}>
          <div class="dossier-header">
            <span class="dossier-eyebrow">GAME OVER</span>
            <span class="dossier-title">${won ? 'Victory!' : 'Defeat'}</span>
            <span class="dossier-subtitle">${gameState.season} · Day ${gameState.day}</span>
          </div>

          <div class="dossier-body">
            <div class="dossier-portrait-col">
              <div class="dossier-portrait-plate">
                <div class="dossier-portrait-art"><span class="dossier-outcome-icon">${won ? '🏆' : '💀'}</span></div>
                <div class="dossier-portrait-label">${won ? 'All Predators Defeated' : 'The Flock Has Fallen'}</div>
              </div>
              <div class="dossier-stat-row">
                <div class="dossier-stat">
                  <div class="dossier-label">PREDATORS DEFEATED</div>
                  <div class="dossier-stat-value">${predatorsDefeated}/${gameState.predators.length}</div>
                </div>
                <div class="dossier-stat">
                  <div class="dossier-label">PLAYERS ALIVE</div>
                  <div class="dossier-stat-value">${survivors}/${gameState.players.length}</div>
                </div>
              </div>
            </div>

            <div class="dossier-detail-col">
              <div class="dossier-section">
                <span class="dossier-section-title">${won ? 'RESULT' : 'CAUSE'}</span>
                <div class="dossier-flavor-text">
                  ${won
                    ? 'All 4 Predators defeated before the 3rd season ended, with everyone alive.'
                    : gameState.players.every((p) => !p.alive)
                    ? 'The whole flock has fallen.'
                    : 'The 3rd season ended before every Predator was defeated (or a downed player never made it back for their first turn).'}
                </div>
              </div>

              <div class="dossier-divider"></div>

              <div class="dossier-section">
                <span class="dossier-section-title">FINAL FLOCK</span>
                ${gameState.players.map(
                  (p) => html`
                    <div key=${p.id} class="dossier-flavor-text">
                      ${playerNames[p.id] ?? p.id} — ${p.chickenName} · Stage ${p.stage}
                      ${p.alive ? html` — ${p.health}/${p.maxHealth} health` : html` — fallen`}
                    </div>
                  `,
                )}
              </div>
            </div>
          </div>

          <div class="dossier-footer">
            <div class="dossier-spacer"></div>
            <button type="button" class="dossier-btn-confirm" onClick=${leaveSession}>LEAVE GAME</button>
          </div>
        </div>
      </div>
    `;
  }

  const currentPlayerId = gameState.turnOrder[gameState.currentPlayerIndex];
  const currentPlayer = gameState.players.find((p) => p.id === currentPlayerId);
  // The device's own seat — what "my board"/"you are here" means. Distinct
  // from currentPlayer (whoever's turn it is): the action bar stays tied to
  // currentPlayer (only the active player can act, so that's the right
  // stats/caps to build buttons from), but every display-only panel (dock,
  // board location, mobile strip/HERE card, player sheet) should always
  // show *my* player, not whoever's turn it happens to be — previously
  // these all used currentPlayer, so during a teammate's turn a device
  // would show their board/location as if it were your own (playtest-
  // feedback.md, 2026-08-19 "Multi-Player Board" / "Mobile Health
  // Discrepancy" entries). Falls back to currentPlayer if myPlayerId isn't
  // a real seat (local/no-session contexts, same tolerance canAct already has).
  const myPlayer = gameState.players.find((p) => p.id === myPlayerId) ?? currentPlayer;
  const opponents = gameState.players.filter((p) => p.id !== myPlayer.id);
  // Full history, newest first — the rail panel is a persistent scrollable
  // log now (not a small popup), so there's no reason to cap it.
  const recentLog = gameState.actionLog.filter((a) => formatLogEntry(a, playerNames)).slice().reverse();

  // Function, not a hoisted vnode — reused for both mobile's bottom sheet
  // (unchanged, "Traits & Cards" overlay in mobilePlayerSheet.js) and, for
  // the desktop rail below, passed in as the sidebar's `actionsSlot`;
  // Preact can't render the same vnode instance twice.
  const actionBar = () => html`<${ActionBar}
    state=${gameState}
    player=${currentPlayer}
    dispatch=${dispatch}
    onEndTurn=${handleEndTurn}
    onUseExtraAction=${() => handleUseExtraAction(currentPlayer.id)}
    pendingPick=${pendingPick}
    setPendingPick=${setPendingPick}
    myPlayerId=${myPlayerId}
    displayName=${playerNames[currentPlayer.id] ?? currentPlayer.id}
    playerNames=${playerNames}
  />`;

  // Desktop left rail (design 7a) — the player's own board, always myPlayer,
  // with the action grid / special abilities / End Turn wired to whoever's
  // turn it currently is (currentPlayer) exactly like the old dockPanel()+
  // actionBar() split did.
  const sidebarPanel = () => html`<${PlayerPanel}
    variant="sidebar"
    player=${myPlayer}
    currentPlayer=${currentPlayer}
    isCurrent=${myPlayer.id === currentPlayerId}
    state=${gameState}
    dispatch=${dispatch}
    pendingPick=${pendingPick}
    setPendingPick=${setPendingPick}
    myPlayerId=${myPlayerId}
    displayName=${playerNames[myPlayer.id] ?? myPlayer.id}
    playerNames=${playerNames}
    onEndTurn=${handleEndTurn}
    onUseExtraAction=${() => handleUseExtraAction(currentPlayer.id)}
    actionsSlot=${currentPlayer.pendingProductionReveal
      ? html`<${ProductionReveal} player=${currentPlayer} dispatch=${dispatch} myPlayerId=${myPlayerId} />`
      : actionBar()}
  />`;

  // Predator/Grub dossier (design mockup 6a): either committing (Attack
  // armed, a target was just clicked — the dossier is itself the confirm
  // step) or a read-only inspect (nothing armed, just peeking at a
  // reference card). At most one of these is ever true.
  const dossierCommitting = pendingPick?.type === 'attack' && pendingPick.step === 'dossier';
  const dossierTargetType = dossierCommitting ? pendingPick.targetType : inspectingTarget?.targetType;
  const dossierTargetId = dossierCommitting ? pendingPick.targetId : inspectingTarget?.targetId;

  return html`
    <div class="game">
      ${error && html`<div class="error-banner">${error}</div>`}
      ${dossierTargetId &&
      html`<${TargetDossier}
        key=${`${dossierTargetType}-${dossierTargetId}`}
        state=${gameState}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
        myPlayerId=${myPlayerId}
        targetType=${dossierTargetType}
        targetId=${dossierTargetId}
        committing=${dossierCommitting}
        onClose=${() => (dossierCommitting ? setPendingPick(null) : setInspectingTarget(null))}
      />`}
      ${pendingPick?.type === 'drawTwoKeepOne' &&
      html`<${ForesightPicker} state=${gameState} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} myPlayerId=${myPlayerId} />`}
      ${dayEndPending &&
      html`<${TurnControls}
        state=${gameState}
        onSubmitDayEnd=${handleDayEndSubmit}
        onCancel=${handleCancelDayEnd}
        myPlayerId=${myPlayerId}
        playerNames=${playerNames}
        pendingExchanges=${pendingExchanges}
        onSetExchangeAmount=${handleSetExchangeAmount}
        dayEndReveal=${dayEndReveal}
        onDismissReveal=${handleDismissDayEndReveal}
      />`}

      <div class="gs-topbar">
        <span class="gs-title">FLOCK TOGETHER</span>
        <div class="gs-divider"></div>
        <div class="gs-season">
          <span class="gs-season-label">SEASON</span>
          <div class="season-pills">
            ${SEASON_ORDER.map((s) => html`<span key=${s} class=${`season-pill ${s === gameState.season ? 'active' : ''}`}>${s.toUpperCase()}</span>`)}
          </div>
          <span class="gs-day">Day ${gameState.day} · Phase ${gameState.phase}</span>
        </div>
        <div class="gs-divider"></div>
        <div class="gs-turnorder">
          ${gameState.turnOrder.map(
            (id) =>
              html`<span
                key=${id}
                class=${`turn-avatar ${id === currentPlayerId ? 'active' : ''}`}
                title=${playerNames[id] ?? id}
                style=${{ background: playerColor(gameState, id) }}
              >${(playerNames[id] ?? id).slice(0, 2)}</span>`,
          )}
        </div>
        <div class="gs-spacer"></div>
        <button type="button" class="table-view-toggle" onClick=${() => setTableView((v) => !v)}>
          ⤢ ${tableView ? 'Exit table view' : 'Table view'}
        </button>
      </div>

      <div class="gs-mid">
        ${!tableView && html`<div class="gs-side-panel">${sidebarPanel()}</div>`}
        <div class="gs-board">
          ${dieRoll && html`<${DieRoll} key=${dieRoll.key} roll=${dieRoll.roll} label=${dieRoll.label} />`}
          <${Board}
            state=${gameState}
            dispatch=${dispatch}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
            playerNames=${playerNames}
            hereLocation=${myPlayer.location}
            onInspectTarget=${(targetType, targetId) => setInspectingTarget({ targetType, targetId })}
          />
        </div>
        ${!tableView &&
        html`<div class="right-rail">
          ${opponents.length > 0 &&
          html`<${AvatarStrip}
            opponents=${opponents}
            currentPlayerId=${currentPlayerId}
            state=${gameState}
            dispatch=${dispatch}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
            myPlayerId=${myPlayerId}
            playerNames=${playerNames}
          />`}
          <div class="log-rail">
            <div class="log-rail-title">LOG</div>
            <div class="log-rail-entries">
              ${recentLog.map((a, i) => html`<div key=${i} class="log-rail-entry">${formatLogEntry(a, playerNames)}</div>`)}
            </div>
          </div>
        </div>`}
      </div>

      <${MobilePlay}
        state=${gameState}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
        myPlayerId=${myPlayerId}
        playerNames=${playerNames}
        myPlayer=${myPlayer}
        currentPlayer=${currentPlayer}
        opponents=${opponents}
        onEndTurn=${handleEndTurn}
        onUseExtraAction=${() => handleUseExtraAction(currentPlayer.id)}
        recentLog=${recentLog}
        formatLogEntry=${formatLogEntry}
        onInspectTarget=${(targetType, targetId) => setInspectingTarget({ targetType, targetId })}
        onOpenPlayerSheet=${() => setMobilePlayerSheetOpen(true)}
        actionBarFactory=${actionBar}
      />
      ${mobilePlayerSheetOpen &&
      html`<${MobilePlayerSheet}
        player=${myPlayer}
        state=${gameState}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
        myPlayerId=${myPlayerId}
        displayName=${playerNames[myPlayer.id] ?? myPlayer.id}
        playerNames=${playerNames}
        onClose=${() => setMobilePlayerSheetOpen(false)}
      />`}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
