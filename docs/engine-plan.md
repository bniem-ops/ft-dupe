# Flock Together Digital Engine — Scoping Plan

Status: early scoping, not started. No deadline — motivating use case is
playing remotely with friends/family in different parts of the country
(not the Labor Day 2026 in-person playtest, which uses the physical game).
Revisit and refine this doc as work actually begins; it's a living plan,
not a spec to freeze.

## What "engine" means here

Full rules engine: validates actions, resolves combat automatically,
enforces turn order and phase structure, tracks all state server-side
(Firestore) so remote players never touch a physical board. Not a
self-adjudicated tracker — the app makes the calls.

## What we're building on

- `core_rules.md` — the full rulebook already transcribed to mechanics
  (turn structure, 8 actions, combat resolution order, leveling, death/
  revival, difficulty modifiers). This is essentially complete and is the
  spec for steps 3-4 below.
- `data/chickens.json` / `data/predators.json` — stats are fully
  structured (health/attack/production/mealsToNext per stage), but
  **abilities are free text** (`{name, text}`), not machine-readable.
  ~150+ of these across 17 chickens × 3 stages + 16 predators. This is
  the single biggest unknown in the whole plan.
- `data/weather.json` — 3 season decks, free-text `effect` per card, same
  transcription-vs-execution gap as abilities.
- Bonus Cards (66) and Grub Cards (24) — **not in the data model at all
  yet**. You've noted Bonus Cards fall into ~5 categories rather than 66
  unique effects, which should make them cheaper to build than the raw
  count suggests. Grub Cards' categorical structure isn't confirmed yet.
- `session.js` — proven real-time sync primitive: a Firestore doc per
  4-char session code, `onSnapshot` listeners, `updateDoc` for partial
  writes. Currently only used for pre-game team picking, but the pattern
  (not the schema) extends directly to full game state.

## The real bottleneck

Same conclusion as before, now sharper having looked at the actual JSON:
implementation speed isn't the constraint. Converting ~150+ free-text
ability strings (plus weather effects, plus eventually Bonus/Grub cards)
into rules the engine can *execute* — correctly, matching the physical
rulebook's intent — is the bulk of the real work. Coding a turn structure
and a Firestore schema is comparatively mechanical.

## Phased build order

Roughly increasing risk, and phases 1-3 are useful checkpoints on their
own rather than only valuable once everything else is done.

1. **Data completion.** Transcribe Bonus Cards and Grub Cards into `.txt`
   templates following the existing pipeline
   (`chickens_template.txt` → `scripts/build_data.js` → `data/*.json`).
   You've already offered to do this transcription once card categories
   are agreed on — that agreement (naming the ~5 Bonus Card categories,
   confirming/denying a Grub Card equivalent) is the actual first task.

2. **Rules-interaction audit.** Go through every chicken/predator ability
   and weather effect and classify it:
   - *executable now* — clear trigger + effect (e.g. "Immune to Pollen").
   - *needs an engine hook* — mechanically clear but needs a new
     extension point (e.g. "can attack either Grub from any location"
     needs a location-check override the base engine doesn't have yet).
   - *ambiguous* — needs your read of the physical rulebook before it can
     be coded at all.
   This turns "~150 unique effects" from a guess into an actual task list,
   and tells us early how big phase 5 really is.

3. **Static game state + turn skeleton** (no ability logic yet). Season/
   day/Weathervane advancement, Egg Exchange windows, turn structure
   (production → 2 actions), the 8 base actions with their costs,
   level-up thresholds, difficulty modifiers at setup. `core_rules.md`
   already fully specifies this — lowest-risk phase, and worth treating
   as a shippable milestone: a group could play with the app handling all
   bookkeeping while still self-adjudicating ability text manually,
   before phase 5 exists at all.

4. **Combat resolution engine.** The 3-step order (Weather → Predator →
   Chicken abilities), return-attack damage, loot drop on kill, predator
   level-up at season end (health recalculated, damage carried over).
   Contained scope, but depends on phase 2's classification to know which
   chicken/predator abilities plug in cleanly.

5. **Ability effect engine.** Implement the "executable now" abilities
   from phase 2 as data-driven modifiers/hooks grouped by effect shape
   (stat modifier, action-cost change, extra action, damage mitigation,
   location override, etc.) rather than bespoke per-chicken code — same
   "group by category, not by card" approach you already identified for
   Bonus Cards.

6. **Bonus/Grub card engine.** Same category-driven approach, once
   phase 1's transcription exists to build against.

7. **Remote multiplayer sync.** Extend the Firestore session schema from
   "picks" to full game state: `phase`, `season`, `day`, `weathervane`,
   `players[]` (chicken/stage/health/food/eggs/hand/position),
   `predators[]` (stage/health/revealed), grub decks, turn order, an
   action log. The sync *primitive* is already proven by `session.js`;
   this phase is schema and turn-locking (whose write wins, how a
   player's turn is exclusively theirs), not new infrastructure.

8. **Win/lose conditions, death/Brood/revival flow.** Small in scope,
   sequenced last because it depends on combat (phase 4) and turns
   (phase 3) both existing.

## Open questions (not blocking yet, worth deciding before the phase that needs them)

- **Solo mode:** support it in the engine from the start, or squad-only
  first and retrofit solo later?
- **Trust model:** friends/family play, so does every player need
  Firestore security rules limiting them to writing only their own
  fields, or is a shared "anyone can write the doc" model (like today's
  team-picker) acceptable? Affects phase 7's schema design.
- **Mistake correction:** physical play lets you informally fudge a
  misplay. Should the engine allow reversing recent actions, or lock in
  each action like a strict digital implementation?

## Non-goals for now

- No AI/bot players — this is for real remote friends, not solo-vs-AI.
- No native app — stays a web app, same stack (vanilla JS, Firestore),
  consistent with the whole project so far.
