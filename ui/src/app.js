import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { html } from 'htm/preact';
import {
  createGame,
  applyAction,
  startTurn,
  endTurn,
  isLastPlayerOfDay,
  advanceDay,
  useExtraActionToken,
  randomizePredatorSelection,
  dealChickenChoices,
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

const SEASON_ORDER = ['Spring', 'Summer', 'Fall'];

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

function App() {
  const [screen, setScreen] = useState('entry');
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [dayEndPending, setDayEndPending] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);
  // Mobile UI state (≤900px — see styles.css's .mobile-play-*, design
  // mockups 7a-7c). Purely local presentation state, not synced.
  const [mobilePlayerSheetOpen, setMobilePlayerSheetOpen] = useState(false);
  // Desktop-only UI state (≥901px — see styles.css's .gs-side-panel/
  // .avatar-strip). Purely local presentation state, not synced.
  const [tableView, setTableView] = useState(false);
  const [logRailOpen, setLogRailOpen] = useState(false);
  // A Predator or Grub inspected read-only (no attack armed) — design
  // mockup 6a's dossier doubling as a reference card. Separate from
  // pendingPick since it's a non-committal peek, not part of the action
  // state machine. { targetType: 'predator'|'grub', targetId } | null.
  const [inspectingTarget, setInspectingTarget] = useState(null);

  // Session state — every game is a session now, no local hotseat mode.
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [hostConfig, setHostConfig] = useState(null);
  const [seats, setSeats] = useState({});
  const [predators, setPredators] = useState(null);
  const [dealtChickens, setDealtChickens] = useState(null);
  const [chosenChicken, setChosenChicken] = useState({});
  const [myPlayerId, setMyPlayerId] = useState(null);
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

      if (doc.state) {
        const synced = fromSyncedDoc(doc.state);
        setGameState(synced);
        setDayEndPending(!!doc.dayEndPending);
        setScreen(synced.gameOver ? 'gameOver' : 'game');
        return;
      }
      // myPlayerId (React state) can lag one tick behind a join that just
      // succeeded — the doc's snapshot can arrive before this device's own
      // setMyPlayerId call runs. Falling back to the synchronous localStorage
      // read (already written by the Host/Join/Solo handler before
      // setMyPlayerId) avoids a spurious flash back to the entry screen.
      const savedSeat = myPlayerId ?? remoteSession.getMySeat(sessionCode);
      if (!savedSeat) {
        // Shouldn't normally happen now that a seat is claimed as part of
        // the Host/Join/Solo submission itself — still the safest fallback.
        setScreen('entry');
        return;
      }
      if (!myPlayerId) setMyPlayerId(savedSeat);

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
  useEffect(() => {
    if (!isHost || !predators || !dealtChickens || !hostConfig || finalizingRef.current) return;
    const seatIds = Object.keys(seats);
    if (seatIds.length < hostConfig.playerCount) return;
    if (!seatIds.every((id) => chosenChicken[id])) return;

    finalizingRef.current = true;
    try {
      const config = {
        players: seatIds.map((id) => ({ id, chickenName: chosenChicken[id] })),
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
  }, [isHost, predators, dealtChickens, hostConfig, seats, chosenChicken, sessionCode]);

  // Every path that can produce a new GameState routes through this so a
  // gameOver result (win via a killing blow, loss via end-of-turn weather
  // or a Fall day 8 rollover) always reaches the end screen. Pushes to
  // Firestore; every device (including this one) then re-renders from
  // whatever onSnapshot delivers back, so this local setGameState is just
  // an optimistic preview, not the final word.
  function applyStateUpdate(next, dayEnd = dayEndPending) {
    setGameState(next);
    if (next.gameOver) setScreen('gameOver');
    remoteSession.pushState(sessionCode, next, dayEnd).catch((e) => setError(e.message));
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
      applyStateUpdate(state, dayEnd);
      setDayEndPending(dayEnd);
    } else {
      setDayEndPending(true);
      remoteSession.pushState(sessionCode, gameState, true).catch((e) => setError(e.message));
    }
  }

  function handleDayEndSubmit({ discardSide, exchanges }) {
    try {
      let s = advanceDay(gameState, { discardSide, exchanges });
      if (s.gameOver) {
        applyStateUpdate(s, false);
        setDayEndPending(false);
        return;
      }
      s = endTurn(s); // advanceDay doesn't reset currentPlayerIndex itself
      const { state, dayEnd } = advanceToNextActor(s);
      applyStateUpdate(state, dayEnd);
      setDayEndPending(dayEnd);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
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
      setIsHost(true);
      const seatId = await remoteSession.joinAndClaimSeat(code, name);
      remoteSession.setMySeat(code, seatId);
      setMyPlayerId(seatId);
      setSessionCode(code); // the subscribe effect above takes it from here
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleJoinByCode(name, code) {
    try {
      await remoteSession.getSession(code); // validates the code exists before committing to it
      setIsHost(false);
      const existingSeat = remoteSession.getMySeat(code);
      const seatId = existingSeat ?? (await remoteSession.joinAndClaimSeat(code, name));
      if (!existingSeat) remoteSession.setMySeat(code, seatId);
      setMyPlayerId(seatId);
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
      setIsHost(true);
      const seatId = await remoteSession.joinAndClaimSeat(code, pendingName);
      remoteSession.setMySeat(code, seatId);
      setMyPlayerId(seatId);
      setSessionCode(code);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
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

  function handleLockIn(chickenName) {
    remoteSession.lockInChicken(sessionCode, myPlayerId, chickenName).catch((e) => setError(e.message));
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
      error=${error}
    />`;
  }

  if (screen === 'chickenDraft') {
    const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
    return html`<${ChickenDraft}
      predators=${predators}
      candidates=${dealtChickens[myPlayerId]}
      lockedIn=${chosenChicken[myPlayerId] ?? null}
      seatIds=${seatIds}
      seats=${seats}
      chosenChicken=${chosenChicken}
      myPlayerId=${myPlayerId}
      onLockIn=${handleLockIn}
    />`;
  }

  if (screen === 'gameOver') {
    return html`
      <div class="game-over">
        ${gameState.won
          ? html`<h1>🏆 You Won!</h1>
              <p>All 4 Predators defeated before the 3rd season ended, with everyone alive.</p>`
          : html`<h1>Defeat</h1>
              <p>
                ${gameState.players.every((p) => !p.alive)
                  ? 'The whole flock has fallen.'
                  : 'The 3rd season ended before every Predator was defeated (or a downed player never made it back for their first turn).'}
              </p>`}
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
  // Filter before slicing so a superseded entry (resolveProductionReveal's
  // raw action, see formatLogEntry's case above) doesn't crowd out a real
  // one from the last-12 window.
  const recentLog = gameState.actionLog.filter((a) => formatLogEntry(a, playerNames)).slice(-12).reverse();

  // Functions, not hoisted vnodes — the dock is rendered in two places at
  // once (desktop side panel, CSS-hidden on mobile; mobile sheet, CSS-hidden
  // on desktop), and Preact can't render the same vnode instance twice.
  // `slideOver` is only true for the desktop side panel — the mobile sheet
  // keeps the notebook inline like before.
  const dockPanel = (slideOver = false) => html`<${PlayerPanel}
    variant="dock"
    player=${myPlayer}
    isCurrent=${myPlayer.id === currentPlayerId}
    state=${gameState}
    dispatch=${dispatch}
    pendingPick=${pendingPick}
    setPendingPick=${setPendingPick}
    myPlayerId=${myPlayerId}
    displayName=${playerNames[myPlayer.id] ?? myPlayer.id}
    playerNames=${playerNames}
    slideOverNotebook=${slideOver}
  />`;

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
        ${!tableView &&
        html`<div class="gs-side-panel">
          ${dayEndPending
            ? html`<${TurnControls} state=${gameState} onSubmitDayEnd=${handleDayEndSubmit} myPlayerId=${myPlayerId} playerNames=${playerNames} />`
            : currentPlayer.pendingProductionReveal
              ? html`${dockPanel(true)}<${ProductionReveal} player=${currentPlayer} dispatch=${dispatch} myPlayerId=${myPlayerId} />`
              : html`${dockPanel(true)}${actionBar()}`}
        </div>`}
        <div class="gs-board">
          <${Board}
            state=${gameState}
            dispatch=${dispatch}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
            playerNames=${playerNames}
            hereLocation=${myPlayer.location}
            onInspectTarget=${(targetType, targetId) => setInspectingTarget({ targetType, targetId })}
          />
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
              <button type="button" class="log-rail-toggle" title="Log" onClick=${() => setLogRailOpen((v) => !v)}>
                🕘
              </button>
              ${logRailOpen &&
              html`<div class="log-rail-panel">
                <div class="log-rail-title">LOG</div>
                ${recentLog.map((a, i) => html`<div key=${i} class="log-rail-entry">${formatLogEntry(a, playerNames)}</div>`)}
              </div>`}
            </div>
          </div>`}
        </div>
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
        dayEndPending=${dayEndPending}
        onSubmitDayEnd=${handleDayEndSubmit}
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
