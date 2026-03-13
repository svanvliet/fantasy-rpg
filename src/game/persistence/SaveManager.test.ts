import { describe, expect, it } from "vitest";

import { SaveManager, type GameSaveState, type StorageLike } from "./SaveManager";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("SaveManager", () => {
  it("round-trips game state through storage", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const saveState: GameSaveState = {
      version: 1,
      savedAt: "2026-03-12T18:00:00.000Z",
      player: {
        position: { x: 1, y: 2, z: 3 },
        yaw: 0.5,
        pitch: -0.2
      },
      inventory: {
        player: [{ itemId: "moonwater-vial", quantity: 2 }],
        containers: [{ id: "foot-locker", items: [{ itemId: "linen-wrap", quantity: 1 }] }]
      },
      interaction: {
        collectedPickupIds: ["alchemy-bottle-0"],
        droppedItems: [
          {
            id: "dropped-moonwater-vial-1",
            itemId: "moonwater-vial",
            position: { x: 4, y: 1, z: -2 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            linearVelocity: { x: 0, y: 0, z: 0 },
            angularVelocity: { x: 0, y: 0, z: 0 },
            localAnchor: { x: 0, y: 0, z: 0 }
          }
        ]
      }
    };

    manager.save(saveState);

    expect(manager.load()).toEqual(saveState);
  });

  it("returns null for invalid save payloads", () => {
    const storage = new MemoryStorage();
    storage.setItem("fantasy-rpg-save-v1", "{invalid json");
    const manager = new SaveManager(storage);

    expect(manager.load()).toBeNull();
  });
});
