import type { InventorySaveState } from "../inventory/InventoryStore";
import type { PlayerPersistenceState } from "../player/PlayerController";

export const SAVE_STORAGE_KEY = "fantasy-rpg-save-v1";

export interface Vector3SaveState {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionSaveState {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface DroppedItemSaveState {
  id: string;
  itemId: string;
  position: Vector3SaveState;
  rotation: QuaternionSaveState;
  linearVelocity: Vector3SaveState;
  angularVelocity: Vector3SaveState;
  localAnchor: Vector3SaveState;
}

export interface InteractionSaveState {
  collectedPickupIds: string[];
  droppedItems: DroppedItemSaveState[];
}

export interface GameSaveState {
  version: 1;
  savedAt: string;
  player: PlayerPersistenceState;
  inventory: InventorySaveState;
  interaction: InteractionSaveState;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class SaveManager {
  private readonly storage: StorageLike;
  private readonly storageKey: string;

  constructor(storage: StorageLike, storageKey = SAVE_STORAGE_KEY) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  load(): GameSaveState | null {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as GameSaveState;
      if (parsed.version !== 1) {
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn("Failed to load saved prototype state.", error);
      return null;
    }
  }

  save(state: GameSaveState): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to save prototype state.", error);
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.storageKey);
    } catch (error) {
      console.warn("Failed to clear saved prototype state.", error);
    }
  }
}
