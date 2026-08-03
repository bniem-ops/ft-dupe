# Rules-Interaction Audit (Phase 2)

Working document for `docs/engine-plan.md` phase 2: classify every chicken
ability, predator effect/loot drop, weather effect, Bonus Card, and Grub
Card as one of:

- **Executable now (E)** — self-scoped numeric/trigger effect (immunity,
  stat delta, starting resource, roll bonus on your own roll, resource-for-
  effect exchange). A generic data-driven ability layer handles these
  without per-card special-casing.
- **Needs an engine hook (H)** — mechanically clear, but bypasses a
  structural rule (location restriction, action economy, hand limit) or
  reaches across to another actor/shared state (aura effects on others'
  rolls, damage redirection, moving another player, board-state tokens
  anyone can collect, on-demand deck manipulation). Needs a deliberate
  extension point in the phase 3/4 engine, not just a config value.
- **Ambiguous (A)** — contradicts something stated elsewhere in
  `core_rules.md`, references a concept that's never defined, or is
  missing a spec (tie-break rule, action cost) needed to implement it at
  all. Needs your read of the physical rulebook.

This is a living document — classifications are a first pass and may
shift once related abilities/cards are cross-checked against each other.

## Status

- [x] Chickens (51 abilities across 17 chickens × 3 stages)
- [x] Predators (64 items: 3 stage effects + 1 loot drop × 16 predators)
- [x] Weather (21 effects: 18 base + 3 Eggspansion)
- [x] Bonus Cards (66 cards, 27 unique effects)
- [x] Grub Cards (24 cards, 48 items: defend Effect + kill Reward each)

**Grand total: 175 executable now / 75 needs hook / 0 ambiguous, out of 250 items.** Every category closed with zero open questions:

| Category | Items | Executable now | Needs hook | Ambiguous |
|---|---|---|---|---|
| Chickens | 51 | 32 | 19 | 0 |
| Predators | 64 | 29 | 35 | 0 |
| Weather | 21 | 16 | 5 | 0 |
| Bonus Cards | 66 | 57 | 9 | 0 |
| Grub Cards | 48 | 41 | 7 | 0 |
| **Total** | **250** | **175** | **75** | **0** |

30% of everything in the game needs a deliberate engine hook rather than falling out of a generic data-driven modifier layer. Per phase 2's goal, this now feeds phase 5/6 (and phase 4, for the predator/Grub combat-specific ones): group the 75 "needs hook" items by the *shape* of hook they need, not by which card/ability/effect they came from — the same handful of shapes recur across every category (see each section's notes above). A first pass at those shared shapes, tallied across all 5 categories:

- **Cross-actor / aura effects** — modifying another player's or predator's roll, stat, or resources (Battle Cry, Bolsterer, Shere Corn's splash, teammate-targeted Loot Drops, "Reroll a teammate's die").
- **Unbounded roll scope** — "any die roll" with no actor restriction (Strategem, Deus Eggs Machina, "Reroll any die," Spotted Lanternfly).
- **Location-restriction overrides** — bypassing an action's normal Inside/Outside requirement (Informant Network, Fur Coat, Freezing weather, Four Leaf Clover, Arrow Pack).
- **Action-economy exceptions** — free actions, extra actions, or bypassing the once-per-season Extra Action Token limit (Landlord, Nobility, Long Shanks, "2 extra actions," Coopella's loot).
- **Shared-deck / board-state manipulation** — on-demand weather redraws, Grub-deck references, board-placed eggs anyone can collect, discard-pile searches (Wherever Any Weather, Sheriff of Rottingham, Bacaw!, Dedication, Dung Beetle, Firefly).
- **Multi-actor combat participation** — a second attacker joining one Attack, damage redirection between players, damage reflected back onto a predator (Quite Friendly, Tank, Wasp Swarm).
- **Dynamic ability/effect copying** — temporarily binding another actor's ability or card effect to the caster (borrowed ability, Lucky Cricket).
- **Structural exceptions to death/revival/defeat** — bypassing Brood, predator revival resetting the win check (Gravekeeper Fowl, Gravekeeper's Light).

---

## Chickens

| Chicken | Stage | Ability | Class | Note |
|---|---|---|---|---|
| Shellock Holmes | Chick | Naturalist | E | Immunity flag + starting-resource grant — both generic patterns. |
| Shellock Holmes | S2 | Informant Network | H | Location-check override on Attack targeting Grubs (the plan's own worked example). |
| Shellock Holmes | S3 | Plots & Ploys | H | Confirmed: defeating a Grub gives you the card (no hand limit, per `core_rules.md`), held/playable like a Bonus Card until discarded. This ability additionally lets a held Grub's health absorb your damage as a shield, gated by its own damage state (discard when fully damaged; can't use the effect once injured). Needs a hook for redirecting incoming damage to a held card's health pool. |
| Beowing | Chick | Stargazer | E | Immunity + starting resource. |
| Beowing | S2 | Battle Cry | H | Passive aura modifying *other* actors' die rolls — needs a broadcast/event hook, not a self-only modifier. |
| Beowing | S3 | Berseker | E | On-damage-taken trigger, self-scoped roll → heal. |
| Wyatt Chirp | Chick | Hardtack | E | Starting resource. |
| Wyatt Chirp | S2 | Payback | E | On-missed-production-roll trigger, self-scoped. |
| Wyatt Chirp | S3 | Thick Feathers | E | Self stat modifier (return-attack damage reduction). |
| Madam Chickovsky | Chick | Cold-Hardy | E | Immunity to two named weather effects. |
| Madam Chickovsky | S2 | Ladies' Aid | E | Confirmed: Madam Chickovsky's own ability text is the exception the no-trading rule allows for. Confirmed no action cost — an optional per-turn effect, not one of the 2 actions. Self-scoped trigger + resource gift. |
| Madam Chickovsky | S3 | Fur Coat | H | Location override — Inside-only actions (Lay Egg/Heal/Brood) now usable Outside. |
| Cluckleberry Finn | Chick | Endowment | E | Starting resource. |
| Cluckleberry Finn | S2 | Quite Friendly | H | Second attacker joins one Attack action — base combat resolution assumes a single attacker. |
| Cluckleberry Finn | S3 | Superior Product | E | Rate modifier on a well-defined event (Egg Exchange). |
| Eggatha Christie | Chick | Warm-Hardy | E | Starting resource + immunity. Note: text has "Drough" — confirm it's "Drought." |
| Eggatha Christie | S2 | The Forager | E | On-Forage roll modifier, self-scoped. |
| Eggatha Christie | S3 | Tomb Raider | H | Confirmed: two face-up Grubs (one per location) are attackable day to day; one gets discarded to the shared Grub discard pile at end of day (per `core_rules.md`'s daily-discard rule), and used/exhausted Grubs land there too. Tomb Raider lets Eggatha specifically attack cards sitting in that discard pile ("revived") — once its Reward is used, that card is removed from the game entirely rather than cycling back into the reshuffle. Needs a hook treating the discard pile itself as an attackable target pool, plus permanent removal. |
| Cumberbill Rockefeather | Chick | Long Legs | E | Starting resource + immunity. |
| Cumberbill Rockefeather | S2 | Landlord | H | Confirmed unlimited: Cumberbill can Move Inside for free as many times as the turn allows (in practice capped by needing another player's Bonus/Grub card to grant an extra Move Outside, since only the Inside direction is free). Needs an action-economy exception hook on the Move action, scoped to one direction. |
| Cumberbill Rockefeather | S3 | Dandy | E | Broad immunity flag (all negative weather) — still a simple check. |
| Annie Yolkley | Chick | Endowment | E | Starting resource. |
| Annie Yolkley | S2 | Bacaw! | H | Creates a board-state egg token at a location, collectible by *any* player there — new shared-resource-on-map mechanic, not just a personal effect. |
| Annie Yolkley | S3 | High Producer | E | Confirmed: two independent Production rolls, both apply — up to 2 eggs per production. Self-scoped, now fully specified. |
| General Tso | Chick | Traveler | E | Setup-time positional choice + starting resource. |
| General Tso | S2 | Foresight | E | Clean action modifier: draw 2, keep 1. |
| General Tso | S3 | Strategem | H | "Adjust the roll of any die by 1" — broad scope (any roll in the game, not just your own), same shape as Battle Cry. Needs a generic roll-interception hook. |
| Wingston Coophill | Chick | Misdirection | E | Self-scoped damage mitigation via resource cost, clear formula. |
| Wingston Coophill | S2 | Smallest Chicken | H | Piggyback movement triggered by *another* player's action. |
| Wingston Coophill | S3 | Evasion | E | Self-scoped roll granting dodge on your own attack — dodge mechanic already defined in `core_rules.md`. |
| Atilla the Hen | Chick | Big-Boned | E | Immunity + starting resource. |
| Atilla the Hen | S2 | Tank | H | Damage redirection between players — base combat resolution applies damage to the attacker/target only. |
| Atilla the Hen | S3 | Just Reward | E | Resource grant on the "took damage for another player" event — but that event only exists once Tank's hook (above) is built; dependent on it. |
| Princess Layer | Chick | Nobility | H | "Refresh your Extra Action Token" — the Token is explicitly once-per-season in `core_rules.md`; this bypasses that limit via a resource cost. Needs an exception hook on the season-resource system. |
| Princess Layer | S2 | Well-Laid Plans | E | Self-scoped action roll modifier, clear. |
| Princess Layer | S3 | Eggpire Strikes Back | E | Damage mitigation via resource, clear formula. |
| Chickira | Chick | Endowment | E | Starting resource. |
| Chickira | S2 | Wherever, any Weather | H | Player-triggered weather-deck draw outside the normal Egg-Exchange cadence — manipulates shared deck state on demand. |
| Chickira | S3 | Shake it Off | E | On-missed-production-roll trigger, self-scoped (same shape as Payback). |
| Broods Lee | Chick | Revenge | E | On-Predator-defeated trigger, self-scoped, "present" maps cleanly to location. |
| Broods Lee | S2 | Adrenaline | E | Conditional self stat modifier, clear. |
| Broods Lee | S3 | Bolsterer | H | Aura modifying *other* players' stat — same shape as Battle Cry. |
| J.R.R. Yolkien | Chick | Bookworm | E | Hand-limit override (just a number) + immunity to Grub damage, both simple. |
| J.R.R. Yolkien | S2 | Dedication | H | Same board-state egg-token mechanic as Bacaw!, plus requires tracking "same action taken twice this turn" within a single turn. |
| J.R.R. Yolkien | S3 | Deus Eggs Machina | H | Immunity (fine alone) but "reroll any die" is broad-scope, same shape as Battle Cry/Strategem. |
| Cluck Norris | Chick | Not really a miss | H | Second clause ("if a nearby teammate misses an attack, gain 1 food") requires listening to *another* player's attack-miss event. |
| Cluck Norris | S2 | Always on Purpose | E | Explicit "Free Action," self-scoped resource exchange, clear. |
| Cluck Norris | S3 | Quick Claws | E | Explicit "Free action," self-scoped, clear. |
| Aracorn, Heir of Condor | Chick | Free Range | H | "Everyone in your location is immune to Bird Flu" — grants immunity to *other* players, cross-actor. |
| Aracorn, Heir of Condor | S2 | Long Shanks | E | Explicit "Free action," self-scoped — matches the clean once-per-turn pattern (contrast with Landlord above). |
| Aracorn, Heir of Condor | S3 | Wilderness Guide | H | Immunity is fine alone, but "pay an egg to move another player" acts on another player's position — cross-actor. |

**Chickens summary: 32 executable now / 19 needs hook / 0 ambiguous** (out of 51). All 5 originally-ambiguous items were resolved via user clarification (see git history / conversation for the reasoning behind each reclassification above).

### Confirmed core mechanic (from the Plots & Ploys / Tomb Raider clarifications)

Defeating a Grub transfers the card to the killer (no hand limit, per `core_rules.md`), where it's held and playable like a Bonus Card at any time, then discarded to the shared Grub discard pile. Two Grubs are face-up and attackable at any time (one per location); one gets discarded to the shared pile at the end of each day per the existing daily-discard rule, and used-up Grubs land there too. This was already implied by `core_rules.md`'s Grubs section ("No hand limit... single-use like Bonus Cards... playable any time") — worth keeping in mind for every Grub Card's `reward` field: it's a held, played-on-demand effect, not an immediate on-kill effect.

---

## Predators

Every predator has 3 stage effects (roll table applied when the predator is
attacked, per `core_rules.md`'s combat order) plus one Loot Drop (granted
to whoever lands the killing blow). A stage effect scoped to just "the
attacker" is the base case the combat engine is built around —
**executable now**. Anything reaching past the attacker (splash to
everyone nearby, "every player," scaling off a location/global chicken
count, weather-conditional predator stats, Grub-deck references, moving/
targeting another player) needs a dedicated hook, consistent with how
cross-actor chicken abilities were classified above.

| Predator | Item | Effect | Class | Note |
|---|---|---|---|---|
| Eggsmeralda | S1 | "4-6: heals 1 health" Cannot heal after defeat | E | Predator self-heal on its own combat-step roll — same resolution step as everything else here. |
| Eggsmeralda | S2 | "3-4: Take egg from attacker. 5-6: Take egg from every player" | H | "every player" clause reaches beyond the attacker. |
| Eggsmeralda | S3 | "3-4: Take 2 eggs from attacker. 5-6: Take 2 eggs from every player" | H | Same as S2. |
| Eggsmeralda | Loot | Egg Stash — 3 eggs on card, distribute to nearby players, immune to predator/weather effects (Permanent) | H | New object type: a shared stash with its own immunity flag, distributed to others. |
| Sal Moe Nella | S1 | "4-6: may not Eat until next Egg Exchange" | E | Single-actor status effect with a well-defined expiry. |
| Sal Moe Nella | S2 | "3-4: not Eat. 5-6: not Heal" (until next Egg Exchange) | E | Same shape. |
| Sal Moe Nella | S3 | "1-3: not Eat. 4-6: not Heal" (until next Egg Exchange) | E | Same shape. |
| Sal Moe Nella | Loot | Food Stash — same shape as Egg Stash (Permanent) | H | Same reasoning as Egg Stash. |
| Professor Moltiarty | S1 | Attacker skips free food production until next Egg Exchange | E | Single-actor status effect. |
| Professor Moltiarty | S2 | "4-6: Attacker may not participate in next Egg Exchange" | E | Single-actor status effect. |
| Professor Moltiarty | S3 | Attacker may not participate in next Egg Exchange (guaranteed) | E | Same, no roll needed. |
| Professor Moltiarty | Loot | Gas Mask — predator's attack -1 for a day, used on a nearby Predator (Single Use) | E | Single-target duration-bound stat modifier, doesn't reach other players. |
| Gravekeeper Fowl | S1 | Can't be attacked the day a player moves in; on defeat, 5-6: revives with 1 health | H | Confirmed: revival resets it to not-defeated — the team must land another killing blow for the win condition to count it. Needs a hook that un-sets the "defeated" flag and re-arms the predator for win-check purposes. |
| Gravekeeper Fowl | S2 | Same, revives with 2 health | H | Same confirmed mechanic. |
| Gravekeeper Fowl | S3 | On defeat, 5-6: revives with 3 health | H | Same confirmed mechanic. |
| Gravekeeper Fowl | Loot | Gravekeeper's Light — self-revive at 1 health (single-use) | H | Bypasses the normal Brood-required revival flow — a card-based exception, same pattern as Ladies' Aid being the ability that licenses its own exception. Mechanically clear, just needs a hook. |
| Owl Coopone | S1 | +2 health/+1 attack during Nighttime; can't use Bonus/Grub Cards to dodge | H | Predator stats conditional on the active weather card (new cross-system link) + disables the card-based dodge mechanic seen elsewhere in the data. |
| Owl Coopone | S2 | +3 health during Sunny; can't use cards to dodge | H | Same shape. |
| Owl Coopone | S3 | +4 health during Snow; can't use cards to dodge | H | Same shape. |
| Owl Coopone | Loot | Monocle — never miss any attacks (permanent) | H | Global override of every miss-mechanic in the game (Fog weather, Evasion, etc.), not just a personal stat. |
| Hens Gruber | S1 | "3-4: Lose 1 food. 5-6: Lose 2 food" | E | Single-actor resource loss on roll. |
| Hens Gruber | S2 | "1-2/3-4/5-6: Lose 1/2/3 food" | E | Same shape. |
| Hens Gruber | S3 | "1/2-4/5-6: Lose 1/2/3 food" | E | Same shape. |
| Hens Gruber | Loot | Bandit Mask — Predator attacks to you are -1 (multi-use) | E | Simple self stat modifier. |
| Shere Corn | S1 | "4-6: All nearby players take 1 splash damage" | H | Splash hits multiple actors, not just the attacker. |
| Shere Corn | S2 | Splash 1/2/3 damage by roll tier | H | Same shape. |
| Shere Corn | S3 | Splash 1/2/3 damage by roll tier | H | Same shape. |
| Shere Corn | Loot | Signature Cloak — +1 health capacity (permanent) | E | Simple self stat modifier. |
| Chicksune | S1 | Immune to Bonus Card effects | E | Predator-side immunity flag, generic pattern. |
| Chicksune | S2 | "Roll for predator heal. 5: heal 1. 6: heal 2." Cannot heal after defeat | E | Self-heal on the combat-step roll, same as Eggsmeralda. |
| Chicksune | S3 | "4: heal 1. 5: heal 2. 6: heal 3." Cannot heal after defeat | E | Same shape. |
| Chicksune | Loot | Fox's Staff — roll for Predator effect twice, pick best (permanent) | H | Modifies how the Predator Effect roll resolves — a meta-modifier on an existing system, not just a value. |
| Cleopoultra | S1 | "5-6: dodges attack, you only suffer -1 return attack" | E | Self-contained per-combat outcome. |
| Cleopoultra | S2 | Same shape | E | |
| Cleopoultra | S3 | "4-6: dodges attack, -1 return attack" | E | Same shape. |
| Cleopoultra | Loot | Arrow Pack — ranged attack, -1 health per arrow, 1 action + 1 food/arrow (multi-use) | H | Confirmed: 3 arrows total held on the card (same "charges on a card" shape as Egg/Food Stash), 1 arrow per action (so using all 3 costs 3 separate actions/food, spread across however many turns it takes) — no "must be nearby" requirement since it's ranged. Location-override + finite-charge resource, needs a hook. |
| Ursula Bone | S1 | "4-6: Return attack +1" | E | Simple return-attack modifier. |
| Ursula Bone | S2 | "2-5: +1. 6: +2" | E | Same shape. |
| Ursula Bone | S3 | "1-2: +1. 3-5: +2. 6: +3" | E | Same shape. |
| Ursula Bone | Loot | Brass Knuckles — +1 attack (permanent) | E | Simple self stat modifier. |
| Chew Bawka | S1 | Return attack +1 per chicken in the Coop | H | Scales off a global count, not a self stat. |
| Chew Bawka | S2 | Return attack +1 per teammate in this location | H | Scales off a location-scoped count — still a dynamic query, not a fixed value. |
| Chew Bawka | S3 | Return attack +1 per chicken in every other Outside location | H | Global-state query across multiple locations. |
| Chew Bawka | Loot | Healing Poultice — free action, heal everyone in your location 1 heart (multi-use) | H | Free action + heals every player in location, cross-actor. |
| Weasma and Clawnk | S1 | "Roll before attack. 4-6: Move out of this location" (no dmg, keep food, pick destination) | H | Per S3's explicit wording ("You are moved"), this displaces the *attacking player* and cancels the combat instance entirely — new hook, not just unclear phrasing. |
| Weasma and Clawnk | S2 | "3-6: Move out of this location", same parenthetical | H | Same shape as S1. |
| Weasma and Clawnk | S3 | "1-3: A teammate moves out. 4-6: You are moved out" | H | Confirms S1/S2's reading — displaces attacker or a teammate, cancels combat. |
| Weasma and Clawnk | Loot | Secret Tunnels — free Move for yourself or any nearby player (multi-use) | H | Free action + can move *another* player. |
| Hendel's Mother | S1 | Return attack +1 if you don't have a Bonus Card | E | Conditional modifier based on the attacker's own hand state — self-contained. |
| Hendel's Mother | S2 | "4-6: Discard a Bonus Card after combat" | E | Single-actor, well-defined. |
| Hendel's Mother | S3 | "3-4: Discard Bonus Card. 5-6: Discard Grub Card" | E | Same shape. |
| Hendel's Mother | Loot | Cave Hoard — free action, you or a nearby teammate draws a Bonus Card (multi-use) | H | Grants another player use of the Draw Card action outside their own turn's budget. |
| Coopella | S1 | "4: Exhaust Extra Action Token. 5-6: Draw new Weather Card (redraw on Fair)" | H | Forces a structural resource (Extra Action Token) + on-demand weather-deck manipulation, same shape as "Wherever, any Weather." |
| Coopella | S2 | Same shape (redraw on Sunny) | H | Same. |
| Coopella | S3 | Same shape (redraw on Snow) | H | Same. |
| Coopella | Loot | Chamberstick — everyone in your location may refresh Extra Action Tokens (multi-use) | H | Cross-actor + bypasses the once-per-season Extra Action Token limit, same shape as Nobility. |
| Layonardo | S1 | "1-3: can't leave location until next Egg Exchange. 4-6: take 1 return attack damage" | E | Self-contained status flag or simple damage. |
| Layonardo | S2 | "3-6: can't leave location until next Egg Exchange" | E | Same shape. |
| Layonardo | S3 | Same as S2 | E | Same shape. |
| Layonardo | Loot | Portable House — you or a nearby player ignore weather for one turn (multi-use) | H | Targets another player with a temporary immunity grant. |
| Sheriff of Rottingham | S1 | Roll before attack: return attack = max health of Inside or Outside Grub | H | Return-attack value computed from shared Grub-deck state — cross-system reference. |
| Sheriff of Rottingham | S2 | Return attack increased by max health of Inside or Outside Grub | H | Same shape. |
| Sheriff of Rottingham | S3 | Return attack = combined Inside + Outside Grub health; empty deck adds 1 | H | Confirmed the both-empty case can't actually occur: the existing "reshuffle discard and redeal into two new decks when both are empty" rule fires first, so there's always at least a fresh deal by the time this effect would check. No special-case needed beyond implementing that redeal rule. |
| Sheriff of Rottingham | Loot | Dungeon Keys — shuffle Grub discard, draw until two 1-health Grubs found, keep one give one (single-use) | H | Deck search-until mechanic + cross-actor gift; note the edge case if the discard pile never yields two 1-health Grubs. |

**Predators summary: 29 executable now / 35 needs hook / 0 ambiguous** (out of 64). All originally-ambiguous items resolved:

- **Gravekeeper Fowl** — revival resets it to not-defeated; must be re-killed for the win condition.
- **Sheriff of Rottingham S3** — both-decks-empty can't actually occur, since the existing discard-reshuffle rule fires first.
- **Arrow Pack** — 3 arrow charges held on the card, 1 arrow per action (1 food each), no location requirement.

---

## Weather

Weather is inherently global — most effects apply uniformly to whichever
player triggers/experiences them, so "self-scoped" here just means
"applies the same way to whoever it hits," not "restricted to one
specific actor" the way chicken/predator auras were. The "needs hook" bar
shifts accordingly: it means the effect **overrides a structural rule**
(an action's normal location restriction, the Egg Exchange's fixed
schedule), requires a **cross-player relational check** (proximity between
different players, not just one player's own state), introduces
**per-player personalized state** where the base model assumes one shared
active weather card, or **manipulates the shared Grub deck/board**.

| Weather | Season | Effect | Class | Note |
|---|---|---|---|---|
| Fair | Spring | If you Forage at least once on your turn, gain a bonus food | E | Self-scoped trigger on your own turn. |
| Freezing | Spring | Immediately enter the Coop, cannot leave. May Eat inside during this phase | H | The "may Eat inside" clause overrides Eat's normal Outside-only location restriction — a structural exception, even though it applies to everyone. |
| Nighttime | Spring | Once during this phase, perform 1 less action | E | Action-economy modifier, applies uniformly per player's turn. |
| Drought | Spring | Foraging requires 2 actions | E | Action-cost change on a specific action. |
| Pollen | Spring | Cannot Fight Grubs | E | Simple action-block flag for the phase's duration. |
| Bird Flu | Spring | Anyone who ends the day near another player loses 1 heart | H | Requires a proximity check *between* players, not a single player's own state — a new cross-player relational query at end-of-day. |
| Sunny | Summer | Once during this phase, perform 1 extra action | E | Extra-action grant, self-scoped per turn. |
| Lightning Storm | Summer | If you end your turn Outside, roll 1-2: lose 1 health | E | Self-scoped end-of-turn trigger + roll. |
| Flash Flood | Summer | All food discarded at end of this phase | E | Uniform resource wipe at a defined point — simple even though it hits everyone. |
| Tornado | Summer | At start of turn, roll 1-2: take 1 less action | E | Self-scoped per-turn trigger. |
| Pouring Rain | Summer | Skip next Egg Exchange | E | Modifies the shared day/season calendar the turn engine already owns — a simple schedule-skip flag. |
| Heat Wave | Summer | Immediately exit Coop, cannot re-enter | E | Movement lock with no action-override clause (contrast with Freezing) — same shape as Layonardo's predator effect. |
| Snow | Fall | Bonus 3 food if you join next Egg Exchange. "If in last phase, you may make exchanges during any turn" | H | Confirmed: "last phase" = the 3rd/final phase of Fall (the last 2 days before the game ends), not Snow's own duration. If Snow is drawn as that final phase's card, Egg Exchanges become ad-hoc (any turn) instead of only at the scheduled phase boundary — a schedule override scoped to this specific case. |
| Hail | Fall | -1 health every time you end your turn Outside | E | Self-scoped recurring trigger. |
| Daylight Savings | Fall | All Egg Production rolls require 4-6 | E | Simple parameter override on an existing roll's success threshold. |
| Severe Wind | Fall | Discard a food or egg if you end your turn outside | E | Self-scoped trigger with a player choice. |
| Fog | Fall | Roll before every attack, 1-2: miss (no return damage) | E | Self-scoped, plugs into the existing Attack/miss mechanic. |
| Dust Storm | Fall | Max Attack strength -1 | E | Simple stat modifier. |
| Ice Melts | Eggspansion (Spring) | At end of each day, discard the Grubs in both locations | H | Overrides the normal single-Grub daily-discard rule with a discard-both rule for the weather's duration — shared-deck manipulation. |
| Mudslide | Eggspansion (Summer) | Shuffle rest of Summer deck; deal each player a personal Weather Card in effect until replaced | H | Introduces per-player individual weather state — the base model assumes one shared active card; this is a structural departure. |
| Earthquake | Eggspansion (Fall) | If you hold a Bonus Card at start of turn, discard one and draw a replacement before production | E | Self-scoped per-player trigger at a defined turn point. |

**Weather summary: 16 executable now / 5 needs hook / 0 ambiguous** (out of 21). Snow's "last phase" ambiguity resolved (see below).

### Confirmed core mechanic: season phase structure

Each 7-day season splits into 3 phases of 2/3/2 days, matching `core_rules.md`'s existing "Egg Exchange + new Weather Card before days 1, 3, and 6" rule — phase boundaries *are* those Egg-Exchange/weather-draw events, they just weren't named "phases" explicitly before. A weather card's `phaseLength` field is how many days of one of these phases it's active for. "Last phase" in Snow's effect means the 3rd phase of a season (days 6-7) — for Fall specifically, that's the last 2 days of the entire game.

---

## Bonus Cards

66 cards, but only 27 unique effects — grouped by unique effect below, with
a Copies count instead of 66 near-duplicate rows (matches how the deck
itself was transcribed). Most are self-scoped resource/roll trades on the
caster's own turn, which the phase-5 modifier layer handles directly —
**executable now**. A one-time, bounded gift to a *named* teammate (heal
them, give them food) is still simple enough to count as executable (it's
just a target-selection input every card-effect needs anyway); what pushes
a card to **needs hook** is the same pattern as before — unbounded roll
scope ("any die"), copying another actor's ability, shared-deck
manipulation, or granting the whole player set an action at once.

| Effect (shorthand → description) | Copies | Class | Note |
|---|---|---|---|
| -2 health → -2 enemy health (spend 2 of your own health to deal 2 to a Predator/Grub) | 2 | E | Self-cost, single designated enemy target — bounded. |
| +1 egg OR immune to weather for 1 turn | 2 | E | Self-scoped choice. |
| +1 food OR heal 1 | 3 | E | Self-scoped choice. |
| +1 attack strength, no extra food cost | 3 | E | Self-scoped combat modifier on your own attack. |
| -2 food → +2 health | 3 | E | Self-scoped resource exchange. |
| -1 to enemy health (reduce a Predator/Grub's health by 1) | 3 | E | Direct damage to a chosen enemy target, no self-cost. |
| -1 egg → +2 food OR +1 health | 4 | E | Self-scoped resource exchange + choice. |
| +1 to a teammate's meal counter or health | 5 | E | Bounded one-time gift to a named teammate — simple target-selection, not a persistent aura. |
| -1 meal OR (-1 health → +3 food) | 2 | E | Self-scoped choice. |
| +1 to a teammate's food | 3 | E | Same bounded-gift shape as the meal/health card above. |
| For 1 turn, borrow an unlocked ability from a teammate | 2 | H | Confirmed: the caster chooses which of the teammate's currently-unlocked abilities to borrow. Needs a hook to temporarily bind another actor's chosen ability to the caster. |
| Reroll a teammate's die | 2 | H | Modifies a die roll belonging to another actor, on demand — same "reaches beyond self" shape as Battle Cry (chicken). |
| Reroll your own die | 2 | E | Self-scoped, bounded to your own roll. |
| -1 to enemy attack (reduce incoming damage from a Predator/Grub by 1) | 4 | E | Self-scoped damage mitigation. |
| -2 health → +2 meals OR +4 eggs | 3 | E | Self-scoped resource exchange + choice. |
| Reroll any die | 1 | H | Unbounded scope — could target any roll happening anywhere, not just your own or one you're party to. |
| +1 meal or +2 eggs | 4 | E | Self-scoped choice. |
| -1 to a Predator's roll | 3 | E | Bounded to the Predator Effect roll within your own current combat instance — the same hook phase 4's combat engine already needs. |
| -2 eggs → +4 food OR +2 health | 2 | E | Self-scoped resource exchange + choice. |
| +1 egg OR discard an extra Bonus Card for +3 eggs | 2 | E | Self-scoped choice + resource cost. |
| Draw a new Weather Card from the appropriate deck | 2 | H | On-demand shared weather-deck manipulation — same shape as "Wherever, any Weather" (chicken) and Coopella (predator). |
| Dodge enemy attack (Predator return attack/effects, or avoid Grub counter-damage) | 2 | E | Self-scoped, plugs into the existing dodge mechanic. |
| Move everyone for free (all players may take a free Move) | 2 | H | Grants the *entire player set* a bonus action at once. |
| 2 extra actions | 1 | E | Self-scoped action-economy grant, matches the anticipated "extra action" shape. |
| -2 to a Predator's roll | 1 | E | Same bounded shape as the -1 version, larger magnitude. |
| +2 eggs OR discard an extra Bonus Card for +4 eggs | 1 | E | Confirmed via physical card: a distinct, stronger version of the "+1 egg / +3 eggs" card above, not a duplicate — same self-scoped choice + resource-cost shape. |

**Bonus Cards summary: 57 executable now / 9 needs hook / 0 ambiguous** (out of 66 cards; 27 unique effects). The earlier flagged mismatch was a stale JSON regeneration issue, not a rulebook ambiguity — resolved by confirming against the physical card and rebuilding `data/bonusCards.json`.

---

## Grub Cards

Every Grub has a defend `effect` (self-scoped roll, triggers when attacked
— same shape as a Predator stage effect, resolved via the same combat
step) and a `reward` (granted to whoever lands the killing blow, held and
played on demand like a Bonus Card — see the confirmed mechanic at the end
of the Chickens section). All 24 defend effects are simple self-scoped
rolls with no cross-actor reach, so every one is **executable now** — not
worth a 24-row table for that half. Rewards vary more, closer in shape to
Bonus Cards, so those get the full table.

**Defend effects: 24/24 executable now.** Simple self-scoped roll →
outcome for the attacker, identical in shape to Predator stage effects
(Miss your attack, Lose N health, one card's guaranteed effect with no
roll, one with none at all).

| Grub | Reward | Class | Note |
|---|---|---|---|
| Scorpion | For one attack, ignore all Predator roll effects | E | Bounded to your own next attack. |
| Lunar Moth | Ignore weather effects until a new weather card is drawn | E | Self-scoped immunity, clear duration. |
| Slug | Heal 1 health | E | Self-scoped. |
| Cocoon | +3 food to a teammate | E | Bounded one-time gift to a named teammate — same shape as the Bonus Card teammate gifts. |
| Dung Beetle | Take a Bonus Card from the discard pile | H | Targeted retrieval from a specific discard pile, not a random draw — needs the discard pile treated as a searchable pool (same shape as Tomb Raider/Dungeon Keys). |
| Dragonfly | Draw 3 Bonus Cards, keep 2, give 1 to a teammate | E | Self draw + choice + bounded teammate gift — hand limit (2) naturally satisfied by "keep 2." |
| Four Leaf Clover | For 1 turn, perform all actions Outside | H | Location-restriction override, same shape as Fur Coat (chicken). |
| Praying Mantis | Dodge an enemy attack (and effects) | E | Plugs into the existing dodge mechanic. |
| Caterpillar | +1 to egg production rolls (Permanent Upgrade) | E | Simple self stat modifier. |
| Roly Poly | When attacking, roll 4-6: Predator return attack -1 (Permanent Upgrade) | E | Self-scoped conditional modifier on your own attack. |
| Garden Snail | Tag along when a teammate moves (Permanent Upgrade) | H | Triggered by *another* player's action — same shape as Smallest Chicken (chicken). |
| Lucky Cricket | Copy another player's Bonus Card effect | H | Needs a hook to bind another player's card effect to the caster. Per the resolved "borrow ability" precedent above, assuming the caster chooses which of the target's cards to copy. |
| Earthworm | Heal up to 3 of your teammate's health | E | Bounded gift to a named teammate. |
| Beehive | +2 meals or +3 food | E | Self-scoped choice. |
| Ladybug | Roll 3 times; use the 3 numbers to gain eggs, gain food, and lose health | E | Confirmed: player rolls 3 dice, then freely assigns each result to one of eggs/food/health. Self-scoped once the assignment rule is known. |
| Spotted Lanternfly | Pick the outcome of any die roll | H | Unbounded scope, same shape as "Reroll any die" (Bonus Card). |
| Mosquitoes | +2 Bonus Cards | E | Simple draw grant; normal hand-limit rules apply afterward like any other draw. |
| Wild Grain | +2 food | E | Self-scoped. |
| Centipede | +2 meals or +3 food | E | Same as Beehive. |
| Wasp Swarm | Dodge Predator attack, then base Predator return attack is dealt to the Predator | H | Damage-reflection — redirects the predator's own return-attack value back onto itself, a new mechanic not seen elsewhere. |
| Ant Pile | -2 health to any enemy | E | Direct damage to a chosen enemy target, same shape as the Bonus Card "-1 to enemy health" effects. |
| Firefly | Redraw weather OR call for an Egg Exchange | H | Both options manipulate shared/scheduled state — on-demand weather redraw, or an ad-hoc Egg Exchange outside the normal phase boundary. |
| Lizard | Forage produces +1 additional food until the next weather | E | Self-scoped stat modifier with a defined duration. |
| Large Spider | No Bonus Card hand limit (Permanent upgrade) | E | Hand-limit override, same shape as Bookworm (chicken). |

**Grub Cards summary: 41 executable now / 7 needs hook / 0 ambiguous** (out of 48 items: 24 effects + 24 rewards). Ladybug's reward resolved: player rolls 3 dice and freely assigns each result to eggs/food/health.

### Cross-cutting pattern carried over from Chickens

The same three shapes that dominated the "needs hook" chicken abilities show up again here: **cross-actor/aura effects** (splash damage, "every player," teammate counts), **shared-deck/board-state manipulation** (weather redraws, Grub-deck references, discard-pile searches), and **action-economy exceptions** (free actions granted to others, Extra Action Token refreshes). Loot Drops skew even more toward "needs hook" than base predator stage effects — 11 of the 16 Loot Drops — since a Loot Drop's whole purpose is to be a strong, often teammate-targeting exception to a normal rule.
