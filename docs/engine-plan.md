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
UI can create/join a Firestore-backed session and play a fully synced
game across devices, with the client-side engine as the only reducer
(see phase 8 below for the design). `ft-dupe`'s Cloud Firestore is
enabled and its rules are published for the shared-write trust model.
That was the last item on the original roadmap. Phase 10 (session-based
setup flow) done as a follow-up, replacing phase 8's original
seat-claiming lobby (where claiming a seat and picking a chicken were
the same action, and predators were picked manually) with a flow that
matches the physical game: named joins, predators randomly selected for
the whole table *before* anyone sees a chicken, then each player dealt
2 chicken candidates to choose between (see phase 10 below). 164 tests
passing. Phase 11 (the 75 "needs hook" items) is **fully done, including
11k (Mudslide)** — every H item from `docs/rules-audit.md` now has a real
implementation. 11a through 11j landed first; the UI-wiring backlog they
left behind (~25 actions that were engine-correct and dispatchable but had
no board/panel control) was closed in a follow-up pass; Mudslide (11k),
initially deferred pending a design conversation since it breaks the
engine's one-shared-weather-card assumption, landed last — see phase 11's
closing note for all three. Also landed: a rules clarification on Sunny/
Nighttime ("once during this phase," but the player picks which of their
turns it lands on, not automatically the first), and a base-game bug fix
where gaining a Bonus Card at the hand limit was blocked outright instead
of letting the gain happen and the player discard down to size afterward.
232 engine tests passing. Revisit and refine this doc as new work comes
up — it's a living plan, not a spec to freeze.

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

10. **Session-based setup flow — done.** Replaces phase 8's original lobby
    (seat-claiming and chicken-picking were the same action, predators
    picked manually by the host) with a flow matching the physical game
    much more closely, driven by a correction mid-design: predators are
    randomly selected for the whole table *before* anyone sees a chicken,
    not after (the physical rules "randomly select 3 predators at the
    start of the game" places this first).
    Engine (`engine/src/setup.ts`): exported the previously-private
    `bossPool`/`allFourPool` species-pool functions so the UI's difficulty
    blurb can read them directly; new `randomizePredatorSelection` covers
    every difficulty level, not just 5+ — levels 7-8 still draw from the
    named closed species list, levels 5-6 still constrain only the Boss to
    its pool, but levels 1-4 (and the free regular-3 slots at 5-6) now
    auto-randomize from the full roster instead of requiring manual entry.
    This also meant correcting `core_rules.md`'s "never part of this
    randomization pool at any difficulty" note — that exclusion only ever
    applied to the levels 7-8 pool; the 8 predators it named are eligible
    everywhere else. New `dealChickenChoices` deals 2 distinct chicken
    candidates per player from one shared shuffle (Eggspansion-filtered),
    guaranteeing no name is ever dealt to two players.
    Firestore schema (`ui/src/remoteSession.js`): `sessions/{code}` now
    tracks named `seats` (not chicken picks), a `predators` selection and
    `dealtChickens` map set once at Start Game, and a `chosenChicken` map
    filled in as each player locks in. Seat-claiming (`joinAndClaimSeat`)
    is the one write that goes through a Firestore transaction rather than
    phase 8's default last-write-wins — two devices racing to claim "the
    next open seat" without one could silently drop a player, a worse
    failure than the general concurrent-write tradeoff accepted elsewhere.
    UI: new `landing.js` (Create/Join Game), `createGame.js` (player
    count/Eggspansion/difficulty as pill buttons, matching a reference
    screenshot, with a difficulty blurb generated live from the engine's
    own modifier functions so it can't drift out of sync), `joinGame.js` +
    `nameEntry.js` (shared by both entry paths), a rewritten `lobby.js`
    (named seats, Start Game gated on every seat filled), and
    `chickenDraft.js` (a "This Game's Predators" panel — the 3 revealed
    regulars plus a hidden-Boss placeholder — above each player's own 2
    dealt candidates, shown with full stage 1-3 stats/abilities; clicking
    highlights, a separate Lock In button commits). `app.js`'s screen is
    now re-derived from the synced doc on every snapshot end-to-end
    (`landing` → `createGame`/`joinGame` → `nameEntry` → `lobby` →
    `chickenDraft` → `game`/`gameOver`), and the old local hotseat form
    (`ui/src/setup.js`) is deleted — every game is a session now. Player
    display names are threaded through `Board`/`PlayerPanel`/`ActionBar`/
    `TurnControls` so the game screen shows names instead of `p1`/`p2`.
    9 new engine tests (164 total, zero regressions). Verified against the
    real `ft-dupe` project with an extended standalone Firestore REST
    script exercising the full schema end-to-end (create → two seats join
    → predators randomized + chickens dealt → both lock in → final state
    published) — same caveat as phase 8: this confirms the schema and
    engine logic, not an actual browser click-through, which I can't do
    myself here.

11. **The 75 "needs hook" (H) items — in progress.** Prompted by a real bug
    report (Sal Moe Nella's Food Stash Loot Drop did nothing after she was
    defeated). Phases 6-7 explicitly built only the 175 "executable now"
    items from `docs/rules-audit.md` and left every H item a no-op; no
    later phase came back for them until now. Grouped into batches by hook
    *shape* (matching `rules-audit.md`'s own "recurring shapes" grouping)
    rather than tackled item-by-item — each batch adds one reusable
    primitive and wires every item needing that shape through it, and each
    lands independently tested/buildable. `docs/rules-audit.md`'s H/E
    classification table is left as-is (a historical phase-2 snapshot,
    same as phases 6-7 treated it) — this doc is the implementation-status
    tracker.

    **11a. Board-state "stash"/charge Loot Drops — done.** Eggsmeralda's
    Egg Stash, Sal Moe Nella's Food Stash, Cleopoultra's Arrow Pack, plus
    closing a related gap for Professor Moltiarty's Gas Mask (classified
    "executable" but never wired to an activation action). New
    `PlayerState.lootCharges: Record<string, number>` (predator name ->
    remaining count, granted alongside `lootDrops` at defeat time, kept
    through death like Loot Drops themselves) and `PredatorState.
    returnAttackReductionToday` (Gas Mask's "-1 for an entire day," reset
    every day in `turn.ts`'s `advanceDay`). New `PredatorLoot` fields in
    `abilities/types.ts` (`stash`, `chargedRangedAttack`,
    `activatableAttackReduction`) populated in `abilities/predators.ts`'s
    `PREDATOR_LOOT`. Three new free (no-action-cost, "playable any time")
    actions in `actions.ts`: `collectFromStash` (self or a nearby player,
    same nearby-check shape as `giftFood`), `useGasMask`; `useArrowPack` is
    the one exception — it's a real ranged Attack, costs 1 action + 1 food
    per arrow, no return attack.
    Along the way, refactored `combat.ts`'s predator-defeat consequences
    (Loot Drop grant, permanent stat patches, Revenge, Boss reveal) out of
    `resolvePredatorAttack` into a shared `grantPredatorDefeatConsequences`,
    and added `applyDirectPredatorDamage`/`applyDirectGrubDamage` on top of
    it for damage sources that bypass the normal Attack pipeline entirely
    (Arrow Pack's ranged shot, a Bonus/Grub card's `enemyDamage` effect).
    This also **fixed a real, pre-existing bug**: `actions.ts`'s
    `resolveCardEffect` previously handled a card's `enemyDamage` by
    directly clamping the target's health with no defeat handling at all —
    a Bonus/Grub card landing the killing blow on a Predator left it at
    0 health but `defeated: false` forever (no Loot Drop, no Boss reveal,
    and it silently blocked the win check since `evaluateGameStatus` checks
    `defeated`, not health). Now routes through the same helper Arrow Pack
    uses. UI: `playerPanel.js`'s Loot Drops list gained inline controls per
    activatable Loot Drop (`StashControls` for the amount/recipient picker,
    reusing `board.js`'s existing `pendingPick`/`cardTarget` board-click
    flow for Gas Mask/Arrow Pack's Predator-or-Grub target, the same
    mechanism phase 7's card Play buttons already use).
    10 new tests in `engine/test/abilities-predatorLoot.test.ts` (174
    total, zero regressions) covering both Stash Loot Drops, Gas Mask's
    daily reset, Arrow Pack (including that it still grants loot/reveals
    the Boss on a kill), and the `enemyDamage` regression fix. Same
    standing caveat as every UI-touching phase: syntax-checked and
    confirmed served by the dev server, not click-through tested.

    **11b-11j — done (engine).** Closed every remaining "needs hook" item
    except Mudslide (11k, see below), 51 new tests across 8 new
    `engine/test/abilities-*.test.ts` files (225 total, zero regressions),
    `tsc` clean throughout. One batch per commit-sized slice of work, same
    grouping-by-hook-shape approach as 11a:
    - **11b** (global roll-outcome overrides): Monocle (never dodged/
      whiffed, checked centrally in `combat.ts`'s `resolveCombat`) and Fox's
      Staff (roll the Predator-effect roll twice, keep the milder result).
    - **11c** (action-economy exceptions): Nobility, Landlord, Chamberstick,
      Cave Hoard, Healing Poultice, Secret Tunnels — all new free (no
      action-cost) `Action` variants in `actions.ts`, matching the existing
      `giftFood`-style pattern. UI: real buttons in `actionBar.js` (Nobility/
      Landlord) and `playerPanel.js`'s Loot Drops list (the other 4).
    - **11d** (cross-actor auras & reactive listeners): Battle Cry,
      Bolsterer, Free Range/Bird Flu, "Not really a miss," Smallest
      Chicken/Garden Snail (`tagAlong` — UI button in `actionBar.js`), Chew
      Bawka's dynamic return attack. New `abilities/chickens.ts` aura
      helpers (`sumNearbyAura` and friends) consulted at every roll/
      max-attack-strength site touched so far. Also folded in Freezing
      (forced Coop lockdown + Eat-inside override) since it shares Fur
      Coat's location-override shape.
    - **11e** (multi-target/redirected combat): Shere Corn's splash,
      Weasma and Clawnk's forced relocation, Wasp Swarm's
      reflected damage, Quite Friendly (`attackWithCompanion`, a documented
      simplified interpretation — see the function's own comment), Tank
      (`attack()`'s new `damageRedirect` param, finally making Just Reward
      live).
    - **11f** (roll interception): Strategem, Deus Eggs Machina, "Reroll a
      teammate's/any die," Spotted Lanternfly. New `PlayerState.
      pendingRollIntercept`, deliberately scoped to a player's own next
      production/forage/lay-egg/Predator-effect roll — not a literal
      global interceptor on every `rollDie()` call in the engine (see the
      field's doc comment for the full reasoning).
    - **11g** (on-demand shared-deck/schedule manipulation): Wherever Any
      Weather, Coopella, Firefly, "Draw new weather," Ice Melts, Sheriff of
      Rottingham (return attack driven by live Grub-deck health), Dungeon
      Keys, Dung Beetle, Tomb Raider. `drawNextWeatherCard`/new
      `redrawWeatherCard` moved from `turn.ts` to `abilities/weather.ts` to
      break a circular-import problem (both `turn.ts` and `combat.ts` need
      it now).
    - **11h** (structural death/revival/defeat exceptions): Gravekeeper
      Fowl (`cannotBeAttackedToday`, on-defeat revival roll that undoes the
      Boss reveal too) and Gravekeeper's Light (self-revive at 1 health —
      wired directly into `combat.ts`'s `applyDamageAndMaybeDeath`, the one
      choke point every death in the game already routes through).
    - **11i** (ability/effect copying): "Borrow a teammate's ability" (new
      `PlayerState.pendingBorrowedAbility` — a chicken/stage *reference*,
      not the ability object itself, since that can hold functions and
      wouldn't survive Firestore sync; wired into the "free action" gate
      checks across `actions.ts` — a deliberate scope limit, not every
      aura/roll-modifier/combat-hook call site) and Lucky Cricket (copies a
      teammate's held Bonus Card effect without spending their card).
    - **11j** (remaining one-offs): Informant Network, Plots & Ploys (a
      held Grub's health shields return-attack damage), Bacaw!/Dedication
      (new `GameState.boardEggs` — a shared board resource anyone at that
      location can collect), Wilderness Guide, Portable House, Eggsmeralda
      S2/S3 ("take eggs from every player"), Owl Coopone (modeled as a
      per-combat self-heal while its matching weather is active, not a
      permanent maxHealth change — its "can't use cards to dodge" clause is
      deliberately out of scope, see the code comment for why), Four Leaf
      Clover, Snow's last-phase ad-hoc Egg Exchange, "Move everyone for
      free."
    - **UI gap — closed.** The ~25 actions from 11b/11d(partial)/11e/11f/
      11g/11h/11i/11j that were engine-correct but had no board/panel
      control now do:
      - `actionBar.js` (turn-scoped, consumes an action or the once-per-
        turn free-ability slot): Strategem (General Tso, target + eggs +
        direction picker), Deus Eggs Machina (J.R.R. Yolkien, target
        picker), Wherever Any Weather (Chickira, plain button), Wilderness
        Guide (Aracorn, target + destination picker), Attack with
        Companion (Cluckleberry Finn's Quite Friendly — new `pendingPick`
        flow: pick a nearby companion, then a target on the board via the
        same reachability-checked click as a normal Attack, then both
        players' strengths), and Tomb Raider (Eggatha Christie — a
        discard-pile picker scoped to the player's own inside/outside
        side, since raiding the wrong side isn't legal).
      - `playerPanel.js` (any-time actions, per the engine's own
        `requireAlive`-only gating): Portable House and Dungeon Keys join
        the existing Loot Drop controls list (both nearby-teammate-or-self
        pickers, matching their actual nearby rule — unlike the Stash
        Loot Drops, which the engine really does let you gift to anyone
        regardless of location); `useFreeMoveGrant` ("Move everyone for
        free") and Snow's ad-hoc Egg Exchange appear as their own prompts
        near the top of a player's panel when pending/available; a
        board-egg "Collect egg here" button appears whenever `boardEggs`
        has one at the player's current location (Bacaw!/Dedication).
      - `PlayCardControls`/`cardInputShape` (shared by both the Bonus Card
        and Grub Card lists) gained 4 more effect shapes: borrowing a
        teammate's ability (teammate picker + a stage picker capped at
        their actual stage), Lucky Cricket (teammate picker + a picker
        over *their* held Bonus Cards, not your own), and "reroll a
        teammate's/any die" + Spotted Lanternfly (both allow targeting
        yourself, unlike every other teammate-picker card — a `PlayCard
        Controls` first). The latter two were an incidental find: they'd
        been silently broken (no target picker at all, so playing them
        always hit the engine's "this card requires a target" error)
        since 11f landed, despite reaching engine-tested/dispatchable
        status — caught while extending the same generic mechanism for
        the two items above.
      Automatic/passive effects (Owl Coopone's weather bonus, Eggsmeralda's
      egg loss, Coopella's roll, Battle Cry's aura, Gravekeeper Fowl's
      revival, etc.) never needed a button and already worked end-to-end.
      Standing caveat unchanged: syntax-checked and dev-server-served, not
      click-through tested (no browser automation tool in this
      environment) — worth a manual pass.
    - **Rules clarification, applied**: Sunny/Nighttime's "once during
      this phase" adjustment was previously auto-applied on the player's
      *first* turn of the phase (`turn.ts`'s `startTurn`). Confirmed with
      the table: it's the player's choice which of their turns in the
      phase it lands on. Reworked as an explicit action
      (`useWeatherActionAdjustment`, `turn.ts`) triggered from a button in
      `actionBar.js` that appears once per phase while Sunny/Nighttime is
      active and unused; `startTurn` no longer touches it at all (ordinary
      per-turn weather effects — Tornado's random roll, Earthquake's
      redraw — are unaffected, still automatic).

    **11k. Mudslide (Eggspansion weather) — done.** Landed after a scoping
    conversation (deferred initially since it breaks the base model's
    assumption that `GameState.weather.active` is one shared card
    everyone reads) resolved two open questions:
    - **How "deal each player a personal card" actually works**: it's a
      one-time event at the moment Mudslide is drawn, not an ongoing
      per-player deck — the printed text ("shuffle *the rest of* the
      Summer deck") already describes it as a single deal-out, not a
      recurring one. New `WeatherEffect.dealsPersonalWeatherOnDraw` flag
      (Mudslide only) and `PlayerState.personalWeatherOverride: {season,
      cardIndex} | null`, resolved in `abilities/weather.ts`'s
      `drawNextWeatherCard` right alongside Freezing's existing "immediate
      side effect on draw" handling. Dealt cards are removed from the
      season's remaining deck (a real deck would run out); if there aren't
      enough distinct cards left for every alive player, deals with
      replacement rather than failing (disclosed in the code, not a
      realistic table state at 6 base Summer cards vs. typical player
      counts). Every player's override clears automatically the moment
      Mudslide is replaced by the next drawn card, same function.
    - **How predator stats that depend on weather work when players are
      experiencing different weather** (Owl Coopone's "+N health while
      [card] is active"): ruled that it resolves from the *attacking*
      player's personal weather, at the moment of that attack — confirmed
      this needs no compromise, since Owl Coopone's bonus was already
      modeled (for an unrelated reason, back in 11j) as a per-combat
      self-heal evaluated fresh each attack rather than a persisted stat,
      and the attacker is always known at that instant
      (`CombatContext.attackerId`). It turned out to be the *only*
      predator stat that's weather-conditional at all.
    `activeWeatherEffect`/`activeWeatherName` (`abilities/weather.ts`)
    gained an optional `playerId` param: pass one to prefer that player's
    override over the shared card (only takes effect while the shared
    card is actually Mudslide); omit it for genuinely global/no-single-
    actor checks (Ice Melts' daily Grub discard, Bird Flu's day-end
    proximity check — neither can ever coexist with Mudslide anyway, being
    different seasons). Every other call site across `turn.ts`/
    `actions.ts`/`combat.ts`/`abilities/predators.ts` already had the
    relevant player in scope, so threading it through was mechanical
    everywhere except one spot: `advanceDay`'s outgoing-phase-boundary
    resolution (Flash Flood's food wipe, Pouring Rain's Egg Exchange skip,
    Snow's bonus) applied some effects globally and only walked players
    for others — unified into one per-player pass so a personal Flash
    Flood, say, only discards that one player's food. UI: `playerPanel.js`
    shows a player's personal card (name + effect text) whenever one is
    set, since the board only ever displays the shared card — misleading
    on its own once Mudslide is active. 5 new tests in `engine/test/
    abilities-mudslide.test.ts` (231 total, zero regressions): the deal-out
    itself, per-player resolution, override clearing on replacement, Owl
    Coopone resolving per-attacker, and the phase-boundary fix.

    **Bonus Card hand-limit discard — bug fix, base game (not a phase 11
    item).** `core_rules.md` says "hand limit 2" with no discard rule at
    all. The actual engine bug: every card-gaining path (`drawCard`,
    `useCaveHoard`, `payEggForCard`, `drawTwoKeepOne`, "take a card from
    discard," and multi-card grants like Cave Hoard's draw effect) hard-
    blocked outright once a player was at the limit, with no way to ever
    discard — reported in `docs/playtest-feedback.md`. Table ruling: you
    can only discard once your hand is actually *over* the limit (never
    proactively), it's free, and you choose which card, including one you
    just gained. Fix: every one of those gain paths now always succeeds
    (a hand can temporarily exceed its limit); a new `discardBonusCard`
    action removes any held card once actually over, surfaced as a
    "Discard" button per card in `playerPanel.js`'s Bonus Cards list, only
    rendered while over the limit. `giveBonusCards` (the multi-card-grant
    helper) no longer silently drops cards that don't fit — they enter the
    hand and become subject to the same discard step; a card's own printed
    "keep K, give M, discard the rest" split (e.g. Dragonfly) is untouched,
    since that's a different concept from the hand limit. 3 tests in
    `engine/test/actions.test.ts` updated/added for the new behavior
    (drawing into a full hand, `discardBonusCard`'s own guard rails); 2
    tests in `abilities-grubRewards.test.ts` (Dragonfly, Mosquitoes) had
    stale expected counts baked in from the old silent-drop bug, corrected.
    232 tests total, zero regressions.

    **11e correction: Weasma and Clawnk's destination is a player choice,
    not engine-random.** The printed effect text literally says "pick your
    destination" — the original 11e call to model it as engine-random (the
    same precedent used for "reroll your own die") didn't actually fit
    here; flagged by the table. Fixed: combat no longer picks a
    destination itself — it flags the mover (new `PlayerState.
    pendingForcedRelocation`, `combat.ts`) and leaves their location
    unchanged. A new `completeForcedRelocation` action (any location other
    than the one they're being moved out of) resolves it, surfaced as a
    picker in `playerPanel.js` that only appears while the flag is set.
    The stage 3 clause's *other* random element — which of several
    teammates at the location gets forced out, when the roll says "a
    teammate" rather than "you" — is untouched, since the table's
    correction was specifically about the destination, not who moves.

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
