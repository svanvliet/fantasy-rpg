# Prop Asset Agent Workflow

## Goal
Create visually strong fantasy RPG prop assets that can be reviewed quickly and then swapped into the castle prototype as `.glb` presentation assets.

## Repo-Local Command Path
- Start a session with:
  - `npm run asset-agent -- init --slug <slug> --room <room> --category <category> [--scope <single|family|set>] [--intent <production|exploration>] [--swap-id <id>] [--use "..."]`
- For family/set sessions, branch a production child asset with:
  - `npm run asset-agent -- spawn-child --session asset-workbench/<session-id> --slug <slug> --category <category> [--child-role <role>] [--swap-id <id>] [--use "..."]`
- Refresh generated markdown and provider jobs after editing `session.json`:
  - `npm run asset-agent -- refresh --session asset-workbench/<session-id>`
- Record the approved concept and revision notes:
  - `npm run asset-agent -- select --session asset-workbench/<session-id> --concept concept-02 --notes "reduce ornament|clearer silhouette"`
- Record the approved refinement image that should drive 3D:
  - `npm run asset-agent -- select-revision --session asset-workbench/<session-id> --pass pass-01 --revision revision-03`
- Generate concept images:
  - `npm run asset-agent -- generate-concepts --session asset-workbench/<session-id>`
- For child extraction sessions, `generate-concepts` uses the approved parent sheet as an input image and produces isolated single-asset concepts.
- Generate refinement images from the approved concept:
  - `npm run asset-agent -- generate-revisions --session asset-workbench/<session-id> --count 3`
- Generate another refinement pass from a specific prior revision when one image is closest:
  - `npm run asset-agent -- generate-revisions --session asset-workbench/<session-id> --source-image asset-workbench/<session-id>/outputs/revisions/revision-02.png --count 3`
- Materialize the current 3D handoff:
  - `npm run asset-agent -- prepare-3d --session asset-workbench/<session-id>`
- Submit the prepared handoff to Meshy:
  - `npm run asset-agent -- submit-meshy --session asset-workbench/<session-id>`
- Refresh Meshy task state and optionally download outputs:
  - `npm run asset-agent -- check-meshy --session asset-workbench/<session-id> --download`
- Run Blender cleanup on the generated model:
  - `npm run asset-agent -- cleanup-blender --session asset-workbench/<session-id> --blender /Applications/Blender.app/Contents/MacOS/Blender --target-height <meters>`
- For tiny runtime props, prefer a triangle budget and write the result into a new cleanup pass instead of overwriting the higher-fidelity cleanup:
  - `npm run asset-agent -- cleanup-blender --session asset-workbench/<session-id> --blender /Applications/Blender.app/Contents/MacOS/Blender --target-height <meters> --max-triangles <count>`
- Run Blender cleanup on an external GLB source:
  - `npm run asset-agent -- cleanup-blender --session asset-workbench/<session-id> --blender /Applications/Blender.app/Contents/MacOS/Blender --source-model <path-to-raw-glb> --target-height <meters>`
- See [docs/prop-asset-agent-usage.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-agent-usage.md) for concrete examples.

## Design Constraints
- Keep the asset grounded in the current slice:
  - warm, candle-lit medieval/fantasy interior
  - practical castle furniture and alchemy props
  - readable shapes from first-person distance
- Avoid over-detailing the asset beyond the visual fidelity of the slice unless the user explicitly wants a hero prop.
- Reuse the shared visual language in [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) whenever possible.
- Do not send broad exploratory sheets or family sheets directly to 3D unless we explicitly want a fused decorative set.

## Scope Rules
- `single`
  - one asset
  - may go direct to 3D if intent is `production`
- `family`
  - shared visual system for sibling assets
  - should branch into child single-asset sessions before 3D
- `set`
  - broad thematic exploration
  - should branch into single assets or families before 3D
- `exploration` intent means the session is not yet allowed to move into 3D.
- `production` intent means the session is eligible for 3D once it is also `single`.

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
- Use the selected revision image when downstream extraction or component reuse matters more than the first approved concept.
- Preserve provider submissions and downloads as pass history in `outputs/models/pass-XX/` instead of treating them as disposable exports.
- Retain the main `.glb`, `pre_remeshed_glb`, preview, and texture maps when Meshy provides them so cleanup has the right source materials.
- For prop families, prefer using the family concept session to define reusable forms and components, then validate one extracted family member in 3D before spinning out every variant.
- When a family or set concept is approved, preserve the selected concept/revision image as the source of truth, then branch child sessions that use the approved sheet as an input image for isolated child-asset generation.

### Tripo comparison path
- Use when we want to compare a second provider against the same concept image.

## Blender Cleanup Checklist
- origin is sensible
- scale is normalized
- forward axis is correct
- asset stands or rests on the ground plane correctly
- materials are usable
- export as `.glb`
- preserve the raw provider outputs and write the cleaned export into a separate cleanup pass
- preserve higher-fidelity cleanup passes too; runtime-oriented decimation should create another cleanup pass, not replace the earlier source-quality pass
- for externally sourced GLBs, preserve the raw download inside the session first and then write the cleaned export into a separate cleanup pass

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
