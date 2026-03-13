import type { AlchemySnapshot } from "../game/alchemy/types";

export interface AlchemyPanelActions {
  onClose: () => void;
  onCraft: (recipeId: string) => { success: boolean; message: string };
}

export interface AlchemyPanelController {
  isOpen(): boolean;
  open(stationTitle?: string): void;
  close(): void;
  sync(snapshot: AlchemySnapshot): void;
  setStatus(message: string, tone?: "neutral" | "success" | "warning"): void;
}

interface AlchemyPanelState {
  open: boolean;
  stationTitle: string;
}

const DEFAULT_STATUS_MESSAGE = "Select a recipe to brew at the station.";

export function createAlchemyPanel(
  parent: HTMLElement,
  actions: AlchemyPanelActions
): AlchemyPanelController {
  const panel = document.createElement("section");
  panel.className = "alchemy-panel hidden";
  panel.innerHTML = `
    <header class="alchemy-header">
      <div>
        <p class="alchemy-eyebrow">Phase 9 Prototype</p>
        <h1>Alchemy Table</h1>
      </div>
      <button type="button" class="alchemy-close">Close</button>
    </header>
    <p class="alchemy-help">
      Brew authored recipes using ingredients from your pack. Crafting consumes inventory ingredients and places finished mixtures back into your pack.
    </p>
    <div class="alchemy-scroll">
      <div class="alchemy-body"></div>
    </div>
    <footer class="alchemy-footer">
      <p class="alchemy-status" data-tone="neutral"></p>
    </footer>
  `;
  parent.append(panel);

  const body = panel.querySelector<HTMLElement>(".alchemy-body")!;
  const closeButton = panel.querySelector<HTMLButtonElement>(".alchemy-close")!;
  const title = panel.querySelector<HTMLHeadingElement>("h1")!;
  const status = panel.querySelector<HTMLElement>(".alchemy-status")!;

  const state: AlchemyPanelState = {
    open: false,
    stationTitle: "Alchemy Table"
  };

  let snapshot: AlchemySnapshot = {
    stationTitle: "Alchemy Table",
    recipes: [],
    playerInventory: []
  };

  function resetStatus(): void {
    status.textContent = DEFAULT_STATUS_MESSAGE;
    status.dataset.tone = "neutral";
  }

  function renderInventorySummary(): string {
    if (snapshot.playerInventory.length === 0) {
      return `
        <section class="alchemy-column">
          <header><h2>Pack Reagents</h2></header>
          <p class="alchemy-empty">Pack empty</p>
        </section>
      `;
    }

    return `
      <section class="alchemy-column">
        <header><h2>Pack Reagents</h2></header>
        <ul class="alchemy-inventory-list">
          ${snapshot.playerInventory
            .map(
              (entry) => `
                <li class="alchemy-inventory-row">
                  <strong>${entry.label}</strong>
                  <span>${entry.quantity}</span>
                </li>
              `
            )
            .join("")}
        </ul>
      </section>
    `;
  }

  function renderRecipes(): string {
    if (snapshot.recipes.length === 0) {
      return `
        <section class="alchemy-column">
          <header><h2>Recipes</h2></header>
          <p class="alchemy-empty">No recipes available</p>
        </section>
      `;
    }

    return `
      <section class="alchemy-column">
        <header><h2>Recipes</h2></header>
        <div class="alchemy-recipe-list">
          ${snapshot.recipes
            .map(
              (recipe) => `
                <article class="alchemy-recipe ${recipe.craftable ? "craftable" : "missing"}">
                  <div class="alchemy-recipe-copy">
                    <h3>${recipe.title}</h3>
                    <p>${recipe.description}</p>
                  </div>
                  <div class="alchemy-recipe-meta">
                    <div>
                      <h4>Requires</h4>
                      <ul>
                        ${recipe.requirements
                          .map(
                            (requirement) => `
                              <li class="${requirement.sufficient ? "sufficient" : "insufficient"}">
                                ${requirement.label} x${requirement.quantity}
                                <span>${requirement.available}/${requirement.quantity}</span>
                              </li>
                            `
                          )
                          .join("")}
                      </ul>
                    </div>
                    <div>
                      <h4>Creates</h4>
                      <ul>
                        ${recipe.outputs
                          .map(
                            (output) => `
                              <li>${output.label} x${output.quantity}</li>
                            `
                          )
                          .join("")}
                      </ul>
                    </div>
                  </div>
                  <button type="button" data-recipe-id="${recipe.id}" ${recipe.craftable ? "" : "disabled"}>
                    ${recipe.craftable ? "Craft" : "Missing Ingredients"}
                  </button>
                </article>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function render(): void {
    if (!state.open) {
      panel.classList.add("hidden");
      return;
    }

    title.textContent = state.stationTitle;
    panel.classList.remove("hidden");
    body.innerHTML = `
      <div class="alchemy-grid">
        ${renderRecipes()}
        ${renderInventorySummary()}
      </div>
    `;
  }

  closeButton.addEventListener("click", () => {
    actions.onClose();
  });

  panel.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  panel.addEventListener("click", (event) => {
    event.stopPropagation();
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const recipeId = target.dataset.recipeId;
    if (!recipeId) {
      return;
    }

    const result = actions.onCraft(recipeId);
    status.textContent = result.message;
    status.dataset.tone = result.success ? "success" : "warning";
  });

  return {
    isOpen() {
      return state.open;
    },
    open(stationTitle) {
      state.open = true;
      state.stationTitle = stationTitle ?? snapshot.stationTitle;
      resetStatus();
      render();
    },
    close() {
      state.open = false;
      resetStatus();
      render();
    },
    sync(nextSnapshot) {
      snapshot = nextSnapshot;
      if (!state.open) {
        state.stationTitle = nextSnapshot.stationTitle;
      }
      render();
    },
    setStatus(message, tone = "neutral") {
      status.textContent = message;
      status.dataset.tone = tone;
    }
  };
}
