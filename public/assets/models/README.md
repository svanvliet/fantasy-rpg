# Imported Model Drop Folder

This folder is the Phase 12 drop location for optional GLB presentation swaps.

The runtime will look for these files:

- `alchemy-table.glb`
- `steward-rowan.glb`

Current expectations:

- models are presentation-only for now; gameplay, collisions, and interactions still come from the existing blockout objects
- place the model root at the same world anchor as the blockout it replaces
- use a floor-level origin for `steward-rowan.glb`
- use a floor-level origin centered under the table for `alchemy-table.glb`
- face the model toward world `+Z` unless the swap spec is updated with a rotation offset

Pickup item visuals can also be dropped into this folder, but they do not use the furniture-style swap-anchor path. The current Phase 12 example is:

- `draught-bottle.glb`
- `tincture-bottle.glb`
- `elixir-bottle.glb`

These files are registered as crafted-item visual templates for:

- `emberguard-draught` -> `draught-bottle.glb`
- `moonveil-tonic` -> `tincture-bottle.glb`
- `verdant-restorative` -> `elixir-bottle.glb`

That means:
- the imported model is attached to the hidden gameplay proxy for seeded pickups
- the same imported model follows the held item and dropped item proxy states
- collision, interaction, and persistence still belong to the gameplay proxy rather than the raw GLB

If a file is missing, the prototype will keep using the existing blockout prop.

The first-person viewmodel can also load an optional placeholder hand source:

- `first-person-left-hand.glb`

The current placeholder flow uses that left-hand source for both sides:
- the left hand uses the GLB directly
- the right hand mirrors the same source at runtime

This is only a temporary visual-blocking path for the old primitive hand rig. It is not a production rigging workflow.

The earlier `bed.glb` experiment was removed after playtest because it did not fit the visual theme or collision footprint closely enough. The bed swap can be revisited later through the same cleanup workflow when we have a better source asset.
