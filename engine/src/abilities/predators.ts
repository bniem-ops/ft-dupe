// The 29 "executable now" predator stage effects + 3 passive/permanent
// Loot Drops (docs/rules-audit.md). Gas Mask (Professor Moltiarty's Loot)
// is the one single-use, player-activated Loot Drop among these — its
// grant already works (phase 4's lootDrops tracking); activating it is
// deferred to phase 7's held-effect-playing mechanism.
import { Stage } from '../types.js';
import { PredatorEffect, PredatorLoot } from './types.js';

export const PREDATOR_EFFECTS: Record<string, Partial<Record<Stage, PredatorEffect>>> = {
  Eggsmeralda: {
    1: { rollOutcomes: [{ min: 4, max: 6, selfHeal: 1 }] },
  },
  'Sal Moe Nella': {
    1: { rollOutcomes: [{ min: 4, max: 6, attackerStatus: ['cannotEat'] }] },
    2: {
      rollOutcomes: [
        { min: 3, max: 4, attackerStatus: ['cannotEat'] },
        { min: 5, max: 6, attackerStatus: ['cannotHeal'] },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 1, max: 3, attackerStatus: ['cannotEat'] },
        { min: 4, max: 6, attackerStatus: ['cannotHeal'] },
      ],
    },
  },
  'Professor Moltiarty': {
    1: { alwaysStatus: ['skipProduction'] },
    2: { rollOutcomes: [{ min: 4, max: 6, attackerStatus: ['cannotParticipateInEggExchange'] }] },
    3: { alwaysStatus: ['cannotParticipateInEggExchange'] },
  },
  'Hens Gruber': {
    1: {
      rollOutcomes: [
        { min: 3, max: 4, attackerFoodLoss: 1 },
        { min: 5, max: 6, attackerFoodLoss: 2 },
      ],
    },
    2: {
      rollOutcomes: [
        { min: 1, max: 2, attackerFoodLoss: 1 },
        { min: 3, max: 4, attackerFoodLoss: 2 },
        { min: 5, max: 6, attackerFoodLoss: 3 },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 1, max: 1, attackerFoodLoss: 1 },
        { min: 2, max: 4, attackerFoodLoss: 2 },
        { min: 5, max: 6, attackerFoodLoss: 3 },
      ],
    },
  },
  Chicksune: {
    1: { immuneToBonusCardEffects: true },
    2: {
      rollOutcomes: [
        { min: 5, max: 5, selfHeal: 1 },
        { min: 6, max: 6, selfHeal: 2 },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 4, max: 4, selfHeal: 1 },
        { min: 5, max: 5, selfHeal: 2 },
        { min: 6, max: 6, selfHeal: 3 },
      ],
    },
  },
  Cleopoultra: {
    1: { rollOutcomes: [{ min: 5, max: 6, predatorDodges: true, returnAttackOverride: 1 }] },
    2: { rollOutcomes: [{ min: 5, max: 6, predatorDodges: true, returnAttackOverride: 1 }] },
    3: { rollOutcomes: [{ min: 4, max: 6, predatorDodges: true, returnAttackOverride: 1 }] },
  },
  'Ursula Bone': {
    1: { rollOutcomes: [{ min: 4, max: 6, returnAttackBonus: 1 }] },
    2: {
      rollOutcomes: [
        { min: 2, max: 5, returnAttackBonus: 1 },
        { min: 6, max: 6, returnAttackBonus: 2 },
      ],
    },
    3: {
      rollOutcomes: [
        { min: 1, max: 2, returnAttackBonus: 1 },
        { min: 3, max: 5, returnAttackBonus: 2 },
        { min: 6, max: 6, returnAttackBonus: 3 },
      ],
    },
  },
  "Hendel's Mother": {
    1: { returnAttackIfAttackerHasNoBonusCard: 1 },
    2: { rollOutcomes: [{ min: 4, max: 6, discardCard: 'bonus' }] },
    3: {
      rollOutcomes: [
        { min: 3, max: 4, discardCard: 'bonus' },
        { min: 5, max: 6, discardCard: 'grub' },
      ],
    },
  },
  Layonardo: {
    1: {
      rollOutcomes: [
        { min: 1, max: 3, cannotLeaveLocation: true },
        { min: 4, max: 6, attackerTakesFixedDamage: 1 },
      ],
    },
    2: { rollOutcomes: [{ min: 3, max: 6, cannotLeaveLocation: true }] },
    3: { rollOutcomes: [{ min: 3, max: 6, cannotLeaveLocation: true }] },
  },
};

export const PREDATOR_LOOT: Record<string, PredatorLoot> = {
  'Hens Gruber': { returnAttackReduction: 1 }, // Bandit Mask (multi-use, passive)
  'Shere Corn': { permanentMaxHealthBonus: 1 }, // Signature Cloak
  'Ursula Bone': { permanentAttackBonus: 1 }, // Brass Knuckles
};
