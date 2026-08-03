# Flock Together Digital Engine — Scoping Plan

Status: Phase 1 (data completion) done. Phase 2 (rules-interaction audit)
done — all 250 items across chickens/predators/weather/Bonus/Grub cards
classified with zero open ambiguities, see `docs/rules-audit.md`. Phase 3
(static game state + turn skeleton) done — engine-only, no UI yet; see
`engine/` (TypeScript, first code in the repo) and the design notes below.
Phase 4 (combat resolution engine) done — machinery only (order, return
damage, loot, Grub combat, death, predator level-up), predator/weather/
chicken-ability content stubbed as no-op hooks per the scope boundary
agreed before starting (see phase 4 below). 50 tests passing. Phase 5
(Minimal UI) done — a local hotseat board (`ui/`, Preact + htm, vendored,
no bundler) covering the 8 actions, combat, and day/season/turn
progression, with all chicken/predator/card/Loot text rendered as
read-only reference (see phase 5 below for the scope boundary and what
had to change in `engine/src/data.ts` to make it browser-safe). Phase 6
(ability effect engine) up next. No deadline — motivating use case is
playing remotely with friends/family in different parts of the country
(not the Labor Day 2026 in-person playtest, which uses the physical
game). Revisit and refine this doc as work actually begins; it's a
living plan, not a spec to freeze.

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
- `data/bonusCards.json` (66) / `data/grubCards.json` (24) — **fully
  transcribed.** Neither turned out to have the categorical structure
  originally guessed. Bonus Cards have no printed name or category at all
  — just an icon shorthand (`shorthand`) plus a plaintext `description`
  per card; most are distinct effects rather than falling into a handful
  of buckets, though a large fraction share one structural shape worth
  building for specifically: a binary choice ("Option 1 — X, OR Option 2
  — Y"), sometimes gated behind a cost. Grub Cards have `health`, an
  optional dice-roll defend `effect` (some are "none"), and a `reward`
  granted to whoever lands the killing blow — same shape as a Predator's
  Loot Drop; a subset of rewards are flagged "Permanent Upgrade" versus
  one-shot, which is the one real category-like split in the data.
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

1. **Data completion — done.** Bonus Cards and Grub Cards transcribed into
   `.txt` templates following the existing pipeline
   (`chickens_template.txt` → `scripts/build_data.js` → `data/*.json`),
   same as chickens/predators/weather. `scripts/build_data.js` now parses
   all five source templates into `data/*.json` + `data/app-data.js`.

2. **Rules-interaction audit — done.** All 250 items (chicken abilities,
   predator effects/loot, weather effects, Bonus Cards, Grub effects/
   rewards) classified in `docs/rules-audit.md` as executable-now (175),
   needs-an-engine-hook (75), or ambiguous (0 — every ambiguity was
   resolved via clarification before moving to the next category, per
   the user's preference for full closure section by section). The
   "needs hook" items cluster into ~8 recurring shapes (cross-actor aura
   effects, unbounded roll scope, location overrides, action-economy
   exceptions, shared-deck manipulation, multi-actor combat, dynamic
   ability/effect copying, death/revival/defeat exceptions) rather than
   250 bespoke cases — see `docs/rules-audit.md`'s grand-total section for
   the full breakdown. This directly scopes phase 4 and phases 6-7 below.

3. **Static game state + turn skeleton — done, engine-only (no UI yet).**
   Built in `engine/` (TypeScript, compiled via `tsc`, first code in the
   repo — see `package.json`/`tsconfig.json`). Covers season/day/
   Weathervane advancement (confirmed 2/3/2-day phase split per
   `docs/rules-audit.md`), the confirmed 4-outside-location board (Hendred
   Acre Wood, Golden Gables, Badlands, Grit Stones), Egg Exchange windows,
   turn structure (production → 2 actions + Extra Action Token), the 8
   base actions with their costs, level-up thresholds (damage preserved
   across stage transitions), and difficulty-modifier setup (Loot Drop
   grants, Boss health bonus, weather guarantees, predator randomization
   pools). Designed for any player count including solo. Pure
   `applyAction(state, action)` reducer + action log, no DOM/Firestore —
   42 tests via `npm test` (Node's built-in test runner). Combat
   resolution, ability/card effects, and death/revival are deliberately
   stubbed (see the phase 3 plan/commit for exactly where the extension
   points are) — that's phases 4/5/6/8.

4. **Combat resolution engine — done.** Built in `engine/src/combat.ts`
   (+ `engine/src/grubs.ts`, extracted shared Grub-dealing helpers).
   Scope boundary decided before starting: this is the combat *machinery*
   only — the 3-step order (Weather → Predator → Chicken abilities) is
   wired as 3 pluggable hooks (`GameConfig.hooks`) that all default to
   no-ops, since the free-text *content* of predator effects, weather
   combat effects, and chicken abilities is phase 6's job ("implement the
   executable-now abilities from phase 2"). What phase 4 does implement:
   return-attack damage (skippable via a `dodged` hook result, matching
   "dodging a return attack also dodges the Predator effect"), loot drop
   tracking on kill, Boss reveal once the last regular predator falls,
   Grub combat (health reduction, defeat transferring a fresh full-health
   `HeldGrubCard` to the killer per the confirmed Grub lifecycle, redeal),
   the death consequence (resource wipe, Loot Drops kept), and predator
   level-up at end of Spring/Summer (health recalculated from the new
   stage's multiplier, damage carried over). 8 new tests, 50 total
   passing.

5. **Minimal UI — done.** Added after an earlier conversation flagged
   that the original 8-phase list had no UI phase at all. Positioned
   here — *after* combat resolution, *before* the ability/card engines —
   because this is the first point where turns, all 8 actions, and
   combat all work: the first real moment a human group could sit down
   and let the app handle bookkeeping and fights while still
   self-adjudicating ability/card text by hand.
   Built as `ui/`: a local single-tab "hotseat" (pass-the-laptop) board
   using **Preact + htm**, vendored locally into `ui/vendor/` (no CDN,
   no bundler — served as plain `<script type="module">` files via
   `scripts/serve.js`, a zero-dependency static server; `npm run dev`).
   Scope matches what was planned: board view (Coop + the 4 named
   locations, predator/Grub slots, weathervane/season/phase/weather
   display), all 8 action buttons (with inline pickers for
   Move/Attack/Heal/Eat/Brood), and per-player stat panels. **Scope
   boundary for text content**, resolved from the milestone's own
   rationale above: the UI *displays* all chicken ability, predator
   effect/return-attack, weather, Bonus/Grub card, and Loot Drop text as
   read-only reference so players can self-adjudicate it by hand, but
   doesn't provide buttons to "play" or "apply" any of it — the engine
   doesn't execute that content yet (phases 6-7).
   Turn-loop orchestration (calling `startTurn`/`endTurn`/`advanceDay`
   in the right sequence, skipping dead players' turns, handling the
   day-end Grub-discard/Egg-Exchange prompt) lives in `ui/src/app.js`,
   since the engine's exported functions are individually correct but
   don't sequence themselves.
   **Prerequisite fix discovered mid-phase:** `engine/src/data.ts` read
   `data/*.json` via `node:fs`, which doesn't exist in a browser, and
   `setup.ts`/`combat.ts` both depend on it transitively — the engine as
   built through phase 4 could not have run in a browser at all. Fixed
   by having `scripts/build_data.js` emit `data/generated.mjs` (a plain
   ES module, not JSON-with-import-attributes, for zero browser-support
   risk) instead of the old dead `window.FLOCK_DATA` bundle, and having
   `data.ts` import from it via a `#data/*` Node subpath import (mapped
   in `package.json`'s `"imports"` field for Node, and in
   `ui/index.html`'s `<script type="importmap">` for the browser) rather
   than a literal relative path — a literal `../../` would have been
   correct for one of {tsc type-checking the source, Node resolving the
   compiled output} but not both, since `rootDir`/`outDir` adds a
   directory level between them. `data.ts`'s public function signatures
   didn't change, so no other engine file or test needed touching; 50
   tests still pass. `engine/src/index.ts`'s barrel now also re-exports
   `data.ts` (it hadn't, so `loadChickens`/`findPredator`/etc. weren't
   actually reachable from outside the engine until this was added).

6. **Ability effect engine.** Implement the "executable now" abilities
   from phase 2 as data-driven modifiers/hooks grouped by effect shape
   (stat modifier, action-cost change, extra action, damage mitigation,
   location override, etc.) rather than bespoke per-chicken code.

7. **Bonus/Grub card engine.** Bonus Cards turned out to be mostly
   distinct effects rather than a handful of categories — the one
   structural shape worth a shared primitive is the binary-choice card
   ("Option 1 — X, OR Option 2 — Y"), often cost-gated. Grub Cards split
   on single-use vs. "Permanent Upgrade" rewards. Group by these real
   shapes (from phase 2's classification), not by card.

8. **Remote multiplayer sync.** Extend the Firestore session schema from
   "picks" to full game state: `phase`, `season`, `day`, `weathervane`,
   `players[]` (chicken/stage/health/food/eggs/hand/position),
   `predators[]` (stage/health/revealed), grub decks, turn order, an
   action log. The sync *primitive* is already proven by `session.js`;
   this phase is schema and turn-locking (whose write wins, how a
   player's turn is exclusively theirs), not new infrastructure.

9. **Win/lose conditions, death/Brood/revival flow.** Small in scope,
   sequenced last because it depends on combat (phase 4) and turns
   (phase 3) both existing.

## Open questions (not blocking yet, worth deciding before the phase that needs them)

- ~~**Solo mode**~~ — resolved: phase 3's state design supports any player
  count including solo (1) from the start.
- **Trust model:** friends/family play, so does every player need
  Firestore security rules limiting them to writing only their own
  fields, or is a shared "anyone can write the doc" model (like today's
  team-picker) acceptable? Affects phase 8's schema design.
- **Mistake correction:** physical play lets you informally fudge a
  misplay. Should the engine allow reversing recent actions, or lock in
  each action like a strict digital implementation?

## Non-goals for now

- No AI/bot players — this is for real remote friends, not solo-vs-AI.
- No native app — stays a web app. Stack as of phase 5: TypeScript for
  the engine core (`engine/`), Preact + htm (vendored, no bundler) for
  the UI (`ui/`), Firestore for sync (phase 8) — no heavy framework or
  bundler commitment beyond what each of those needs.
