import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';
import { createGame, applyAction, startTurn, endTurn, isLastPlayerOfDay, advanceDay, useExtraActionToken } from './engine.js';
import { Setup } from './setup.js';
import { RemoteHome, Lobby } from './components/lobby.js';
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
  const [screen, setScreen] = useState('setup');
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [dayEndPending, setDayEndPending] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);

  // Remote-session state (docs/engine-plan.md phase 8). sessionCode is
  // null in local hotseat play — every remote-only code path below is
  // guarded on it, so local play is unaffected.
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [hostConfig, setHostConfig] = useState(null);
  const [claimedSeats, setClaimedSeats] = useState({});
  const [myPlayerId, setMyPlayerId] = useState(null);

  // Subscribes once a session exists, for both the lobby (hostConfig/
  // claimedSeats) and the live game (state/dayEndPending) — the same doc
  // carries both, so one listener drives every screen after `remoteHome`.
  useEffect(() => {
    if (!sessionCode) return undefined;
    const unsubscribe = remoteSession.subscribe(sessionCode, (doc) => {
      if (!doc) return;
      setHostConfig(doc.hostConfig ?? null);
      setClaimedSeats(doc.claimedSeats ?? {});
      if (doc.state) {
        const synced = fromSyncedDoc(doc.state);
        setGameState(synced);
        setDayEndPending(!!doc.dayEndPending);
        setScreen(synced.gameOver ? 'gameOver' : 'game');
      } else {
        setScreen('lobby');
      }
    });
    return unsubscribe;
  }, [sessionCode]);

  // Every path that can produce a new GameState routes through this so a
  // gameOver result (win via a killing blow, loss via end-of-turn weather
  // or a Fall day 8 rollover) always reaches the end screen, not just the
  // day-end submit path that used to be the only place checking it. In a
  // remote session it also pushes the result to Firestore — every device
  // (including this one) then re-renders from whatever onSnapshot
  // delivers back, so this local setGameState is just an optimistic
  // preview, not the final word.
  function applyStateUpdate(next, dayEnd = dayEndPending) {
    setGameState(next);
    if (next.gameOver) setScreen('gameOver');
    if (sessionCode) remoteSession.pushState(sessionCode, next, dayEnd).catch((e) => setError(e.message));
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

  function handleStartGame(config) {
    try {
      const created = createGame(config);
      const { state, dayEnd } = advanceToNextActor(created);
      setGameState(state);
      setDayEndPending(dayEnd);
      setError(null);
      setScreen('game');
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
      if (sessionCode) remoteSession.pushState(sessionCode, gameState, true).catch((e) => setError(e.message));
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

  async function handleCreateSession(formHostConfig) {
    try {
      const code = await remoteSession.createSession(formHostConfig);
      setIsHost(true);
      setHostConfig(formHostConfig);
      setSessionCode(code);
      setScreen('lobby');
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleJoinSession(code) {
    try {
      await remoteSession.joinSession(code); // validates the code exists before committing to it
      setIsHost(false);
      const savedSeat = remoteSession.getMySeat(code);
      if (savedSeat) setMyPlayerId(savedSeat);
      setSessionCode(code); // the subscribe effect above takes it from here
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleClaimSeat(seatId, chickenName) {
    try {
      await remoteSession.claimSeat(sessionCode, seatId, chickenName);
      remoteSession.setMySeat(sessionCode, seatId);
      setMyPlayerId(seatId);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleStartRemoteGame() {
    try {
      const seatIds = Array.from({ length: hostConfig.playerCount }, (_, i) => `p${i + 1}`);
      const config = {
        players: seatIds.map((id) => ({ id, chickenName: claimedSeats[id] })),
        difficulty: hostConfig.difficulty,
        eggspansion: hostConfig.eggspansion,
        rng: () => Math.random(),
        ...(hostConfig.predators ? { predators: hostConfig.predators } : {}),
      };
      const created = createGame(config);
      remoteSession.startGame(sessionCode, created).catch((e) => setError(e.message));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  if (screen === 'setup') {
    return html`<${Setup} onStart=${handleStartGame} onPlayRemotely=${() => setScreen('remoteHome')} error=${error} />`;
  }

  if (screen === 'remoteHome') {
    return html`<${RemoteHome} onCreate=${handleCreateSession} onJoin=${handleJoinSession} error=${error} />`;
  }

  if (screen === 'lobby') {
    return html`<${Lobby}
      code=${sessionCode}
      hostConfig=${hostConfig}
      claimedSeats=${claimedSeats}
      mySeat=${myPlayerId}
      isHost=${isHost}
      onClaim=${handleClaimSeat}
      onStart=${handleStartRemoteGame}
      error=${error}
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

  return html`
    <div class="game">
      ${error && html`<div class="error-banner">${error}</div>`}
      <${Board}
        state=${gameState}
        dispatch=${dispatch}
        pendingPick=${pendingPick}
        setPendingPick=${setPendingPick}
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
          />`,
        )}
      </div>
      ${dayEndPending
        ? html`<${TurnControls} state=${gameState} onSubmitDayEnd=${handleDayEndSubmit} myPlayerId=${myPlayerId} />`
        : html`<${ActionBar}
            state=${gameState}
            player=${currentPlayer}
            dispatch=${dispatch}
            onEndTurn=${handleEndTurn}
            onUseExtraAction=${() => handleUseExtraAction(currentPlayer.id)}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
            myPlayerId=${myPlayerId}
          />`}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
