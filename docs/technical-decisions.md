# Technical Decision Log

This document is the compact architectural memory for the prototype.

Use it to capture material technical decisions without forcing a future reader to reconstruct intent from code diffs, playtest notes, or long phase history.

## How We Use This Log

- Record decisions that change how the project is structured, how systems interact, or what constraints future work should assume.
- Keep entries short and high-signal.
- Prefer updating an existing entry when a decision evolves instead of scattering the same decision across multiple docs.
- Use the implementation plan for phase progress and validation history.
- Use this file for stable architectural context and the reasoning behind it.

## Entry Format

Each decision should include:
- `ID`
- `Status`
- `Phase`
- `Date`
- `Decision`
- `Why`
- `Consequences`

Statuses:
- `accepted`
- `superseded`
- `in_progress`
- `deferred`

---

## TD-001: Browser-First Runtime Stack

- Status: `accepted`
- Phase: `0`
- Date: `2026-03-12`
- Decision:
  Build the prototype as a browser-first TypeScript app using `Vite`, `Three.js`, and `@dimforge/rapier3d-compat`.
- Why:
  We want the fastest path to a shareable first-person prototype across web, Mac, and PC, with modern browser delivery as the first validation target.
- Consequences:
  We optimize for desktop browser iteration first.
  Native packaging is deferred until the browser slice proves the core loop.

## TD-002: UI Uses Plain DOM/CSS, Not a Frontend Framework

- Status: `accepted`
- Phase: `0`
- Date: `2026-03-12`
- Decision:
  Keep HUD, debug UI, inventory, and container panels in plain DOM/CSS instead of introducing React or another UI framework.
- Why:
  The prototype needs low-friction iteration on runtime systems more than a complex UI stack.
- Consequences:
  UI logic stays lightweight and colocated with the game shell.
  If UI complexity grows later, we can revisit this decision with actual prototype pressure rather than assumptions.

## TD-003: Central Runtime Composition Through `GameApp`

- Status: `accepted`
- Phase: `1`
- Date: `2026-03-12`
- Decision:
  `GameApp` owns boot, renderer, scene, camera, main loop, and top-level system composition.
- Why:
  A single composition root keeps the prototype understandable while the system count is still small.
- Consequences:
  Cross-system wiring is easy to follow.
  If the project becomes materially larger, we may need to split orchestration responsibilities more aggressively.

## TD-004: Fixed-Step Simulation With Separate Render

- Status: `accepted`
- Phase: `1`
- Date: `2026-03-12`
- Decision:
  Use a fixed-step update loop for gameplay and physics, with rendering kept separate.
- Why:
  Movement, collision, and object handling feel more stable with a fixed simulation step.
- Consequences:
  Physics tuning is more predictable.
  Runtime systems should be written with deterministic fixed-step updates in mind.

## TD-005: First-Person Interaction Input Split

- Status: `accepted`
- Phase: `3-4`
- Date: `2026-03-12`
- Decision:
  Use:
  `E` for interact/take/stow,
  `F` for physical hold/carry,
  `Q` for release/drop,
  `I` for inventory.
- Why:
  This keeps direct inventory actions separate from physical manipulation and avoids overloaded interaction behavior.
- Consequences:
  The interaction model is easier to reason about during prototyping.
  If we later move toward a single contextual action model, that should be treated as an intentional polish-phase change rather than an ad hoc remap.

## TD-006: Holdable and Stowable Are Separate Capabilities

- Status: `accepted`
- Phase: `4`
- Date: `2026-03-12`
- Decision:
  Item definitions distinguish `stowable` from general physical interaction.
- Why:
  We expect future props that can be moved in the world but should not be pocketed.
- Consequences:
  Inventory logic should never assume that all physically interactive props are inventory items.
  Future world props can participate in carry physics without entering the inventory loop.

## TD-007: Inventory and Containers Are Data-Driven

- Status: `accepted`
- Phase: `4`
- Date: `2026-03-12`
- Decision:
  Keep item definitions and initial container contents in prototype content data instead of hardcoding behavior into UI or interaction logic.
- Why:
  This makes it easier to tune the prototype loop and later swap content without rewriting systems.
- Consequences:
  Content additions should usually start in data definitions.
  Save/restore systems can serialize item ids and quantities instead of bespoke object state per item type.

## TD-008: Physical Carry Uses a Reticle-Anchored Soft Follow

- Status: `accepted`
- Phase: `3`
- Date: `2026-03-12`
- Decision:
  Held props preserve pickup orientation, anchor to the grabbed point under the reticle, and move by soft-following depth toward the carry distance.
- Why:
  This produced a more natural first-person manipulation feel than snapping to a canned orientation or locking the object rigidly to camera space.
- Consequences:
  Carry behavior is closer to diegetic object handling than inventory abstraction.
  Future hand/arm rendering should respect this carry anchor model rather than replacing it blindly.

## TD-009: Phase 5 Persistence Uses Local Browser Storage

- Status: `accepted`
- Phase: `5`
- Date: `2026-03-12`
- Decision:
  Persist prototype state to browser local storage with a versioned save payload covering player state, inventory, containers, collected pickups, and loose world items.
- Why:
  This is the fastest way to validate persistence behavior without introducing backend or platform-specific save infrastructure.
- Consequences:
  Saves are single-device and browser-local for now.
  The save format should stay explicit and versioned so it can evolve safely as the prototype grows.

## TD-010: Persistence Uses Debounced Autosave Plus Lifecycle Flushes

- Status: `accepted`
- Phase: `5`
- Date: `2026-03-12`
- Decision:
  Save world state shortly after meaningful changes and also flush state on page hide and unload.
- Why:
  This keeps the prototype resilient to reloads without forcing the player to use a manual save flow during systems validation.
- Consequences:
  Save writes happen automatically during playtesting.
  Future manual save/load UX should build on this behavior intentionally rather than accidentally fighting it.

## TD-011: Phase 6 Interior Polish Uses Layered Practicals, Fill, and Architectural Rhythm

- Status: `accepted`
- Phase: `6`
- Date: `2026-03-12`
- Decision:
  Improve interior readability and mood through layered practical lights, hidden bounce/fill, and stronger architectural/furniture silhouettes before attempting any heavier baked-lighting pipeline.
- Why:
  This gives us a meaningful visual upgrade inside the current prototype constraints without stalling Phase 6 on a more expensive lighting toolchain.
- Consequences:
  Phase 6 lighting work should favor deliberate room composition and hierarchy first.
  If we later add baked lighting, it should be an explicit enhancement to this strategy rather than a replacement for basic room readability.

## TD-012: Room Composition Should Be Anchored to Architecture

- Status: `accepted`
- Phase: `6`
- Date: `2026-03-12`
- Decision:
  Major furniture should be staged relative to walls, openings, and room functions rather than distributed evenly through open floor area.
- Why:
  Believable room layout depends as much on composition as on prop count or lighting. Anchoring furniture to architecture makes the prototype read more like intentional interior design and less like scattered blockout pieces.
- Consequences:
  Future room polish should prefer wall-based staging, stronger focal groupings, and clearer circulation space.
  Prop moves that improve believability are architectural decisions and should be documented, not treated as incidental cosmetic edits.

## TD-013: Phase 6 Uses RoomEnvironment-Based IBL for Interior Readability

- Status: `revised`
- Phase: `6`
- Date: `2026-03-12`
- Decision:
  We tested Three.js `RoomEnvironment` and `PMREMGenerator` for interior image-based lighting, but reverted that pass for the current prototype baseline.
- Why:
  In practice, the result made the rooms feel washed out and too broadly lit for the grounded indoor mood we want, even after adding a live tuning slider.
- Consequences:
  Phase 6 now returns to direct-light hierarchy as the active baseline.
  Higher-fidelity interior lighting remains a future option, but it should come back only with a more intentional pipeline such as baked lighting, probes, or a room-by-room material pass.

## TD-014: Phase 6 Exposes Lighting Tuning in the Overlay

- Status: `accepted`
- Phase: `6`
- Date: `2026-03-12`
- Decision:
  Expose a lighting-level slider in the overlay that scales the room's direct light intensities.
- Why:
  Lighting feel is still being tuned interactively, and a live control is faster and more reliable than repeatedly hardcoding guesses.
- Consequences:
  Phase 6 lighting can be dialed in collaboratively during playtest.
  Once the preferred range stabilizes, we can bake the chosen default back into the scene tuning.
