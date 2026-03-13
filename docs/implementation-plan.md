# Active Implementation Plan

## Continuity Summary
- Phases 1-7 established a browser-first first-person RPG prototype using Three.js, Rapier, TypeScript, and Vite.
- The prototype now validates first-person traversal, physical item handling, inventory and container transfer, persistence, and room-level atmosphere in a 3-room castle slice.
- The current baseline is intentionally gameplay-first: direct-light interior tuning, blockout-first art direction, and laptop-safe graphics defaults.
- The biggest confirmed gaps are first-person embodiment, alchemy/item-system depth, and lightweight world-purpose scaffolding.
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
| 10 | planned | Add lightweight objectives, dialogue, and one directed NPC/world-purpose flow |
| 11 | planned | Improve asset reuse, GLB integration, and scalable performance instrumentation |

## Current Known Issues And Constraints
- The current slice is still blockout-heavy and does not yet prove a production-ready asset pipeline.
- Interior lighting is good enough for prototype evaluation, but not a final-fidelity target.
- Graphics presets are now part of the baseline and should be preserved during future expansion.
- Persistence is browser-local only and should remain simple unless a later phase explicitly changes that.
- The first-person carry model and interaction key split are validated and should be treated as stable constraints.

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

## Current Phase

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

## Next Phase Preview

### Phase 10: Lightweight Objectives And NPC Scaffolding
- Add one scripted objective flow spanning ingredient gathering, brewing, and a return/deposit step.
- Introduce a minimal dialogue panel and one world-purpose giver or proxy NPC.
- Persist objective progression through the existing save path.

## Deferred Backlog
- third-person camera
- heavier interior-lighting pipeline
- combat
- broad AI / behavior-tree-style NPC systems
