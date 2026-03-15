# Prop Asset Agent Usage

## Purpose
- This repo-local workflow gives us a callable prop-asset agent path inside the `fantasy-rpg` project.
- It is concept-first and prop-first.
- It is designed to fit the current Phase 12 art-swap pipeline rather than bypass it.
- It should follow the shared visual rules in [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) so new assets stay coherent over time.

## Commands

### Create a new asset session
```bash
npm run asset-agent -- init --slug alchemy-table --room alchemy --category furniture --swap-id alchemy-table --use "Primary alchemy crafting table for the castle slice"
```

### Refresh markdown and provider job manifests after editing `session.json`
```bash
npm run asset-agent -- refresh --session asset-workbench/2026-03-14-alchemy-table
```

### Record a selected concept and revision notes
```bash
npm run asset-agent -- select --session asset-workbench/2026-03-14-alchemy-table --concept concept-02 --notes "reduce ornament|thicker legs|clearer iron banding"
```

### Generate concept images with OpenAI
```bash
npm run asset-agent -- generate-concepts --session asset-workbench/2026-03-14-alchemy-table
```

### Generate refinement images from the approved concept
```bash
npm run asset-agent -- generate-revisions --session asset-workbench/2026-03-15-potion-bottle-family --count 3
```

### Generate refinement images from a specific prior revision
```bash
npm run asset-agent -- generate-revisions --session asset-workbench/2026-03-15-potion-bottle-family --source-image asset-workbench/2026-03-15-potion-bottle-family/outputs/revisions/revision-02.png --count 3
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

## Pass Preservation
- Concept batches are preserved as `outputs/concepts/pass-XX/`
- Revision batches are preserved as `outputs/revisions/pass-XX/`
- Re-running concepts or revisions should create a new pass, not overwrite earlier review history

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
8. Then we use the generated 3D job manifest as the handoff point for Meshy or another provider.

## Cost Guidance
- The workflow defaults to `gpt-5-mini` as the orchestration model and `gpt-image-1.5` for image generation.
- Keep the image model strong and the orchestration model cheap unless a prompt-design step truly needs deeper reasoning.

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
