# Phased Implementation Plan for the Castle Prototype

## Summary
- Build a browser-first, first-person fantasy RPG prototype using TypeScript, Vite, Three.js, and Rapier.
- Use this file as the single source of truth for the full prototype roadmap and for phase-by-phase execution updates.
- Keep the high-level scope stable while revising near-term phase details based on implementation findings.

## Master Phase Roadmap

| Phase | Status | Goal |
| --- | --- | --- |
| 0 | done | Bootstrap the project, docs, toolchain, and runnable app shell |
| 1 | accepted | Deliver a playable first-person traversal foundation with a debug room |
| 2 | accepted | Replace the debug room with the 3-room castle blockout and establish atmosphere |
| 3 | planned | Add interaction targeting, prompts, pickup/drop behavior, and physical object handling |
| 4 | planned | Add inventory, containers, transfer rules, and prototype item content |
| 5 | planned | Add persistence for player, item, and container world state |
| 6 | planned | Tune feel, readability, and prototype polish |
| 7 | planned | Produce an evaluation build and revise the roadmap from actual findings |

## Core Implementation Decisions
- Runtime stack:
  - `three` for rendering
  - `@dimforge/rapier3d-compat` for collision and early physics interaction
  - plain DOM/CSS overlays for HUD and debug UI
- Code organization:
  - `src/game` for runtime systems
  - `src/ui` for overlays and panels
  - `docs` for the GDD and living implementation plan
- Architecture:
  - `GameApp` owns boot, renderer, scene, camera, loop, and system composition
  - `PlayerController` owns first-person input, movement, gravity, jump, and grounding
  - room/content helpers assemble world geometry separately from engine systems
  - the overlay remains developer-facing until gameplay UI arrives in later phases
- Planning rule:
  - future phase work updates this master file instead of replacing it with a short execution checklist

## Phase Details

### Phase 0: Project Bootstrap
Objective:
- Stand up the repo, docs, tooling, build pipeline, and a minimal game shell.

Implemented:
- Created the project scaffold with Vite, TypeScript, Three.js, Rapier, Vitest, and core source directories.
- Added [docs/gdd.md](/Users/svanvliet/repos/fantasy-rpg/docs/gdd.md) and this master plan document.
- Added a main HTML entrypoint, CSS shell, boot path, and fixed-step loop utilities.

Acceptance criteria:
- `npm run dev` starts the application
- `npm run build` succeeds without TypeScript errors
- the app renders a basic lit scene and debug overlay without runtime errors

Validation checklist:
- [x] `npm install` completes successfully
- [x] `npm run build` completes successfully
- [x] `npm run test` completes successfully
- [x] `npm run dev` starts successfully
- [x] the app boots to a rendered scene without a startup error overlay

Result:
- completed and technically validated

### Phase 1: Traversal Foundation
Objective:
- Deliver stable first-person movement and collision in a controlled test space before building the castle slice.

Implemented:
- Added `GameApp` boot and orchestration flow.
- Added `PlayerController` with pointer-lock look, WASD movement, gravity, jump, and Rapier-backed character motion.
- Added a moody debug room with static colliders, obstacles, and lighting.
- Added a debug overlay for FPS, phase label, player position, grounded state, pointer-lock state, and placeholder target text.

Acceptance criteria:
- first-person look and movement feel stable
- Rapier-backed collision prevents normal wall and floor clipping
- the debug room is traversable and readable
- the overlay reports FPS, player position, grounded state, and a placeholder interaction target

Validation checklist:
- [x] `npm run build` completes successfully after the Phase 1 runtime work
- [x] `npm run test` passes after the Phase 1 runtime work
- [x] local dev boot succeeds
- [x] click into the scene and confirm pointer-lock onboarding is clear
- [x] confirm mouse look feels stable and responsive
- [x] confirm WASD traversal feels stable and readable in the room
- [x] confirm jump/gravity feel reasonable for a prototype baseline
- [x] confirm releasing movement input mid-jump preserves a natural forward motion arc
- [x] confirm landing without movement input does not cause an unwanted slide
- [x] confirm the player does not walk through walls or fall through the floor during normal movement
- [x] confirm the debug overlay is readable and updates FPS, position, grounded state, and pointer-lock state correctly

Result:
- accepted after user playtest

### Phase 2: Castle Blockout and Atmosphere
Objective:
- Replace the debug room with a 3-room connected castle slice that establishes traversal flow and a grounded Nordic mood.

Planned changes:
- Build bedchamber, storage room, and alchemy room with ceilings, walls, openings, and collision-ready layout.
- Replace generic obstacles with room-specific furniture blockouts and traversal constraints.
- Add mood lighting with candles, lamps, fog, and tuned material palette while preserving readability.
- Keep the current traversal/controller systems, adjusting only what Phase 2 reveals about room-scale navigation.

Acceptance criteria:
- all three rooms are traversable in one continuous slice
- each room reads clearly by purpose
- lighting supports atmosphere without hiding critical geometry

Validation checklist:
- [x] verify all three rooms connect cleanly with no traversal dead ends
- [x] verify bedchamber, storage room, and alchemy room are visually distinguishable by layout and prop language
- [x] verify ceilings, walls, and openings read as intentional castle architecture rather than disconnected blockout pieces
- [x] verify furniture blockouts do not create unfair snag points during normal traversal
- [x] verify lighting creates atmosphere while preserving navigation and object readability
- [x] verify performance remains acceptable across the full connected slice

Result:
- accepted after user playtest

### Phase 3: Interaction Foundation
Objective:
- Establish the world interaction loop before inventory and container systems arrive.

Planned changes:
- Add interaction targeting, prompts, hover feedback, and action routing.
- Support `inspect`, `pickup`, `open`, and `close` behavior with explicit blocked/out-of-range feedback.
- Introduce physically droppable items for selected objects and loose alchemy props.

Acceptance criteria:
- players can consistently identify interactable objects
- pickup/open flows are readable in cluttered spaces
- dropped items settle predictably enough for prototype play

Validation checklist:
- [ ] verify interactable targets are easy to identify at normal play distance
- [ ] verify prompts appear consistently and do not flicker excessively in cluttered scenes
- [ ] verify inspect, pickup, open, and close actions trigger the intended behavior
- [ ] verify blocked or out-of-range interactions provide clear feedback
- [ ] verify dropped items settle in a predictable and readable way

### Phase 4: Inventory and Containers
Objective:
- Add the first complete loot/store/retrieve loop across the castle slice.

Planned changes:
- Add `ItemDefinition`, `InventoryState`, and `ContainerState` models.
- Add player inventory UI and shared container panels.
- Seed the world with collectible ingredients, household items, and storage contents.

Acceptance criteria:
- players can move items between world, inventory, and containers
- stack behavior and transfer rules remain consistent
- no duplication, loss, or container cross-contamination occurs during normal use

Validation checklist:
- [ ] verify items can be looted from the world into player inventory
- [ ] verify items can be transferred from inventory into containers and back out again
- [ ] verify stackable items merge and split according to the prototype rules
- [ ] verify container contents remain isolated per container
- [ ] verify no duplication or item loss occurs during repeated transfers

### Phase 5: Persistence
Objective:
- Preserve prototype world state across reloads.

Planned changes:
- Add local save support for player inventory, container contents, collected items, and moved/dropped objects.
- Assign stable persistence identifiers to relevant world entities.
- Add simple validation/debug hooks for restore correctness.

Acceptance criteria:
- players can reload and retain inventory/container/world state
- restored state matches the prior session closely enough for prototype evaluation

Validation checklist:
- [ ] verify collected items remain collected after reload
- [ ] verify player inventory restores correctly after reload
- [ ] verify each container restores its own contents correctly after reload
- [ ] verify dropped or moved objects restore closely enough to their saved state
- [ ] verify no unrelated world state resets unexpectedly

### Phase 6: Feel and Prototype Polish
Objective:
- Improve usability, readability, and overall vertical-slice quality.

Planned changes:
- Tune movement feel, camera settings, interaction range, prompt timing, and room readability.
- Replace the roughest placeholders with better prototype-value assets where needed.
- Add a lighting fidelity pass for interiors using room-level indirect fill strategy, environment/reflection setup, and if warranted a baked-lighting pipeline for static geometry.
- Add lightweight presentation improvements only after core stability is confirmed.

Acceptance criteria:
- the prototype feels coherent and intentionally designed
- atmosphere and usability improve without destabilizing core systems

Validation checklist:
- [ ] verify movement, camera, and interaction tuning feel more intentional than the prior phase
- [ ] verify lighting and material adjustments improve mood without harming readability
- [ ] verify placeholder replacements improve comprehension or atmosphere
- [ ] verify polish changes do not introduce regressions in traversal or interaction

### Phase 7: Evaluation Build and Rebaseline
Objective:
- Close the loop on the vertical slice and revise the longer roadmap from real evidence.

Planned changes:
- Run the full test checklist.
- Capture technical findings, user-experience findings, and known gaps.
- Rebaseline the roadmap for likely next bets such as hands/arms, alchemy crafting, NPC presence, or third-person experiments.

Acceptance criteria:
- a shareable browser build exists
- the post-prototype roadmap reflects actual implementation findings instead of assumptions

Validation checklist:
- [ ] verify the final browser build can be launched by another tester using the documented steps
- [ ] verify the known-issues list is current and concrete
- [ ] verify the roadmap update reflects actual prototype findings rather than original assumptions
- [ ] verify recommended next phases are prioritized and justified

## Progress Log

### Phase 0 Update
Status:
- done

Step tracking:

| Step | Status | Goal |
| --- | --- | --- |
| 1 | done | Create the GDD and master implementation plan docs |
| 2 | done | Scaffold the Vite + TypeScript + Three.js + Rapier project |
| 3 | done | Implement the Phase 0-1 runtime shell |
| 4 | done | Install dependencies, validate, and fold findings back into the plan |

Completed work:
- initialized the repo scaffold
- added package scripts for `dev`, `build`, `preview`, and `test`
- added the boot entrypoint, styles, and core loop utilities
- created the GDD and the master planning structure

Validation results:
- `npm install` succeeded and created the lockfile
- `npm run build` succeeded after TypeScript config alignment
- `npm run test` passed
- `npm run dev` started successfully once local port binding was permitted by the environment

Learned / changed:
- the repo started completely empty
- current Vite typing expects `moduleResolution: "Bundler"`
- explicit `@types/three` support was needed for the installed package set

Issues found and fixed:
- Three.js type declarations were missing from the initial scaffold, so `@types/three` was added
- Vite needed `moduleResolution: "Bundler"` for the current toolchain
- Vitest config typing required importing `defineConfig` from `vitest/config`

### Phase 1 Update
Status:
- accepted

Step tracking:

| Step | Status | Goal |
| --- | --- | --- |
| 1 | done | Create the GDD and master implementation plan docs |
| 2 | done | Scaffold the Vite + TypeScript + Three.js + Rapier project |
| 3 | done | Implement the first-person runtime shell, debug room, and overlay |
| 4 | done | Validate build, tests, and local dev boot |

Completed work:
- implemented the game boot flow and scene setup
- implemented the first-person controller with Rapier-backed movement
- implemented the debug room and developer overlay
- validated build, tests, and dev-server startup

Artifacts produced:
- `GameApp` boot and orchestration flow
- fixed-step loop utility and unit tests
- Rapier-backed first-person controller
- lit traversal test room with static colliders and mood lighting
- on-screen debug overlay for FPS and movement state

Acceptance status:
- build/test/dev boot acceptance passed
- user playtest passed for pointer lock, look, traversal, collision, and overlay readability
- user playtest passed for jump/gravity feel, mid-air momentum preservation, and landing behavior
- Phase 1 is accepted

User validation checklist:
- [x] click into the scene and confirm pointer-lock onboarding is clear
- [x] confirm mouse look feels stable and responsive
- [x] confirm WASD traversal feels stable and readable in the room
- [x] confirm jump/gravity feel reasonable for a prototype baseline
- [x] confirm releasing movement input mid-jump preserves a natural forward motion arc
- [x] confirm landing without movement input does not cause an unwanted slide
- [x] confirm the player does not walk through walls or fall through the floor during normal movement
- [x] confirm the debug overlay is readable and updates correctly

Learned / changed:
- local dev-server startup required sandbox escalation in this environment, but the app itself boots correctly
- current production output is large enough to justify later code-splitting review, but not enough to block Phase 2
- the next phase should replace the debug room instead of extending it into the castle slice
- future phases should separate `implemented`, `internally validated`, and `accepted` so manual playtest gates remain visible
- the initial jump model and the first constant-only retune still felt too abrupt
- the controller now uses a designed jump profile with target height/time, a short jump-hold window, collision-based ceiling detection, and a fall-speed cap instead of a heuristic ceiling cutoff

Feedback notes:
- User feedback: pointer lock, look, traversal, collision, and overlay readability all felt good.
- User feedback: jump/gravity felt too short, abrupt, and unnatural.
- User feedback: after the first retune, jumping still felt like hitting an invisible ceiling.
- User feedback: after the jump arc improved, releasing `W` mid-jump incorrectly canceled horizontal motion and caused the player to fall straight down.
- User feedback: after preserving air momentum, landing with no movement input still caused a small unwanted slide.
- User feedback: removing that slide with an immediate stop made landing feel too abrupt and unnatural.
- User feedback: the final movement tuning now feels right and the Phase 1 playtest is complete.

Decisions from feedback:
- Keep the current traversal, collision, and overlay behavior unchanged because the user validated those areas.
- Replace the heuristic head-hit handling with real Rapier collision inspection so upward velocity is only cut on actual ceiling contact.
- Move jump tuning to a more traditional game-style authored arc using target jump height, time-to-apex, time-to-descent, and a short hold window.
- Preserve horizontal air momentum after takeoff so releasing movement input does not cancel the jump path.
- Stop horizontal motion immediately on landing when there is no active movement input, so momentum carries in the air but does not create ground skating.
- Use a short landing-brake window instead of an instant stop so touchdown sheds momentum quickly without feeling mechanical.

Feedback-driven changes:
- Marked the non-jump Phase 1 validation items as passed from user playtest.
- Reworked `PlayerController` jump behavior to use collision normals, authored ascent/descent timing, jump hold, and terminal fall speed.
- Reworked horizontal movement so air motion uses persistent velocity with separate ground and air acceleration/deceleration, preserving momentum mid-jump.
- Replaced the instant landing stop with a short landing-brake deceleration window when there is no movement input.
- Left the jump/gravity checklist item open for retest after the new controller pass.

### Phase 2 Update
Status:
- accepted

Step tracking:

| Step | Status | Goal |
| --- | --- | --- |
| 1 | done | Replace the debug room with a three-room castle blockout |
| 2 | done | Add room-specific furniture silhouettes and traversal constraints |
| 3 | done | Add Phase 2 lighting, fog, and scene tuning |
| 4 | done | Validate build, tests, and local boot for the castle slice |

Completed work:
- replaced the Phase 1 debug chamber with a connected 3-room castle slice
- built distinct bedchamber, storage, and alchemy spaces with ceilings, partitions, and open passages
- added room-specific blockout furniture including a bed, foot locker, cabinets, shelves, tables, crates, and an alchemy setup
- updated the Phase label and overlay messaging for Phase 2

Validation results:
- `npm run build` passed after the Phase 2 world replacement
- `npm run test` passed after the Phase 2 world replacement
- local dev boot succeeded for the castle slice
- user playtest accepted the Phase 2 checklist items, including architecture readability, traversal, furniture readability, lighting readability, and performance acceptability

Learned / changed:
- replacing the entire debug room was cleaner than trying to grow the old test arena into the castle layout
- the current blockout is visually readable through layout, prop silhouette, rugs, and room-local lighting, even before asset imports
- port `5173` may already be occupied during validation if the user has the game running locally, so alternate local ports are useful for smoke checks

Feedback notes:
- User feedback: the initial Phase 2 lighting was too sparse and too dark to read all the room elements comfortably.
- User feedback: even after the first brightness pass, the room lighting still did not feel like a believable Elder Scrolls-style interior, and the table tops visibly floated above the legs.
- User feedback: after the second pass, the interiors are more readable but still do not feel like the final intended RPG interior lighting target, and the tables are still proportioned too tall.
- User feedback: tabletop items in the alchemy room were still floating because their placement did not follow the corrected table geometry.
- User feedback: visible candle meshes on tables were still floating above surfaces, and the alchemy tabletop composition had overlapping props.
- User feedback: some candle meshes were still clipping into or floating above end tables because candle placement heights were inconsistent across furniture types.
- User feedback: the visible candle representation still read incorrectly because the generic light marker spheres were too large and made some candles look like they were floating or clipping.
- User feedback: all Phase 2 checklist items now look good and Phase 2 playtest is complete.

Decisions from feedback:
- Keep the grounded candle-lit mood, but increase readable local illumination with more candle-style point lights and a slightly stronger ambient/fill base.
- Add hidden bounce/fill lights and reduce interior fog influence so surfaces read more like a game-lit interior with motivated indirect light instead of only explicit practicals.
- Fix table construction so support geometry visibly connects to the tabletop.
- Defer high-fidelity interior lighting to a later polish pass rather than blocking Phase 2 on a full lighting pipeline change.
- Fix table proportions by lowering the tabletop height to a more believable first-person scale.
- Anchor tabletop props to the corrected table surface height instead of room-relative placeholder offsets.
- Anchor decorative candle meshes to the corrected furniture surfaces and give the alchemy tabletop a cleaner prop layout.
- Standardize candle placement so all candles are surface-anchored and their light sources are offset from a consistent candle body height.
- Use a dedicated candle visual with a smaller flame marker instead of the oversized generic light marker for tabletop candles.
- Accept the current lighting/readability level for Phase 2 and defer higher-fidelity Skyrim-like interior lighting to the planned later polish pass.

Feedback-driven changes:
- Added extra candle-style lights near tables, shelves, cabinets, and the alchemy setup.
- Raised ambient and hemisphere fill slightly so room silhouettes and furniture read more clearly without flattening the scene.
- Added non-visible bounce/fill lights to simulate indirect room illumination and reduced the strength of interior fogging.
- Fixed table leg placement and added apron supports so the tabletops no longer float above the legs.
- Lowered table geometry so tabletops sit at a more believable usable height.
- Repositioned alchemy bottles and tabletop props to sit on the corrected table surface.
- Repositioned candle meshes to the corrected table and shelf heights.
- Spread out the alchemy tabletop props and moved the focal arch so the composition no longer collides visually.
- Reworked candle placement to use consistent surface-height anchors with a separate flame/light offset above the candle mesh.
- Replaced the oversized generic ember markers on candles with smaller dedicated flame visuals anchored above each candle body.

## Current Risks and Watchpoints
- Rapier character motion may need iteration to reduce jitter around walls, corners, and future denser furniture layouts.
- Pointer-lock onboarding must remain readable for first-time players as the game HUD becomes more complex.
- Atmospheric lighting can easily harm interaction readability if Phase 2 over-indexes on mood.
- Bundle size is already large for an early prototype because Three.js and Rapier are landing in one chunk; revisit during the castle-slice phase if startup cost becomes noticeable.

## Current Deferrals
- Inventory and container UI
- Interaction system beyond placeholder status
- Local persistence
- Castle room-specific content and props
- Asset imports and post-processing
- Audio

## Test Strategy
- Automated tests:
  - keep lightweight unit coverage for core loop and future pure-state systems such as inventory and persistence
- Manual checks each phase:
  - traversal stability
  - interaction clarity
  - inventory/container integrity once implemented
  - persistence correctness once implemented
  - performance and readability in the most cluttered room

## Working Rule for Future Phases
- This document stays as the master phased implementation plan.
- Each new phase should be recorded here by:
  - updating the roadmap status table
  - adding or revising only the near-term phase details when implementation findings demand it
  - appending a progress update with completed work and learned / changed notes
- Each phase must also include a Markdown validation checklist with explicit exit criteria and user-facing validation steps, and that checklist should be updated as validation is completed.
- Each phase update should also include feedback notes and the decisions/changes made from that feedback whenever playtesting or user review has occurred.
- Short execution checklists are allowed, but only as subordinate notes inside this file or in phase-specific progress sections, never as a replacement for the master plan.
