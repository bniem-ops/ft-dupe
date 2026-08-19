import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  activeWeatherEffect,
  activeWeatherName,
  isImmuneToWeather,
  getOwnAndBorrowedAbilities,
  maxAttackStrengthFor,
  attackCostFor,
  OUTSIDE_LOCATIONS,
  loadGrubCards,
} from '../engine.js';

const ALL_LOCATIONS = ['Coop', ...OUTSIDE_LOCATIONS];

// Mirrors actions.ts's healCap/eatCap exactly, including eatCap's 0 for
// stage 3 — Hens/Roosters have no meal-counter benefit left to level into
// (mealsToNext is null past stage 3), so Eat is a deliberate no-op there,
// not a UI oversight. Used both for greying out invalid amounts and for
// disabling the button entirely when no nonzero amount is ever valid; the
// engine remains the source of truth and any miss here still surfaces via
// the dispatch error banner.
function healCap(stage) {
  return stage === 1 ? 1 : stage === 2 ? 2 : 3;
}
function eatCap(stage) {
  return stage === 1 ? 1 : stage === 2 ? 2 : 0;
}

function ActionButton({ label, hint, colorClass, disabled, onClick }) {
  return html`
    <button type="button" class=${`action-btn ${colorClass ?? ''}`} disabled=${disabled} onClick=${onClick}>
      <span class="action-btn-label">${label}</span>
      <span class="action-btn-hint">${hint}</span>
    </button>
  `;
}

export function ActionBar({ state, player, dispatch, onEndTurn, onUseExtraAction, pendingPick, setPendingPick, myPlayerId, displayName, playerNames }) {
  const [healAmount, setHealAmount] = useState(1);
  const [eatAmount, setEatAmount] = useState(1);
  const [attackStrength, setAttackStrength] = useState(1);
  const [broodTarget, setBroodTarget] = useState('');
  const [tagAlongTarget, setTagAlongTarget] = useState('');
  const [strategemTarget, setStrategemTarget] = useState('');
  const [strategemEggs, setStrategemEggs] = useState(1);
  const [strategemDirection, setStrategemDirection] = useState('1');
  const [deusTarget, setDeusTarget] = useState('');
  const [guideTarget, setGuideTarget] = useState('');
  const [guideDestination, setGuideDestination] = useState('');
  const [companionId, setCompanionId] = useState('');
  const [companionStrength, setCompanionStrength] = useState(1);
  const [discardIndex, setDiscardIndex] = useState('');
  const [discardStrength, setDiscardStrength] = useState(1);

  // In a remote session, only the device that claimed this seat may act
  // for them — a UX nicety, not a security boundary (the engine's own
  // assertCanAct is the real guard). myPlayerId is null in local hotseat
  // play, where anyone can act on any seat, same as before phase 8.
  const canAct = myPlayerId == null || myPlayerId === player.id;
  const label = displayName ?? player.id;
  const noActions = state.actionsRemainingThisTurn <= 0 || !canAct;
  const deadPlayers = state.players.filter((p) => !p.alive);
  // Sunny/Nighttime: "once during this phase," on whichever of the
  // player's turns they choose — engine remains the source of truth
  // (useWeatherActionAdjustment throws if any of this is stale/wrong).
  const weather = activeWeatherEffect(state);
  const weatherName = activeWeatherName(state);
  const weatherAdjustmentAvailable =
    weather?.turnStartOncePerPhase &&
    !player.weatherAdjustmentUsedThisPhase &&
    !isImmuneToWeather(player.chickenName, player.stage, weatherName ?? '', weather.positive ?? false) &&
    !player.pendingWeatherImmuneUntilNextTurn &&
    !player.permanentWeatherImmuneUntilNextCard;

  const pickingAttackStrength =
    (pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') && pendingPick.step === 'strength';
  // A target already at 0 health (some Grubs — Slug, Wild Grain, Four Leaf
  // Clover — start there) needs no attack strength to claim; the food-cost
  // floor of 1 only makes sense against a target that has health left.
  const targetHealth = pickingAttackStrength
    ? pendingPick.targetType === 'predator'
      ? (state.predators.find((p) => p.name === pendingPick.targetId)?.health ?? 1)
      : (state.grubDecks[pendingPick.targetId]?.faceUp?.currentHealth ?? 1)
    : 1;
  const minAttackStrength = targetHealth <= 0 ? 0 : 1;
  // Mirrors actions.ts's attack() cap exactly — weather deltas, ability
  // bonuses (Adrenaline/Bolsterer), and a "+1 to attack strength" Bonus
  // Card all raise this above the chicken's base stat, so this can't just
  // be player.attackStrength (that let the card's bonus point be
  // unreachable through this input — see actionBar.js's git history /
  // playtest-feedback.md's 2026-08-19 "+1 Strength" entry).
  const { baseCap: attackBaseCap, maxAttackStrength: attackCap } = maxAttackStrengthFor(state, player.id);
  const attackCapCost = attackCostFor(state, player.id, attackCap);
  const affordableAttackMax = attackCapCost <= player.food ? attackCap : Math.min(attackBaseCap, player.food);
  const attackStrengthMax = Math.max(minAttackStrength, affordableAttackMax);
  const attackFoodCost = attackCostFor(state, player.id, attackStrength);
  const pickingCompanion = pendingPick?.type === 'attackWithCompanion' && pendingPick.step === 'companion';

  const abilities = getOwnAndBorrowedAbilities(player);
  const nearbyAlivePlayers = state.players.filter((p) => p.id !== player.id && p.alive && p.location === player.location);
  const otherAlivePlayers = state.players.filter((p) => p.id !== player.id && p.alive);
  // Tomb Raider only reaches the discard pile on your own side (same
  // inside/outside rule as a normal Attack — see actions.ts's own check).
  const discardSide = player.location === 'Coop' ? 'inside' : 'outside';
  const discardPile = state.grubDecks[discardSide].discard;

  function cancelPick() {
    setPendingPick(null);
  }

  return html`
    <div class="action-bar">
      <div class="turn-status">
        <strong>${label}'s turn</strong> — ${state.actionsRemainingThisTurn} action(s) left
        ${!canAct && html`<span class="ref-text">(waiting for ${label}'s device)</span>`}
        ${player.extraActionTokenAvailable &&
        html`<button type="button" disabled=${!canAct} onClick=${onUseExtraAction}>Use Extra Action Token</button>`}
        ${weatherAdjustmentAvailable &&
        html`<button
          type="button"
          disabled=${!canAct}
          onClick=${() => dispatch({ type: 'useWeatherActionAdjustment', playerId: player.id })}
        >
          ${weather.positive ? `Take Bonus Action (${weatherName})` : `Take Reduced Action (${weatherName})`}
        </button>`}
        ${player.chickenName === 'Princess Layer' &&
        !player.extraActionTokenAvailable &&
        player.eggs >= 1 &&
        html`<button type="button" disabled=${!canAct} onClick=${() => dispatch({ type: 'refreshExtraActionToken', playerId: player.id })}>
          Refresh Token (1 egg — Nobility)
        </button>`}
        ${player.chickenName === 'Cumberbill Rockefeather' &&
        player.stage >= 2 &&
        player.location !== 'Coop' &&
        html`<button type="button" disabled=${!canAct} onClick=${() => dispatch({ type: 'freeMoveToCoop', playerId: player.id })}>
          Move to Coop (free — Landlord)
        </button>`}
      </div>

      ${pendingPick?.type === 'move' &&
      html`<div class="pending-hint">Click a location on the board to Move. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'eat' &&
      html`
        <div class="pending-hint">
          How much food to eat (1 meal per food)?
          <input
            type="number"
            min="1"
            max=${Math.max(1, Math.min(eatCap(player.stage), player.food))}
            value=${eatAmount}
            onInput=${(e) => setEatAmount(Number(e.target.value))}
          />
          <button
            type="button"
            disabled=${!canAct}
            onClick=${() => {
              dispatch({ type: 'eat', playerId: player.id, amount: eatAmount });
              setPendingPick(null);
            }}
          >
            Confirm Eat
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}
      ${pendingPick?.type === 'heal' &&
      html`
        <div class="pending-hint">
          How many hearts to heal (1 food per heart)?
          <input
            type="number"
            min="1"
            max=${Math.max(1, Math.min(healCap(player.stage), player.food, player.maxHealth - player.health))}
            value=${healAmount}
            onInput=${(e) => setHealAmount(Number(e.target.value))}
          />
          <button
            type="button"
            disabled=${!canAct}
            onClick=${() => {
              dispatch({ type: 'heal', playerId: player.id, amount: healAmount });
              setPendingPick(null);
            }}
          >
            Confirm Heal
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}
      ${pickingCompanion &&
      html`
        <div class="pending-hint">
          Bring along (must be nearby):
          <select onChange=${(e) => setCompanionId(e.target.value)} value=${companionId}>
            <option value="">Companion…</option>
            ${nearbyAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
          </select>
          <button
            type="button"
            disabled=${!canAct || !companionId}
            onClick=${() => setPendingPick({ ...pendingPick, step: 'target', companionId })}
          >
            Next: pick target
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}
      ${(pendingPick?.type === 'attack' || pendingPick?.type === 'attackWithCompanion') &&
      pendingPick.step === 'target' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pendingPick?.type === 'cardTarget' &&
      html`<div class="pending-hint">Click a Predator or Grub on the board to target the card. <button type="button" onClick=${cancelPick}>Cancel</button></div>`}
      ${pickingAttackStrength &&
      html`
        <div class="pending-hint">
          ${pendingPick.type === 'attackWithCompanion' ? 'Your attack strength:' : 'Attack strength:'}
          <input
            type="number"
            min=${minAttackStrength}
            max=${attackStrengthMax}
            value=${attackStrength}
            onInput=${(e) => setAttackStrength(Number(e.target.value))}
          />
          (costs ${attackFoodCost} food${attackStrength > attackBaseCap ? ' — bonus point free' : ''})
          ${pendingPick.type === 'attackWithCompanion' &&
          html`
            ${playerNames?.[pendingPick.companionId] ?? pendingPick.companionId}'s attack strength:
            <input
              type="number"
              min="1"
              max=${state.players.find((p) => p.id === pendingPick.companionId)?.food ?? 1}
              value=${companionStrength}
              onInput=${(e) => setCompanionStrength(Number(e.target.value))}
            />
          `}
          <button
            type="button"
            disabled=${!canAct}
            onClick=${() => {
              if (pendingPick.type === 'attackWithCompanion') {
                dispatch({
                  type: 'attackWithCompanion',
                  playerId: pendingPick.playerId,
                  companionId: pendingPick.companionId,
                  targetType: pendingPick.targetType,
                  targetId: pendingPick.targetId,
                  primaryStrength: attackStrength,
                  companionStrength,
                });
              } else {
                dispatch({
                  type: 'attack',
                  playerId: pendingPick.playerId,
                  targetType: pendingPick.targetType,
                  targetId: pendingPick.targetId,
                  attackStrength,
                });
              }
              setPendingPick(null);
            }}
          >
            Confirm Attack
          </button>
          <button type="button" onClick=${cancelPick}>Cancel</button>
        </div>
      `}

      <div class="actions-grid">
        <${ActionButton}
          label="Forage"
          hint="Gain 1 food"
          colorClass="field"
          disabled=${noActions}
          onClick=${() => dispatch({ type: 'forage', playerId: player.id })}
        />

        <${ActionButton}
          label="Lay Egg"
          hint="Gain 1 egg · free"
          disabled=${noActions}
          onClick=${() => dispatch({ type: 'layEgg', playerId: player.id })}
        />

        <${ActionButton}
          label="Eat"
          hint="Food → meal"
          colorClass="teal"
          disabled=${noActions || eatCap(player.stage) < 1 || player.food < 1}
          onClick=${() => {
            setEatAmount(1);
            setPendingPick({ type: 'eat', playerId: player.id });
          }}
        />

        <${ActionButton}
          label="Heal"
          hint="1 food per ♥"
          disabled=${noActions || healCap(player.stage) < 1 || player.food < 1 || player.health >= player.maxHealth}
          onClick=${() => {
            setHealAmount(1);
            setPendingPick({ type: 'heal', playerId: player.id });
          }}
        />

        <${ActionButton}
          label="Move"
          hint="New location"
          colorClass="dusk"
          disabled=${noActions}
          onClick=${() => setPendingPick({ type: 'move', playerId: player.id })}
        />

        <${ActionButton}
          label="Draw Card"
          hint="1 bonus card"
          colorClass="dusk"
          disabled=${noActions}
          onClick=${() => dispatch({ type: 'drawCard', playerId: player.id })}
        />

        <div class="action-with-amount">
          <select onChange=${(e) => setBroodTarget(e.target.value)}>
            <option value="">Dead player…</option>
            ${deadPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
          </select>
          <${ActionButton}
            label="Brood"
            hint="1 egg · revive"
            disabled=${noActions || !broodTarget}
            onClick=${() => dispatch({ type: 'brood', playerId: player.id, targetPlayerId: broodTarget })}
          />
        </div>

        <${ActionButton}
          label="Attack"
          hint="1 food per claw"
          colorClass="blood"
          disabled=${noActions}
          onClick=${() => setPendingPick({ type: 'attack', step: 'target', playerId: player.id })}
        />

        ${abilities.some((a) => a.joinsAttackAsSecond) &&
        html`<${ActionButton}
          label="Attack w/ Companion"
          hint="Quite Friendly"
          colorClass="blood"
          disabled=${noActions || nearbyAlivePlayers.length === 0}
          onClick=${() => setPendingPick({ type: 'attackWithCompanion', step: 'companion', playerId: player.id })}
        />`}
      </div>

      ${abilities.some((a) => a.canAdjustAnyRollForEggs) &&
      html`<div class="action-with-amount">
        <select onChange=${(e) => setStrategemTarget(e.target.value)} value=${strategemTarget}>
          <option value=${player.id}>Myself</option>
          ${otherAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
        </select>
        <input type="number" min="1" max=${Math.max(1, player.eggs)} value=${strategemEggs} onInput=${(e) => setStrategemEggs(Number(e.target.value))} />
        <select onChange=${(e) => setStrategemDirection(e.target.value)} value=${strategemDirection}>
          <option value="1">+1 per egg</option>
          <option value="-1">-1 per egg</option>
        </select>
        <button
          type="button"
          disabled=${!canAct || player.eggs < 1}
          onClick=${() =>
            dispatch({
              type: 'useStrategem',
              playerId: player.id,
              targetPlayerId: strategemTarget || player.id,
              eggsToSpend: strategemEggs,
              direction: Number(strategemDirection),
            })}
        >
          Use Strategem
        </button>
      </div>`}

      ${abilities.some((a) => a.canRerollAnyRollForEgg) &&
      html`<div class="action-with-amount">
        <select onChange=${(e) => setDeusTarget(e.target.value)} value=${deusTarget}>
          <option value=${player.id}>Myself</option>
          ${otherAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
        </select>
        <button
          type="button"
          disabled=${!canAct || player.eggs < 1}
          onClick=${() => dispatch({ type: 'useDeusEggsMachina', playerId: player.id, targetPlayerId: deusTarget || player.id })}
        >
          Use Deus Eggs Machina (1 egg, reroll)
        </button>
      </div>`}

      ${abilities.some((a) => a.freeWeatherRedrawRoll) &&
      !player.freeAbilityUsedThisTurn &&
      html`<button type="button" disabled=${!canAct} onClick=${() => dispatch({ type: 'useWhereverAnyWeather', playerId: player.id })}>
        Roll for New Weather (free, once/turn)
      </button>`}

      ${abilities.some((a) => a.freeMoveAnotherPlayerForEgg) &&
      !player.freeAbilityUsedThisTurn &&
      html`<div class="action-with-amount">
        <select onChange=${(e) => setGuideTarget(e.target.value)} value=${guideTarget}>
          <option value="">Move who…</option>
          ${otherAlivePlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
        </select>
        <select onChange=${(e) => setGuideDestination(e.target.value)} value=${guideDestination}>
          <option value="">Destination…</option>
          ${ALL_LOCATIONS.map((loc) => html`<option key=${loc} value=${loc}>${loc}</option>`)}
        </select>
        <button
          type="button"
          disabled=${!canAct || player.eggs < 1 || !guideTarget || !guideDestination}
          onClick=${() => {
            dispatch({ type: 'useWildernessGuide', playerId: player.id, targetPlayerId: guideTarget, destination: guideDestination });
            setGuideTarget('');
            setGuideDestination('');
          }}
        >
          Use Wilderness Guide (1 egg)
        </button>
      </div>`}

      ${abilities.some((a) => a.canAttackDiscardedGrubs) &&
      discardPile.length > 0 &&
      html`<div class="action-with-amount">
        <select onChange=${(e) => setDiscardIndex(e.target.value)} value=${discardIndex}>
          <option value="">Raid ${discardSide} discard…</option>
          ${discardPile.map(
            (cardId, i) => html`<option key=${i} value=${i}>${loadGrubCards()[cardId]?.name ?? 'Unnamed Grub'}</option>`,
          )}
        </select>
        <input
          type="number"
          min="1"
          max=${Math.max(1, player.food)}
          value=${discardStrength}
          onInput=${(e) => setDiscardStrength(Number(e.target.value))}
        />
        <button
          type="button"
          disabled=${noActions || discardIndex === ''}
          onClick=${() => {
            dispatch({
              type: 'attackDiscardedGrub',
              playerId: player.id,
              side: discardSide,
              discardIndex: Number(discardIndex),
              attackStrength: discardStrength,
            });
            setDiscardIndex('');
          }}
        >
          Raid Discard Pile (Tomb Raider)
        </button>
      </div>`}

      ${(player.permanentTagAlongUnlocked || (player.chickenName === 'Wingston Coophill' && player.stage >= 2)) &&
      html`<div class="action-with-amount">
        <select onChange=${(e) => setTagAlongTarget(e.target.value)} value=${tagAlongTarget}>
          <option value="">Tag along with…</option>
          ${state.players
            .filter((p) => p.id !== player.id && p.alive)
            .map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
        </select>
        <button
          type="button"
          disabled=${!canAct || !tagAlongTarget}
          onClick=${() => dispatch({ type: 'tagAlong', playerId: player.id, targetPlayerId: tagAlongTarget })}
        >
          Tag Along
        </button>
      </div>`}

      <button type="button" class="end-turn" disabled=${!canAct} onClick=${onEndTurn}>End Turn</button>
    </div>
  `;
}
