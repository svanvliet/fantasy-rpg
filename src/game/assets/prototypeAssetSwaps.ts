export interface PrototypeAssetSwapSpec {
  id: string;
  path: string;
  uniformScale?: number;
  positionOffset?: [number, number, number];
  rotationYDegrees?: number;
}

export const PROTOTYPE_ASSET_SWAPS = {
  bed: {
    id: "bed",
    path: "/assets/models/bed.glb",
    uniformScale: 1,
    positionOffset: [0, 0, 0],
    rotationYDegrees: 0
  },
  alchemyTable: {
    id: "alchemy-table",
    path: "/assets/models/alchemy-table.glb",
    uniformScale: 1,
    positionOffset: [0, 0, 0],
    rotationYDegrees: 0
  },
  steward: {
    id: "steward-rowan",
    path: "/assets/models/steward-rowan.glb",
    uniformScale: 1,
    positionOffset: [0, 0, 0],
    rotationYDegrees: 0
  }
} as const satisfies Record<string, PrototypeAssetSwapSpec>;
