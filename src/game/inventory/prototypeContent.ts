import * as THREE from "three";

import type { PickupItemDefinition } from "../interactions/types";

export interface ContainerSeedItem {
  itemId: string;
  quantity: number;
}

export interface ContainerSeedDefinition {
  id: string;
  title: string;
  items: ContainerSeedItem[];
}

export const ITEM_DEFINITIONS: PickupItemDefinition[] = [
  {
    id: "bittermoss-extract",
    label: "Bittermoss Extract",
    description: "A bitter green distillate used in simple restorative mixtures.",
    color: 0x6e8c69,
    shape: "bottle",
    size: new THREE.Vector3(0.18, 0.45, 0.18),
    maxStack: 8,
    stowable: true
  },
  {
    id: "moonwater-vial",
    label: "Moonwater Vial",
    description: "A pale alchemical reagent stored in a narrow glass vial.",
    color: 0x8596b5,
    shape: "bottle",
    size: new THREE.Vector3(0.18, 0.45, 0.18),
    maxStack: 8,
    stowable: true
  },
  {
    id: "emberflower-oil",
    label: "Emberflower Oil",
    description: "A warm-toned oil with a faint resin glow.",
    color: 0xb07c62,
    shape: "bottle",
    size: new THREE.Vector3(0.18, 0.45, 0.18),
    maxStack: 8,
    stowable: true
  },
  {
    id: "golden-resin-tonic",
    label: "Golden Resin Tonic",
    description: "A dense amber tonic bottled for storage and trade.",
    color: 0xd0ba74,
    shape: "bottle",
    size: new THREE.Vector3(0.18, 0.45, 0.18),
    maxStack: 8,
    stowable: true
  },
  {
    id: "linen-wrap",
    label: "Linen Wrap",
    description: "Folded cloth used to bundle tools and fragile ingredients.",
    color: 0xd5c6b2,
    shape: "ingredient",
    size: new THREE.Vector3(0.2, 0.2, 0.2),
    maxStack: 12,
    stowable: true
  },
  {
    id: "tallow-candle",
    label: "Tallow Candle",
    description: "A spare candle wrapped for storage.",
    color: 0xe0d4bd,
    shape: "ingredient",
    size: new THREE.Vector3(0.18, 0.18, 0.18),
    maxStack: 10,
    stowable: true
  },
  {
    id: "field-journal",
    label: "Field Journal",
    description: "A compact notebook with stained parchment pages.",
    color: 0x705039,
    shape: "book",
    size: new THREE.Vector3(0.26, 0.06, 0.34),
    maxStack: 1,
    stowable: true
  },
  {
    id: "travel-satchel",
    label: "Travel Satchel",
    description: "A worn satchel meant for small supplies and letters.",
    color: 0x6f563a,
    shape: "satchel",
    size: new THREE.Vector3(0.3, 0.18, 0.24),
    maxStack: 1,
    stowable: true
  }
];

export const CONTAINER_SEEDS: ContainerSeedDefinition[] = [
  {
    id: "foot-locker",
    title: "Foot Locker",
    items: [
      { itemId: "travel-satchel", quantity: 1 },
      { itemId: "tallow-candle", quantity: 2 },
      { itemId: "linen-wrap", quantity: 3 }
    ]
  },
  {
    id: "cabinet-left",
    title: "Herb Cabinet",
    items: [
      { itemId: "bittermoss-extract", quantity: 2 },
      { itemId: "moonwater-vial", quantity: 3 }
    ]
  },
  {
    id: "cabinet-right",
    title: "Supply Cabinet",
    items: [
      { itemId: "emberflower-oil", quantity: 2 },
      { itemId: "golden-resin-tonic", quantity: 1 },
      { itemId: "field-journal", quantity: 1 }
    ]
  }
];

const ITEM_DEFINITION_MAP = new Map(ITEM_DEFINITIONS.map((definition) => [definition.id, definition]));

export function getItemDefinition(itemId: string): PickupItemDefinition {
  const definition = ITEM_DEFINITION_MAP.get(itemId);
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemId}`);
  }

  return definition;
}
