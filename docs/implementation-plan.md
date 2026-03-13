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
| 9 | planned | Add alchemy recipes, item tags, and a station-gated crafting loop |
| 10 | planned | Add lightweight objectives, dialogue, and one directed NPC/world-purpose flow |
| 11 | planned | Improve asset reuse, GLB integration, and scalable performance instrumentation |

## Current Known Issues And Constraints
- The current slice is still blockout-heavy and does not yet prove a production-ready asset pipeline.
- Interior lighting is good enough for prototype evaluation, but not a final-fidelity target.
- Graphics presets are now part of the baseline and should be preserved during future expansion.
- Persistence is browser-local only and should remain simple unless a later phase explicitly changes that.
- The first-person carry model and interaction key split are validated and should be treated as stable constraints.

## Current Phase

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

## Next Phase Preview

### Phase 9: Alchemy Loop and Item-System Depth
- Add `RecipeDefinition` and station-gated crafting at the alchemy table.
- Expand item metadata with lightweight gameplay tags such as `ingredient`, `solvent`, and `crafted`.
- Start with 3-5 authored recipes and persist crafted results through the existing save pipeline.

## Deferred Backlog
- third-person camera
- heavier interior-lighting pipeline
- combat
- broad AI / behavior-tree-style NPC systems
