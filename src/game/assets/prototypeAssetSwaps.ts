export interface PrototypeAssetSwapSpec {
  id: string;
  path: string;
  uniformScale?: number;
  scale?: [number, number, number];
  positionOffset?: [number, number, number];
  rotationYDegrees?: number;
}

export const PROTOTYPE_ASSET_SWAPS = {
  alchemyTable: {
    id: "alchemy-table",
    path: "/assets/models/alchemy-table.glb",
    scale: [2.02, 1.5, 1.47],
    positionOffset: [0, 0.02, 0],
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
