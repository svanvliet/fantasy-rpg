import { describe, expect, it } from "vitest";

import { InventoryStore } from "../inventory/InventoryStore";
import { ITEM_DEFINITIONS } from "../inventory/prototypeContent";
import { AlchemySystem } from "./AlchemySystem";
import { ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE } from "./prototypeRecipes";

describe("AlchemySystem", () => {
  it("marks recipes craftable only when the player has the required ingredients", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const alchemy = new AlchemySystem(inventoryStore, ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE);

    inventoryStore.addToPlayer("bittermoss-extract", 1);
    inventoryStore.addToPlayer("moonwater-vial", 1);

    const snapshot = alchemy.getSnapshot();
    expect(snapshot.recipes.find((recipe) => recipe.id === "verdant-restorative")?.craftable).toBe(true);
    expect(snapshot.recipes.find((recipe) => recipe.id === "emberguard-draught")?.craftable).toBe(false);
  });

  it("shows only alchemy reagents in the station inventory summary", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const alchemy = new AlchemySystem(inventoryStore, ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE);

    inventoryStore.addToPlayer("moonwater-vial", 1);
    inventoryStore.addToPlayer("field-journal", 1);
    inventoryStore.addToPlayer("travel-satchel", 1);
    inventoryStore.addToPlayer("verdant-restorative", 1);

    const snapshot = alchemy.getSnapshot();

    expect(snapshot.playerInventory.map((entry) => entry.itemId)).toEqual(["moonwater-vial"]);
  });

  it("consumes ingredients and adds crafted outputs to player inventory", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const alchemy = new AlchemySystem(inventoryStore, ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE);

    inventoryStore.addToPlayer("bittermoss-extract", 1);
    inventoryStore.addToPlayer("moonwater-vial", 1);

    const result = alchemy.craft("verdant-restorative");

    expect(result.success).toBe(true);
    const snapshot = inventoryStore.getSnapshot();
    expect(snapshot.player.find((entry) => entry.itemId === "bittermoss-extract")).toBeUndefined();
    expect(snapshot.player.find((entry) => entry.itemId === "moonwater-vial")).toBeUndefined();
    expect(snapshot.player.find((entry) => entry.itemId === "verdant-restorative")?.quantity).toBe(1);
  });

  it("refuses to craft when the player lacks ingredients", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const alchemy = new AlchemySystem(inventoryStore, ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE);

    inventoryStore.addToPlayer("bittermoss-extract", 1);

    const result = alchemy.craft("verdant-restorative");

    expect(result.success).toBe(false);
    expect(inventoryStore.getSnapshot().player.find((entry) => entry.itemId === "bittermoss-extract")?.quantity).toBe(1);
  });
});
