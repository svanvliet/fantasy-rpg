import type { InventoryEntryView, InventorySnapshot } from "../game/inventory/InventoryStore";

export interface InventoryPanelActions {
  onClose: () => void;
  onDropPlayerItem: (itemId: string) => void;
  onTransferPlayerToContainer: (containerId: string, itemId: string, quantity: number) => void;
  onTransferContainerToPlayer: (containerId: string, itemId: string, quantity: number) => void;
}

interface InventoryPanelState {
  mode: "closed" | "player" | "container";
  containerId: string | null;
}

export interface InventoryPanelController {
  isOpen(): boolean;
  openPlayerInventory(): void;
  openContainer(containerId: string): void;
  close(): void;
  sync(snapshot: InventorySnapshot): void;
}

function renderInventoryList(
  title: string,
  entries: InventoryEntryView[],
  controls: (entry: InventoryEntryView) => string
): string {
  if (entries.length === 0) {
    return `
      <section class="inventory-column">
        <header><h2>${title}</h2></header>
        <p class="inventory-empty">Empty</p>
      </section>
    `;
  }

  return `
    <section class="inventory-column">
      <header><h2>${title}</h2></header>
      <ul class="inventory-list">
        ${entries
          .map(
            (entry) => `
              <li class="inventory-row">
                <div class="inventory-entry-copy">
                  <strong>${entry.label}</strong>
                  <span>${renderStackLabel(entry)}</span>
                  ${entry.description ? `<small>${entry.description}</small>` : ""}
                </div>
                <div class="inventory-actions">${controls(entry)}</div>
              </li>
            `
          )
          .join("")}
      </ul>
    </section>
  `;
}

function renderStackLabel(entry: InventoryEntryView): string {
  if (entry.stackQuantities.length <= 1) {
    return `${entry.quantity} / ${entry.maxStack}`;
  }

  const stackSummary = entry.stackQuantities
    .map((quantity) => `${quantity}/${entry.maxStack}`)
    .join(" + ");
  return `${entry.quantity} total · stacks ${stackSummary}`;
}

export function createInventoryPanel(
  parent: HTMLElement,
  actions: InventoryPanelActions
): InventoryPanelController {
  const panel = document.createElement("section");
  panel.className = "inventory-panel hidden";
  panel.innerHTML = `
    <header class="inventory-header">
      <div>
        <p class="inventory-eyebrow">Phase 4 Prototype</p>
        <h1>Inventory</h1>
      </div>
      <button type="button" class="inventory-close">Close</button>
    </header>
    <p class="inventory-help">
      Click <strong>Move 1</strong> to split a stack by one item, <strong>Move All</strong> to transfer the full stack, and <strong>Drop 1</strong> to place one item back into the world.
    </p>
    <div class="inventory-body"></div>
  `;
  parent.append(panel);

  const body = panel.querySelector<HTMLElement>(".inventory-body")!;
  const closeButton = panel.querySelector<HTMLButtonElement>(".inventory-close")!;
  const state: InventoryPanelState = {
    mode: "closed",
    containerId: null
  };
  let snapshot: InventorySnapshot = {
    player: [],
    containers: []
  };

  function getActiveContainer(): InventorySnapshot["containers"][number] | null {
    if (!state.containerId) {
      return null;
    }

    return snapshot.containers.find((container) => container.id === state.containerId) ?? null;
  }

  function render(): void {
    if (state.mode === "closed") {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    const titleElement = panel.querySelector("h1")!;
    if (state.mode === "player") {
      titleElement.textContent = "Player Inventory";
      body.innerHTML = renderInventoryList("Pack", snapshot.player, (entry) => {
        return `
          <button type="button" data-action="drop" data-item-id="${entry.itemId}">Drop 1</button>
        `;
      });
      return;
    }

    const container = getActiveContainer();
    titleElement.textContent = container?.title ?? "Container";
    body.innerHTML = `
      <div class="inventory-grid">
        ${renderInventoryList("Pack", snapshot.player, (entry) => {
          return `
            <button type="button" data-action="store-one" data-item-id="${entry.itemId}">Move 1</button>
            <button type="button" data-action="store-all" data-item-id="${entry.itemId}">Move All</button>
            <button type="button" data-action="drop" data-item-id="${entry.itemId}">Drop 1</button>
          `;
        })}
        ${renderInventoryList(container?.title ?? "Container", container?.items ?? [], (entry) => {
          return `
            <button type="button" data-action="take-one" data-item-id="${entry.itemId}">Move 1</button>
            <button type="button" data-action="take-all" data-item-id="${entry.itemId}">Move All</button>
          `;
        })}
      </div>
    `;
  }

  closeButton.addEventListener("click", () => {
    actions.onClose();
  });

  panel.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const itemId = target.dataset.itemId;
    const action = target.dataset.action;
    if (!itemId || !action) {
      return;
    }

    if (action === "drop") {
      actions.onDropPlayerItem(itemId);
      return;
    }

    if (!state.containerId) {
      return;
    }

    if (action === "store-one") {
      actions.onTransferPlayerToContainer(state.containerId, itemId, 1);
      return;
    }

    if (action === "store-all") {
      const entry = snapshot.player.find((candidate) => candidate.itemId === itemId);
      if (entry) {
        actions.onTransferPlayerToContainer(state.containerId, itemId, entry.quantity);
      }
      return;
    }

    if (action === "take-one") {
      actions.onTransferContainerToPlayer(state.containerId, itemId, 1);
      return;
    }

    if (action === "take-all") {
      const container = getActiveContainer();
      const entry = container?.items.find((candidate) => candidate.itemId === itemId);
      if (entry) {
        actions.onTransferContainerToPlayer(state.containerId, itemId, entry.quantity);
      }
    }
  });

  return {
    isOpen() {
      return state.mode !== "closed";
    },
    openPlayerInventory() {
      state.mode = "player";
      state.containerId = null;
      render();
    },
    openContainer(containerId: string) {
      state.mode = "container";
      state.containerId = containerId;
      render();
    },
    close() {
      state.mode = "closed";
      state.containerId = null;
      render();
    },
    sync(nextSnapshot: InventorySnapshot) {
      snapshot = nextSnapshot;
      if (state.mode === "container" && !getActiveContainer()) {
        state.mode = "player";
        state.containerId = null;
      }
      render();
    }
  };
}
