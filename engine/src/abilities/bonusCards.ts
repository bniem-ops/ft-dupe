// The Bonus Card effects, keyed by the exact `shorthand` string from
// data/bonusCards.json — every copy sharing a shorthand behaves
// identically. Originally 27 of 30 unique shorthands ("57 of 66 printed
// copies" — phases 6/7); "Reroll a teammate's die" and "Reroll any die"
// were added in phase 11f. "For 1 Turn, borrow an unlocked ability from a
// teammate," "Draw new weather," and "Move everyone for free" are still
// deliberately absent (phases 11g/11i).
import { CardEffect } from './types.js';

export const BONUS_CARD_EFFECTS: Record<string, CardEffect> = {
  '-2 health -> -2 enemy health': { selfDelta: { health: -2 }, enemyDamage: 2 },
  '+1 egg OR Immune to weather effects for one turn': { eggOrWeatherImmune: true },
  '+1 food OR health': { choiceGain: [{ food: 1 }, { health: 1 }] },
  '+1 to attack strength': { grantsFreeAttackPoint: true },
  '-2 food -> +2 health': { selfDelta: { food: -2, health: 2 } },
  '-1 to enemy health': { enemyDamage: 1 },
  '-1 egg -> +2 food OR +1 health': { selfDelta: { egg: -1 }, choiceGain: [{ food: 2 }, { health: 1 }] },
  "+1 to a Teammate's meals or health": { teammateChoiceGain: [{ resource: 'meal', amount: 1 }, { resource: 'health', amount: 1 }] },
  '-1 meal OR -1 health -> +3 food': { choiceGain: [{ meal: -1 }, { health: -1, food: 3 }] },
  '+1 to a Teammates food': { teammateGain: { resource: 'food', maxAmount: 1 } },
  'For 1 Turn, borrow an unlocked ability from a teammate': { borrowsTeammateAbility: true },
  "Reroll a teammate's die": { rerollTargetPlayerNextRoll: true },
  'Reroll your own die': { rerollNextOwnRoll: true },
  '-1 to enemy attack': { reducesIncomingDamage: 1 },
  '-2 health -> +2 meals OR +4 eggs': { selfDelta: { health: -2 }, choiceGain: [{ meal: 2 }, { egg: 4 }] },
  'Reroll any die': { rerollTargetPlayerNextRoll: true },
  '+1 meal or +2 eggs': { choiceGain: [{ meal: 1 }, { egg: 2 }] },
  '-1 to a Predators roll': { reducesPredatorRoll: 1 },
  '-2 eggs -> +4 food OR +2 health': { selfDelta: { egg: -2 }, choiceGain: [{ food: 4 }, { health: 2 }] },
  '+1 egg OR Discard an additional bonus card for +3 eggs': { discardExtraForBonus: { baseEggGain: 1, eggsGained: 3 } },
  'Draw new weather': { drawsNewWeatherCard: true },
  'Dodge Enemy attack': { dodgeNextAttack: true },
  'Move everyone for free': { grantsFreeMoveToEveryone: true },
  '2 extra actions': { extraActions: 2 },
  '-2 to a Predators roll': { reducesPredatorRoll: 2 },
  '+2 egg OR Discard an additional bonus card for +4 eggs': { discardExtraForBonus: { baseEggGain: 2, eggsGained: 4 } },
  '+2 food OR +1 egg and +1 health': { choiceGain: [{ food: 2 }, { egg: 1, health: 1 }] },
};
