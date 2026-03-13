import { describe, expect, it } from "vitest";

import { InventoryStore } from "../inventory/InventoryStore";
import { ITEM_DEFINITIONS } from "../inventory/prototypeContent";

import { ObjectiveSystem } from "./ObjectiveSystem";
import { STEWARD_OBJECTIVES } from "./prototypeObjectives";

describe("ObjectiveSystem", () => {
  it("starts with the first objective selected and can accept it", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const objectives = new ObjectiveSystem(inventoryStore, STEWARD_OBJECTIVES);

    expect(objectives.getObjectiveSnapshot().id).toBe("steward-remedy");
    expect(objectives.getObjectiveSnapshot().status).toBe("not_started");

    const result = objectives.performAction("accept");

    expect(result.success).toBe(true);
    expect(objectives.getObjectiveSnapshot("steward-remedy").status).toBe("active");
    expect(objectives.getTrackerSnapshot().title).toBe("Steward's Remedy");
  });

  it("supports multiple accepted objectives and lets the tracked quest change", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const objectives = new ObjectiveSystem(inventoryStore, STEWARD_OBJECTIVES);

    objectives.performAction("accept");
    objectives.performAction("select:steward-watch");
    objectives.performAction("accept");

    expect(objectives.getObjectiveSnapshot("steward-watch").status).toBe("active");
    expect(objectives.getTrackerSnapshot().title).toBe("Night Watch Draught");

    objectives.performAction("select:steward-remedy");
    objectives.performAction("track");

    expect(objectives.getTrackerSnapshot().title).toBe("Steward's Remedy");
  });

  it("becomes ready to turn in when the player has the required item", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const objectives = new ObjectiveSystem(inventoryStore, STEWARD_OBJECTIVES);

    objectives.performAction("accept");
    inventoryStore.addToPlayer("verdant-restorative", 1);

    expect(objectives.getObjectiveSnapshot("steward-remedy").status).toBe("ready_to_turn_in");
    expect(objectives.getTrackerSnapshot().stepLabel).toContain("Return to Steward Rowan");
  });

  it("consumes the required item when turning in the selected objective", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const objectives = new ObjectiveSystem(inventoryStore, STEWARD_OBJECTIVES);

    objectives.performAction("accept");
    inventoryStore.addToPlayer("verdant-restorative", 1);

    const result = objectives.performAction("turn-in");

    expect(result.success).toBe(true);
    expect(objectives.getObjectiveSnapshot("steward-remedy").status).toBe("completed");
    expect(inventoryStore.getPlayerQuantity("verdant-restorative")).toBe(0);
  });

  it("restores statuses and tracked quest, then re-evaluates inventory-driven progress", () => {
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const objectives = new ObjectiveSystem(inventoryStore, STEWARD_OBJECTIVES);

    inventoryStore.addToPlayer("emberguard-draught", 1);
    objectives.restore({
      objectives: [
        { objectiveId: "steward-remedy", status: "completed" },
        { objectiveId: "steward-watch", status: "active" }
      ],
      trackedObjectiveId: "steward-watch"
    });

    expect(objectives.getObjectiveSnapshot("steward-remedy").status).toBe("completed");
    expect(objectives.getObjectiveSnapshot("steward-watch").status).toBe("ready_to_turn_in");
    expect(objectives.getTrackerSnapshot().title).toBe("Night Watch Draught");
  });
});
