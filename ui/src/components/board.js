import { html } from 'htm/preact';
import { findPredator, loadGrubCards, seasonCardList, OUTSIDE_LOCATIONS } from '../engine.js';

const PLAYER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085'];

function playerColor(state, playerId) {
  return PLAYER_COLORS[state.turnOrder.indexOf(playerId) % PLAYER_COLORS.length];
}

function activeWeatherCard(state) {
  const active = state.weather.active;
  if (!active) return null;
  const cards = seasonCardList(active.season.toLowerCase(), state.config.eggspansion);
  return cards[active.cardIndex] ?? null;
}

function PlayerTokens({ state, location }) {
  const here = state.players.filter((p) => p.alive && p.location === location);
  return html`
    <div class="tokens">
      ${here.map((p) => html`<span class="token" key=${p.id} style=${{ background: playerColor(state, p.id) }}>${p.id}</span>`)}
    </div>
  `;
}

function PredatorCard({ predator, clickable, onSelect }) {
  if (!predator.revealed) {
    return html`<div class="predator-card hidden">Face-down Boss</div>`;
  }
  const data = findPredator(predator.name);
  const stageData = data.stages.find((s) => s.stage === predator.stage);
  return html`
    <div
      class=${`predator-card ${predator.defeated ? 'defeated' : ''} ${clickable ? 'clickable' : ''}`}
      onClick=${clickable ? onSelect : undefined}
    >
      <div class="predator-name">${predator.name} ${predator.isBoss ? '👑' : ''}</div>
      <div class="predator-species">${data.species} · Stage ${predator.stage}</div>
      <div class="health-bar"><div class="health-fill" style=${{ width: `${(predator.health / predator.maxHealth) * 100}%` }}></div></div>
      <div class="health-text">${predator.health} / ${predator.maxHealth}</div>
      ${!predator.defeated && html`<div class="ref-text">Return attack: ${stageData?.returnAttack ?? '?'} — ${stageData?.effect ?? ''}</div>`}
      ${predator.defeated && html`<div class="ref-text loot">Loot: ${data.lootDrop ?? '—'}</div>`}
    </div>
  `;
}

function LocationCard({ name, state, dispatch, pendingPick, setPendingPick }) {
  const predator = state.predators.find((p) => p.location === name);
  const pickingMove = pendingPick?.type === 'move';
  const pickingAttackTarget = pendingPick?.type === 'attack' && pendingPick.step === 'target';
  const pickingCardTarget = pendingPick?.type === 'cardTarget' && pendingPick.step === 'target';

  function selectPredator() {
    if (pickingCardTarget) {
      dispatch({
        type: pendingPick.actionType,
        playerId: pendingPick.playerId,
        [pendingPick.handIndexField]: pendingPick.handIndex,
        ...pendingPick.extraParams,
        targetType: 'predator',
        targetId: predator.name,
      });
      setPendingPick(null);
    } else {
      setPendingPick({ ...pendingPick, step: 'strength', targetType: 'predator', targetId: predator.name });
    }
  }

  return html`
    <div
      class=${`location-card ${pickingMove ? 'pickable' : ''}`}
      onClick=${
        pickingMove
          ? () => {
              dispatch({ type: 'move', playerId: pendingPick.playerId, destination: name });
              setPendingPick(null);
            }
          : undefined
      }
    >
      <h3>${name}</h3>
      ${predator &&
      html`<${PredatorCard}
        predator=${predator}
        clickable=${(pickingAttackTarget || pickingCardTarget) && predator.revealed && !predator.defeated}
        onSelect=${selectPredator}
      />`}
      <${PlayerTokens} state=${state} location=${name} />
    </div>
  `;
}

function GrubCard({ side, deckSide, dispatch, pendingPick, setPendingPick }) {
  const pickingAttackTarget = pendingPick?.type === 'attack' && pendingPick.step === 'target';
  const pickingCardTarget = pendingPick?.type === 'cardTarget' && pendingPick.step === 'target';
  const card = deckSide.faceUp ? loadGrubCards()[deckSide.faceUp.cardId] : null;

  function select() {
    if (pickingCardTarget) {
      dispatch({
        type: pendingPick.actionType,
        playerId: pendingPick.playerId,
        [pendingPick.handIndexField]: pendingPick.handIndex,
        ...pendingPick.extraParams,
        targetType: 'grub',
        targetId: side,
      });
      setPendingPick(null);
    } else {
      setPendingPick({ ...pendingPick, step: 'strength', targetType: 'grub', targetId: side });
    }
  }

  return html`
    <div class="grub-card">
      <h4>${side === 'inside' ? 'Inside Grub' : 'Outside Grub'}</h4>
      ${card
        ? html`
            <div class=${`grub-face ${pickingAttackTarget || pickingCardTarget ? 'clickable' : ''}`} onClick=${pickingAttackTarget || pickingCardTarget ? select : undefined}>
              <div class="grub-name">${card.name ?? 'Unnamed Grub'}</div>
              <div class="health-text">${deckSide.faceUp.currentHealth} / ${card.health}</div>
              ${card.effect && html`<div class="ref-text">Defend: ${card.effect}</div>`}
              <div class="ref-text">Reward: ${card.reward ?? '—'}</div>
            </div>
          `
        : html`<div class="grub-face empty">No face-up Grub</div>`}
      <div class="deck-counts">Draw: ${deckSide.drawPile.length} · Discard: ${deckSide.discard.length}</div>
    </div>
  `;
}

export function Board({ state, dispatch, pendingPick, setPendingPick }) {
  const weatherCard = activeWeatherCard(state);
  const pickingMove = pendingPick?.type === 'move';

  return html`
    <div class="board">
      <div class="locations">
        ${OUTSIDE_LOCATIONS.map(
          (loc) => html`<${LocationCard} key=${loc} name=${loc} state=${state} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />`,
        )}
      </div>

      <div class="board-middle">
        <div
          class=${`coop-card ${pickingMove ? 'pickable' : ''}`}
          onClick=${
            pickingMove
              ? () => {
                  dispatch({ type: 'move', playerId: pendingPick.playerId, destination: 'Coop' });
                  setPendingPick(null);
                }
              : undefined
          }
        >
          <h3>Coop</h3>
          <${PlayerTokens} state=${state} location="Coop" />
        </div>

        <div class="weather-card">
          <div>${state.season} · Day ${state.day} (Phase ${state.phase})</div>
          ${weatherCard
            ? html`<div class="ref-text"><strong>${weatherCard.name ?? 'Unnamed weather'}</strong> — ${weatherCard.effect ?? ''}</div>`
            : html`<div class="ref-text">No weather card active</div>`}
        </div>

        <div class="bonus-deck-card">
          <div>Bonus Cards</div>
          <div class="deck-counts">Draw: ${state.bonusDeck.drawPile.length} · Discard: ${state.bonusDeck.discard.length}</div>
        </div>
      </div>

      <div class="grubs">
        <${GrubCard} side="inside" deckSide=${state.grubDecks.inside} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
        <${GrubCard} side="outside" deckSide=${state.grubDecks.outside} dispatch=${dispatch} pendingPick=${pendingPick} setPendingPick=${setPendingPick} />
      </div>
    </div>
  `;
}
