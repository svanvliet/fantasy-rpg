# Imported Model Drop Folder

This folder is the Phase 12 drop location for optional GLB presentation swaps.

The runtime will look for these files:

- `bed.glb`
- `alchemy-table.glb`
- `steward-rowan.glb`

Current expectations:

- models are presentation-only for now; gameplay, collisions, and interactions still come from the existing blockout objects
- place the model root at the same world anchor as the blockout it replaces
- use a floor-level origin for `bed.glb` and `steward-rowan.glb`
- use a floor-level origin centered under the table for `alchemy-table.glb`
- face the model toward world `+Z` unless the swap spec is updated with a rotation offset

If a file is missing, the prototype will keep using the existing blockout prop.
