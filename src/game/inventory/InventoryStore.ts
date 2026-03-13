import type { PickupItemDefinition } from "../interactions/types";

export interface InventoryStack {
  itemId: string;
  quantity: number;
}

export interface InventoryEntryView extends InventoryStack {
  label: string;
  description?: string;
  maxStack: number;
  stackQuantities: number[];
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
      player: this.resolveEntries(this.aggregateStacks(this.playerItems)),
      containers: Array.from(this.containerStates.values()).map((container) => ({
        id: container.id,
        title: container.title,
        items: this.resolveEntries(this.aggregateStacks(container.items))
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

  addManyToPlayer(items: InventoryStack[]): void {
    items.forEach((item) => {
      this.addToStacks(this.playerItems, item.itemId, item.quantity);
    });
    this.emitChange();
  }

  removeFromPlayer(itemId: string, quantity: number): boolean {
    const removed = this.removeFromStacks(this.playerItems, itemId, quantity);
    if (removed) {
      this.emitChange();
    }
    return removed;
  }

  getPlayerQuantity(itemId: string): number {
    return this.playerItems
      .filter((stack) => stack.itemId === itemId)
      .reduce((sum, stack) => sum + stack.quantity, 0);
  }

  hasPlayerItems(items: InventoryStack[]): boolean {
    return items.every((item) => this.getPlayerQuantity(item.itemId) >= item.quantity);
  }

  consumePlayerItems(items: InventoryStack[]): boolean {
    if (!this.hasPlayerItems(items)) {
      return false;
    }

    items.forEach((item) => {
      this.removeFromStacks(this.playerItems, item.itemId, item.quantity);
    });
    this.emitChange();
    return true;
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

  private resolveEntries(
    stacks: Array<InventoryStack & { stackQuantities?: number[] }>
  ): InventoryEntryView[] {
    return stacks.map((stack) => {
      const definition = this.getItemDefinition(stack.itemId);
      return {
        itemId: stack.itemId,
        quantity: stack.quantity,
        label: definition.label,
        description: definition.description,
        maxStack: definition.maxStack,
        stackQuantities: stack.stackQuantities ?? [stack.quantity]
      };
    });
  }

  private aggregateStacks(stacks: InventoryStack[]): Array<InventoryStack & { stackQuantities: number[] }> {
    const totals = new Map<string, { quantity: number; stackQuantities: number[] }>();
    const order: string[] = [];

    stacks.forEach((stack) => {
      if (!totals.has(stack.itemId)) {
        order.push(stack.itemId);
        totals.set(stack.itemId, {
          quantity: 0,
          stackQuantities: []
        });
      }
      const entry = totals.get(stack.itemId)!;
      entry.quantity += stack.quantity;
      entry.stackQuantities.push(stack.quantity);
    });

    return order.map((itemId) => ({
      itemId,
      quantity: totals.get(itemId)!.quantity,
      stackQuantities: totals.get(itemId)!.stackQuantities
    }));
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
