# Playtest Feedback Log

Running log of gameplay that didn't match rules/expectations, found by playing
the local dev server. Append new entries at the top. Triage note explains
whether it's a real engine bug, expected (not built yet), or a rules-audit
misread — link the relevant `rules-audit.md` item where useful.

Format per entry:

```
## YYYY-MM-DD — short title
- What happened:
- Expected:
- Card/rule involved:
- Triage: [bug | not-yet-implemented | working as intended] — notes
- Status: [open | fixed in <commit/summary> | deferred to phase N]
```

---
## 2026-08-03 — Owl Coopone bug
- What happened: Owl Coopone gains 3 health in Sunny Weather in Summer. The previous season's last weather was Nighttime. On Day 1 of Summer, Owl's health dropped from 3 to 1 after the debuff from nighttime weather dropping, but it did not increase back up with the new weather.
- Expected: I expect Owl Coopone to have 4 health until Sunny weather is no longer in play
- Card/rule involved: Sunny weather card, Nighttime weather card, Owl Coopone Health
- Triage: not-yet-implemented — Owl Coopone's weather-conditional stat bonuses are classified "H" (needs hook) in rules-audit.md:151-154, explicitly out of Phase 6's scope (only the 77 "E" items were built). Its health today is just its flat base stat with no weather modifier at all. Needs a "predator stat conditional on active weather card" hook — worth scoping as part of the H-item follow-up work, not Phase 7 (which is Bonus/Grub cards).
- Status: closed — weather-conditional health/attack bonus shipped in phase 11j (modeled as a per-combat self-heal resolved from the attacker's own weather, tested per-attacker under Mudslide in 11k). The remaining "cannot use Bonus/Grub Cards to dodge Predator attacks" clause shipped separately: `playBonusCard`/`useGrubReward` now require a `targetType`/`targetId` on any dodge-shaped card ("Dodge Enemy attack", Praying Mantis's Reward) and reject the play outright when the target is Owl Coopone, rather than letting the card go to waste — see `actions.ts`'s `dodgeNextAttack` branch in `resolveCardEffect`.

## 2026-08-03 — Nighttime Action Economy
- What happened: In Nighttime, I was able to take 2 actions in each turn.
- Expected: Nighttime weather should force you to have 1 less action during that phase
- Card/rule involved: Nighttime weather card
- Triage: likely working as intended — the printed card text (data/weather.json) is "Once during this phase, you must perform 1 less action," and rules-audit.md:225 classifies it the same way: a one-time reduction, not a per-turn one. The engine applies it on each player's *first* turn of the phase only (engine/src/turn.ts startTurn, gated by weatherAdjustmentUsedThisPhase), then 2 actions every turn after, for the rest of that phase. Open question for you: did your very first turn of that Nighttime phase also show 2 actions (real bug), or only turns after the first (expected)?
- Status: open — needs confirmation of which turn was affected

## 2026-08-03 — Four Leaf Clover
- What happened: I attacked a grub (Four Leaf Clover, printed Health: 0 per grub_cards_template.txt) and it took 1 food even though it had 0 health.
- Expected: Only my action is used to attack the grub, it does not consume food (check this against rules if possible)
- Card/rule involved: base Attack action rules (core_rules.md:49, 77), not weather
- Triage: working as intended — core_rules.md's Attack row says "Costs 1 food per point of attack strength," with no health-based exception, and the Predators section confirms the pattern explicitly ("Attacking costs food equal to chosen attack strength... regardless of whether you land the killing blow"). A 0-health Grub still requires an Attack action (min food cost) to resolve/defeat; the food isn't refunded because the kill was guaranteed. The bigger real gap here is that Grub combat is still very bare — no defend-effect roll, no Reward granted/playable yet (grub's `reward` is just held on your hand, unusable). That's exactly Phase 7 scope.
- Status: closed (working as intended) — underlying missing Grub Reward/defend-roll mechanics tracked as Phase 7 work, not a bug
- Update 2026-08-04: Phase 7 shipped Grub defend rolls (Four Leaf Clover: "6: +1 health") and its Reward (Reward is a needs-hook item — deferred, no ETA). Attacking a Grub now carries real retaliation risk in general, closing the underlying gap this entry flagged.

## 2026-08-07 — Nighttime/Sunny Action Economy
- What happened: I have the sunny weather but am unable to use an additional action in the phase.
- Expected: I should be able to take 1 extra action across the 2 or 3 turns in that phase. 
- Card/rule involved: Sunny Weather
- Triage: bug, confirmed — clarified with the table that the adjustment applies to exactly 1 turn within the phase, at the player's discretion (not automatically the first turn, not every turn). The engine previously auto-applied it on the player's first turn of the phase only. Reworked as an explicit `useWeatherActionAdjustment` action (`engine/src/turn.ts`), surfaced as a button in `actionBar.js` that appears once per phase while Sunny is active and unused, so the player picks which turn to spend it on.
- Status: fixed (2026-08-08 UI-wiring session, docs/engine-plan.md phase 11 closing note)


## 2026-08-07 — Nighttime/Sunny Action Economy
- What happened: I have the Nighttime weather but am forced to lose the action in the first turn of the phase.
- Expected: I should be able to take 1 less action across the 2 or 3 turns in that phase. 
- Card/rule involved: Nighttime Weather card
- Triage: bug, confirmed — same fix as the Sunny entry above (shared code path).
- Status: fixed (2026-08-08 UI-wiring session, docs/engine-plan.md phase 11 closing note)

## 2026-08-07 — Bonus Cards
- What happened: I have reached the hand limit for bonus cards
- Expected: I should be able to discard bonus cards
- Card/rule involved: Bonus Card rules
- Triage: bug, confirmed — core_rules.md never spells out a discard rule at all (just "hand limit 2"); the engine's actual bug was blocking every card-gaining action outright once at the limit (Draw Card, Cave Hoard, Quick Claws, "take a card from discard," multi-draw effects), with no way to ever discard. Clarified with the table: discarding is only possible once your hand is actually over the limit (never proactively), it's free, and you choose which card. Gains are no longer blocked; a new discardBonusCard action (button in playerPanel.js, only shown once actually over) fixes it.
- Status: fixed (2026-08-08 UI-wiring session, docs/engine-plan.md phase 11 closing note)

## 2026-08-18 — Shere Corn return attack damage solo game/only chicken at location
- What happened: I attacked Shere Corn in a solo game at level 1 (3 health and 2 return attack) and received 3 damage to my chicken
- Expected: 2 damage should have been applied to my character
- Card/rule involved: splash damage for Nearby Teammate logic improperly assigned
- Triage: bug, confirmed — `combat.ts`'s `resolveCombat` was applying Shere Corn's "4-6: All nearby players take 1 splash damage" to *every* alive player at the location, attacker included (a deliberate choice from Phase 11e, tested that way at the time). But the attacker already has their own dedicated Return Attack line (2) — stacking splash on top double-counted them, invisible in the original multiplayer test since a second player's splash instance masked it. In solo there's no one else to splash, so the extra 1 damage was the whole discrepancy.
- Status: fixed — `resolveCombat` now excludes the attacker (`p.id !== playerId`) from splash; only other nearby players take it. Updated/added assertions in `abilities-multiTargetCombat.test.ts` covering attacker-excluded, nearby-teammate-still-hit, elsewhere-untouched, and solo (no one to splash) cases.

## 2026-08-18 — Nighttime action
- What happened: I was not forced to take 1 fewer action in the Night time weather
- Expected: I would be forced to take 1 fewer action in my last turn on that phase if I haven't already
- Card/rule involved: Nighttime weather card
- Triage: bug, confirmed — the 2026-08-07 fix made the once-per-phase adjustment fully opt-in (a button, player picks which turn), correctly per "the player chooses which turn," but never added a backstop: a player who simply never clicked it kept full actions all phase, even though the printed text ("you must perform 1 less action") reads as mandatory, not skippable.
- Status: fixed — `startTurn` (`turn.ts`) now force-applies the adjustment on the last day of the current phase (day 2/5/7) if the player hasn't used it by then, same immunity checks as the opt-in path. Added 4 new tests in `abilities-weather.test.ts` (Nighttime + Sunny forced on last day, not re-forced if already used, immune players still exempt).

## 2026-08-18 — Toasts / Roll outcomes
- What happened: I do not see toasts or roll outcomes from the game
- Expected: I thought code was added to show roll outcomes to validate the game engine and have player trust. Could the toasts and persistent log be added to the right side where teammates are shown? I believe it's a toggleable rail
- Card/rule involved: N/A
- Triage: not a regression — the persistent log (with roll outcomes) was there, just easy to miss: a small stack bottom-left of the board, competing with the location/predator/grub cards already cluttering that area.
- Status: fixed — moved to a toggleable rail on the right edge of the board (a 🕘 tab, opens a scrollable panel), stacked below the flock/avatar strip when opponents exist, alone (still visible) in solo. Replaces both the old bottom-left toast stack and the separate centered-modal log-history button.