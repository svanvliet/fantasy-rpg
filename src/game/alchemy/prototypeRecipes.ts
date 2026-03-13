import type { RecipeDefinition } from "./types";

export const ALCHEMY_STATION_ID = "alchemy-table";
export const ALCHEMY_STATION_TITLE = "Alchemy Table";

export const ALCHEMY_RECIPES: RecipeDefinition[] = [
  {
    id: "verdant-restorative",
    title: "Verdant Restorative",
    description: "A simple restorative brewed from moss distillate and moonwater.",
    stationId: "alchemy-table",
    ingredients: [
      { itemId: "bittermoss-extract", quantity: 1 },
      { itemId: "moonwater-vial", quantity: 1 }
    ],
    outputs: [{ itemId: "verdant-restorative", quantity: 1 }]
  },
  {
    id: "emberguard-draught",
    title: "Emberguard Draught",
    description: "A warming tonic blended for resilience and long winter patrols.",
    stationId: "alchemy-table",
    ingredients: [
      { itemId: "emberflower-oil", quantity: 1 },
      { itemId: "golden-resin-tonic", quantity: 1 },
      { itemId: "moonwater-vial", quantity: 1 }
    ],
    outputs: [{ itemId: "emberguard-draught", quantity: 1 }]
  },
  {
    id: "moonveil-tonic",
    title: "Moonveil Tonic",
    description: "A clear night-bloom mixture for steadier hands and focus.",
    stationId: "alchemy-table",
    ingredients: [
      { itemId: "moonwater-vial", quantity: 1 },
      { itemId: "golden-resin-tonic", quantity: 1 }
    ],
    outputs: [{ itemId: "moonveil-tonic", quantity: 1 }]
  }
];
