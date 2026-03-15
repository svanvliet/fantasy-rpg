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
| 12 | implemented | Introduce real imported assets, modeled hands, and the first art-forward asset swap pass |
| 13 | planned | Add item use effects, inventory pressure, and stronger item-management choices |
| 14 | planned | Expand quest breadth and world reactivity with additional NPCs, rewards, and clearer multi-quest structure |
| 15 | planned | Add a first combat graybox loop and validate encounter feel inside the castle slice |

## Current Known Issues And Constraints
- The slice is still visually blockout-heavy and does not yet prove a production-ready art pipeline.
- There are no real `.glb` or equivalent production assets checked into the repo yet.
- The Phase 12 runtime swap path is now in place, but visible world art replacement still depends on dropping actual model files into `public/assets/models`.
- Balanced graphics remains the default evaluation preset.
- Persistence is intentionally browser-local and explicit.
- The first-person carry model, interaction key split, and station-gated crafting flow are now stable constraints.

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
- `implemented`

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

Validation checklist:
- [ ] verify at least one imported prop is visible in the castle slice and loaded through the shared asset path
- [ ] verify the imported asset swap does not break traversal, collision, or interaction readability
- [ ] verify the balanced graphics preset remains acceptable after the art-swap pass
- [ ] verify modeled hands, if added this phase, preserve the validated embodiment readability and carry feel

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

## Deferred Backlog
- formal third-person camera support
- heavier interior-lighting pipeline
- broad AI / behavior-tree-style NPC systems
- native packaging beyond browser-first delivery
