# Prop Asset Agent Usage

## Purpose
- This repo-local workflow gives us a callable prop-asset agent path inside the `fantasy-rpg` project.
- It is concept-first and prop-first.
- It is designed to fit the current Phase 12 art-swap pipeline rather than bypass it.
- It should follow the shared visual rules in [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) so new assets stay coherent over time.

## Session Scope And Intent
- Every session should be treated as one of:
  - `single`: one production candidate prop
  - `family`: a reusable sibling asset system like `tincture / draught / elixir`
  - `set`: a broader exploratory sheet that may later branch into singles and families
- Every session also has an intent:
  - `production`: the asset is allowed to move toward 3D
  - `exploration`: the session is for concept/system discovery only
- Only `single + production` sessions should move directly into 3D generation.
- `family` and `set` sessions should normally branch into child single-asset sessions before 3D.

## Commands

### Create a new asset session
```bash
npm run asset-agent -- init --slug alchemy-table --room alchemy --category furniture --scope single --intent production --swap-id alchemy-table --use "Primary alchemy crafting table for the castle slice"
```

### Create a child single-asset session from a family or set session
```bash
npm run asset-agent -- spawn-child --session asset-workbench/2026-03-15-potion-bottle-family --slug potion-bottle-draught --category prop --child-role draught --use "Reusable draught bottle for crafted potions and alchemy loot"
```

### Refresh markdown and provider job manifests after editing `session.json`
```bash
npm run asset-agent -- refresh --session asset-workbench/2026-03-14-alchemy-table
```

### Record a selected concept and revision notes
```bash
npm run asset-agent -- select --session asset-workbench/2026-03-14-alchemy-table --concept concept-02 --notes "reduce ornament|thicker legs|clearer iron banding"
```

### Record the approved revision image for 3D generation
```bash
npm run asset-agent -- select-revision --session asset-workbench/2026-03-15-potion-bottle-family --pass pass-01 --revision revision-03
```

### Generate concept images with OpenAI
```bash
npm run asset-agent -- generate-concepts --session asset-workbench/2026-03-14-alchemy-table
```

### Generate child concepts from an approved family or set sheet
```bash
npm run asset-agent -- generate-concepts --session asset-workbench/2026-03-15-potion-bottle-draught
```

### Generate refinement images from the approved concept
```bash
npm run asset-agent -- generate-revisions --session asset-workbench/2026-03-15-potion-bottle-family --count 3
```

### Generate refinement images from a specific prior revision
```bash
npm run asset-agent -- generate-revisions --session asset-workbench/2026-03-15-potion-bottle-family --source-image asset-workbench/2026-03-15-potion-bottle-family/outputs/revisions/revision-02.png --count 3
```

### Materialize the 3D handoff from the approved concept or revision
```bash
npm run asset-agent -- prepare-3d --session asset-workbench/2026-03-15-potion-bottle-family
```

### Submit the prepared 3D handoff to Meshy
```bash
npm run asset-agent -- submit-meshy --session asset-workbench/2026-03-15-potion-bottle-family
```

### Refresh Meshy task status and download outputs when ready
```bash
npm run asset-agent -- check-meshy --session asset-workbench/2026-03-15-potion-bottle-family --download
```

### Run a Blender cleanup pass on a generated model
```bash
npm run asset-agent -- cleanup-blender --session asset-workbench/2026-03-15-potion-bottle-draught --blender /Applications/Blender.app/Contents/MacOS/Blender --target-height 0.22
```

### Run a Blender cleanup pass with a runtime triangle budget
```bash
npm run asset-agent -- cleanup-blender --session asset-workbench/2026-03-16-potion-bottle-tincture --blender /Applications/Blender.app/Contents/MacOS/Blender --target-height 0.18 --max-triangles 15000
```

### Run a Blender cleanup pass on an external GLB that did not come from Meshy
```bash
npm run asset-agent -- cleanup-blender --session asset-workbench/2026-03-15-bed-import --blender /Applications/Blender.app/Contents/MacOS/Blender --source-model asset-workbench/2026-03-15-bed-import/source/bed-raw.glb --target-height 2.0
```

## What gets created
- `session.json`
- `01-brief.md`
- `02-concept-prompts.md`
- `03-review-notes.md`
- `provider-jobs/openai-concepts.json`
- `provider-jobs/openai-revisions.json`
- `provider-jobs/meshy-image-to-3d.json`
- `outputs/concepts/`
- `outputs/revisions/`
- `outputs/models/`
- `outputs/cleanup/`

## Pass Preservation
- Concept batches are preserved as `outputs/concepts/pass-XX/`
- Revision batches are preserved as `outputs/revisions/pass-XX/`
- 3D provider runs are preserved as `outputs/models/pass-XX/`
- Re-running concepts or revisions should create a new pass, not overwrite earlier review history

## Child Extraction Strategy
- If a family or set concept already spaces items cleanly, keep that source image intact and branch child sessions from it.
- Child sessions should preserve the approved parent sheet as `referenceImage`.
- The child session then uses OpenAI image editing/generation with that approved parent image as input to create isolated single-asset concept candidates.
- This is preferred over treating the whole family/set sheet as a single direct-to-3D source.
- We preserve the approved source sheet and the child session lineage so the workflow stays auditable.
- If the user already has a clean isolated final image for a child asset, preserve that file inside the child session and register it as a revision pass instead of generating a redundant refinement batch.
- In that case, treat the supplied image as the approved revision source for `prepare-3d` and provider submission.

## Family Assets Versus Single Props
- Some sessions are best treated as **family concept sessions** rather than immediate single-model sessions.
- Example: the potion bottle family session exists to define the shared visual language for:
  - tincture
  - draught
  - elixir
- For these sessions:
  - use concept and revision passes to lock the family language and reusable components
  - then spawn a child `single + production` session for one family member
  - then treat 3D generation as a validation step for that one child asset first
  - only after one member looks usable in-engine should we branch into additional child assets or variants
- This keeps iteration fast and avoids overcommitting to a bloated family asset before we know the style works in the game.

## Set Exploration
- `set` sessions are broader and should not go directly to 3D by default.
- Use them to answer:
  - what prop categories should exist
  - which concepts become single assets
  - which concepts become families
- Once the set direction is approved, branch child sessions intentionally.

## Current Example Session
- The repo already contains a live example session:
  - [asset-workbench/2026-03-14-alchemy-table](/Users/svanvliet/repos/fantasy-rpg/asset-workbench/2026-03-14-alchemy-table)
- We can use that as our first real concept-review target instead of starting from a blank slate.

## How we should use it in this Codex thread
1. Ask me to start an asset session for a specific prop.
2. I run `npm run asset-agent -- init ...`.
3. We review the generated brief and concept prompts together.
4. We use the OpenAI image path for concept generation and revision.
5. Once you approve a concept, we record it with `select`.
6. If the concept becomes a style anchor or reusable family reference, we capture that in the style guide and workflow docs.
7. If the approved concept needs refinement, we generate revisions from that selected concept instead of starting the next pass from scratch.
8. If the session is `family` or `set`, we branch a child single-asset session for the first production candidate.
9. Child sessions use the approved family/set image as a reference input to generate isolated asset concepts.
10. Once a refinement is approved in a `single + production` session, we record the selected revision and prepare the 3D handoff from that exact image.
11. Then we can submit the prepared job to Meshy and keep provider status and downloads inside the same session history.
12. Prefer validating one extracted prop in-engine before multiplying family variants or set-derived children.

## Cost Guidance
- The workflow defaults to `gpt-5-mini` as the orchestration model and `gpt-image-1.5` for image generation.
- Keep the image model strong and the orchestration model cheap unless a prompt-design step truly needs deeper reasoning.

## Blender Cleanup
- Provider outputs should stay untouched in `outputs/models/pass-XX/`.
- Externally sourced GLBs should also stay untouched. Preserve the raw source in the session before cleanup.
- Blender cleanup should write a separate cleaned export in `outputs/cleanup/pass-XX/` so raw provider artifacts remain available for comparison or rollback.
- The current cleanup command:
  - imports the generated `.glb`
  - grounds and centers the prop
  - applies transforms
  - optionally normalizes the height for gameplay validation
  - exports a separate cleaned `.glb`
  - writes a cleanup report and preview render
- If `--source-model` is provided, the cleanup pass is treated as an external-source cleanup rather than a provider-model cleanup.

## Provider Keys
- `OPENAI_API_KEY` powers concept and revision generation.
- `MESHY_API_KEY` powers the Meshy image-to-3D stage.
- Keep both in the repo-local `.env` file so the workflow stays local and they remain out of git.

## Meshy Output Capture
- When a Meshy task succeeds, the workflow should retain the useful source outputs for cleanup:
  - main remeshed `.glb`
  - `pre_remeshed_glb` when available
  - preview image
  - texture maps
- Alternate interchange formats like `fbx`, `obj`, or `usdz` are optional and should be added later only when they materially help cleanup or runtime integration.

## Current scope
- Good fit:
  - furniture
  - fixtures
  - clutter
  - alchemy props
- Not yet the right target:
  - humanoid hands
  - character bodies
  - rigged animation assets
