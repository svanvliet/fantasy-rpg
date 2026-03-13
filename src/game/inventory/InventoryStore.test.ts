import { describe, expect, it } from "vitest";

import { InventoryStore } from "./InventoryStore";
import { ITEM_DEFINITIONS } from "./prototypeContent";

describe("InventoryStore", () => {
  it("merges stacks up to the item stack limit", () => {
    const store = new InventoryStore(ITEM_DEFINITIONS);

    store.addToPlayer("moonwater-vial", 10);

    const snapshot = store.getSnapshot();
    const moonwaterStacks = snapshot.player.filter((entry) => entry.itemId === "moonwater-vial");
    expect(moonwaterStacks).toHaveLength(2);
    expect(moonwaterStacks[0].quantity).toBe(8);
    expect(moonwaterStacks[1].quantity).toBe(2);
  });

  it("transfers a partial quantity between player and container", () => {
    const store = new InventoryStore(ITEM_DEFINITIONS);
    store.registerContainer("cabinet-left", "Herb Cabinet", [{ itemId: "bittermoss-extract", quantity: 2 }]);

    store.transferContainerToPlayer("cabinet-left", "bittermoss-extract", 1);

    let snapshot = store.getSnapshot();
    expect(snapshot.player.find((entry) => entry.itemId === "bittermoss-extract")?.quantity).toBe(1);
    expect(snapshot.containers[0].items.find((entry) => entry.itemId === "bittermoss-extract")?.quantity).toBe(1);

    store.transferPlayerToContainer("cabinet-left", "bittermoss-extract", 1);

    snapshot = store.getSnapshot();
    expect(snapshot.player.find((entry) => entry.itemId === "bittermoss-extract")).toBeUndefined();
    expect(snapshot.containers[0].items.find((entry) => entry.itemId === "bittermoss-extract")?.quantity).toBe(2);
  });

  it("refuses transfers when the source does not have enough quantity", () => {
    const store = new InventoryStore(ITEM_DEFINITIONS);
    store.registerContainer("foot-locker", "Foot Locker", [{ itemId: "tallow-candle", quantity: 1 }]);

    expect(store.transferContainerToPlayer("foot-locker", "tallow-candle", 2)).toBe(false);
    expect(store.removeFromPlayer("tallow-candle", 1)).toBe(false);
  });
});
