import { render } from 'preact';
import { useState } from 'preact/hooks';
import { html } from 'htm/preact';
import { createGame, applyAction, startTurn, endTurn, isLastPlayerOfDay, advanceDay, useExtraActionToken } from './engine.js';
import { Setup } from './setup.js';
import { Board } from './components/board.js';
import { PlayerPanel } from './components/playerPanel.js';
import { ActionBar } from './components/actionBar.js';
import { TurnControls } from './components/turnControls.js';

// Advances from `state` until either a living player's turn has started
// (production applied via startTurn) or the day has ended and needs the
// day-end prompt. Dead players are skipped entirely — startTurn doesn't
// check `alive` itself, and revival (Brood reviving mid-turn-cycle) is
// handled the next time this runs.
function advanceToNextActor(state) {
  let s = state;
  for (;;) {
    const playerId = s.turnOrder[s.currentPlayerIndex];
    const player = s.players.find((p) => p.id === playerId);
    if (player.alive) return { state: startTurn(s), dayEnd: false };
    if (isLastPlayerOfDay(s)) return { state: s, dayEnd: true };
    s = endTurn(s);
  }
}

function App() {
  const [screen, setScreen] = useState('setup');
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);
  const [dayEndPending, setDayEndPending] = useState(false);
  const [pendingPick, setPendingPick] = useState(null);

  function dispatch(action) {
    try {
      setGameState(applyAction(gameState, action));
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
      setGameState(state);
      setDayEndPending(dayEnd);
    } else {
      setDayEndPending(true);
    }
  }

  function handleDayEndSubmit({ discardSide, exchanges }) {
    try {
      let s = advanceDay(gameState, { discardSide, exchanges });
      if (s.gameOver) {
        setGameState(s);
        setScreen('gameOver');
        setDayEndPending(false);
        return;
      }
      s = endTurn(s); // advanceDay doesn't reset currentPlayerIndex itself
      const { state, dayEnd } = advanceToNextActor(s);
      setGameState(state);
      setDayEndPending(dayEnd);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleUseExtraAction(playerId) {
    try {
      setGameState(useExtraActionToken(gameState, playerId));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  if (screen === 'setup') {
    return html`<${Setup} onStart=${handleStartGame} error=${error} />`;
  }

  if (screen === 'gameOver') {
    return html`
      <div class="game-over">
        <h1>Fall Day 7 reached</h1>
        <p>Win/lose evaluation isn't implemented yet — check the board and decide as a group whether you made it.</p>
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
          (p) => html`<${PlayerPanel} key=${p.id} player=${p} isCurrent=${p.id === currentPlayerId} />`,
        )}
      </div>
      ${dayEndPending
        ? html`<${TurnControls} state=${gameState} onSubmitDayEnd=${handleDayEndSubmit} />`
        : html`<${ActionBar}
            state=${gameState}
            player=${currentPlayer}
            dispatch=${dispatch}
            onEndTurn=${handleEndTurn}
            onUseExtraAction=${() => handleUseExtraAction(currentPlayer.id)}
            pendingPick=${pendingPick}
            setPendingPick=${setPendingPick}
          />`}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
