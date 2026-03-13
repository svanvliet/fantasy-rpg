# Active Technical Decisions

## Continuity Summary
- This is the compact working decision log for the next phase cycle.
- It carries forward only the active technical constraints that still shape implementation after Phases 1-7.
- Historical detail, superseded reasoning, and phase-by-phase evolution live in the archive.
- The evaluation report is the bridge between the archived prototype cycle and the next roadmap.
- Update this file only when a decision changes how future work must be implemented.

## References
- Archived technical decisions: [docs/archive/2026-03-13-phase-0-7/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/technical-decisions.md)
- Archived implementation history: [docs/archive/2026-03-13-phase-0-7/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/implementation-plan.md)
- Current evaluation summary: [docs/evaluation-report.md](/Users/svanvliet/repos/fantasy-rpg/docs/evaluation-report.md)

## TD-001: Browser-First Runtime Stack

- Status: `accepted`
- Active since: `Phase 0`
- Decision:
  Keep the prototype browser-first using `Vite`, `Three.js`, and `@dimforge/rapier3d-compat`.
- Why:
  The current vertical slice has already validated the browser-first delivery path as the fastest way to iterate and share.
- Consequences:
  New features should preserve desktop-browser operability as the primary validation target.

## TD-002: UI Uses Plain DOM/CSS

- Status: `accepted`
- Active since: `Phase 0`
- Decision:
  Keep HUD, inventory, dialogue, and other prototype UI in plain DOM/CSS rather than introducing a frontend framework.
- Why:
  The project is still optimizing for rapid systems iteration over UI-framework complexity.
- Consequences:
  New interface work should fit the current lightweight UI stack unless a later phase proves that constraint untenable.

## TD-003: `GameApp` Remains the Composition Root

- Status: `accepted`
- Active since: `Phase 1`
- Decision:
  Keep `GameApp` as the central boot and orchestration layer for renderer, scene, loop, player, interaction, inventory, and persistence systems.
- Why:
  The current system scale is still small enough that a single composition root is the clearest structure.
- Consequences:
  New major systems should integrate through `GameApp` unless the next phase explicitly introduces a new orchestration boundary.

## TD-004: Fixed-Step Simulation Is the Baseline

- Status: `accepted`
- Active since: `Phase 1`
- Decision:
  Continue using fixed-step updates for gameplay and physics with rendering kept separate.
- Why:
  Movement, carry behavior, and persistence-sensitive world interaction already rely on this stability.
- Consequences:
  New gameplay systems should be authored with fixed-step assumptions in mind.

## TD-005: First-Person Interaction Input Split Is Stable

- Status: `accepted`
- Active since: `Phases 3-4`
- Decision:
  Keep `E` for interact/take/stow, `F` for hold/carry, `Q` for release/drop, and `I` for inventory.
- Why:
  This input model has already been validated through playtest and supports a clear distinction between inventory actions and physical manipulation.
- Consequences:
  New embodiment, crafting, and dialogue features should respect this mapping unless a future phase explicitly redesigns input.

## TD-006: Holdable And Stowable Are Separate Capabilities

- Status: `accepted`
- Active since: `Phase 4`
- Decision:
  Continue treating holdability and stowability as separate item capabilities.
- Why:
  The next phases will likely add props and station interactions that can be manipulated physically without belonging in inventory.
- Consequences:
  New items and props should not assume that all interactable things are inventory items.

## TD-007: Physical Carry Uses A Reticle-Anchored Model

- Status: `accepted`
- Active since: `Phase 3`
- Decision:
  Preserve the reticle-anchored soft-follow carry model and pickup orientation behavior as the gameplay authority for held objects.
- Why:
  This is one of the strongest validated parts of the current prototype feel.
- Consequences:
  First-person hands/arms in Phase 8 must present this behavior, not replace it.

## TD-008: Persistence Stays Local And Explicit

- Status: `accepted`
- Active since: `Phase 5`
- Decision:
  Keep persistence in browser local storage with explicit save structure for player, inventory, containers, collected pickups, and loose world items.
- Why:
  This is sufficient for the prototype goals and already validated.
- Consequences:
  New systems such as crafting outcomes, dialogue/objective state, and NPC/world scripts should integrate into the same explicit save model.

## TD-009: Direct-Light Hierarchy Is The Active Interior-Lighting Baseline

- Status: `accepted`
- Active since: `Phase 6`
- Decision:
  Keep direct-light tuning, room composition, and practical lighting as the active interior baseline rather than reintroducing the reverted IBL approach.
- Why:
  The reverted environment-lighting pass washed out the mood and did not hold up in playtest.
- Consequences:
  Future lighting work should treat heavier interior-lighting solutions as a deliberate new phase, not an implicit default.

## TD-010: Balanced Graphics Preset Is The Evaluation Baseline

- Status: `accepted`
- Active since: `Phase 6`
- Decision:
  Treat the `balanced` graphics preset as the default evaluation mode for future playtests.
- Why:
  It provides laptop-safe rendering behavior without collapsing the visual baseline.
- Consequences:
  New rendering or embodiment work should be judged first against the balanced preset, not the quality preset.

## TD-011: Post-Prototype Priorities Favor First-Person Depth Before Scope Expansion

- Status: `accepted`
- Active since: `Phase 7`
- Decision:
  Prioritize first-person embodiment, alchemy/item-system depth, and lightweight world-purpose systems before third-person support or heavier rendering expansion.
- Why:
  The engine direction is already validated; the largest remaining gaps are now gameplay depth and embodied interaction.
- Consequences:
  Near-term phases should deepen the current loop rather than broadening feature scope prematurely.

## TD-012: First-Person Embodiment Uses A Separate Viewmodel Render Pass

- Status: `accepted`
- Active since: `Phase 8`
- Decision:
  Render first-person arms/hands through a dedicated viewmodel system and secondary camera pass while keeping gameplay interaction authored by the existing world/carry systems.
- Why:
  This preserves the validated reticle-anchored carry model and avoids giving presentation meshes authority over collision, targeting, or held-item physics.
- Consequences:
  Future embodiment work should extend the current presentation bridge rather than moving carry gameplay into the viewmodel.
  Viewmodel rendering should remain lightweight and non-shadow-casting so it does not materially undermine the balanced performance baseline.

## TD-013: Any Early Third-Person View Must Remain Debug-Scoped

- Status: `accepted`
- Active since: `Phase 8`
- Decision:
  Allow a temporary third-person camera and player proxy only as a troubleshooting aid during embodiment work, not as a formal camera-mode expansion.
- Why:
  We need a practical way to inspect player-facing embodiment state without changing the roadmap priority that keeps full third-person support deferred.
- Consequences:
  Debug third-person support can exist as an inspection tool, but future roadmap decisions should not treat it as equivalent to a production third-person feature.

## TD-014: Phase 9 Alchemy Uses Authored Recipes At A Station

- Status: `accepted`
- Active since: `Phase 9`
- Decision:
  Implement alchemy as a station-gated authored recipe system driven by player inventory ingredients, rather than a freeform combination system.
- Why:
  The prototype needs a readable and testable gameplay loop quickly, and authored recipes are enough to validate station flow, item taxonomy, and persistence.
- Consequences:
  Phase 9 crafting should stay constrained to the alchemy table and a small recipe list.
  Inventory remains the source of truth for ingredients and crafted outputs, which keeps persistence simple and explicit.
  Item definitions should carry explicit crafting-oriented metadata so station UIs can distinguish reagents from general inventory items without inventing per-panel heuristics.

## TD-015: Stack Rules Stay Item-Scoped Before Inventory Pressure Systems

- Status: `accepted`
- Active since: `Phase 9`
- Date: `2026-03-13`
- Decision:
  Keep per-item `maxStack` rules active now, but defer broader inventory-pressure systems such as slot caps, encumbrance, or forced pack-tradeoff mechanics to a later dedicated inventory-depth pass.
- Why:
  Stack metadata is already useful for crafting outputs and item taxonomy, but full inventory pressure would change player decision-making enough that it should be introduced deliberately rather than incidentally during alchemy work.
- Consequences:
  Ingredients, solvents, crafted mixtures, and utility items can continue to define their own stack limits now.
  Inventory-facing UI may surface stack-cap context and stack breakdowns so we can validate stack behavior now, while station UIs can continue to show gross totals when stacks are not the relevant player concern.
  UI stack context should not yet be treated as a full “inventory management game” mechanic.
  A future inventory-depth phase can build on the current item-level stack metadata instead of inventing stack semantics later from scratch.

## TD-016: Phase 10 Uses A Scripted Objective State Machine Before Broader Quest Systems

- Status: `accepted`
- Active since: `Phase 10`
- Date: `2026-03-13`
- Decision:
  Implement early world-purpose as a very small authored objective list with explicit tracked-quest selection and a lightweight HUD tracker, rather than introducing a generalized quest framework or AI-driven behavior system.
- Why:
  The prototype needs to prove that directed RPG structure is both functional and readable in moment-to-moment play, without dragging in unnecessary quest-system abstraction before we know the loop is worth deepening.
- Consequences:
  Phase 10 can use a small authored objective list, explicit dialogue states, and one tracked-quest HUD summary.
  Objective progress should persist in the same explicit save model as player, inventory, and interaction state.
  Broader quest tooling, open-ended concurrent quest management, and richer NPC systems remain future work until this smaller directed loop is validated.
