# AGENTS.md

## Project Workflow Rules
- Keep [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md) as the master phased roadmap for the project.
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
