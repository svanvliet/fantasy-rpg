# Fantasy RPG Prototype

Browser-based first-person fantasy RPG prototype built with `Three.js`, `Rapier`, `TypeScript`, and `Vite`.

The current vertical slice is a first-person castle interior with a full RPG interaction loop:
- first-person traversal with collision and jumping
- physical item handling, inspect, hold, and release
- inventory, container storage, and item transfer flow
- station-gated alchemy crafting with authored recipes
- NPC dialogue, two authored quests, and a quest tracker HUD
- save-state persistence for player, inventory, containers, and quest progress
- mood lighting, graphics quality presets, and live performance telemetry

This project is intentionally being built in phases and tracked as a living prototype rather than a throwaway spike.

## Current Prototype

The playable slice currently includes:
- a 3-room castle blockout: bedchamber, storage room, and alchemy room
- first-person movement with pointer lock
- inspect, take, hold, and release interactions
- inventory and container storage
- separate storage contents across the foot locker and cabinets
- physically droppable loose items with tuned collision behavior
- persistence for player position, inventory, containers, collected pickups, and dropped loose items
- a station-gated alchemy loop with authored recipes and crafted outputs
- steward dialogue, two authored quests, and a lightweight quest tracker HUD
- a live lighting slider in the prototype overlay for Phase 6 room-light tuning
- live performance telemetry in the prototype overlay, plus a collapsible debug shell for playtest-friendly monitoring

## Tech Stack

- `three`
- `@dimforge/rapier3d-compat`
- `typescript`
- `vite`
- `vitest`

## Getting Started

Install dependencies:

```bash
npm install
```

Run the prototype:

```bash
./play.sh
```

Or run the dev server directly:

```bash
npm run dev -- --host 127.0.0.1
```

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm run test
```

## Controls

- `Click` captures mouse look
- `W A S D` move
- `Mouse` look
- `Space` jump
- `E` interact / take / search / stow held item
- `F` hold a loose item physically
- `Q` release a held item
- `I` open player inventory
- `Esc` close inventory or container UI
- `V` toggle the debug third-person camera
- `Lighting` slider in the overlay tunes direct room lights during Phase 6 polish
- `Graphics` control in the overlay switches between performance, balanced, and quality rendering presets
- `Add Reagents` in the overlay restocks alchemy inputs for testing
- `Reset Progress` in the overlay clears local prototype progress and reloads the seeded slice
- `Collapse` in the overlay hides the full debug body while keeping a compact summary visible

## Project Structure

- [src/game](src/game) runtime systems
- [src/ui](src/ui) overlays and UI panels
- [docs/gdd.md](docs/gdd.md) high-level game design document
- [docs/implementation-plan.md](docs/implementation-plan.md) active roadmap for the current phase cycle
- [docs/technical-decisions.md](docs/technical-decisions.md) active technical constraints for the current phase cycle
- [docs/evaluation-report.md](docs/evaluation-report.md) current vertical-slice evaluation and roadmap rebaseline
- [docs/archive/2026-03-13-phase-0-7](docs/archive/2026-03-13-phase-0-7) archived Phase 0-7 planning history and technical decisions
- [docs/archive/2026-03-14-phase-8-11](docs/archive/2026-03-14-phase-8-11) archived Phase 8-11 planning history and technical decisions

## Development Approach

This repo follows a phased implementation model:
- Phase 1: traversal foundation
- Phase 2: castle blockout and atmosphere
- Phase 3: interaction foundation
- Phase 4: inventory and containers
- Phase 5: persistence
- Phase 6: feel and polish
- Phase 7: evaluation build and roadmap rebaseline
- Phase 8: first-person embodiment
- Phase 9: alchemy loop and item-system depth
- Phase 10: objectives, dialogue, and quest tracking
- Phase 11: asset reuse and performance hardening
- Phase 12: imported assets and first art-swap pass

We record implementation progress, feedback, design decisions, validation checklists, and acceptance status in the implementation plan instead of keeping that process separate from the code.
Older planning history is archived once a phase cycle closes so the active docs stay compact.

## Current Status

Accepted phases:
- Phase 1: traversal foundation
- Phase 2: castle blockout and atmosphere
- Phase 3: interaction foundation
- Phase 4: inventory and containers
- Phase 5: persistence
- Phase 6: feel and prototype polish
- Phase 7: evaluation build and roadmap rebaseline
- Phase 8: first-person embodiment and interaction readability
- Phase 9: alchemy loop and item-system depth
- Phase 10: lightweight objectives, dialogue, and quest tracking
- Phase 11: asset reuse, GLB integration groundwork, and performance hardening

Current active milestone:
- Phase 12: imported assets and first art-swap pass

## Notes

- The project is currently optimized for modern desktop browsers on Mac and PC.
- The prototype is intentionally using stylized blockout content and simple UI so system validation can happen before asset-heavy production work.
- Bundle size is still large for an early prototype and will be revisited in later optimization/polish passes.
- Real imported art assets are not yet checked into the repo; the current asset work established the loading/caching path so the next cycle can swap them in intentionally.
