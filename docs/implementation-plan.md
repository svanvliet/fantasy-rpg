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
| 8 | planned | Add first-person hands/arms and improve embodiment without breaking carry/interaction feel |
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

Validation checklist:
- [ ] verify carry, inspect, stow, and drop still work with visible hands/arms
- [ ] verify the first-person embodiment pass does not break reticle targeting
- [ ] verify held-item presentation still matches the validated carry model
- [ ] verify balanced and quality presets still behave correctly with the added viewmodel pass

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
