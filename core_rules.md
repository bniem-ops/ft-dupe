# Flock Together — Core Rules Reference

Extracted from the official rulebook PDF. This covers mechanics only —
character/predator stat blocks live in the physical Chicken Books / Predator
Books and are tracked in `chickens_template.txt` / `predators_template.txt`.

## Objective

Cooperative game. **Win** if, before the 3rd season ends:
1. All four Predators are defeated, AND
2. Every player is alive when the final Predator is defeated.

**Lose** if any of:
1. All players die at any point.
2. The third season ends before all Predators are defeated.
3. One or more players is dead when the final Predator is defeated.

## Structure

- 3 seasons: Spring, Summer, Fall — 7 days each.
- One day = every player takes a turn, then discards a Grub Card (Inside or
  Outside, player's choice), then the Weathervane advances.
- Before days 1, 3, and 6 of each season (not day 1 of Spring):
  1. **Egg Exchange** — trade any number of eggs for equal food.
  2. Draw a new **Weather Card** from the current season's deck.
- End of season 7: Weathervane resets to day 1, draw from next season's deck.
- End of Spring and Summer: every surviving Predator levels up (recalculate
  health: new max from higher multiplier, minus damage already sustained).

## Turn Structure

1. **Production** — Chicks get 1 free food. Leveled-up chickens roll for a
   chance at an egg instead.
2. **Two actions** (can repeat; more with Bonus Cards, weather, or the
   once-per-season Extra Action Token).

Bonus/Grub Cards cost no action and can be played any time, including on
others' turns.

### The 8 actions

| Action | Location | Notes |
|---|---|---|
| Lay Egg | Inside only | Not available to Chicks (needs Pullet/Cockerel+) |
| Heal | Inside only | Chick: pay 1 food/1 heart. Pullet/Cockerel: up to 2. Hen/Rooster: up to 3. |
| Brood | Inside only | Revive a dead player — pay 1 egg, skip your next turn |
| Move | Any | Between Coop and Outside, or between Outside locations |
| Draw Card | Any | Draw 1 Bonus Card, hand limit 2 |
| Attack | Any | Must be nearby the target. Costs 1 food per point of attack strength |
| Eat | Outside only | Levels up your chicken. Chick: pay 1 food/1 meal-track space. Pullet/Cockerel: up to 2. |
| Forage | Outside only | Collect 1 food |

### Combat resolution order
1. Weather Effect
2. Predator Effect
3. Chicken Abilities

Other combat notes:
- You still take return damage/effects even on the killing blow.
- If Weather/Predator effects cause a miss, you still pay the food cost.
- Dodging a return attack also dodges the Predator effect.

## Leveling Up

- Chicks → Pullet(f)/Cockerel(m) → Hen(f)/Rooster(m).
- Track meals eaten on the Meal Counter; hitting the required number flips
  the Chicken Book to the next stage.
- On level up: gain new abilities (keep old ones), new meal threshold, and
  possibly more health/attack/production. Add new hearts at full health,
  keep existing damage.
- Meal counter does NOT reset on level up.

## Predators

- Max health = (multiplier on card) × (number of players).
- Predator effects resolve before or after the attack depending on the card.
- Attacking costs food equal to chosen attack strength; you take the
  Predator's listed return attack (claws) regardless of whether you land
  the killing blow.
- 3 regular Predators are revealed at setup; the 4th (**Boss**) stays face
  down until the last regular Predator dies. Boss always opens to its 3rd
  (final) stage, health multiplier +3.
- Defeating a Predator awards its **Loot Drop** (single-use, multi-use, or
  permanent) to whoever landed the final blow.

## Grubs

- Not required to win, but help. Inside and Outside each have their own
  Grub deck/discard.
- No hand limit on Grubs. Single-use like Bonus Cards unless stated
  otherwise, playable any time, no action cost.
- One Grub must be discarded (Inside or Outside, player's choice) at the
  end of every day.
- When both decks are empty, reshuffle the combined discard and redeal into
  two new decks.

## Death

- Health hits 0 → die. Discard all food, eggs, Bonus Cards, Grub Cards, and
  Meal Counter token. Loot Drops are kept.
- Another player must Brood (pay 1 egg, skip next turn) to revive you.
- On revival: draw 2 new Chicken Books, pick one, rejoin as a Chick.
- If the game ends before a downed player has taken their first turn back
  as a Chick, the whole team loses — even if all Predators are dead.

## Misc rules

- No trading food/eggs between teammates unless a card says otherwise.
- Can't play Bonus/Grub cards on teammates unless the card names "teammate"
  or says "Any." (Solo mode: you count as your own teammate.)
- Recommended: play open-hand (cards face up).
- Chicken die face = 6 on a standard die.

## Difficulty Modifiers (corrected from user's physical rulebook)

8-level scale. **Level 4 is Normal (no modifiers).** Levels 1-3 are
progressively *easier* than Normal; levels 5-8 are progressively *harder*.
The "randomize predator" modifiers at 5+ draw from a fixed species list,
not the full 16-predator roster — and that list is shorter without
Eggspansion.

Species → predator name in this dataset: Bear = Ursula Bone, Coyote =
Shere Corn, Hawk = Cleopoultra, Fox = Chicksune, Raccoon = Hens Gruber,
Badger = Hendel's Mother (Eggspansion), Cougar = Coopella (Eggspansion),
Snapping Turtle = Layonardo (Eggspansion).

### Without Eggspansion

| Level | Modifiers |
|---|---|
| 1 | All players start with a random Loot Drop; no +3 health bonus on the Boss; guaranteed positive card on top of each Weather deck |
| 2 | No +3 health bonus on the Boss; guaranteed positive card on top of each Weather deck |
| 3 | Guaranteed positive card on top of each Weather deck |
| 4 | **Normal — no modifiers** |
| 5 | Boss randomly selected from: Bear, Coyote, Hawk |
| 6 | Boss randomly selected from: Bear, Coyote, Hawk; Fair/Sunny/Snow removed from their decks |
| 7 | Fair/Sunny/Snow removed from their decks; all 4 Predators randomly selected from: Bear, Coyote, Hawk, Fox, Raccoon |
| 8 | Fair/Sunny/Snow removed; all 4 Predators randomly selected from: Bear, Coyote, Hawk, Fox, Raccoon; Boss health multiplier increased to +4 |

### With Eggspansion

| Level | Modifiers |
|---|---|
| 1 | All players start with a random Loot Drop; no +3 health bonus on the Boss; guaranteed positive card on top of each Weather deck |
| 2 | No +3 health bonus on the Boss; guaranteed positive card on top of each Weather deck |
| 3 | Guaranteed positive card on top of each Weather deck |
| 4 | **Normal — no modifiers** |
| 5 | Boss randomly selected from: Bear, Coyote, Hawk, Badger, Cougar |
| 6 | Boss randomly selected from: Bear, Coyote, Hawk, Badger, Cougar; Fair/Sunny/Snow removed from their decks |
| 7 | Fair/Sunny/Snow removed from their decks; all 4 Predators randomly selected from: Bear, Coyote, Hawk, Fox, Raccoon, Badger, Cougar, Snapping Turtle |
| 8 | Fair/Sunny/Snow removed; all 4 Predators randomly selected from: Bear, Coyote, Hawk, Fox, Raccoon, Badger, Cougar, Snapping Turtle; Boss health multiplier increased to +4 |

Note: Owl Coopone, Eggsmeralda, Sal Moe Nella, Professor Moltiarty, and
Gravekeeper Fowl are never part of this randomization pool at any
difficulty. Chew Bawka, Weasma and Clawnk, and Sheriff of Rottingham
(3 of the 6 Eggspansion predators) are also excluded even with
Eggspansion on — only Hendel's Mother, Coopella, and Layonardo get added.

## Components (for reference)

11 Chicken Books, 10 Predator Books, 1 Bonus Card Deck (66 cards),
3 Weather Decks (6 cards each, 18 total), 24 Grub Cards, 60 Resin Eggs,
80 Food Tokens, 36 Health Tokens, 8 Player Cheeples, 5 Player Boards,
4 Predator Damage Counters, 5 Extra Action Tokens, First Player Token,
Weathervane Token, 6 Resource Nests, 2 Chicken Dice, 8 Color Reminder
Tokens.

(Eggspansion adds: 6 more Chicken Books, 6 more Predator Books, 3 more
Weather Cards — totals used elsewhere in this project: 17 chickens, 16
predators, 18 base + 3 expansion weather cards.)
