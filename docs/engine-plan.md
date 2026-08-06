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
(ability effect engine) done — the 77 "executable now" chicken/predator/
weather items from `docs/rules-audit.md` are now live rules, not just
reference text (see phase 6 below). Phase 7 (Bonus/Grub card engine)
done — the 98 "executable now" Bonus Card (57 of 66 copies)/Grub defend
roll (24)/Grub Reward (17) items are implemented, including a UI Play
button so cards are actually usable in the browser, not just enforced
(see phase 7 below). Phase 9 (win/lose conditions, death/Brood/revival
flow) done, taken out of order ahead of phase 8 since it was smaller and
self-contained — real win/lose evaluation and the full Brood → choose a
new Chicken Book → rejoin as a Chick flow both work now (see phase 9
below). 155 tests passing. Phase 8 (remote multiplayer sync) done — the
UI can now create/join a Firestore-backed session, claim seats, and play
a fully synced game across devices, with the client-side engine as the
only reducer (see phase 8 below for the design). `ft-dupe`'s Cloud
Firestore is enabled and its rules are published for the shared-write
trust model; a standalone REST round-trip (create session → claim seat →
push/read a synced GameState) confirmed live against the real project.
That was the last item on the original roadmap; revisit and refine this
doc as new work comes up — it's a living plan, not a spec to freeze.

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
   doesn't execute that content yet (phases 6-7). **Update after phase
   6:** this framing now only holds for the "needs hook" (H) items and
   Bonus/Grub cards (still phase 7) — the "executable now" chicken/
   predator/weather ability text the UI renders is live rules as of
   phase 6, not just reference; the same displayed text now describes
   what the engine actually does. **Update after phase 7:** Bonus/Grub
   card text now has an actual "Play" button next to it (not just
   reference) for the 98 executable-now items; only the "needs hook"
   items across every category remain click-free reference text.
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

6. **Ability effect engine — done.** Implemented the 77 "executable now"
   chicken (32) / predator (29) / weather (16) items from phase 2 —
   Bonus/Grub cards stayed out of scope for phase 7. New
   `engine/src/abilities/` (`types.ts`, `chickens.ts`, `predators.ts`,
   `weather.ts`): each content source is a registry of small, optional-
   field objects — one field per effect *shape* (starting resource,
   weather immunity, roll-table outcome, stat modifier, free action,
   damage mitigation, etc.), not one per named ability, so the ~30 shapes
   that recur across 77 items stayed data, not bespoke code per card.
   Combat's 3 hooks (`weatherEffect`/`targetEffect`/`chickenAbilities`,
   phase 4) now default to real registry lookups instead of no-ops when
   `config.hooks` doesn't override them — existing test overrides still
   work unchanged. New call sites needed beyond combat: turn-start
   (Nighttime/Tornado/Sunny/Earthquake), turn-end (Hail/Lightning Storm/
   Severe Wind), production (Daylight Savings' threshold, High
   Producer's extra roll), Forage (The Forager's roll, Drought's cost,
   Fair's bonus), Lay Egg (Well-Laid Plans' roll), Egg Exchange
   (Pouring Rain/Snow, Superior Product's rate, per-status blocks),
   and 5 new "free action" `Action` variants (`giftFood`,
   `sacrificeHealthForEggs`, `payEggForCard`, `freeOutsideMove`,
   `drawTwoKeepOne`) for abilities that grant a bonus action rather than
   modifying an existing one. New `PlayerState` fields:
   `statusEffectsUntilNextEggExchange` (unifies every "...until the next
   Egg Exchange" clause), `foragedThisTurn`, `weatherAdjustmentUsedThisPhase`
   ("once per phase" effects), `freeAbilityUsedThisTurn`. Two items are
   wired but currently inert, both noted in code: **Just Reward** (needs
   Tank, an H item, to ever fire) and **Gas Mask** (the one single-use
   *activatable* Loot Drop among these — its grant already worked from
   phase 4; activating it on demand is deferred to phase 7's held-effect-
   playing mechanism, the same problem Bonus/Grub cards need solved
   anyway). Also fixed a real gap found along the way: `attack`'s
   strength was never actually capped at the chicken's stat — harmless
   until Dust Storm/Adrenaline needed a real "max attack strength" to
   modify. 55 new tests across `abilities-weather.test.ts`,
   `abilities-chickens.test.ts`, `abilities-predators.test.ts` (105
   total, zero regressions). No UI changes — `ui/` already renders all of
   this text; it just went from inert reference to enforced rules. The 75
   "needs hook" (H) items are unchanged, still no-op.

7. **Bonus/Grub card engine — done.** Implemented the 98 "executable now"
   items from phase 2: 57 of 66 Bonus Card copies (27 unique effects, 5
   unique needs-hook effects deferred), all 24 Grub defend rolls, and 17
   of 24 Grub Rewards (7 needs-hook deferred: Dung Beetle, Four Leaf
   Clover, Garden Snail, Lucky Cricket, Spotted Lanternfly, Wasp Swarm,
   Firefly). New `engine/src/abilities/grubCards.ts`
   (`GRUB_DEFEND_EFFECTS`, reusing `PredatorEffect`'s roll-table shape
   as-is since Grub defend rolls turned out structurally identical to
   Predator ones — no new type needed; `GRUB_REWARDS`) and
   `engine/src/abilities/bonusCards.ts` (`BONUS_CARD_EFFECTS`, keyed by
   the card's `shorthand` text since Bonus Cards have no printed name/id).
   Both Reward/Bonus-Card shapes share one `CardEffect` interface (one
   optional field per shape: signed resource deltas, choice-of-two,
   bounded teammate gifts, direct enemy damage, permanent one-time-patch
   upgrades, and 6 new "pending" `PlayerState` fields for reactive
   attack-time effects — dodge, damage reduction, predator-roll
   reduction, a free attack point, reroll-your-next-roll — consumed by
   the next matching action, same pre-committed pattern as phase 6's
   Misdirection). Two new free (no action cost) `Action` types,
   `playBonusCard`/`useGrubReward`, both routing through a shared
   `resolveCardEffect` in `actions.ts`. `combat.ts`'s `resolveGrubAttack`
   now actually rolls the target Grub's defend effect and can deal return
   damage to the attacker — previously Grubs had zero retaliation risk,
   which was the exact bug a playtester hit (see
   `docs/playtest-feedback.md`'s Four Leaf Clover entry, now closed).
   Unlike phase 6, this phase needed real UI work too, since playing a
   card is player-initiated rather than an automatic trigger: `ui/`'s
   `playerPanel.js` now renders a "Play" button per held card (with
   inline option/teammate/amount pickers, or a board-click target pick
   for enemy-damage cards, reusing `actionBar.js`/`board.js`'s existing
   `pendingPick` machinery) instead of read-only text. 43 new tests
   across `abilities-grubDefend.test.ts`, `abilities-bonusCards.test.ts`,
   `abilities-grubRewards.test.ts` (148 total, zero regressions). Note:
   "Reroll your own die" can't literally re-prompt after seeing a roll in
   a synchronous reducer, so it's modeled as a pre-committed "best of 2"
   at the point of rolling instead. I verified the dev server serves the
   rebuilt engine and UI files correctly, but couldn't click through the
   new Play buttons myself (no browser-automation tool available in this
   environment) — worth a manual pass before considering this fully
   verified.

8. **Remote multiplayer sync — done.** Trust model resolved: shared write
   access (any device with the session code can write the doc), same as
   the old team-picker — not per-player Firestore security rules. No
   Cloud Functions / server-side reducer: every device runs the exact
   same `applyAction`/`endTurn`/`advanceDay`/`createGame` calls it always
   has, and a remote-mode client also pushes the resulting `GameState` to
   `sessions/{code}` after computing it; every device (including the
   writer) re-renders from whatever `onSnapshot` delivers next, rather
   than trusting its own optimistic compute. Last-write-wins, no
   transactions/revision counters.
   New `ui/src/remoteSession.js` replaces the orphaned root `session.js`
   (deleted — its schema was the old companion app's pre-game picker,
   unrelated to `GameState`). `toSyncedState`/`fromSyncedDoc` are the
   serialization boundary: `config.rng`/`config.hooks` are functions (not
   JSON-safe, and don't need to be shared — a roll's outcome is already
   baked into the resulting state, so each device keeps rolling with its
   own local `Math.random()`), and `actionLog` is dropped from the synced
   doc (unbounded growth risk against Firestore's 1MiB doc cap; nothing
   in the UI reads it). `dayEndPending` rides alongside `state` in the
   doc rather than being derived from it, since `currentPlayerIndex`
   alone can't distinguish "the last player's turn is in progress" from
   "the last player just ended their turn and day-end is pending."
   New UI flow: `Setup` gains a "Play Remotely" entry point into
   `ui/src/components/lobby.js`'s two screens — `RemoteHome` (create a
   session with the host-only settings: player count/difficulty/
   eggspansion/predators, or join one by its 4-char code) and `Lobby`
   (each device claims one unclaimed seat by picking its own chicken,
   host starts once every seat is filled). `app.js` threads a
   `myPlayerId` (the seat this device claimed, persisted in
   `localStorage` per session code) through `ActionBar`, `TurnControls`,
   and `PlayerPanel`; a `canAct(seatId)` check (`myPlayerId == null` in
   local hotseat play, unrestricted, exactly today's behavior) disables
   action/card/revival controls that aren't this device's seat. This is
   a UX nicety, not a security boundary — the reducer's own
   `assertCanAct` is the real guard, consistent with the shared-write
   trust model.
   Verified against the real `ft-dupe` project via a standalone Firestore
   REST script (no browser-automation tool available to click through an
   actual two-device session, so this is schema/data-layer verification,
   not a UI click-through): create a session doc, claim a seat, push a
   synced `GameState`, read it back — round-trip confirmed correct.
   Getting there needed two console-side steps beyond this session's code
   changes, both done: enabling the Cloud Firestore API for `ft-dupe`
   (it had never been turned on) and publishing open rules matching the
   shared-write trust model:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /sessions/{code} { allow read, write: if true; }
     }
   }
   ```
   Worth remembering: a 4-char code is only ~1M combinations, so this is
   obscurity, not real access control — fine for casual friends/family
   play, not for anything sensitive. `npm test` stays at 155/155 (no
   engine changes this phase — everything is additive in `ui/` plus the
   new `ui/src/remoteSession.js`).

9. **Win/lose conditions, death/Brood/revival flow — done.** New
   `engine/src/gameStatus.ts` (`evaluateGameStatus`) checks the two
   state-derivable conditions from core_rules.md's Objective section —
   all players dead (loss) and all 4 Predators defeated with everyone
   truly back (win) — called from `reducer.ts`'s `applyAction` (catches a
   win on the killing blow, and card-driven self-damage deaths) and
   `turn.ts`'s `endTurn` (catches an end-of-turn weather death, since
   `endTurn` is called directly by `ui/src/app.js`, not through
   `applyAction`). The third condition — the season timing out before all
   Predators are defeated — is a timing event, not a state fact, so it's
   its own branch in `advanceDay`'s Fall-day-8 rollover instead (preserves
   an already-landed win rather than overwriting it). `GameState` gained
   a `won` field alongside the existing `gameOver`. `applyAction` now
   rejects any action once `gameOver` is true.
   Revival: `brood()` no longer revives immediately — it draws 2 Chicken
   Book candidates (names not currently in use by a living player,
   respecting `eggspansion`, same pool-filtering pattern as predator
   selection in `setup.ts`) and the target stays `alive: false` until a
   new `completeRevival` action (playable any time, like a Bonus Card)
   locks in stage-1 stats + starting grants for the chosen chicken —
   extracted a shared `baseChickStats` helper out of `setup.ts`'s
   `createPlayer` so the grant logic isn't duplicated. A new
   `justRevivedPendingFirstTurn` flag (set by `completeRevival`, cleared
   at that player's own next `endTurn`) implements core_rules.md's edge
   case: a revived player who hasn't taken their first turn back yet
   doesn't count as "truly alive" for the win check, even though
   `alive` is already `true`.
   UI: `app.js` now routes every state-producing path (dispatch, End
   Turn, day-end submit) through one `applyStateUpdate` helper that
   switches to a real win/loss screen instead of only the day-end path
   checking `gameOver`; `playerPanel.js` shows a "choose your chicken to
   rejoin" button pair for a player with a pending revival choice. 7 new
   tests in `gameStatus.test.ts` plus updates to the pre-existing
   `brood`/Fall-day-7 tests (155 total, zero regressions). Same caveat as
   phase 7: verified the dev server serves the rebuilt files, couldn't
   click through the new screens myself.

## Open questions (not blocking yet, worth deciding before the phase that needs them)

- ~~**Solo mode**~~ — resolved: phase 3's state design supports any player
  count including solo (1) from the start.
- ~~**Trust model**~~ — resolved: shared write access (like today's
  team-picker), not per-player Firestore security rules. See phase 8.
- **Mistake correction:** physical play lets you informally fudge a
  misplay. Should the engine allow reversing recent actions, or lock in
  each action like a strict digital implementation?

## Non-goals for now

- No AI/bot players — this is for real remote friends, not solo-vs-AI.
- No native app — stays a web app. Stack as of phase 5: TypeScript for
  the engine core (`engine/`), Preact + htm (vendored, no bundler) for
  the UI (`ui/`), Firestore for sync (phase 8) — no heavy framework or
  bundler commitment beyond what each of those needs.
