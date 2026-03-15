# Prop Asset Agent Workflow

## Goal
Create visually strong fantasy RPG prop assets that can be reviewed quickly and then swapped into the castle prototype as `.glb` presentation assets.

## Repo-Local Command Path
- Start a session with:
  - `npm run asset-agent -- init --slug <slug> --room <room> --category <category> [--swap-id <id>] [--use "..."]`
- Refresh generated markdown and provider jobs after editing `session.json`:
  - `npm run asset-agent -- refresh --session asset-workbench/<session-id>`
- Record the approved concept and revision notes:
  - `npm run asset-agent -- select --session asset-workbench/<session-id> --concept concept-02 --notes "reduce ornament|clearer silhouette"`
- Generate concept images:
  - `npm run asset-agent -- generate-concepts --session asset-workbench/<session-id>`
- Generate refinement images from the approved concept:
  - `npm run asset-agent -- generate-revisions --session asset-workbench/<session-id> --count 3`
- Generate another refinement pass from a specific prior revision when one image is closest:
  - `npm run asset-agent -- generate-revisions --session asset-workbench/<session-id> --source-image asset-workbench/<session-id>/outputs/revisions/revision-02.png --count 3`
- See [docs/prop-asset-agent-usage.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-agent-usage.md) for concrete examples.

## Design Constraints
- Keep the asset grounded in the current slice:
  - warm, candle-lit medieval/fantasy interior
  - practical castle furniture and alchemy props
  - readable shapes from first-person distance
- Avoid over-detailing the asset beyond the visual fidelity of the slice unless the user explicitly wants a hero prop.
- Reuse the shared visual language in [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) whenever possible.

## Asset Brief Template
- Asset name:
- Room:
- Intended use:
- Silhouette goals:
- Material goals:
- Approximate real-world size:
- Should it read as:
  - humble utility
  - noble/ornate
  - mystical/alchemical
  - worn/commonplace
- Interaction notes:
- Collision/gameplay notes:

## Concept Prompt Guidance
- Prefer one strong prop per prompt.
- Ask for:
  - isolated object
  - clean background or transparent background if supported
  - readable three-quarter view
  - coherent materials
  - no extra scene clutter unless needed
- If the first batch is weak, revise with clearer silhouette and material language before moving to 3D.
- Default to `gpt-image-1.5` for direct image generation jobs unless we have a reason to compare another image model.
- Default the orchestration layer to `gpt-5-mini` so image quality stays high without paying flagship-model text costs for routine concept and revision runs.
- Preserve concept and revision history in pass folders instead of overwriting the last batch.

## 3D Generation Guidance

### Meshy default path
- Use image-to-3D when the concept image is good.
- Use multi-image-to-3D if we have multiple approved views.
- Keep topology and target-polycount appropriate for a game prop, not a cinematic sculpt.

### Tripo comparison path
- Use when we want to compare a second provider against the same concept image.

## Blender Cleanup Checklist
- origin is sensible
- scale is normalized
- forward axis is correct
- asset stands or rests on the ground plane correctly
- materials are usable
- export as `.glb`

## Runtime Integration
- Export the final prop to `public/assets/models`
- Match one of the Phase 12 filenames where applicable:
  - `bed.glb`
  - `alchemy-table.glb`
  - `steward-rowan.glb`
- Or extend the swap registry if a new target prop is being introduced

## Revision Loop
- Record:
  - what the user likes
  - what needs revision
  - whether the issue is concept, geometry, texture, scale, or in-game readability
- Prefer one revision axis at a time.
- If the user chooses a concept as a reusable style anchor, record that in the style guide instead of leaving it only in the session notes.
- If the user asks for reusable families, record the shared components explicitly in the style guide so future assets reuse the same forms instead of approximating them from memory.
