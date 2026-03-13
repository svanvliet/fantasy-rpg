# Fantasy RPG Prototype GDD

## Vision
Create a browser-first fantasy RPG prototype inspired by the grounded Nordic feel of Skyrim, focused on tactile first-person exploration inside a compact castle slice. The prototype should validate the engine, movement, collision, interaction flow, inventory concepts, and atmosphere before broader RPG systems are added.

Phases 1-7 validated that this direction works as a browser-first vertical slice. The next cycle is focused on deepening the first-person RPG loop through embodiment, alchemy depth, and lightweight world-purpose systems rather than broadening scope prematurely.

## Core Pillars
- Immersive first-person exploration
- Physical, readable interaction with the world
- Traditional RPG inventory and container handling
- Strong environmental mood through lighting, materials, and room storytelling

## Prototype Slice
The first vertical slice is a 3-room castle interior:
- Bedchamber with bed, foot locker, side furniture, and collectible clutter
- Storage room with cabinets, shelves, containers, and general-use items
- Alchemy room with an alchemy table, collectible ingredients, tools, and themed storage

## Prototype Scope
Included in the prototype:
- First-person traversal
- Room-scale collision and physics-backed movement
- Object interaction foundations
- Pickup, storage, and container loops
- Stylized blockout environment with intentional lighting
- Persistent local state for inventory, containers, collected pickups, and moved objects
- Prototype-stage performance guardrails for laptop-safe browser evaluation

Excluded from the prototype:
- Combat
- Broad NPC AI
- Large narrative or quest systems
- Skill trees and character builds
- Third-person camera
- Final-fidelity interior-lighting pipeline

Current near-term priorities:
- visible first-person hands and arms that preserve the validated carry/interaction model
- station-gated alchemy recipes and clearer item-system depth
- lightweight dialogue/objective scaffolding that gives the castle slice directed purpose

## Core Systems
- Player movement and camera look
- World interaction targeting and prompts
- Item definitions and pickup rules
- Inventory and container state
- Local persistence of room state
- Lighting and environment mood support
- Graphics presets and render-scale guardrails for practical desktop-browser testing

## Room Intent
The castle rooms are meant to test different gameplay needs:
- Bedchamber validates personal storage, intimate interior traversal, and atmosphere
- Storage room validates clutter readability, dense collision spaces, and multiple containers
- Alchemy room validates collectible tabletop items and future crafting adjacency

## Prototype Evaluation Goals
- Verify Three.js is a workable rendering base for the project
- Verify Rapier-backed movement and collision feel stable in a first-person web experience
- Verify players can understand where to go, what can be interacted with, and how items move through the world
- Verify the project can hit a performant, visually coherent baseline on modern desktop browsers
- Verify the current foundation is strong enough to support deeper first-person RPG systems without a major architectural reset

## Success Criteria
- The prototype runs reliably in the browser on modern Mac and PC hardware
- Traversal is stable and readable
- The room slice feels like a coherent fantasy location rather than a disconnected test map
- Future systems can layer onto the existing runtime without major rewrites

## Current References
- Evaluation summary: [docs/evaluation-report.md](/Users/svanvliet/repos/fantasy-rpg/docs/evaluation-report.md)
- Active implementation roadmap: [docs/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/implementation-plan.md)
- Archived Phase 0-7 planning history: [docs/archive/2026-03-13-phase-0-7/implementation-plan.md](/Users/svanvliet/repos/fantasy-rpg/docs/archive/2026-03-13-phase-0-7/implementation-plan.md)
