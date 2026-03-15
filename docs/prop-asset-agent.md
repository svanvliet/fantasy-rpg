# Prop Asset Agent Plan

## Summary
- We can build a callable prop-asset workflow for this project.
- The most practical first version is a hybrid agent:
  - OpenAI image generation for concept ideation and revisions
  - Meshy or Tripo for first-pass 3D generation
  - Blender cleanup and `.glb` export for game use
- For this repo, the agent should target props and environment pieces first, not humanoid hands or characters.

## Why This Is The Right First Step
- Our current Phase 12 runtime already supports optional `.glb` prop swaps.
- Props like tables, cabinets, bottles, candles, shelves, stools, and alchemy clutter are the highest-value asset category for the castle slice.
- Current AI workflows are much more reliable for props than for anatomy-sensitive assets like hands, faces, or deforming characters.
- We can improve reuse and consistency by defining style anchors and prop families before we generate a large number of unrelated one-off objects.

## Recommended Architecture

### 1. Concept stage
- Use the OpenAI Responses API with the `image_generation` tool or the Image API with `gpt-image-1`.
- Generate 3-6 concept images for a single asset brief.
- Save:
  - prompt
  - revised prompt
  - image outputs
  - chosen concept id

### 2. Selection stage
- Present the concepts in a review folder or HTML contact sheet.
- Record the selected concept and the revision notes.
- If a concept becomes a style anchor, capture it in [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md).

### 3. Refinement stage
- Run one or more OpenAI image-edit passes to produce cleaner front/three-quarter views and style-consistent references.
- Prefer reference images with:
  - plain or transparent background
  - clear silhouette
  - centered framing
  - readable material cues

### 4. 3D generation stage
- Send the selected concept or multi-view references into Meshy or Tripo.
- Prefer prop-first workflows:
  - image-to-3D for chosen concept images
  - multi-image-to-3D when we have multiple strong views
  - text-to-3D only when concept art is not yet good enough

### 5. Cleanup stage
- Import the generated model into Blender.
- Normalize:
  - origin
  - scale
  - orientation
  - material slots
  - export format
- Export `.glb` into `public/assets/models`.

### 6. In-game review stage
- Drop the asset into the existing Phase 12 swap path.
- Review in the live castle slice.
- Loop on feedback if needed.

## Best Starting Scope
- Start with 3-5 props:
  - bed
  - alchemy table
  - cabinet
  - stool
  - bottle set

Before broad asset generation, define:
- reusable bottle families
- shared material language
- style anchors for room-appropriate furniture

Do not start with:
- humanoid hands
- NPC bodies
- animated characters
- rigged hero assets

## Codex Integration Options

### Option A: Repo-local workflow plus optional skill wrapper
- Keep the real implementation in checked-in scripts and docs.
- Add a Codex skill that tells the agent how to run the workflow.
- Best for this repo because it is transparent, reviewable, and versioned.

### Option B: Global Codex skill in `$CODEX_HOME/skills`
- Best if you want to invoke the workflow across multiple projects.
- Slightly less visible in project history unless we also mirror the docs in-repo.

### Option C: External service only
- Fastest to prototype.
- Weakest audit trail and hardest to keep aligned with the game repo.

## Recommendation
- Use Option A first:
  - repo-local workflow
  - repo-local skill scaffold
  - later install globally if we like it

## Current Tooling Recommendation

### OpenAI
- Use `gpt-image-1.5` as the default concept and revision model.
- Use the Responses API with the `image_generation` tool when we want iterative concept refinement in a multi-step workflow.
- Use the Image API only when we need a simpler one-shot generation or edit path.

### 3D generation
- Prefer Meshy first for the first implementation because its API docs are more direct for:
  - text-to-3D
  - image-to-3D
  - multi-image-to-3D
  - texturing
- Keep Tripo as a second provider option if we want to compare outputs later.

### Cleanup
- Blender remains the cleanup/export authority before an asset is considered usable in-game.

## Research Notes
- OpenAI image generation supports iterative generation and editing through the Responses API and Image API:
  - [Image generation guide](https://platform.openai.com/docs/guides/images/image-generation)
  - [Image generation tool guide](https://platform.openai.com/docs/guides/tools-image-generation/)
  - [GPT Image model page](https://developers.openai.com/api/docs/models/gpt-image-1)
- Meshy supports:
  - [Text to 3D API](https://docs.meshy.ai/en/api/text-to-3d)
  - [Image to 3D API](https://docs.meshy.ai/api/image-to-3d)
  - [Pricing](https://docs.meshy.ai/en/api/pricing)
- Tripo provides:
  - [API overview](https://www.tripo3d.ai/api)
  - [Text to 3D workflow](https://www.tripo3d.ai/features/text-to-3d-model)
  - [Image to 3D workflow](https://www.tripo3d.ai/features/image-to-3d-model)

## Proposed Rollout

### Stage 1
- Create the callable skill, repo-local command workflow, and provider job manifests.
- Target concept generation and revision planning first.

### Stage 2
- Add provider-backed concept-to-3D orchestration.
- Generate one real prop and swap it into the slice.
- Use the first approved concept as a style anchor rather than immediately branching into unrelated art directions.

### Stage 3
- Add Blender cleanup automation and revision tracking.

### Stage 4
- Revisit modeled hands once the prop pipeline is stable.
