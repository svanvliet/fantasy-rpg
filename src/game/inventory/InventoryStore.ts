import type { PickupItemDefinition } from "../interactions/types";

export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export interface InventoryEntryView extends InventoryStack {
  label: string;
  description?: string;
  maxStack: number;
}

export interface ContainerState {
  id: string;
  title: string;
  items: InventoryStack[];
}

export interface InventoryContainerView {
  id: string;
  title: string;
  items: InventoryEntryView[];
}

export interface InventorySnapshot {
  player: InventoryEntryView[];
  containers: InventoryContainerView[];
}

export interface InventorySaveState {
  player: InventoryStack[];
  containers: Array<{
    id: string;
    items: InventoryStack[];
  }>;
}

type InventoryListener = () => void;

export class InventoryStore {
  private readonly itemDefinitions = new Map<string, PickupItemDefinition>();
  private readonly containerStates = new Map<string, ContainerState>();
  private readonly listeners = new Set<InventoryListener>();
  private readonly playerItems: InventoryStack[] = [];

  constructor(itemDefinitions: PickupItemDefinition[]) {
    itemDefinitions.forEach((definition) => {
      this.itemDefinitions.set(definition.id, definition);
    });
  }

  subscribe(listener: InventoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  registerContainer(id: string, title: string, items: InventoryStack[]): void {
    this.containerStates.set(id, {
      id,
      title,
      items: this.normalizeStacks(items)
    });
    this.emitChange();
  }

  getSnapshot(): InventorySnapshot {
    return {
      player: this.resolveEntries(this.playerItems),
      containers: Array.from(this.containerStates.values()).map((container) => ({
        id: container.id,
        title: container.title,
        items: this.resolveEntries(container.items)
      }))
    };
  }

  getContainer(containerId: string): ContainerState | null {
    return this.containerStates.get(containerId) ?? null;
  }

  getSaveState(): InventorySaveState {
    return {
      player: this.cloneStacks(this.playerItems),
      containers: Array.from(this.containerStates.values()).map((container) => ({
        id: container.id,
        items: this.cloneStacks(container.items)
      }))
    };
  }

  restore(saveState: InventorySaveState): void {
    this.playerItems.splice(0, this.playerItems.length, ...this.normalizeStacks(saveState.player ?? []));

    saveState.containers.forEach((containerState) => {
      const container = this.containerStates.get(containerState.id);
      if (!container) {
        return;
      }

      container.items = this.normalizeStacks(containerState.items ?? []);
    });

    this.emitChange();
  }

  addToPlayer(itemId: string, quantity: number): void {
    this.addToStacks(this.playerItems, itemId, quantity);
    this.emitChange();
  }

  removeFromPlayer(itemId: string, quantity: number): boolean {
    const removed = this.removeFromStacks(this.playerItems, itemId, quantity);
    if (removed) {
      this.emitChange();
    }
    return removed;
  }

  transferPlayerToContainer(containerId: string, itemId: string, quantity: number): boolean {
    const container = this.containerStates.get(containerId);
    if (!container) {
      return false;
    }

    if (!this.removeFromStacks(this.playerItems, itemId, quantity)) {
      return false;
    }

    this.addToStacks(container.items, itemId, quantity);
    this.emitChange();
    return true;
  }

  transferContainerToPlayer(containerId: string, itemId: string, quantity: number): boolean {
    const container = this.containerStates.get(containerId);
    if (!container) {
      return false;
    }

    if (!this.removeFromStacks(container.items, itemId, quantity)) {
      return false;
    }

    this.addToStacks(this.playerItems, itemId, quantity);
    this.emitChange();
    return true;
  }

  getItemDefinition(itemId: string): PickupItemDefinition {
    const definition = this.itemDefinitions.get(itemId);
    if (!definition) {
      throw new Error(`Missing item definition: ${itemId}`);
    }

    return definition;
  }

  private addToStacks(stacks: InventoryStack[], itemId: string, quantity: number): void {
    const definition = this.getItemDefinition(itemId);
    let remaining = quantity;

    for (const stack of stacks) {
      if (stack.itemId !== itemId || stack.quantity >= definition.maxStack) {
        continue;
      }

      const availableSpace = definition.maxStack - stack.quantity;
      const moved = Math.min(availableSpace, remaining);
      stack.quantity += moved;
      remaining -= moved;
      if (remaining === 0) {
        return;
      }
    }

    while (remaining > 0) {
      const stackQuantity = Math.min(remaining, definition.maxStack);
      stacks.push({
        itemId,
        quantity: stackQuantity
      });
      remaining -= stackQuantity;
    }
  }

  private removeFromStacks(stacks: InventoryStack[], itemId: string, quantity: number): boolean {
    let remaining = quantity;
    const totalQuantity = stacks
      .filter((stack) => stack.itemId === itemId)
      .reduce((sum, stack) => sum + stack.quantity, 0);

    if (totalQuantity < quantity) {
      return false;
    }

    for (let index = stacks.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const stack = stacks[index];
      if (stack.itemId !== itemId) {
        continue;
      }

      const removed = Math.min(stack.quantity, remaining);
      stack.quantity -= removed;
      remaining -= removed;

      if (stack.quantity === 0) {
        stacks.splice(index, 1);
      }
    }

    return true;
  }

  private resolveEntries(stacks: InventoryStack[]): InventoryEntryView[] {
    return stacks.map((stack) => {
      const definition = this.getItemDefinition(stack.itemId);
      return {
        itemId: stack.itemId,
        quantity: stack.quantity,
        label: definition.label,
        description: definition.description,
        maxStack: definition.maxStack
      };
    });
  }

  private normalizeStacks(stacks: InventoryStack[]): InventoryStack[] {
    const normalized: InventoryStack[] = [];
    stacks.forEach((stack) => {
      this.addToStacks(normalized, stack.itemId, stack.quantity);
    });
    return normalized;
  }

  private cloneStacks(stacks: InventoryStack[]): InventoryStack[] {
    return stacks.map((stack) => ({
      itemId: stack.itemId,
      quantity: stack.quantity
    }));
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}
