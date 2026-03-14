# Active Technical Decisions

## Continuity Summary
- This is the compact decision log for the current post-Phase-11 cycle.
- It carries forward only the technical constraints that still shape implementation in Phases 12-15.
- Historical detail and superseded reasoning live in the archive.
- Use this file for stable constraints and architecture memory, not phase progress.

## References
- Current evaluation summary: [docs/evaluation-report.md](/Users/svanvliet/repos/fantasy-rpg/docs/evaluation-report.md)
- Archived Phase 0-7 technical decisions: [docs/archive/2026-03-13-phase-0-7/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/technical-decisions.md)
- Archived Phase 8-11 technical decisions: [docs/archive/2026-03-14-phase-8-11/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-14-phase-8-11/technical-decisions.md)
- Archived Phase 8-11 implementation history: [docs/archive/2026-03-14-phase-8-11/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-14-phase-8-11/implementation-plan.md)

## TD-001: Browser-First Runtime Stack

- Status: `accepted`
- Phase: `0+`
- Date: `2026-03-14`
- Decision:
  Keep the prototype browser-first using `Vite`, `Three.js`, and `@dimforge/rapier3d-compat`.
- Why:
  The browser slice is already validated as the fastest path for iteration and sharing.
- Consequences:
  New systems should preserve modern desktop-browser operability as the primary target.

## TD-002: UI Uses Plain DOM/CSS

- Status: `accepted`
- Phase: `0+`
- Date: `2026-03-14`
- Decision:
  Keep HUD, debug, inventory, dialogue, quest, and station UI in plain DOM/CSS.
- Why:
  The project still benefits more from low-friction systems iteration than from adding a frontend framework.
- Consequences:
  New UI should fit the current lightweight stack unless a future phase proves that constraint too costly.

## TD-003: `GameApp` Remains The Composition Root

- Status: `accepted`
- Phase: `1+`
- Date: `2026-03-14`
- Decision:
  Keep `GameApp` as the main boot and orchestration layer for renderer, scene, loop, player, interaction, inventory, objectives, and persistence systems.
- Why:
  The current system scale still fits a single clear composition root.
- Consequences:
  New major systems should integrate through `GameApp` unless a later phase intentionally introduces a new orchestration boundary.

## TD-004: Fixed-Step Simulation Is Baseline

- Status: `accepted`
- Phase: `1+`
- Date: `2026-03-14`
- Decision:
  Continue using fixed-step updates for gameplay and physics with rendering kept separate.
- Why:
  Movement, carry behavior, and persistence-sensitive interactions already depend on this stability.
- Consequences:
  New gameplay systems should be authored with fixed-step assumptions in mind.

## TD-005: First-Person Interaction Input Split Is Stable

- Status: `accepted`
- Phase: `3+`
- Date: `2026-03-14`
- Decision:
  Keep `E` for interact/take/stow, `F` for hold/carry, `Q` for release/drop, `I` for inventory, and `V` as a debug-only third-person toggle.
- Why:
  This mapping is already validated and keeps physical manipulation distinct from inventory actions.
- Consequences:
  New systems should respect this split unless a future phase deliberately redesigns input.

## TD-006: Holdable And Stowable Stay Separate

- Status: `accepted`
- Phase: `4+`
- Date: `2026-03-14`
- Decision:
  Continue treating holdability and stowability as separate item capabilities.
- Why:
  The prototype already contains and will likely gain more props that can be moved physically without belonging in inventory.
- Consequences:
  New items and props should not assume all interactables are inventory items.

## TD-007: Persistence Stays Local And Explicit

- Status: `accepted`
- Phase: `5+`
- Date: `2026-03-14`
- Decision:
  Keep persistence in browser local storage with explicit save structure for player, inventory, containers, objectives, collected pickups, and loose world items.
- Why:
  This is sufficient for the prototype goals and is already validated.
- Consequences:
  New systems should extend the same explicit save model instead of introducing parallel persistence paths.

## TD-008: Balanced Graphics Preset Is The Evaluation Baseline

- Status: `accepted`
- Phase: `6+`
- Date: `2026-03-14`
- Decision:
  Treat the `balanced` graphics preset as the default playtest and evaluation mode.
- Why:
  It gives a practical laptop-safe baseline without collapsing the visual slice too far.
- Consequences:
  New rendering, asset, and embodiment work should be judged against `balanced` first, not `quality`.

## TD-009: Embodiment Uses A Separate Viewmodel Pass

- Status: `accepted`
- Phase: `8+`
- Date: `2026-03-14`
- Decision:
  Keep first-person hands/arms in a dedicated presentation-only viewmodel render pass while leaving gameplay authority in the world interaction/carry systems.
- Why:
  This preserves the validated carry model and avoids giving presentation meshes authority over collision or targeting.
- Consequences:
  Future modeled hands/arms should be integrated through the existing viewmodel path rather than replacing the underlying carry logic.

## TD-010: Crafting Stays Station-Gated And Role-Driven

- Status: `accepted`
- Phase: `9+`
- Date: `2026-03-14`
- Decision:
  Keep alchemy authored, station-gated, and driven by explicit item roles/tags instead of freeform combinations.
- Why:
  This is the clearest validated crafting loop in the current prototype.
- Consequences:
  Future crafting work should build on explicit item metadata and station UX rather than ad hoc inventory heuristics.

## TD-011: Stack Rules Stay Item-Scoped Before Inventory Pressure

- Status: `accepted`
- Phase: `9+`
- Date: `2026-03-14`
- Decision:
  Keep per-item `maxStack` rules active now, but defer broader inventory-pressure systems such as slots, encumbrance, or forced pack-tradeoff mechanics to a later dedicated phase.
- Why:
  Stack metadata is already useful, but full inventory pressure should be introduced deliberately.
- Consequences:
  Phase 13 should build on the current stack model instead of inventing inventory limits from scratch.

## TD-012: Objectives Stay Lightweight And Scripted Until Proven Broader

- Status: `accepted`
- Phase: `10+`
- Date: `2026-03-14`
- Decision:
  Keep quests/objectives as a small authored state-machine flow with simple tracking and persistence before introducing broader quest frameworks or heavier AI systems.
- Why:
  The current prototype needs readable directed play more than generalized quest tooling.
- Consequences:
  Phase 14 should expand quest breadth carefully without prematurely introducing heavyweight quest architecture.

## TD-013: Phase 11 Established Hardening Before Broad Asset Swaps

- Status: `accepted`
- Phase: `11`
- Date: `2026-03-14`
- Decision:
  Start asset/pipeline work with shared primitive reuse, cached GLB-loading infrastructure, and visible perf telemetry before broad real-asset swaps.
- Why:
  The prototype needed performance visibility and a reusable import path before art integration would be meaningful.
- Consequences:
  Phase 12 should use the existing asset catalog path for its first real imports.
  Because no production-ready model assets are currently checked into the repo, real asset integration must begin intentionally rather than assuming the assets already exist.
