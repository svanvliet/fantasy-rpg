import type { InventoryStore } from "../inventory/InventoryStore";

import type { AlchemySnapshot, CraftResult, RecipeDefinition, RecipeOutputView, RecipeView } from "./types";

export class AlchemySystem {
  private readonly inventoryStore: InventoryStore;
  private readonly recipes = new Map<string, RecipeDefinition>();
  private readonly stationTitle: string;

  constructor(inventoryStore: InventoryStore, recipes: RecipeDefinition[], stationTitle: string) {
    this.inventoryStore = inventoryStore;
    recipes.forEach((recipe) => {
      this.recipes.set(recipe.id, recipe);
    });
    this.stationTitle = stationTitle;
  }

  getSnapshot(): AlchemySnapshot {
    const playerInventory = this.inventoryStore
      .getSnapshot()
      .player.filter((entry) => {
        const definition = this.inventoryStore.getItemDefinition(entry.itemId);
        return definition.alchemyRole === "ingredient" || definition.alchemyRole === "solvent";
      })
      .map((entry) => ({
        itemId: entry.itemId,
        label: entry.label,
        quantity: entry.quantity
      }));

    return {
      stationTitle: this.stationTitle,
      recipes: Array.from(this.recipes.values()).map((recipe) => this.resolveRecipeView(recipe)),
      playerInventory
    };
  }

  craft(recipeId: string): CraftResult {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return {
        success: false,
        message: "That recipe has gone missing from the station notes."
      };
    }

    if (!this.inventoryStore.hasPlayerItems(recipe.ingredients)) {
      return {
        success: false,
        recipeId,
        message: `Missing ingredients for ${recipe.title}.`
      };
    }

    this.inventoryStore.consumePlayerItems(recipe.ingredients);
    this.inventoryStore.addManyToPlayer(recipe.outputs);

    const outputLabels = recipe.outputs
      .map((output) => `${output.quantity}x ${this.inventoryStore.getItemDefinition(output.itemId).label}`)
      .join(", ");

    return {
      success: true,
      recipeId,
      message: `Crafted ${outputLabels}.`
    };
  }

  private resolveRecipeView(recipe: RecipeDefinition): RecipeView {
    const requirements = recipe.ingredients.map((requirement) => {
      const definition = this.inventoryStore.getItemDefinition(requirement.itemId);
      const available = this.inventoryStore.getPlayerQuantity(requirement.itemId);
      return {
        itemId: requirement.itemId,
        label: definition.label,
        quantity: requirement.quantity,
        available,
        sufficient: available >= requirement.quantity
      };
    });

    const outputs: RecipeOutputView[] = recipe.outputs.map((output) => ({
      itemId: output.itemId,
      label: this.inventoryStore.getItemDefinition(output.itemId).label,
      quantity: output.quantity
    }));

    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      craftable: requirements.every((requirement) => requirement.sufficient),
      requirements,
      outputs
    };
  }
}
