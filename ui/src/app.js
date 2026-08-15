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
import { Landing } from './components/landing.js';
import { CreateGame } from './components/createGame.js';
import { JoinGame } from './components/joinGame.js';
import { NameEntry } from './components/nameEntry.js';
import { Lobby } from './components/lobby.js';
import { ChickenDraft } from './components/chickenDraft.js';
import { remoteSession, fromSyncedDoc } from './remoteSession.js';
import { Board, playerColor } from './components/board.js';
import { PlayerPanel } from './components/playerPanel.js';
import { ActionBar } from './components/actionBar.js';
import { TurnControls } from './components/turnControls.js';

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
  const [screen, setScreen] = useState('landing');
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [dayEndPending, setDayEndPending] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);
  // Mobile bottom-sheet UI state (≤900px — see styles.css's .gs-mobile-dock).
  // Purely local presentation state, not synced.
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState('board');

  // Session state — every game is a session now, no local hotseat mode.
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [hostConfig, setHostConfig] = useState(null);
  const [seats, setSeats] = useState({});
  const [predators, setPredators] = useState(null);
  const [dealtChickens, setDealtChickens] = useState(null);
  const [chosenChicken, setChosenChicken] = useState({});
  const [myPlayerId, setMyPlayerId] = useState(null);

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
      // read (already written by handleSubmitName before setMyPlayerId)
      // avoids a spurious flash back to nameEntry — and the "already full"
      // error that flash could otherwise trigger via a re-submit.
      const savedSeat = myPlayerId ?? remoteSession.getMySeat(sessionCode);
      if (!savedSeat) {
        setScreen('nameEntry');
        return;
      }
      if (!myPlayerId) setMyPlayerId(savedSeat);
      setScreen(doc.predators ? 'chickenDraft' : 'lobby');
    });
    return unsubscribe;
  }, [sessionCode, myPlayerId]);

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

  async function handleCreateLobby(formHostConfig) {
    try {
      const code = await remoteSession.createSession(formHostConfig);
      setIsHost(true);
      setSessionCode(code);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleJoinByCode(code) {
    try {
      await remoteSession.getSession(code); // validates the code exists before committing to it
      setIsHost(false);
      const savedSeat = remoteSession.getMySeat(code);
      if (savedSeat) setMyPlayerId(savedSeat);
      setSessionCode(code); // the subscribe effect above takes it from here
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmitName(name) {
    try {
      // Already seated (e.g. a stray re-submit) — reuse it instead of
      // attempting a fresh claim, which would fail with "session is full"
      // once every seat (including this device's own) is taken.
      const existingSeat = remoteSession.getMySeat(sessionCode);
      if (existingSeat) {
        setMyPlayerId(existingSeat);
        setError(null);
        return;
      }
      const seatId = await remoteSession.joinAndClaimSeat(sessionCode, name);
      remoteSession.setMySeat(sessionCode, seatId);
      setMyPlayerId(seatId);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleStartDraft() {
    try {
      const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
      const rng = () => Math.random();
      const predatorSelection = randomizePredatorSelection(hostConfig.difficulty, hostConfig.eggspansion, rng);
      const dealt = dealChickenChoices(seatIds, hostConfig.eggspansion, rng);
      remoteSession.startDraft(sessionCode, predatorSelection, dealt).catch((e) => setError(e.message));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleLockIn(chickenName) {
    remoteSession.lockInChicken(sessionCode, myPlayerId, chickenName).catch((e) => setError(e.message));
  }

  if (screen === 'landing') {
    return html`<${Landing} onCreateGame=${() => setScreen('createGame')} onJoinGame=${() => setScreen('joinGame')} />`;
  }

  if (screen === 'createGame') {
    return html`<${CreateGame} onCreateLobby=${handleCreateLobby} error=${error} />`;
  }

  if (screen === 'joinGame') {
    return html`<${JoinGame} onJoinByCode=${handleJoinByCode} error=${error} />`;
  }

  if (screen === 'nameEntry') {
    return html`<${NameEntry} code=${sessionCode} onSubmitName=${handleSubmitName} error=${error} />`;
  }

  if (screen === 'lobby') {
    return html`<${Lobby} code=${sessionCode} hostConfig=${hostConfig} seats=${seats} isHost=${isHost} onStart=${handleStartDraft} error=${error} />`;
  }

  if (screen === 'chickenDraft') {
    const seatIds = Object.keys(seats);
    const waitingOn = seatIds.filter((id) => id !== myPlayerId && !chosenChicken[id]).map((id) => seats[id]?.name ?? id);
    return html`<${ChickenDraft}
      predators=${predators}
      candidates=${dealtChickens[myPlayerId]}
      lockedIn=${chosenChicken[myPlayerId] ?? null}
      onLockIn=${handleLockIn}
      waitingOn=${waitingOn}
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
  const playerNames = Object.fromEntries(Object.entries(seats).map(([id, s]) => [id, s.name]));
  const opponents = gameState.players.filter((p) => p.id !== currentPlayerId);
  const recentLog = gameState.actionLog.slice(-12).reverse();

  // Functions, not hoisted vnodes — the dock is rendered in two places at
  // once (desktop .gs-dock, CSS-hidden on mobile; mobile sheet, CSS-hidden
  // on desktop), and Preact can't render the same vnode instance twice.
  const dockPanel = () => html`<${PlayerPanel}
    variant="dock"
    player=${currentPlayer}
    isCurrent=${true}
    state=${gameState}
    dispatch=${dispatch}
    pendingPick=${pendingPick}
    setPendingPick=${setPendingPick}
    myPlayerId=${myPlayerId}
    displayName=${playerNames[currentPlayer.id] ?? currentPlayer.id}
    playerNames=${playerNames}
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

  const rail = html`
    <div class="gs-rail-title">FLOCK</div>
    ${opponents.map(
      (p) => html`<${PlayerPanel}
        key=${p.id}
        variant="rail"
        player=${p}
        isCurrent=${p.id === currentPlayerId}
        state=${gameState}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
        myPlayerId=${myPlayerId}
        displayName=${playerNames[p.id] ?? p.id}
        playerNames=${playerNames}
      />`,
    )}
    <div class="gs-log">
      <div class="gs-log-title">LOG</div>
      ${recentLog.map((a, i) => html`<div key=${i} class="gs-log-entry">${formatLogEntry(a, playerNames)}</div>`)}
    </div>
  `;

  return html`
    <div class="game">
      ${error && html`<div class="error-banner">${error}</div>`}

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
      </div>

      <div class="gs-mid">
        <div class="gs-board">
          <${Board}
            state=${gameState}
            dispatch=${dispatch}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
            playerNames=${playerNames}
            hereLocation=${currentPlayer.location}
          />
        </div>
        <div class="gs-rail">${rail}</div>
      </div>

      ${dayEndPending
        ? html`<div class="gs-dock-dayend">
            <${TurnControls} state=${gameState} onSubmitDayEnd=${handleDayEndSubmit} myPlayerId=${myPlayerId} playerNames=${playerNames} />
          </div>`
        : html`<div class="gs-dock">${dockPanel()}${actionBar()}</div>`}

      <div class="gs-mobile-dock">
        ${!mobileSheetOpen
          ? html`
              <div class="mobile-dock-collapsed">
                <span class="name">${playerNames[currentPlayer.id] ?? currentPlayer.id}</span>
                <span class="ref-text">❤ ${currentPlayer.health}/${currentPlayer.maxHealth}</span>
                <div class="gs-spacer"></div>
                <div class="meal"><span>MEAL</span><strong>${currentPlayer.mealCounter}</strong></div>
                <button type="button" class="sheet-toggle" onClick=${() => setMobileSheetOpen(true)}>Board ▲</button>
              </div>
            `
          : html`
              <div class="mobile-dock-expanded">
                <div class="mobile-tabs">
                  ${['board', 'flock', 'log'].map(
                    (t) =>
                      html`<button key=${t} type="button" class=${`mobile-tab ${mobileTab === t ? 'active' : ''}`} onClick=${() => setMobileTab(t)}>
                        ${t === 'board' ? 'My board' : t === 'flock' ? 'Flock' : 'Log'}
                      </button>`,
                  )}
                  <button type="button" class="sheet-toggle" onClick=${() => setMobileSheetOpen(false)}>▼</button>
                </div>
                <div class="mobile-tab-body">
                  ${mobileTab === 'board' && (dayEndPending
                    ? html`<${TurnControls} state=${gameState} onSubmitDayEnd=${handleDayEndSubmit} myPlayerId=${myPlayerId} playerNames=${playerNames} />`
                    : html`${dockPanel()}${actionBar()}`)}
                  ${mobileTab === 'flock' &&
                  opponents.map(
                    (p) => html`<${PlayerPanel}
                      key=${p.id}
                      variant="rail"
                      player=${p}
                      isCurrent=${p.id === currentPlayerId}
                      state=${gameState}
                      dispatch=${dispatch}
                      pendingPick=${pendingPick}
                      setPendingPick=${setPendingPick}
                      myPlayerId=${myPlayerId}
                      displayName=${playerNames[p.id] ?? p.id}
                      playerNames=${playerNames}
                    />`,
                  )}
                  ${mobileTab === 'log' && recentLog.map((a, i) => html`<div key=${i} class="gs-log-entry">${formatLogEntry(a, playerNames)}</div>`)}
                </div>
              </div>
            `}
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
