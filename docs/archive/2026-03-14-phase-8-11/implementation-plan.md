# Active Implementation Plan

## Continuity Summary
- Phases 1-7 established a browser-first first-person RPG prototype using Three.js, Rapier, TypeScript, and Vite.
- Phases 8-11 then validated first-person embodiment, station-gated alchemy, lightweight quest flow, and the first round of performance/asset-pipeline hardening.
- The current baseline is intentionally gameplay-first: direct-light interior tuning, blockout-first art direction, laptop-safe graphics defaults, visible perf telemetry, and reusable blockout asset paths.
- The biggest confirmed gaps are production-ready asset integration, deeper item usefulness/inventory pressure, broader quest/world reactivity, and a first combat graybox loop.
- Third-person camera, combat, and heavier rendering ambition remain intentionally deferred.

## References
- Archived implementation history: [docs/archive/2026-03-13-phase-0-7/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/implementation-plan.md)
- Archived technical decision log: [docs/archive/2026-03-13-phase-0-7/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/technical-decisions.md)
- Current evaluation summary: [docs/evaluation-report.md](/Users/svanvliet/repos/fantasy-rpg/docs/evaluation-report.md)

## Active Roadmap

| Phase | Status | Goal |
| --- | --- | --- |
| 8 | accepted | Add first-person hands/arms and improve embodiment without breaking carry/interaction feel |
| 9 | accepted | Add alchemy recipes, item tags, and a station-gated crafting loop |
| 10 | accepted | Add lightweight objectives, dialogue, quest tracking, and one directed NPC/world-purpose flow |
| 11 | accepted | Improve asset reuse, GLB integration groundwork, and scalable performance instrumentation |
| 12 | planned | Introduce real imported assets, modeled hands, and the first art-forward asset swap pass |
| 13 | planned | Add item use effects, inventory pressure, and stronger item-management choices |
| 14 | planned | Expand quest/world reactivity with additional NPCs, rewards, and clearer multi-quest structure |
| 15 | planned | Add a first combat graybox loop and validate encounter feel inside the castle slice |

## Current Known Issues And Constraints
- The current slice is still blockout-heavy and does not yet prove a production-ready asset pipeline.
- Interior lighting is good enough for prototype evaluation, but not a final-fidelity target.
- Graphics presets are now part of the baseline and should be preserved during future expansion.
- Persistence is browser-local only and should remain simple unless a later phase explicitly changes that.
- The first-person carry model and interaction key split are validated and should be treated as stable constraints.
- There are no real `.glb` or equivalent production assets checked into the repo yet, so Phase 12 needs to begin with intentional asset sourcing/integration rather than assuming art is already available.

## Recent Phase History

### Phase 8: First-Person Embodiment and Interaction Readability
Objective:
- Add visible first-person hands/arms while preserving the current reticle-anchored interaction and carry model.

Implementation approach:
- Add a dedicated first-person viewmodel layer and secondary camera/render pass for hands/arms and held-item presentation.
- Keep gameplay authority in the existing interaction and carry systems; hands are presentation-driven.
- Avoid world-shadow casting from the viewmodel and keep the embodiment pass cheap enough to fit the current performance baseline.

Important interfaces:
- `ViewModelController`
- `HandPoseState`
- `HeldPresentationState`
- extensions to interaction/carry state needed to drive hand pose and held-item presentation

Acceptance criteria:
- hands/arms feel aligned with pickup, carry, inspect, stow, and release actions
- embodiment does not break reticle targeting, carry feel, or current interaction prompts
- the added presentation pass does not materially break the balanced graphics baseline

Current implementation status:
- `implemented`
- `internally_validated`
- `accepted`

Implemented work:
- added a dedicated first-person viewmodel system in [src/game/viewmodel/ViewModelController.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/viewmodel/ViewModelController.ts)
- added Phase 8 embodiment state in [src/game/viewmodel/types.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/viewmodel/types.ts)
- extended [src/game/interactions/InteractionSystem.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/interactions/InteractionSystem.ts) to expose presentation-oriented interaction/hold state for the viewmodel pass
- updated [src/game/GameApp.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/GameApp.ts) to render the world first and then a secondary first-person viewmodel pass
- added a debug third-person camera toggle and simple player proxy in [src/game/player/PlayerController.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/player/PlayerController.ts) to help troubleshoot embodiment alignment without changing the formal roadmap sequence

Validation checklist:
- [x] verify carry, inspect, stow, and drop still work with visible hands/arms
- [x] verify the first-person embodiment pass does not break reticle targeting
- [x] verify held-item presentation still matches the validated carry model
- [x] verify balanced and quality presets still behave correctly with the added viewmodel pass

Current findings:
- the embodiment pass is currently presentation-only and does not participate in world collision or interaction authority
- the current implementation keeps held-item gameplay state in the existing interaction system and uses the viewmodel only to mirror pose/readability
- the balanced preset remains the evaluation baseline for this phase
- a temporary third-person debug view is acceptable in Phase 8 as a troubleshooting aid, but it does not count as formal third-person camera support
- early playtest feedback showed the first viewmodel rig was oversized enough to block held-item readability, especially for larger items like the field journal
- early playtest feedback also showed the first-person viewmodel was incorrectly remaining visible in the debug third-person camera, which undermined the troubleshooting value of that mode
- in response, the embodiment pass was revised to hide completely outside first-person mode and the arm rig was reduced/repositioned to preserve more screen space while holding items
- follow-up playtest feedback showed the slimmer rig was close but felt slightly too thin, so the arm scale was brought back up modestly for readability
- follow-up playtest feedback also showed the carried item itself was still using a first-person camera-relative anchor in third-person mode, so the hold anchor was revised to use a player-relative third-person presentation offset instead
- later playtest feedback highlighted that the bottle and journal already felt distinct in-hand, which confirmed the value of shape-specific embodiment cues
- in response, the Phase 8 presentation pass was deepened so bottles, ingredients, and book-like items now use more explicitly distinct carry/support poses while still following the same gameplay-authoritative hold system
- final playtest signoff confirmed that carry, inspect, stow, drop, targeting clarity, cross-shape held-item presentation, and balanced/quality preset behavior all felt good enough to accept the phase

Acceptance summary:
- Phase 8 successfully proved that a presentation-only first-person embodiment layer can sit on top of the validated carry/interaction model without undermining it
- the debug third-person mode was useful for tuning and remains explicitly scoped as a troubleshooting aid rather than a roadmap expansion
- the prototype now has a strong enough embodiment baseline to move on to alchemy-system depth in Phase 9

## Phase 9 Closeout

### Phase 9: Alchemy Loop and Item-System Depth
Objective:
- Turn the alchemy room from collect/store scenery into a real station-gated gameplay loop.

Implementation approach:
- Add an authored recipe system tied to the alchemy table only.
- Expand item definitions with lightweight alchemy roles and tags.
- Keep ingredients and crafted outputs in the existing inventory system so persistence stays simple and explicit.

Important interfaces:
- `AlchemySystem`
- `RecipeDefinition`
- `AlchemySnapshot`
- `CraftResult`

Acceptance criteria:
- gather ingredients, craft a result, store or retrieve it, reload, and keep state intact
- alchemy table interaction is readable and constrained to the station
- crafted outputs behave like normal inventory items and persist through the existing save model

Current implementation status:
- `implemented`
- `internally_validated`
- `accepted`

Implemented work:
- added authored Phase 9 recipes in [src/game/alchemy/prototypeRecipes.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/alchemy/prototypeRecipes.ts)
- added the crafting logic layer in [src/game/alchemy/AlchemySystem.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/alchemy/AlchemySystem.ts)
- expanded item definitions with alchemy roles and tags plus crafted outputs in [src/game/inventory/prototypeContent.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/inventory/prototypeContent.ts)
- extended [src/game/inventory/InventoryStore.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/inventory/InventoryStore.ts) with batched add/consume helpers used by crafting
- added a dedicated alchemy panel in [src/ui/alchemyPanel.ts](/Users/svanvliet/repos/fantasy-rpg/src/ui/alchemyPanel.ts)
- updated [src/game/interactions/InteractionSystem.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/interactions/InteractionSystem.ts) and [src/game/world/castleInteractables.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/world/castleInteractables.ts) so the alchemy board now opens a brewing station flow instead of only inspect text
- updated [src/game/GameApp.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/GameApp.ts) to wire alchemy crafting into the existing runtime and autosave flow

Validation checklist:
- [x] verify `E` on the alchemy table opens the station panel and keeps interaction station-gated
- [x] verify at least one valid recipe can be crafted from carried inventory ingredients
- [x] verify invalid recipes remain disabled or fail clearly when ingredients are missing
- [x] verify crafted outputs land in player inventory and can be moved into containers or dropped like other items
- [x] verify crafted outputs and consumed ingredients restore correctly after reload

Current findings:
- the existing inventory/persistence path was already strong enough to support authored crafting without introducing a second save model
- authored recipes give us a readable gameplay loop quickly while keeping the design space open for future expansion
- the alchemy board works well as a station anchor for Phase 9 because it is already visually established as the room's focal work surface
- playtest feedback showed the original Pack Reagents column was too broad because it included general inventory items rather than only true alchemy inputs
- in response, the station summary now filters to reagent-appropriate inventory entries using explicit item alchemy roles
- playtest feedback also showed the craft status could scroll out of view after brewing, so the station status bar is now pinned within the panel to keep crafting feedback visible while browsing recipes
- follow-up playtest feedback showed the first pinned-status implementation was visually messy and could overlap the recipe list, which made the station UI feel unfinished
- in response, the panel layout was reworked into a fixed header, dedicated scroll region, and separate footer/status region so feedback stays visible without sitting on top of the recipe content
- follow-up playtest feedback also showed that the craft status was persisting across close/reopen cycles, which made the station feel stale when returning to it later
- in response, the alchemy panel now resets its status message whenever it closes or reopens
- playtest also surfaced the practical issue of exhausting reagents while iterating on the crafting loop, so the debug overlay now includes buttons to restock Phase 9 reagents and reset local prototype progress entirely
- follow-up playtest feedback showed that reagent restocking was surfacing as multiple duplicate lines in both the alchemy summary and the inventory UI because the snapshot view was exposing physical stack entries directly
- in response, the inventory snapshot layer now aggregates duplicate stacks for display while preserving the existing stack-based internal/save model
- playtest also showed that the first reset-progress implementation was clearing storage but then immediately writing the old runtime state back during reload
- in response, reset-progress now suppresses save-on-hide/save-on-unload behavior for the reset transition so the prototype actually returns to its seeded initial state
- playtest discussion also highlighted that crafted items like Verdant Restorative already read in the UI as `1 / 6`, which reflects the current per-item stack cap rather than a true inventory-capacity system
- in response, Phase 9 keeps per-item stack metadata as useful groundwork for crafting and future inventory pressure, while deliberately deferring slot limits, encumbrance, and broader inventory-choice pressure to a later dedicated inventory-depth phase
- follow-up playtest feedback clarified that the inventory screen should help validate stack behavior directly, while the alchemy screen should stay focused on gross reagent totals
- in response, the inventory UI now preserves aggregated item rows but surfaces explicit stack breakdown text when multiple stacks exist, while the alchemy station continues to show only total reagent counts
- a later cross-phase playtest note also highlighted that the debug third-person embodiment proxy was anchored too high relative to the actual first-person eye point, which made that troubleshooting camera less trustworthy than it should be
- in response, the debug third-person camera focus was lowered to the real first-person eye height and the proxy body was re-proportioned beneath that head anchor so the debug view reads as a believable avatar rather than a floating camera marker

Acceptance summary:
- Phase 9 successfully turned the alchemy room into a real authored gameplay loop with station-gated crafting, explicit item roles, and persistence-safe recipe consumption/output behavior
- the inventory and station UIs are now tuned enough to validate both gross reagent totals and stack-aware inventory behavior without conflating those concerns
- debug affordances for restocking and reset made iteration much faster during playtest and are acceptable prototype-only tools
- the temporary third-person proxy still has minor polish room left, but because it remains a debug-only aid and not a Phase 9 success criterion, it is not blocking acceptance

## Current Phase

### Phase 11: Asset Reuse, GLB Integration, and Performance Hardening
Objective:
- Make the current slice more production-feasible by adding reusable asset/prefab groundwork and clearer performance instrumentation without destabilizing the accepted gameplay systems.

Implementation approach:
- Add lightweight runtime performance instrumentation directly to the overlay so render cost is visible during playtest.
- Introduce reusable blockout asset/prefab caching so repeated geometry and materials stop being recreated unnecessarily.
- Add a small cached GLB-loading catalog now so later asset swaps land on infrastructure instead of one-off loader code.

Important interfaces:
- `BlockoutFactory`
- `AssetCatalog`
- renderer info / performance overlay metrics

Acceptance criteria:
- the overlay exposes useful live performance data for the slice
- graphics presets and render scale are visible and easier to reason about during testing
- the current castle blockout uses a reusable asset/prefab path for repeated primitive content
- the added hardening work does not regress traversal, interaction, crafting, objectives, or persistence behavior

Current implementation status:
- `implemented`
- `internally_validated`
- `accepted`

Implemented work:
- added reusable primitive geometry/material caching in [src/game/assets/BlockoutFactory.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/assets/BlockoutFactory.ts)
- added a cached GLB-loading catalog in [src/game/assets/AssetCatalog.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/assets/AssetCatalog.ts)
- updated [src/game/world/createCastleBlockout.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/world/createCastleBlockout.ts) to use the shared blockout/prefab path for repeated primitive content
- updated [src/game/GameApp.ts](/Users/svanvliet/repos/fantasy-rpg/src/game/GameApp.ts) and [src/ui/debugOverlay.ts](/Users/svanvliet/repos/fantasy-rpg/src/ui/debugOverlay.ts) to surface live render scale, draw calls, triangle counts, and memory-oriented renderer stats in the overlay
- later refined the overlay with a collapsible debug shell so the new telemetry remains available without permanently occupying as much screen space during playtest

Validation checklist:
- [x] verify the debug overlay now shows live render scale, draw calls, triangle counts, geometry count, and texture count
- [x] verify switching graphics presets visibly changes the reported render scale and shadow/perf characteristics
- [x] verify the debug overlay can be collapsed and expanded cleanly without losing telemetry or controls
- [x] verify traversal, interaction, inventory, crafting, objectives, and persistence still work after the Phase 11 hardening changes
- [x] verify the scene still looks materially the same while using the new shared blockout/prefab path

Current findings:
- the prototype now benefits more from performance visibility and reuse groundwork than from deeper new systems, because the gameplay loop baseline is already proving out well
- renderer stats are especially important now because the slice includes multiple passes, dynamic lights, and graphics presets, which are otherwise hard to reason about from FPS alone
- a cached GLB catalog is worth adding before real assets arrive so later swaps land on a stable loading path instead of scene-specific one-offs
- shared blockout geometry/material caching is an appropriate first hardening step because it improves memory/runtime discipline without changing the user-facing shape of the slice
- playtest feedback on the first telemetry pass showed the overlay had become too visually large, so the Phase 11 debug shell now supports collapse/expand behavior to keep perf instrumentation usable without dominating the viewport
- later feedback on the collapsed overlay showed the summary text rhythm was drifting; the overlay summary/header were refactored into fixed row blocks with shared styles in both states, and collapse now only hides the body while keeping the summary structure consistent
- final playtest signoff confirmed that perf telemetry is useful, graphics presets remain understandable, the scene still behaves as before, and the overlay collapse affordance is now visually clean enough to keep as part of the prototype baseline

Acceptance summary:
- Phase 11 successfully made the slice easier to reason about technically without destabilizing any of the accepted gameplay systems.
- Performance cost is now visible in the HUD, graphics presets are easier to evaluate, and repeated blockout content is no longer built entirely through ad hoc geometry/material allocation.
- Because no real production assets are in the repo yet, the GLB work in this phase intentionally stops at loader/cache infrastructure and hands off real asset integration to the next milestone.

## Next Phase Preview

### Phase 12: Imported Assets and First Art-Swap Pass
Objective:
- Use the new asset-loading groundwork to introduce the first real imported props and a modeled first-person hand/arm asset without breaking the gameplay baseline.

Planned scope:
- replace a small set of high-visibility blockout props with imported GLB assets
- swap the current primitive first-person rig for a real modeled hand/arm asset if we have a suitable source asset
- keep balanced graphics as the default validation preset while measuring any perf cost of the imported content

Success criteria:
- imported assets load through the shared catalog path instead of scene-specific loader code
- the castle slice remains functionally unchanged while gaining a clearer visual identity
- the embodiment pass supports a real modeled hand/arm asset without regressing carry readability or interaction feel

### Phase 13: Item Use Effects and Inventory Pressure
Objective:
- Make crafted items and inventory choices matter more moment to moment by introducing actual item use effects and lightweight inventory pressure.

Planned scope:
- add use/consume behavior for crafted restoratives and related inventory items
- introduce an explicit inventory-pressure mechanism such as slot count, carry weight, or another constrained-capacity rule
- preserve current item-level stack rules and build the pressure system on top of them

Success criteria:
- crafted mixtures are useful beyond quest turn-in
- players can feel and understand an inventory tradeoff rather than carrying everything indefinitely
- new item-use rules persist cleanly and do not destabilize containers, crafting, or drop/pickup flow

### Phase 14: Quest Breadth and World Reactivity
Objective:
- Expand the prototype from one directed quest giver into a more convincing small RPG space with additional NPC/world responses and clearer multi-quest structure.

Planned scope:
- add at least one more quest giver or reactive world role
- add quest rewards and clearer active/completed quest state presentation
- expand persistence coverage for a richer multi-quest state

Success criteria:
- multiple quest lines can coexist and remain understandable in the UI
- quest rewards and state changes make the world feel more directed and reactive
- reload mid-quest still restores state cleanly

### Phase 15: Combat Graybox and Encounter Loop
Objective:
- Validate whether the castle slice can support a basic hostile encounter loop without undermining the systems we have already proven.

Planned scope:
- add one simple player combat interaction model
- add one hostile target or encounter space
- validate combat readability, movement feel under pressure, and save/load behavior around encounters

Success criteria:
- one graybox encounter can be entered, resolved, and persisted safely
- combat feels compatible with the current first-person embodiment and interaction baseline
- the project has enough evidence to decide whether combat should become a major next-cycle pillar

## Deferred Backlog
- third-person camera
- heavier interior-lighting pipeline
- combat
- broad AI / behavior-tree-style NPC systems
