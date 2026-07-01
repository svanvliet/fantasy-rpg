# Active Implementation Plan

## Continuity Summary
- Phases 1-7 established the browser-first castle prototype and validated traversal, interaction, inventory, persistence, atmosphere, and the overall technical direction.
- Phases 8-11 then deepened the slice with first-person embodiment, station-gated alchemy, lightweight quest flow, and the first round of performance and asset-pipeline hardening.
- The prototype now proves a small but directed RPG loop: move, loot, carry, store, craft, accept quests, progress them, and persist that state across reloads.
- The current baseline remains intentionally gameplay-first and blockout-first.
- The next cycle should focus on real asset integration, stronger item usefulness and inventory pressure, broader world reactivity, and the first combat graybox loop.

## References
- Current evaluation summary: [docs/evaluation-report.md](/Users/svanvliet/repos/fantasy-rpg/docs/evaluation-report.md)
- Archived Phase 0-7 implementation history: [docs/archive/2026-03-13-phase-0-7/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/implementation-plan.md)
- Archived Phase 0-7 technical decisions: [docs/archive/2026-03-13-phase-0-7/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/technical-decisions.md)
- Archived Phase 8-11 implementation history: [docs/archive/2026-03-14-phase-8-11/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-14-phase-8-11/implementation-plan.md)
- Archived Phase 8-11 technical decisions: [docs/archive/2026-03-14-phase-8-11/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-14-phase-8-11/technical-decisions.md)

## Active Roadmap

| Phase | Status | Goal |
| --- | --- | --- |
| 12 | accepted | Introduce real imported assets, modeled hands, and the first art-forward asset swap pass |
| 13 | planned | Add item use effects, inventory pressure, and stronger item-management choices |
| 14 | planned | Expand quest breadth and world reactivity with additional NPCs, rewards, and clearer multi-quest structure |
| 15 | planned | Add a first combat graybox loop and validate encounter feel inside the castle slice |
| Infra: Cloud Save | internally_validated | Add opt-in PlayFab cloud backup of the existing local save, local-first and behind swappable seams |

## Current Known Issues And Constraints
- The slice is still visually blockout-heavy and does not yet prove a production-ready art pipeline.
- The first imported static prop path and the first imported pickup prop path are now validated, but the wider world is still mostly blockout geometry.
- Imported pickup props should continue to preserve gameplay authority on the existing interactable mesh until we deliberately migrate that authority later.
- Balanced graphics remains the default evaluation preset.
- Persistence is intentionally browser-local and explicit.
- Cloud save (PlayFab) is an opt-in backup layer on top of the local save; when `VITE_PLAYFAB_TITLE_ID` is unset the whole feature no-ops and the prototype behaves exactly as local-only.
- The first-person carry model, interaction key split, and station-gated crafting flow are now stable constraints.
- Stylized first-person hands are now validated at the concept level, but production hands remain deferred until we have a suitable rigged asset and a clearer left/right asset plan.
- Hands exploration should now follow a paired-study-to-child-asset flow: approve a paired left/right style study first, then branch isolated `single + production` left/right child sessions before any 3D generation.

## Current Phase

### Phase 12: Imported Assets and First Art-Swap Pass
Objective:
- Use the new asset-loading groundwork to introduce the first real imported props and, when available, a modeled first-person hand/arm asset without breaking the validated gameplay baseline.

Implementation approach:
- Replace a small set of high-visibility blockout props with imported GLB assets loaded through the shared asset catalog.
- Keep the current gameplay and collision authority where it already lives; asset swaps should primarily improve visual fidelity and pipeline confidence.
- If we have a suitable hand/arm asset, route it through the existing viewmodel pass instead of changing embodiment architecture.

Important interfaces:
- `AssetCatalog`
- `BlockoutFactory`
- `ViewModelController`

Acceptance criteria:
- imported assets load through the shared catalog path rather than scene-specific loader code
- the castle slice remains functionally unchanged while gaining clearer visual identity
- the embodiment pass can support a modeled hand/arm asset without regressing carry readability or interaction feel
- balanced graphics remains practical after the first imported assets are added

Current implementation status:
- `accepted`

Implemented work:
- added presentation-only asset swap anchors for the bed, alchemy table, and steward proxy while preserving current gameplay, collision, and interaction authority
- wired optional GLB loading through `AssetCatalog` in `GameApp` so matching files are loaded automatically when present and blockout fallbacks are hidden only on successful load
- documented the expected drop folder and filenames in [public/assets/models/README.md](/Users/svanvliet/repos/fantasy-rpg/public/assets/models/README.md)
- added a repo-local asset-agent command workflow in [scripts/asset-agent.mjs](/Users/svanvliet/repos/fantasy-rpg/scripts/asset-agent.mjs) with session folders, prompt manifests, and revision tracking for concept-to-3D prop work
- documented workflow usage in [docs/prop-asset-agent-usage.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-agent-usage.md) and updated the repo-local skill scaffold to point at the real command path
- created the first working asset session at [asset-workbench/2026-03-14-alchemy-table](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-14-alchemy-table) as the initial concept-generation target for the castle slice
- added a shared style guide at [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) so style anchors and reusable families become part of the workflow, not just ad hoc feedback
- extended the asset-agent workflow so an approved concept can now drive a dedicated refinement pass instead of forcing concept work to restart from scratch
- switched the asset-agent workflow to a lower-cost orchestration default while keeping image generation on `gpt-image-1.5`, and added support for refining from a specific prior revision image
- changed the asset-agent workflow to preserve both concept and revision batches as pass history instead of overwriting the latest outputs
- added explicit revision selection and 3D handoff preparation commands so the workflow can promote an approved refinement image into the modeled-asset stage instead of relying on manual session edits
- added Meshy submission and task-refresh commands that preserve provider runs as `outputs/models/pass-XX` history, including task metadata and downloaded outputs when available
- generated the first provider-backed bottle-family model from the approved `revision-03` source image and stored the resulting `.glb` and preview under [asset-workbench/2026-03-15-potion-bottle-family/outputs/models/pass-01](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-15-potion-bottle-family/outputs/models/pass-01)
- extended the Meshy download stage so successful 3D passes now retain the remeshed `.glb`, `pre_remeshed_glb`, preview, and texture maps instead of only the main `.glb` and preview
- extended the asset-agent session model with explicit `scope` (`single`, `family`, `set`) and `intent` (`production`, `exploration`) so broad ideation sessions stop being treated like direct production assets
- added child-session branching so family/set sessions can spawn a `single + production` child asset session that inherits style constraints and uses the approved parent image as a reference source
- changed child-asset concept generation to use OpenAI image editing/generation with the approved parent concept or revision as an input image, so isolated production candidates preserve the approved family/set language instead of reimagining it from scratch
- gated 3D preparation and provider submission so only `single + production` sessions move directly into the modeled-asset step by default
- added a Blender-backed cleanup command to the asset agent so generated models can be grounded, centered, scaled for gameplay validation, and exported as separate cleaned `.glb` passes without overwriting raw provider artifacts
- ran the first cleanup pass on the isolated draught bottle and saved the cleaned export, preview, and report under [asset-workbench/2026-03-15-potion-bottle-draught/outputs/cleanup/pass-01](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-15-potion-bottle-draught/outputs/cleanup/pass-01)
- created child production sessions for the `tincture` and `elixir` bottle variants, preserved user-supplied isolated images as approved revision sources, and submitted both through the same Meshy + Blender cleanup flow used for the draught bottle
- copied the cleaned draught bottle into [public/assets/models/draught-bottle.glb](/Users/svanvliet/repos/fantasy-rpg/public/assets/models/draught-bottle.glb), first validated the imported pickup path against `golden-resin-tonic`, and then reassigned that imported presentation to the crafted `emberguard-draught` item once the runtime behavior proved out
- copied the cleaned tincture and elixir bottles into [public/assets/models/tincture-bottle.glb](/Users/svanvliet/repos/fantasy-rpg/public/assets/models/tincture-bottle.glb) and [public/assets/models/elixir-bottle.glb](/Users/svanvliet/repos/fantasy-rpg/public/assets/models/elixir-bottle.glb), and wired them to the crafted `moonveil-tonic` and `verdant-restorative` items so the imported bottle family now covers multiple crafted outputs
- added a runtime triangle-budget path to Blender cleanup, preserved the earlier higher-fidelity tincture/elixir cleanup passes, and replaced the runtime bottle GLBs with new `pass-03` cleanup exports capped at `15,000` triangles each after playtest showed the uncapped variants were too heavy for tiny pickup props
- after playtest showed the `15,000` triangle cleanup passes tore holes in the generated bottle meshes, regenerated runtime cleanup passes at `50,000` triangles for the tincture and elixir and swapped the runtime GLBs to those `pass-04` exports while keeping both the original high-fidelity and failed ultra-low-poly passes in the workbench history
- preserved a user-supplied simplified alchemy-table image as an approved revision source in the existing alchemy-table session and submitted the first provider-backed Meshy model pass from that exact image so the table can progress through the same asset workflow without swapping it into the game prematurely
- downloaded the first provider-backed alchemy-table outputs, ran a Blender cleanup pass at gameplay scale, and copied the cleaned table into [public/assets/models/alchemy-table.glb](/Users/svanvliet/repos/fantasy-rpg/public/assets/models/alchemy-table.glb) so the existing furniture swap anchor can load it as the next visual validation target
- changed imported pickup props to attach the GLB visual directly to the hidden gameplay proxy mesh, so the same imported presentation can follow seeded, held, dropped, and restored item states without moving interaction or collision authority onto the raw GLB
- preserved static furniture-style swap anchors for bed, alchemy table, and steward props while separating imported pickup visuals into their own lifecycle-aware presentation path
- preserved a second isolated draught source image as `revision pass-02`, submitted a fresh Meshy run from that newer source, and completed a separate Blender cleanup pass at [asset-workbench/2026-03-15-potion-bottle-draught/outputs/cleanup/pass-02](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-15-potion-bottle-draught/outputs/cleanup/pass-02) so the current runtime draught can be compared against a more stylistically aligned replacement before any swap is made
- after comparison confirmed the refreshed draught looked more in-family, promoted that `pass-02` cleaned GLB into [public/assets/models/draught-bottle.glb](/Users/svanvliet/repos/fantasy-rpg/public/assets/models/draught-bottle.glb) while preserving the earlier runtime-safe draught cleanup history in the workbench
- split static asset-swap fallback handling into fully hidden visual remnants and ghosted interaction-authority remnants so the imported alchemy table can hide the old table/arch visuals while keeping an invisible station target alive behind the scenes
- extended static asset-swap specs to support non-uniform scale so imported furniture can be matched to the actual footprint of the blockout prop it replaces instead of forcing every swap through a single uniform scalar
- expanded the alchemy station interaction proxy from a tiny board hotspot to a broad tabletop-sized invisible target so the imported alchemy table behaves like the interactable object instead of requiring players to find a small hidden activation point
- removed the runtime bed swap and deleted `public/assets/models/bed.glb` after playtest confirmed the found asset did not match the slice’s visual direction or the original bed footprint closely enough to keep in the accepted Phase 12 baseline

Current findings:
- the first meaningful Phase 12 step was pipeline-facing rather than visual because no real model assets are checked into the repo yet
- modeled hands are still planned for this phase cycle, but they remain gated on acquiring a suitable rigged hand/arm asset
- the current implementation keeps imported props presentation-only until we intentionally choose to move collision or interaction authority to real assets
- we now have a dedicated prop-asset agent plan, repo-local skill scaffold, and actual command-line session workflow so concept-to-3D asset generation can become part of the project workflow without coupling it directly to game runtime code
- the first approved alchemy-table concept is useful not only as a single prop direction, but as a visual style anchor for future alchemy-adjacent assets
- reusable item families, especially potion bottle families, should be treated as a workflow-level asset strategy now so later art passes stay coherent and cheaper to produce
- the bottle-family workflow now explicitly treats shared label bands and shared neck metal rings as reusable family components so future variants stay consistent by default
- revision passes should isolate multi-prop families cleanly when downstream extraction or individual modeling is expected; overlap is now treated as a workflow issue, not just an art note
- concept exploration now defaults to three images instead of four so the workflow stays cheaper and tighter without losing useful variation
- the 3D stage now has a real CLI path, but actually generating provider-backed models still depends on a separate `MESHY_API_KEY`; OpenAI-only credentials are not sufficient for the modeled-asset step
- the workflow has now proven a real provider-backed round trip: approved revision image -> Meshy submission -> downloaded `.glb` and preview artifacts, which materially reduces Phase 12 pipeline risk even before the asset is imported into the live slice
- family-style concept sessions should not automatically imply that every member becomes a single generated 3D model immediately; for fast iteration, the better default is to lock the family language first and validate one extracted family member in-engine before branching into multiple child assets
- the first Meshy bottle-family textures confirm that grouped family sheets are being interpreted as one fused textured asset, which is acceptable for decorative sets but the wrong default for reusable sibling game props
- the workflow therefore needs to distinguish between concept-family approval and production-model generation: family and set sessions are useful for art direction, but production-ready 3D should branch into single-child sessions before model generation
- when a family or set sheet already isolates its items cleanly, preserving that approved source image and using it as a reference input for child extraction is less lossy than asking for a wholly new image generation pass with no input
- when the artist or user already has a clean isolated bottle-family member image, the workflow should accept it as a preserved child-session revision source instead of spending another generation pass just to recreate the same composition
- the workflow now proves both child-session paths: generated isolated refinement images and user-supplied final isolated images can both move cleanly into provider-backed 3D and Blender cleanup without breaking session lineage
- the first isolated draught child concept is close to usable, but we learned that stronger glass reflections can still make image-to-3D handoff riskier; for glossy transparent props, the safer default is one cleanup refinement pass that softens reflections before 3D submission
- Blender cleanup is now a real executable workflow step instead of just a checklist item, and it should preserve raw provider outputs while creating separate cleaned exports for in-engine validation
- imported pickup props need a different pattern from static furniture swaps: a hidden authority proxy with an attached imported visual is more robust than a detached presentation mount for anything that can be collected, held, dropped, or restored from persistence
- external GLB files that did not originate from the concept-to-provider workflow still need a first-class cleanup path, so Blender cleanup now has to support direct source models as well as provider-generated model passes
- imported static furniture still needs hidden collider retuning after the art swap when the incoming mesh footprint differs materially from the old blockout; the bed now uses a tighter mattress-height proxy instead of relying on the oversized original collision volume
- once one crafted pickup visual is proven, sibling crafted items can reuse the same lifecycle-aware imported-visual bridge simply by mapping item ids to the corresponding cleaned family member GLBs
- the debug overlay FPS readout was previously too optimistic because it was derived from fixed-step update time rather than real render cadence; runtime perf metrics now need to reflect actual rendered frame timing when imported assets get heavy
- aggressive decimation on messy single-material provider meshes can destroy bottle-like props well before a nominally reasonable triangle target; runtime optimization should step down in stages and preserve every pass so we can retreat to a better quality/perf point instead of guessing
- when one family member is regenerated later from a cleaner isolated source image, the older runtime version should remain in place until the replacement completes the same cleanup/comparison path; otherwise it becomes too easy to lose a stable baseline while chasing family consistency
- static furniture swaps can have the same “visible import + hidden authority proxy” need as pickup props, especially when the replaced blockout included a tiny interaction mesh that should remain active but not visible after the visual swap
- once a static furniture swap proves out, its hidden interaction proxy should usually be widened to the practical footprint of the imported prop rather than preserving a tiny blockout-era hotspot
- the imported alchemy table and crafted bottle family are now the accepted Phase 12 proof points for static and pickup asset swaps respectively; the bed experiment was intentionally removed rather than carried forward as a known-bad placeholder
- modeled first-person hands remain deferred because we still do not have a suitable rigged hand/arm asset, but the viewmodel architecture from Phase 8 and the asset cleanup pipeline from Phase 12 now give us a clear path when that asset exists

Validation checklist:
- [x] verify at least one imported prop is visible in the castle slice and loaded through the shared asset path
- [x] verify the imported asset swap does not break traversal, collision, or interaction readability
- [x] verify the balanced graphics preset remains acceptable after the art-swap pass
- [x] record modeled hands as deferred due to missing suitable rigged assets rather than forcing a low-confidence Phase 12 hand swap

Acceptance summary:
- user validated the imported crafted bottle family in-world, including seeded, held, dropped, and persisted item behavior
- user validated the imported alchemy table after scale, visual fallback, and interaction-proxy refinements
- user agreed to defer the bed swap and modeled-hands asset work so Phase 12 closes on the strongest proven art-swap baseline rather than carrying known-misaligned assets forward

## Infrastructure Workstream: PlayFab Cloud Save (MVP)

Objective:
- Back up the existing single-slot local save to PlayFab so progress survives beyond one browser/device, without hard-coding PlayFab into the game or blocking gameplay on the network.

Scope decisions (user-confirmed):
- Title ID already exists; supplied via `VITE_PLAYFAB_TITLE_ID` (graceful no-op when unset).
- Anonymous device login now (`LoginWithCustomID`), designed so real accounts can be added later.
- Local-first: `localStorage` stays the synchronous source of truth; cloud is backup/sync.
- Single save slot; push on existing autosave triggers + on quit, debounced.
- Reconcile at startup by newer-wins timestamp (local vs cloud).
- Official PlayFab SDK (`playfab-web-sdk`); save stored in PlayFab Entity Files (future-proof for larger saves).
- Debug overlay shows a cloud-save status line plus a manual "Sync now" button.

Implementation approach:
- New `src/game/persistence/cloud/` module built on swappable seams so the backend and identity strategy can each evolve independently:
  - `CloudSaveProvider` / `IdentityProvider` contracts (no PlayFab references in gameplay).
  - `AnonymousDeviceIdentityProvider` (device id persisted in localStorage) — future account providers drop in with no coordinator changes.
  - `PlayFabClient` (loads the browser SDK via `?url` classic-script injection, sharing `window.PlayFab`) + `PlayFabCloudSaveProvider` (Entity Files read/write/delete).
  - `NullCloudSaveProvider` for the disabled path.
  - `SaveSyncCoordinator`: startup reconcile, debounced push, quit flush, manual sync, and cloud-clear on reset; emits status for the overlay.
- `SaveManager` (local layer) is unchanged in behavior.
- `GameApp` reconciles cloud↔local before restoring stores, pushes after each local persist, flushes on visibility/unload, and clears the cloud copy on Reset Progress.

Important interfaces:
- `SaveManager`, `GameSaveState`
- `CloudSaveProvider`, `IdentityProvider`, `SaveSyncCoordinator`
- `DebugOverlayController.setCloudSaveStatus`

Known MVP gaps (intentional, deferred):
- Real accounts, multiple slots, and explicit conflict-resolution UI are out of scope.
- `beforeunload` cannot await async work, so the final on-quit push is best-effort; the debounced autosave push plus the `visibilitychange:hidden` flush cover the common cases.

Internal validation results:
- `npx tsc --noEmit` passes.
- `npm run build` succeeds; the PlayFab SDK is emitted as separate script assets, kept out of the main bundle until injected.
- `npm run test` passes (38 tests, incl. 19 new: config resolution, coordinator newer-wins/debounce/flush/syncNow/clearCloud/error-retry/disabled, and identity device-id/login-caching).

Validation checklist:
- [x] cloud save fully no-ops and the prototype runs unchanged when `VITE_PLAYFAB_TITLE_ID` is unset
- [x] startup reconcile chooses the newer of local vs cloud by timestamp (unit-verified)
- [x] pushes are debounced off existing autosave triggers and flushed on quit/visibility
- [x] Reset Progress also clears the cloud copy so a stale cloud save cannot win on reload
- [x] overlay exposes cloud status + a manual "Sync now" button
- [ ] user configures a live `VITE_PLAYFAB_TITLE_ID` and confirms a real login + Entity File round trip
- [ ] user confirms cross-session/device restore (save on one session, restore in another)
- [ ] user confirms Reset Progress clears both local and cloud and starts fresh

Current implementation status:
- `internally_validated`

## Next Phase Preview

### Phase 13: Item Use Effects and Inventory Pressure
Goal:
- Make crafted items and inventory choices matter more moment to moment by introducing item use behavior and a lightweight inventory-pressure rule.

Preview:
- add use/consume behavior for crafted restoratives and related items
- add an explicit inventory-pressure mechanism such as slot count, carry weight, or another constrained-capacity rule
- build on current per-item stack metadata instead of replacing it

### Phase 14: Quest Breadth and World Reactivity
Goal:
- Expand the prototype from a single directed steward flow into a more convincing small RPG space with clearer multi-quest structure and stronger world response.

Preview:
- add at least one more quest giver or reactive world role
- add quest rewards and clearer active/completed state presentation
- expand persistence coverage for richer multi-quest state

### Phase 15: Combat Graybox and Encounter Loop
Goal:
- Validate whether the castle slice can support a basic hostile encounter loop without undermining the systems already proven.

Preview:
- add one simple player combat model
- add one hostile target or encounter space
- validate combat readability, movement under pressure, and persistence behavior around encounters

## Active Exploration Notes

### Pre-Phase 13 Hands Aesthetic Study
- Approved paired-hands aesthetic anchor: [revision-03.png](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-20-first-person-hands-forearms/outputs/revisions/pass-01/revision-03.png)
- Branched isolated child production sessions for:
  - [2026-03-20-first-person-right-hand-forearm](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-20-first-person-right-hand-forearm)
  - [2026-03-20-first-person-left-hand-forearm](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-20-first-person-left-hand-forearm)
- Promoted isolated concept picks directly into first Meshy passes so we can validate stylized hand/forearm mesh feasibility without turning this work into a full rigging effort before Phase 13 starts.
- The first isolated right-hand extraction came back as the wrong anatomical side, so the asset-agent prompts were tightened to state handedness explicitly and forbid mirrored outputs before generating the replacement right-hand pass.
- Even after the prompt fix, AI-generated right-hand meshes remained anatomically unreliable. For temporary in-engine validation, we are instead using the good left-hand placeholder mesh and mirroring it locally for the right side, while keeping rigged production hands deferred.

## Deferred Backlog
- formal third-person camera support
- heavier interior-lighting pipeline
- broad AI / behavior-tree-style NPC systems
- native packaging beyond browser-first delivery
