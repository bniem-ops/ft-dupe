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
import { Board } from './components/board.js';
import { PlayerPanel } from './components/playerPanel.js';
import { ActionBar } from './components/actionBar.js';
import { TurnControls } from './components/turnControls.js';

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

  return html`
    <div class="game">
      ${error && html`<div class="error-banner">${error}</div>`}
      <${Board}
        state=${gameState}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
        playerNames=${playerNames}
      />
      <div class="players">
        ${gameState.players.map(
          (p) => html`<${PlayerPanel}
            key=${p.id}
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
      </div>
      ${dayEndPending
        ? html`<${TurnControls} state=${gameState} onSubmitDayEnd=${handleDayEndSubmit} myPlayerId=${myPlayerId} playerNames=${playerNames} />`
        : html`<${ActionBar}
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
          />`}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
