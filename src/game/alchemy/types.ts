import type { InventoryStack } from "../inventory/InventoryStore";

export interface RecipeDefinition {
  id: string;
  title: string;
  description: string;
  stationId: "alchemy-table";
  ingredients: InventoryStack[];
  outputs: InventoryStack[];
}

export interface RecipeRequirementView {
  itemId: string;
  label: string;
  quantity: number;
  available: number;
  sufficient: boolean;
}

export interface RecipeOutputView {
  itemId: string;
  label: string;
  quantity: number;
}

export interface RecipeView {
  id: string;
  title: string;
  description: string;
  craftable: boolean;
  requirements: RecipeRequirementView[];
  outputs: RecipeOutputView[];
}

export interface AlchemySnapshot {
  stationTitle: string;
  recipes: RecipeView[];
  playerInventory: Array<{
    itemId: string;
    label: string;
    quantity: number;
  }>;
}

export interface CraftResult {
  success: boolean;
  message: string;
  recipeId?: string;
}
