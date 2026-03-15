# AGENTS.md

## Project Workflow Rules
- Keep [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md) as the master phased roadmap for the project.
- Keep [docs/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/technical-decisions.md) as the succinct architectural memory for the project.
- Do not replace the master plan with a short execution checklist. Short checklists are allowed only as subordinate notes inside the master plan or in phase-specific progress sections.
- Update the master plan as work progresses. Record status changes, completed work, validation results, issues found, fixes applied, and any plan changes caused by implementation findings.
- Track phase state explicitly using distinct statuses:
  - `implemented`
  - `internally_validated`
  - `accepted`
- Do not mark a phase `accepted` until the user has had a chance to playtest it or has explicitly signed off on it.
- At the end of each phase, add a Markdown validation checklist to [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md) with:
  - specific exit criteria
  - specific user validation steps
  - a tracked status for each checklist item
- Keep those checklists as part of the permanent phase history so acceptance decisions remain auditable.
- Capture user playtest feedback and testing observations in the master plan as phase notes.
- For each meaningful feedback item, also record:
  - the decision we made in response
  - the implementation change that followed from that decision
  - whether the feedback item is resolved, still being tuned, or deferred
- When merging detailed execution history into the master plan, preserve the detail. Do not collapse completed phase history into a vague summary if step-by-step tracking, validation results, or findings would be lost.
- Record material technical and architectural decisions in [docs/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/technical-decisions.md) as we go.
- Use the technical decision log for stable reasoning and constraints, not for task progress.
- Each technical decision entry should stay concise and include:
  - decision id
  - status
  - phase
  - date
  - decision
  - why
  - consequences
- Update an existing decision entry when the decision evolves; add a new entry only when there is a genuinely new architectural or technical choice to preserve.
- When a phase introduces or revises important system design, update both:
  - [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md) for phase history
  - [docs/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/technical-decisions.md) for enduring architecture context

## Documentation Archival Strategy
- When a phase cycle is fully closed out and the active planning docs become history-heavy, archive the current working copies instead of letting them grow indefinitely.
- Archive the full detailed versions of:
  - [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md)
  - [docs/technical-decisions.md](/Users/svanvliet/repos/fantasy-rpg/docs/technical-decisions.md)
- Store archived cycle docs under [docs/archive](/Users/svanvliet/repos/fantasy-rpg/docs/archive) in a dated folder named like:
  - `YYYY-MM-DD-phase-X-Y`
- After archiving, create new compact working copies in `docs/` that:
  - summarize what the archived phase cycle proved
  - link to the archived implementation plan and technical decisions
  - carry forward only the still-active roadmap and still-relevant technical constraints
- Keep the active docs intentionally short so they remain useful as a working set during implementation.
- Update [README.md](/Users/svanvliet/repos/fantasy-rpg/README.md) when a new archive folder is created so the current docs and archived history are both discoverable.
- Treat this archive-and-reset step as a routine closeout action at the end of a completed phase cycle, not as an exceptional cleanup.

## Phase Commit Protocol
- At the end of each phase, create a git commit so the project history reflects phase boundaries.
- Use detailed commit messages that clearly describe:
  - the phase number and phase name
  - the systems or content added or changed
  - important fixes, validation results, or scope notes if they materially affected the phase outcome
- Do not create the phase-end commit until the phase has reached its agreed checkpoint for that phase. If the phase still requires user playtest or signoff, note that status clearly before committing or use an intermediate checkpoint commit only if the user asks for it.

## Current Operating Expectation
- Future work on this repo should follow the master plan first, then update that plan as implementation reveals new information.
- Preserve a clear audit trail across docs and git so design intent, implementation progress, and acceptance status stay aligned.
- Treat playtest feedback as a formal input to planning, not an informal side note.

## Asset Workflow Rules
- Use the repo-local prop asset workflow for fantasy RPG prop concepting, revision, and first-pass 3D handoff work instead of inventing ad hoc asset-generation steps in-thread.
- The primary entrypoints for this workflow are:
  - [scripts/asset-agent.mjs](/Users/svanvliet/repos/fantasy-rpg/scripts/asset-agent.mjs)
  - [codex-skills/prop-asset-agent/SKILL.md](/Users/svanvliet/repos/fantasy-rpg/codex-skills/prop-asset-agent/SKILL.md)
  - [docs/prop-asset-agent-usage.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-agent-usage.md)
  - [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md)
- When the user asks for new prop assets, revisions, reusable prop families, or concept-to-3D asset work, route the work through the prop-asset-agent skill/workflow.
- Prefer the asset-agent session structure under `asset-workbench/` so each asset request keeps:
  - a brief
  - prompts
  - review notes
  - preserved concept passes
  - preserved revision passes
  - provider handoff manifests
- Treat each asset session as having both:
  - a `scope`: `single`, `family`, or `set`
  - an `intent`: `production` or `exploration`
- Only `single` sessions with `production` intent should move directly into 3D generation by default.
- Use `family` sessions to lock a reusable sibling asset language, not to imply that the whole sheet should become one fused production mesh.
- Use `set` sessions for broad exploration and branching, not for direct 3D generation unless we explicitly want one fused decorative set.
- When a `family` or `set` session produces an approved concept or revision, branch a `single + production` child session for the first real production candidate before moving into 3D.
- For child extraction work, preserve the approved parent concept or revision image as the source of truth and use it as an input image for OpenAI image editing/generation so the isolated child asset keeps the approved visual language.
- Prefer generating 3D assets only for props we actually expect to use in the game slice. Broad exploration sheets should stay at the concept stage until we intentionally promote a specific child asset into production.
- Preserve pass history for both concept and revision batches. Do not overwrite prior image outputs when generating a new batch.
- Preserve provider-backed model history too. Do not overwrite prior Meshy or other provider outputs when generating a new 3D pass.
- Treat approved concepts as style anchors when appropriate, and record reusable-family rules in [docs/prop-asset-style-guide.md](/Users/svanvliet/repos/fantasy-rpg/docs/prop-asset-style-guide.md) so future assets stay visually coherent.
- Prefer lower-cost orchestration for routine asset runs while keeping the image model strong; the current default should favor `gpt-5-mini` orchestration with `gpt-image-1.5` image generation unless a stronger reasoning model is genuinely needed.
- When using Meshy, preserve the useful output set when available:
  - remeshed `.glb`
  - `pre_remeshed_glb`
  - preview image
  - texture maps
- When running Blender cleanup on generated assets, preserve the raw provider outputs and save the cleaned result as a separate cleanup pass rather than overwriting the generated model.
- Keep gameplay authority separate from imported art unless we explicitly decide otherwise; initial asset work should continue to attach through the existing Phase 12 presentation-swap path.
