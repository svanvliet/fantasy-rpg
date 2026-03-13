import type { DialogueObjectiveView, DialogueSnapshot } from "../game/objectives/types";

export interface DialoguePanelActions {
  onClose: () => void;
  onAction: (actionId: string) => { success: boolean; message: string };
}

export interface DialoguePanelController {
  isOpen(): boolean;
  open(): void;
  close(): void;
  sync(snapshot: DialogueSnapshot): void;
  setStatus(message: string, tone?: "neutral" | "success" | "warning"): void;
}

const DEFAULT_STATUS = "Listen, accept the task, or return once the work is done.";

export function createDialoguePanel(
  parent: HTMLElement,
  actions: DialoguePanelActions
): DialoguePanelController {
  const panel = document.createElement("section");
  panel.className = "dialogue-panel hidden";
  panel.innerHTML = `
    <header class="dialogue-header">
      <div>
        <p class="dialogue-eyebrow">Phase 10 Prototype</p>
        <h1>Castle Steward</h1>
      </div>
      <button type="button" class="dialogue-close">Close</button>
    </header>
    <div class="dialogue-body">
      <p class="dialogue-speaker"></p>
      <p class="dialogue-copy"></p>
      <section class="dialogue-ledger">
        <header>
          <h2>Steward Ledger</h2>
          <p class="dialogue-ledger-summary"></p>
        </header>
        <div class="dialogue-objective-list"></div>
      </section>
      <section class="dialogue-objective">
        <h2></h2>
        <p class="dialogue-progress"></p>
      </section>
    </div>
    <footer class="dialogue-footer">
      <div class="dialogue-actions"></div>
      <p class="dialogue-status" data-tone="neutral"></p>
    </footer>
  `;
  parent.append(panel);

  const title = panel.querySelector<HTMLHeadingElement>("h1")!;
  const speaker = panel.querySelector<HTMLElement>(".dialogue-speaker")!;
  const copy = panel.querySelector<HTMLElement>(".dialogue-copy")!;
  const ledgerSummary = panel.querySelector<HTMLElement>(".dialogue-ledger-summary")!;
  const objectiveList = panel.querySelector<HTMLElement>(".dialogue-objective-list")!;
  const objectiveLabel = panel.querySelector<HTMLHeadingElement>(".dialogue-objective h2")!;
  const progress = panel.querySelector<HTMLElement>(".dialogue-progress")!;
  const actionRoot = panel.querySelector<HTMLElement>(".dialogue-actions")!;
  const closeButton = panel.querySelector<HTMLButtonElement>(".dialogue-close")!;
  const status = panel.querySelector<HTMLElement>(".dialogue-status")!;

  let open = false;
  let snapshot: DialogueSnapshot = {
    speaker: "Castle Steward",
    title: "Steward's Remedy",
    body: "The keep needs simple, directed work before deeper stories arrive.",
    objectiveLabel: "Offer",
    progressLabel: "No active objective.",
    actions: [],
    objectives: [],
    activeCountLabel: "No active tasks yet."
  };

  function resetStatus(): void {
    status.textContent = DEFAULT_STATUS;
    status.dataset.tone = "neutral";
  }

  function render(): void {
    if (!open) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    title.textContent = snapshot.title;
    speaker.textContent = snapshot.speaker;
    copy.textContent = snapshot.body;
    ledgerSummary.textContent = snapshot.activeCountLabel;
    objectiveList.innerHTML = renderObjectiveList(snapshot.objectives);
    objectiveLabel.textContent = snapshot.objectiveLabel;
    progress.textContent = snapshot.progressLabel;
    actionRoot.innerHTML = snapshot.actions
      .map(
        (action) => `
          <button
            type="button"
            class="dialogue-action"
            data-action-id="${action.id}"
            data-tone="${action.tone ?? "secondary"}"
            ${action.disabled ? "disabled" : ""}
          >
            ${action.label}
          </button>
        `
      )
      .join("");
  }

  function renderObjectiveList(objectives: DialogueObjectiveView[]): string {
    return objectives
      .map(
        (objective) => `
          <button
            type="button"
            class="dialogue-objective-item ${objective.selected ? "is-selected" : ""}"
            data-action-id="select:${objective.id}"
          >
            <span class="dialogue-objective-item-copy">
              <strong>${objective.title}</strong>
              <small>${objective.statusLabel}${objective.tracked ? " · Tracked" : ""}</small>
            </span>
          </button>
        `
      )
      .join("");
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
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button[data-action-id]");
    if (!button) {
      return;
    }

    const actionId = button.dataset.actionId;
    if (!actionId) {
      return;
    }

    const result = actions.onAction(actionId);
    status.textContent = result.message;
    status.dataset.tone = result.success ? "success" : "warning";
  });

  return {
    isOpen() {
      return open;
    },
    open() {
      open = true;
      resetStatus();
      render();
    },
    close() {
      open = false;
      resetStatus();
      render();
    },
    sync(nextSnapshot) {
      snapshot = nextSnapshot;
      render();
    },
    setStatus(message, tone = "neutral") {
      status.textContent = message;
      status.dataset.tone = tone;
    }
  };
}
