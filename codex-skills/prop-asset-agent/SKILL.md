---
name: prop-asset-agent
description: Use when we want to create or revise fantasy RPG prop assets for this repo using a concept-to-3D workflow. This skill is for prop and environment asset generation, review, revision tracking, and export planning, especially when the output should fit the fantasy-rpg castle slice and Phase 12 asset swap pipeline.
---

# Prop Asset Agent

Use this skill when the goal is to design or revise a prop asset for the fantasy RPG prototype.

This skill is intentionally scoped to:
- props
- furniture
- alchemy objects
- environmental clutter
- room fixtures

Do not use it as the primary workflow for:
- humanoid hands
- character bodies
- rigged NPCs
- animation-ready hero characters

## Workflow

1. Read [references/workflow.md](references/workflow.md) before proposing or running the asset workflow.
2. Read [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) when style anchors or reusable prop families matter for the request.
3. Confirm the target asset category and where it should appear in the castle slice.
4. Start or refresh the repo-local asset session with `npm run asset-agent -- init ...` or `npm run asset-agent -- refresh ...`.
5. Produce or refine the concise asset brief:
   - silhouette
   - materials
   - size
   - style constraints
   - gameplay constraints
6. Generate concept references first.
7. Only after concept approval, record the chosen concept with `npm run asset-agent -- select ...`.
8. Capture any enduring style-anchor or reusable family decision in the style guide and active docs.
9. Then move to 3D generation and cleanup planning.
10. Keep all outputs compatible with the Phase 12 `.glb` swap workflow in `public/assets/models`.

## Output Expectations

For each asset request, produce:
- a short asset brief
- 3-5 concept prompt options
- a recommended prompt
- a session folder in `asset-workbench/`
- a file/output plan for:
  - concept images
  - chosen concept
  - 3D generation
  - exported `.glb`
- revision notes in a compact checklist format

## Notes

- Prefer OpenAI image generation for concept ideation and revision.
- Prefer `gpt-image-1.5` when using the OpenAI image path directly.
- Prefer Meshy first for first-pass 3D generation unless the user explicitly wants Tripo.
- Treat Blender cleanup as required before an asset is considered ready for the game slice.
- When a real asset is requested, remember that gameplay authority still stays with the existing blockout objects until we explicitly change that architecture.
- Prefer reusable prop families and shared material language over generating many unrelated unique props when the gameplay does not require uniqueness.
