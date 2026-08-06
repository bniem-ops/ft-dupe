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
- Status: deferred (needs-hook backlog, not yet scheduled)

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