import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import {
  findChicken,
  loadBonusCards,
  loadGrubCards,
  findPredator,
  BONUS_CARD_EFFECTS,
  GRUB_REWARDS,
  PREDATOR_LOOT,
  OUTSIDE_LOCATIONS,
  activeWeatherName,
  seasonCardList,
} from '../engine.js';
import { monogram } from '../cardVisuals.js';
import { playerColor } from './board.js';

// A card's identity in hand — same "card anatomy" language as the board's
// full card plates (board.js), just collapsed to a monogram chip since a
// hand list has no room for the full frame.
function CardChip({ kind, name }) {
  return html`<span class=${`card-chip kind-${kind}`}>${monogram(name)}</span>`;
}

const ALL_LOCATIONS = ['Coop', ...OUTSIDE_LOCATIONS];

export function Hearts({ health, maxHealth }) {
  return html`
    <div class="hearts">
      ${Array.from({ length: maxHealth }, (_, i) => html`<span key=${i} class=${i < health ? 'heart full' : 'heart empty'}>❤</span>`)}
    </div>
  `;
}

// Reads what input a CardEffect needs (docs/engine-plan.md phase 7) so the
// UI doesn't hardcode per-card logic — mirrors actions.ts's own
// resolveCardEffect switch, one flag per shape actually present.
function cardInputShape(effect) {
  if (!effect) return null;
  // "Reroll a teammate's die" / "Reroll any die" / Spotted Lanternfly, plus
  // the plain resource-gain teammate effects, can all legally target the
  // caster too (actions.ts never blocks targetPlayerId === playerId, and
  // core_rules.md: "Solo mode: you count as your own teammate" — confirmed
  // with the user this was a real UI gap, not intentional). Borrowing a
  // teammate's ability or copying a teammate's held card stay
  // teammate-only — targeting yourself for either is meaningless (you
  // already have full access to your own ability/hand).
  const targetsAnyRoll = !!(effect.rerollTargetPlayerNextRoll || effect.pickTargetPlayerNextRollOutcome);
  const targetsResourceGain = !!(effect.teammateGain || effect.teammateChoiceGain || (effect.drawBonusCards && effect.drawBonusCards.giveTeammate > 0));
  return {
    needsOption: !!(effect.choiceGain || effect.teammateChoiceGain || effect.eggOrWeatherImmune || effect.discardExtraForBonus),
    needsTeammate: !!(
      effect.teammateGain ||
      effect.teammateChoiceGain ||
      (effect.drawBonusCards && effect.drawBonusCards.giveTeammate > 0) ||
      effect.borrowsTeammateAbility ||
      effect.copiesTeammateBonusCardEffect ||
      targetsAnyRoll
    ),
    allowSelfAsTarget: targetsAnyRoll || targetsResourceGain,
    needsAmount: !!(effect.teammateGain && effect.teammateGain.maxAmount > 1) || !!effect.pickTargetPlayerNextRollOutcome,
    maxAmount: effect.pickTargetPlayerNextRollOutcome ? 6 : (effect.teammateGain?.maxAmount ?? 1),
    needsEnemy: !!(effect.enemyDamage || effect.dodgeNextAttack),
    needsExtraCardDiscard: !!effect.discardExtraForBonus,
    // Borrow a teammate's ability: pick which of their unlocked stages'
    // ability to use (capped at their actual stage — actions.ts clamps
    // the same way if this is ever stale).
    needsAbilityStage: !!effect.borrowsTeammateAbility,
    // Lucky Cricket: pick which of the chosen teammate's held Bonus Cards
    // to copy the effect of (their hand, not your own — unlike the
    // discardExtraForBonus picker below, which is always your own hand).
    needsCopiedCard: !!effect.copiesTeammateBonusCardEffect,
  };
}

// Play button + whatever inline option/target/amount pickers the specific
// card needs, reusing the same dispatch/pendingPick plumbing actionBar.js
// and board.js already use for Move/Attack. `onPickEnemy` hands off to a
// board click (same pattern as Attack's target step) since a Predator/Grub
// target can't be chosen from a dropdown here.
function PlayCardControls({ effect, selfId, otherPlayers, playerNames, remainingCards, onPlay, onPickEnemy }) {
  const shape = cardInputShape(effect);
  const [option, setOption] = useState(1);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [amount, setAmount] = useState(1);
  const [discardExtraCardIndex, setDiscardExtraCardIndex] = useState('');
  const [abilityStage, setAbilityStage] = useState(1);
  const [copiedCardIndex, setCopiedCardIndex] = useState('');

  if (!effect) return html`<span class="ref-text">(not yet implemented)</span>`;

  const targetPlayer = otherPlayers.find((p) => p.id === targetPlayerId);
  const blockedOnTeammate = shape.needsTeammate && !targetPlayerId;
  const blockedOnDiscard = shape.needsExtraCardDiscard && option === 2 && discardExtraCardIndex === '';
  const blockedOnCopiedCard = shape.needsCopiedCard && copiedCardIndex === '';

  function play() {
    const params = {
      option: shape.needsOption ? option : undefined,
      targetPlayerId: shape.needsTeammate ? targetPlayerId || undefined : undefined,
      amount: shape.needsAmount ? amount : shape.needsAbilityStage ? abilityStage : undefined,
      discardExtraCardIndex: shape.needsExtraCardDiscard && option === 2
        ? Number(discardExtraCardIndex)
        : shape.needsCopiedCard && copiedCardIndex !== ''
          ? Number(copiedCardIndex)
          : undefined,
    };
    if (shape.needsEnemy) onPickEnemy(params);
    else onPlay(params);
  }

  return html`
    <span class="card-controls">
      ${shape.needsOption &&
      html`<select onChange=${(e) => setOption(Number(e.target.value))} value=${option}>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </select>`}
      ${shape.needsTeammate &&
      html`<select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">${shape.allowSelfAsTarget ? 'Target…' : 'Teammate…'}</option>
        ${shape.allowSelfAsTarget && html`<option value=${selfId}>Myself</option>`}
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>`}
      ${shape.needsAbilityStage &&
      html`<select onChange=${(e) => setAbilityStage(Number(e.target.value))} value=${abilityStage}>
        ${Array.from({ length: targetPlayer?.stage ?? 1 }, (_, i) => i + 1).map(
          (s) => html`<option key=${s} value=${s}>Stage ${s} ability</option>`,
        )}
      </select>`}
      ${shape.needsCopiedCard &&
      html`<select onChange=${(e) => setCopiedCardIndex(e.target.value)} value=${copiedCardIndex}>
        <option value="">Copy which card…</option>
        ${(targetPlayer?.bonusCardHand ?? []).map(
          (cardId, i) => html`<option key=${i} value=${i}>${loadBonusCards()[cardId]?.shorthand ?? '?'}</option>`,
        )}
      </select>`}
      ${shape.needsAmount &&
      html`<input type="number" min="1" max=${shape.maxAmount} value=${amount} onInput=${(e) => setAmount(Number(e.target.value))} />`}
      ${shape.needsExtraCardDiscard &&
      option === 2 &&
      html`<select onChange=${(e) => setDiscardExtraCardIndex(e.target.value)} value=${discardExtraCardIndex}>
        <option value="">Discard which card…</option>
        ${remainingCards.map((c) => html`<option key=${c.index} value=${c.index}>${c.label}</option>`)}
      </select>`}
      <button type="button" disabled=${blockedOnTeammate || blockedOnDiscard || blockedOnCopiedCard} onClick=${play}>
        ${shape.needsEnemy ? 'Play (pick target on board)' : 'Play'}
      </button>
    </span>
  `;
}

// Egg Stash / Food Stash: draw down the shared pool held on the card,
// either into your own hand or a nearby player's (giftFood-style nearby
// check, enforced by the engine — this is just the picker).
function StashControls({ name, resource, remaining, otherPlayers, playerNames, onCollect }) {
  const [amount, setAmount] = useState(1);
  const [targetPlayerId, setTargetPlayerId] = useState('');

  if (remaining < 1) return html`<span class="ref-text">(stash empty)</span>`;
  return html`
    <span class="card-controls">
      <span class="ref-text">${remaining} ${resource} left</span>
      <input type="number" min="1" max=${remaining} value=${amount} onInput=${(e) => setAmount(Number(e.target.value))} />
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">Take for myself</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>Give to ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <button type="button" onClick=${() => onCollect(amount, targetPlayerId || undefined)}>Take</button>
    </span>
  `;
}

// Cave Hoard: draw a Bonus Card for yourself or a nearby teammate.
function CaveHoardControls({ otherPlayers, playerNames, onUse }) {
  const [targetPlayerId, setTargetPlayerId] = useState('');
  return html`
    <span class="card-controls">
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">For myself</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>For ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(targetPlayerId || undefined)}>Draw via Cave Hoard</button>
    </span>
  `;
}

// Secret Tunnels: free Move for yourself or a nearby player, to any location.
function SecretTunnelsControls({ otherPlayers, playerNames, onUse }) {
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [destination, setDestination] = useState(ALL_LOCATIONS[0]);
  return html`
    <span class="card-controls">
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value="">Move myself</option>
        ${otherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>Move ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <select onChange=${(e) => setDestination(e.target.value)} value=${destination}>
        ${ALL_LOCATIONS.map((loc) => html`<option key=${loc} value=${loc}>${loc}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(destination, targetPlayerId || undefined)}>Use Secret Tunnels</button>
    </span>
  `;
}

// Dungeon Keys: give the revived 1-health Grub to yourself or a nearby teammate.
function DungeonKeysControls({ myId, nearbyOtherPlayers, playerNames, onUse }) {
  const [targetPlayerId, setTargetPlayerId] = useState(myId);
  return html`
    <span class="card-controls">
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value=${myId}>Keep for myself</option>
        ${nearbyOtherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>Give to ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(targetPlayerId)}>Use Dungeon Keys</button>
    </span>
  `;
}

// Portable House: grant weather immunity for a turn, to yourself or a nearby player.
function PortableHouseControls({ myId, nearbyOtherPlayers, playerNames, onUse }) {
  const [targetPlayerId, setTargetPlayerId] = useState(myId);
  return html`
    <span class="card-controls">
      <select onChange=${(e) => setTargetPlayerId(e.target.value)} value=${targetPlayerId}>
        <option value=${myId}>For myself</option>
        ${nearbyOtherPlayers.map((p) => html`<option key=${p.id} value=${p.id}>For ${playerNames?.[p.id] ?? p.id}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(targetPlayerId)}>Use Portable House</button>
    </span>
  `;
}

// "Move everyone for free" Bonus Card: each granted player picks their own destination.
function FreeMoveGrantControls({ onUse }) {
  const [destination, setDestination] = useState(ALL_LOCATIONS[0]);
  return html`
    <span class="card-controls">
      <span class="ref-text">Free Move available:</span>
      <select onChange=${(e) => setDestination(e.target.value)} value=${destination}>
        ${ALL_LOCATIONS.map((loc) => html`<option key=${loc} value=${loc}>${loc}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(destination)}>Move (free)</button>
    </span>
  `;
}

// Weasma and Clawnk: "pick your destination" — your own choice of where
// you're forced out to, any location other than the one you're in now.
function ForcedRelocationControls({ currentLocation, onUse }) {
  const options = ALL_LOCATIONS.filter((loc) => loc !== currentLocation);
  const [destination, setDestination] = useState(options[0]);
  return html`
    <span class="card-controls">
      <span class="ref-text">Weasma and Clawnk forced you out — pick where you go:</span>
      <select onChange=${(e) => setDestination(e.target.value)} value=${destination}>
        ${options.map((loc) => html`<option key=${loc} value=${loc}>${loc}</option>`)}
      </select>
      <button type="button" onClick=${() => onUse(destination)}>Move</button>
    </span>
  `;
}

// Snow's last-phase clause: an ad-hoc Egg Exchange outside the normal
// phase-boundary cadence, available only while Snow is active in phase 3.
function AdHocExchangeControls({ maxEggs, onUse }) {
  const [amount, setAmount] = useState(1);
  if (maxEggs < 1) return html`<span class="ref-text">Snow's ad-hoc Egg Exchange available (no eggs to exchange)</span>`;
  return html`
    <span class="card-controls">
      <span class="ref-text">Snow's ad-hoc Egg Exchange:</span>
      <input type="number" min="1" max=${maxEggs} value=${amount} onInput=${(e) => setAmount(Number(e.target.value))} />
      <button type="button" onClick=${() => onUse(amount)}>Exchange for food</button>
    </span>
  `;
}

// Own-board dock's meal-counter track: a single highlighted box at the
// player's current position, not a fill-up-to-here progress bar. Stage 3
// chickens have no further mealsToNext, so there's no fixed track length —
// falls back to a plain chip in that case.
function MealCounterStrip({ mealCounter, mealsToNext }) {
  if (!mealsToNext) {
    return html`<div class="chip-stat">Meals ${mealCounter}</div>`;
  }
  return html`
    <div class="meal-counter-strip">
      ${Array.from({ length: mealsToNext }, (_, i) => html`<span key=${i} class=${i + 1 === mealCounter ? 'filled' : ''}>${i + 1}</span>`)}
    </div>
  `;
}

export function PlayerPanel({
  player,
  isCurrent,
  state,
  dispatch,
  pendingPick,
  setPendingPick,
  myPlayerId,
  displayName,
  playerNames,
  variant = 'rail',
  slideOverNotebook = false,
}) {
  const chicken = findChicken(player.chickenName);
  const stageData = chicken.stages.find((s) => s.stage === player.stage);
  const otherPlayers = state.players.filter((p) => p.id !== player.id && p.alive);
  const nearbyOtherPlayers = otherPlayers.filter((p) => p.location === player.location);
  // Bonus/Grub cards and revival choices are playable "any time" in the
  // engine (not turn-gated), so in a remote session each device may only
  // act on its own panel — same canAct nicety as actionBar.js.
  const canAct = myPlayerId == null || myPlayerId === player.id;
  const label = displayName ?? player.id;
  // Mudslide: the board's weather card shows the shared Mudslide card
  // itself, not what any one player is actually experiencing — this is
  // the one place a player's *personal* card (dealt while Mudslide is
  // active, in effect until it's replaced) needs to be visible.
  const personalWeatherCard = player.personalWeatherOverride
    ? seasonCardList(player.personalWeatherOverride.season.toLowerCase(), state.config.eggspansion)[player.personalWeatherOverride.cardIndex]
    : null;
  // core_rules.md never spells out a discard rule — the table's reading is
  // you can only discard once your hand actually exceeds the limit (never
  // proactively), and it's free. So the control only appears here, not a
  // standing "discard" button next to every card.
  const overBonusCardHandLimit = !player.permanentNoBonusCardHandLimit && player.bonusCardHand.length > player.bonusCardHandLimit;

  const [dockTab, setDockTab] = useState('traits');
  // Desktop side-panel only (slideOverNotebook=true) — mobile's bottom-sheet
  // "My board" tab keeps the notebook inline, unaffected by this.
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  const hasUrgentPending =
    !!player.pendingRevivalChoices ||
    !!player.pendingFreeMove ||
    !!player.pendingForcedRelocation ||
    (activeWeatherName(state) === 'Snow' && state.phase === 3) ||
    (state.boardEggs?.[player.location] ?? 0) > 0;

  const pendingBlock = html`
    ${personalWeatherCard &&
    html`<div class="ref-text">Your weather (Mudslide): <strong>${personalWeatherCard.name}</strong> — ${personalWeatherCard.effect}</div>`}
    ${player.pendingRevivalChoices &&
    html`<div class="dock-pending revival-choice">
      <strong>Choose your chicken to rejoin (as a Chick):</strong>
      ${!canAct && html`<span class="ref-text">(waiting for ${label}'s device)</span>`}
      ${player.pendingRevivalChoices.map(
        (name) =>
          html`<button
            key=${name}
            type="button"
            disabled=${!canAct}
            onClick=${() => dispatch({ type: 'completeRevival', playerId: player.id, chickenName: name })}
          >
            ${name}
          </button>`,
      )}
    </div>`}
    ${canAct &&
    player.pendingFreeMove &&
    html`<div class="dock-pending"><${FreeMoveGrantControls} onUse=${(destination) => dispatch({ type: 'useFreeMoveGrant', playerId: player.id, destination })} /></div>`}
    ${canAct &&
    player.pendingForcedRelocation &&
    html`<div class="dock-pending">
      <${ForcedRelocationControls}
        currentLocation=${player.location}
        onUse=${(destination) => dispatch({ type: 'completeForcedRelocation', playerId: player.id, destination })}
      />
    </div>`}
    ${canAct &&
    activeWeatherName(state) === 'Snow' &&
    state.phase === 3 &&
    html`<div class="dock-pending"><${AdHocExchangeControls} maxEggs=${player.eggs} onUse=${(amount) => dispatch({ type: 'adHocEggExchange', playerId: player.id, amount })} /></div>`}
    ${canAct &&
    (state.boardEggs?.[player.location] ?? 0) > 0 &&
    html`<div class="dock-pending">
      <button type="button" onClick=${() => dispatch({ type: 'collectBoardEgg', playerId: player.id, location: player.location })}>
        Collect egg here (${state.boardEggs[player.location]} available)
      </button>
    </div>`}
  `;

  const traitsTab = html`
    ${chicken.stages.map(
      (s) => html`
        <div key=${s.stage} class=${`notebook-row ${s.stage > player.stage ? 'future' : ''}`}>
          <div class="row-head">
            <span class="row-title">Stage ${s.stage} — ${s.label}</span>
          </div>
          ${s.abilities.map((a, i) => html`<div key=${i} class="row-text">${a.name ? html`<strong>${a.name}</strong> — ` : ''}${a.text}</div>`)}
        </div>
      `,
    )}
  `;

  const bonusCardEntries = player.bonusCardHand.map((id, i) => {
    const card = loadBonusCards()[id];
    const effect = card?.shorthand ? BONUS_CARD_EFFECTS[card.shorthand] : undefined;
    const remainingCards = player.bonusCardHand
      .filter((_, j) => j !== i)
      .map((cid, j) => ({ index: j, label: loadBonusCards()[cid]?.shorthand ?? '?' }));
    return html`
      <div key=${`bonus-${i}`} class="notebook-row card-row">
        <${CardChip} kind="bonus" name=${card?.shorthand} />
        <div class="row-text">${card?.shorthand} — ${card?.description}</div>
        ${canAct
          ? html`<${PlayCardControls}
              effect=${effect}
              selfId=${player.id}
              otherPlayers=${otherPlayers}
              playerNames=${playerNames}
              remainingCards=${remainingCards}
              onPlay=${(params) => dispatch({ type: 'playBonusCard', playerId: player.id, cardHandIndex: i, ...params })}
              onPickEnemy=${(params) =>
                setPendingPick({
                  type: 'cardTarget',
                  actionType: 'playBonusCard',
                  playerId: player.id,
                  handIndexField: 'cardHandIndex',
                  handIndex: i,
                  step: 'target',
                  extraParams: params,
                })}
            />`
          : html`<span class="ref-text">(waiting for ${label}'s device)</span>`}
        ${canAct &&
        overBonusCardHandLimit &&
        html`<button type="button" onClick=${() => dispatch({ type: 'discardBonusCard', playerId: player.id, cardHandIndex: i })}>Discard</button>`}
      </div>
    `;
  });

  const grubCardEntries = player.grubHand.map((held, i) => {
    const card = loadGrubCards()[held.cardId];
    const effect = card?.name ? GRUB_REWARDS[card.name] : undefined;
    return html`
      <div key=${`grub-${i}`} class="notebook-row card-row">
        <${CardChip} kind="grub" name=${card?.name} />
        <div class="row-text">${card?.name} (${held.currentHealth}/${card?.health}) — Reward: ${card?.reward ?? '—'}</div>
        ${held.rewardUsed
          ? html`<span class="ref-text">(Reward used)</span>`
          : !canAct
          ? html`<span class="ref-text">(waiting for ${label}'s device)</span>`
          : html`<${PlayCardControls}
              effect=${effect}
              selfId=${player.id}
              otherPlayers=${otherPlayers}
              playerNames=${playerNames}
              remainingCards=${[]}
              onPlay=${(params) => dispatch({ type: 'useGrubReward', playerId: player.id, grubHandIndex: i, ...params })}
              onPickEnemy=${(params) =>
                setPendingPick({
                  type: 'cardTarget',
                  actionType: 'useGrubReward',
                  playerId: player.id,
                  handIndexField: 'grubHandIndex',
                  handIndex: i,
                  step: 'target',
                  extraParams: params,
                })}
            />`}
      </div>
    `;
  });

  const lootEntries = player.lootDrops.map((name, i) => {
    const loot = PREDATOR_LOOT[name];
    const remaining = player.lootCharges?.[name] ?? 0;
    return html`
      <div key=${`loot-${i}`} class="notebook-row card-row">
        <div class="row-text">${name} — ${findPredator(name).lootDrop ?? '—'}</div>
        ${canAct &&
        loot?.stash &&
        html`<${StashControls}
          name=${name}
          resource=${loot.stash.resource === 'egg' ? 'eggs' : 'food'}
          remaining=${remaining}
          otherPlayers=${otherPlayers}
          playerNames=${playerNames}
          onCollect=${(amount, targetPlayerId) => dispatch({ type: 'collectFromStash', playerId: player.id, predatorName: name, amount, targetPlayerId })}
        />`}
        ${canAct &&
        loot?.chargedRangedAttack &&
        html`<span class="card-controls">
          <span class="ref-text">${remaining} arrows left</span>
          <button
            type="button"
            disabled=${remaining < 1}
            onClick=${() =>
              setPendingPick({ type: 'cardTarget', actionType: 'useArrowPack', playerId: player.id, handIndexField: 'unused', step: 'target', extraParams: {} })}
          >
            Fire Arrow (pick target on board)
          </button>
        </span>`}
        ${canAct &&
        loot?.activatableAttackReduction &&
        html`<span class="card-controls">
          ${remaining > 0
            ? html`<button
                type="button"
                onClick=${() =>
                  setPendingPick({ type: 'cardTarget', actionType: 'useGasMask', playerId: player.id, handIndexField: 'unused', step: 'target', extraParams: {} })}
              >
                Use Gas Mask (pick Predator on board)
              </button>`
            : html`<span class="ref-text">(used)</span>`}
        </span>`}
        ${canAct &&
        loot?.everyoneAtLocationRefreshExtraAction &&
        html`<button type="button" onClick=${() => dispatch({ type: 'useChamberstick', playerId: player.id })}>Refresh everyone's Token here</button>`}
        ${canAct &&
        loot?.freeDrawBonusCardForSelfOrTeammate &&
        html`<${CaveHoardControls}
          otherPlayers=${otherPlayers}
          playerNames=${playerNames}
          onUse=${(targetPlayerId) => dispatch({ type: 'useCaveHoard', playerId: player.id, targetPlayerId })}
        />`}
        ${canAct &&
        loot?.healEveryoneAtLocation &&
        html`<button type="button" onClick=${() => dispatch({ type: 'useHealingPoultice', playerId: player.id })}>
          Heal everyone here ${loot.healEveryoneAtLocation}
        </button>`}
        ${canAct &&
        loot?.freeMoveForSelfOrNearby &&
        html`<${SecretTunnelsControls}
          otherPlayers=${otherPlayers}
          playerNames=${playerNames}
          onUse=${(destination, targetPlayerId) => dispatch({ type: 'useSecretTunnels', playerId: player.id, destination, targetPlayerId })}
        />`}
        ${canAct &&
        loot?.dungeonKeys &&
        (remaining > 0
          ? html`<${DungeonKeysControls}
              myId=${player.id}
              nearbyOtherPlayers=${nearbyOtherPlayers}
              playerNames=${playerNames}
              onUse=${(targetPlayerId) => dispatch({ type: 'useDungeonKeys', playerId: player.id, targetPlayerId })}
            />`
          : html`<span class="ref-text">(used)</span>`)}
        ${canAct &&
        loot?.grantsWeatherImmunityForTurn &&
        html`<${PortableHouseControls}
          myId=${player.id}
          nearbyOtherPlayers=${nearbyOtherPlayers}
          playerNames=${playerNames}
          onUse=${(targetPlayerId) => dispatch({ type: 'usePortableHouse', playerId: player.id, targetPlayerId })}
        />`}
      </div>
    `;
  });

  const cardsTab = html`
    <div class="notebook-row"><span class="row-title">Bonus Cards (${player.bonusCardHand.length}${overBonusCardHandLimit ? ` / ${player.bonusCardHandLimit} — over limit` : ''})</span></div>
    ${bonusCardEntries}
    <div class="notebook-row"><span class="row-title">Grub Cards (${player.grubHand.length})</span></div>
    ${grubCardEntries}
    <div class="notebook-row"><span class="row-title">Loot Drops (${player.lootDrops.length})</span></div>
    ${lootEntries}
  `;

  const vitals = html`
    <div class="stats-row">
      <span>🌾 ${player.food}</span>
      <span>🥚 ${player.eggs}</span>
      <span>👊 ${player.attackStrength}</span>
      <span>📍 ${player.location}</span>
    </div>
    <div class="meal-counter">Meals: ${player.mealCounter}${stageData?.mealsToNext ? ` / ${stageData.mealsToNext}` : ''}</div>
    <div class="extra-action">Extra Action Token: ${player.extraActionTokenAvailable ? 'available' : 'used'}</div>
  `;

  if (variant === 'dock') {
    const notebook = html`
      <div class="dock-notebook">
        <div class="dock-tabs">
          <button type="button" class=${`dock-tab ${dockTab === 'traits' ? 'active' : ''}`} onClick=${() => setDockTab('traits')}>Traits</button>
          <button type="button" class=${`dock-tab ${dockTab === 'cards' ? 'active' : ''}`} onClick=${() => setDockTab('cards')}>Cards</button>
          ${slideOverNotebook &&
          html`<button type="button" class="dock-tab-close" onClick=${() => setSlideOverOpen(false)}>✕</button>`}
        </div>
        <div class="dock-notebook-body">${dockTab === 'traits' ? traitsTab : cardsTab}</div>
      </div>
    `;
    return html`
      <div class="player-panel dock">
        ${pendingBlock}
        <div class="dock-charcard">
          <div class="name">${label}</div>
          <div class="breed">${chicken.name} — ${chicken.breed} Stage ${player.stage}${!player.alive ? ' (dead)' : ''}</div>
          <div class="chips">
            ${isCurrent
              ? html`<span class="chip">${state.actionsRemainingThisTurn} action(s)</span>`
              : html`<span class="chip">Not your turn</span>`}
            <span class="chip">${player.attackStrength} claw</span>
          </div>
        </div>
        ${slideOverNotebook
          ? html`
              <button type="button" class="notebook-open-btn" onClick=${() => setSlideOverOpen(true)}>Traits & Cards ▸</button>
              ${slideOverOpen &&
              html`<div class="notebook-slideover-backdrop" onClick=${() => setSlideOverOpen(false)}>
                <div onClick=${(e) => e.stopPropagation()}>${notebook}</div>
              </div>`}
            `
          : notebook}
        <div class="dock-vitals">
          <div class="stats-row">
            <${Hearts} health=${player.health} maxHealth=${player.maxHealth} />
            <span class="chip-stat food">🌾 ${player.food}</span>
            <span class="chip-stat">🥚 ${player.eggs}</span>
          </div>
          <${MealCounterStrip} mealCounter=${player.mealCounter} mealsToNext=${stageData?.mealsToNext} />
          <div class="stats-row">
            <span class="ref-text">👊 ${player.attackStrength} · 📍 ${player.location}</span>
            <span class="ref-text">Extra Action Token: ${player.extraActionTokenAvailable ? 'available' : 'used'}</span>
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div class=${`player-panel rail ${isCurrent ? 'current' : ''} ${!player.alive ? 'dead' : ''}`}>
      <h3>${label} — ${chicken.name}${!player.alive ? ' (dead)' : ''}</h3>
      ${pendingBlock}
      <div class="breed">${chicken.breed} · Stage ${player.stage} · ${player.location}</div>
      <${Hearts} health=${player.health} maxHealth=${player.maxHealth} />
      ${vitals}
      <details class="rail-more" open=${hasUrgentPending || overBonusCardHandLimit}>
        <summary>Abilities · Cards · Loot</summary>
        ${traitsTab}
        ${cardsTab}
      </details>
    </div>
  `;
}

// Presence-driven opponent rail (mockup turn 4b) — a 56px strip of compact
// circles instead of always-visible full cards; hovering/clicking one
// expands it into the same content the old always-visible rail card showed
// (reuses PlayerPanel's own 'rail' variant rather than forking the markup).
export function AvatarStrip({ opponents, currentPlayerId, state, dispatch, pendingPick, setPendingPick, myPlayerId, playerNames }) {
  const [expandedId, setExpandedId] = useState(null);
  const expanded = opponents.find((p) => p.id === expandedId) ?? null;

  return html`
    <div class="avatar-strip">
      <span class="avatar-strip-title">FLOCK</span>
      ${opponents.map((p) => {
        const label = playerNames?.[p.id] ?? p.id;
        return html`
          <button
            key=${p.id}
            type="button"
            class=${`avatar-chip ${p.id === currentPlayerId ? 'current' : ''} ${p.id === expandedId ? 'active' : ''} ${!p.alive ? 'dead' : ''}`}
            style=${{ '--chip-color': playerColor(state, p.id) }}
            onMouseEnter=${() => setExpandedId(p.id)}
            onFocus=${() => setExpandedId(p.id)}
            onClick=${() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
          >
            <span class="avatar-chip-circle">${label.slice(0, 2)}</span>
            <span class="avatar-chip-hp">♥${p.health}</span>
            <span class="avatar-chip-stat">${p.food}·${p.eggs}</span>
          </button>
        `;
      })}
    </div>
    ${expanded &&
    html`
      <div class="opponent-expand-card" onMouseLeave=${() => setExpandedId(null)}>
        <${PlayerPanel}
          variant="rail"
          player=${expanded}
          isCurrent=${expanded.id === currentPlayerId}
          state=${state}
          dispatch=${dispatch}
          pendingPick=${pendingPick}
          setPendingPick=${setPendingPick}
          myPlayerId=${myPlayerId}
          displayName=${playerNames?.[expanded.id] ?? expanded.id}
          playerNames=${playerNames}
        />
      </div>
    `}
  `;
}
