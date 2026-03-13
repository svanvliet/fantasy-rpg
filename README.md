# Fantasy RPG Prototype

Browser-first fantasy RPG prototype built with `Three.js`, `Rapier`, `TypeScript`, and `Vite`.

The current vertical slice is a first-person castle interior focused on validating the core RPG interaction loop:
- first-person traversal and collision
- physical item handling
- inventory and container transfer flow
- mood lighting and room readability

This project is intentionally being built in phases and tracked as a living prototype rather than a throwaway spike.

## Current Prototype

The playable slice currently includes:
- a 3-room castle blockout: bedchamber, storage room, and alchemy room
- first-person movement with pointer lock
- inspect, take, hold, and release interactions
- inventory and container storage
- separate storage contents across the foot locker and cabinets
- physically droppable loose items with tuned collision behavior

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

## Project Structure

- [src/game](/Users/svanvliet/repos/fantasy-rpg/src/game) runtime systems
- [src/ui](/Users/svanvliet/repos/fantasy-rpg/src/ui) overlays and UI panels
- [docs/gdd.md](/Users/svanvliet/repos/fantasy-rpg/docs/gdd.md) high-level game design document
- [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md) master phased roadmap and validation history

## Development Approach

This repo follows a phased implementation model:
- Phase 1: traversal foundation
- Phase 2: castle blockout and atmosphere
- Phase 3: interaction foundation
- Phase 4: inventory and containers
- Phase 5: persistence
- Phase 6: feel and polish
- Phase 7: evaluation build and roadmap rebaseline

We record implementation progress, feedback, design decisions, validation checklists, and acceptance status in the implementation plan instead of keeping that process separate from the code.

## Current Status

Accepted phases:
- Phase 1: traversal foundation
- Phase 2: castle blockout and atmosphere
- Phase 3: interaction foundation
- Phase 4: inventory and containers

Next major milestone:
- Phase 5: persistence for inventory, containers, collected items, and dropped world objects

## Notes

- The project is currently optimized for modern desktop browsers on Mac and PC.
- The prototype is intentionally using stylized blockout content and simple UI so system validation can happen before asset-heavy production work.
- Bundle size is still large for an early prototype and will be revisited in later optimization/polish passes.
