import type { InventoryStore } from "../inventory/InventoryStore";

import type {
  DialogueObjectiveView,
  DialogueSnapshot,
  ObjectiveActionResult,
  ObjectiveDefinition,
  ObjectiveSaveState,
  ObjectiveSnapshot,
  ObjectiveStatus,
  ObjectiveTrackerSnapshot
} from "./types";

type ObjectiveListener = () => void;

export class ObjectiveSystem {
  private readonly inventoryStore: InventoryStore;
  private readonly objectives = new Map<string, ObjectiveDefinition>();
  private readonly objectiveOrder: string[];
  private readonly listeners = new Set<ObjectiveListener>();

  private readonly statuses = new Map<string, ObjectiveStatus>();
  private selectedObjectiveId: string;
  private trackedObjectiveId: string | null = null;

  constructor(inventoryStore: InventoryStore, objectives: ObjectiveDefinition[]) {
    this.inventoryStore = inventoryStore;
    this.objectiveOrder = objectives.map((objective) => objective.id);

    objectives.forEach((objective) => {
      this.objectives.set(objective.id, objective);
      this.statuses.set(objective.id, "not_started");
    });

    this.selectedObjectiveId = this.objectiveOrder[0];

    this.inventoryStore.subscribe(() => {
      if (this.syncProgressFromInventory()) {
        this.emitChange();
      }
    });
  }

  subscribe(listener: ObjectiveListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSaveState(): ObjectiveSaveState {
    return {
      objectives: this.objectiveOrder.map((objectiveId) => ({
        objectiveId,
        status: this.getStatus(objectiveId)
      })),
      trackedObjectiveId: this.trackedObjectiveId
    };
  }

  restore(saveState: ObjectiveSaveState | null | undefined): void {
    this.objectiveOrder.forEach((objectiveId) => {
      this.statuses.set(objectiveId, "not_started");
    });

    if (saveState?.objectives?.length) {
      saveState.objectives.forEach((entry) => {
        if (this.objectives.has(entry.objectiveId)) {
          this.statuses.set(entry.objectiveId, entry.status);
        }
      });
    }

    this.trackedObjectiveId =
      saveState?.trackedObjectiveId && this.objectives.has(saveState.trackedObjectiveId)
        ? saveState.trackedObjectiveId
        : null;

    this.syncProgressFromInventory();
    this.selectedObjectiveId = this.chooseSelectedObjectiveId();
    this.trackedObjectiveId = this.normalizeTrackedObjectiveId(this.trackedObjectiveId);
    this.emitChange();
  }

  getDialogueSnapshot(): DialogueSnapshot {
    const snapshot = this.getObjectiveSnapshot(this.selectedObjectiveId);
    const activeCount = this.getTrackedCandidateIds().length;
    const actions = this.getActionsForSnapshot(snapshot);

    return {
      speaker: snapshot.giverName,
      title: snapshot.title,
      body: this.getBodyForSnapshot(snapshot),
      objectiveLabel: this.getObjectiveLabel(snapshot.status),
      progressLabel: this.getProgressLabel(snapshot),
      actions,
      objectives: this.getDialogueObjectiveViews(),
      activeCountLabel:
        activeCount > 0 ? `${activeCount} active task${activeCount === 1 ? "" : "s"} in the ledger.` : "No active tasks yet."
    };
  }

  getTrackerSnapshot(): ObjectiveTrackerSnapshot {
    const trackedObjectiveId = this.normalizeTrackedObjectiveId(this.trackedObjectiveId);
    if (!trackedObjectiveId) {
      return {
        visible: false,
        title: "",
        statusLabel: "",
        stepLabel: "",
        activeCountLabel: ""
      };
    }

    const snapshot = this.getObjectiveSnapshot(trackedObjectiveId);
    const activeCount = this.getTrackedCandidateIds().length;

    return {
      visible: true,
      title: snapshot.title,
      statusLabel: snapshot.statusLabel,
      stepLabel:
        snapshot.status === "ready_to_turn_in"
          ? `Return to ${snapshot.giverName} with ${snapshot.deliveryLabel}.`
          : `Brew ${snapshot.deliveryLabel} x${snapshot.deliveryQuantity} (${snapshot.deliveryAvailable}/${snapshot.deliveryQuantity}).`,
      activeCountLabel:
        activeCount > 1 ? `Tracking 1 of ${activeCount} active tasks` : "Tracking current active task"
    };
  }

  getObjectiveSnapshot(objectiveId?: string): ObjectiveSnapshot {
    const definition = this.getDefinition(objectiveId ?? this.selectedObjectiveId);
    const deliveryDefinition = this.inventoryStore.getItemDefinition(definition.deliveryRequirement.itemId);
    const deliveryAvailable = this.inventoryStore.getPlayerQuantity(definition.deliveryRequirement.itemId);
    const status = this.getStatus(definition.id);

    return {
      id: definition.id,
      title: definition.title,
      giverName: definition.giverName,
      summary: definition.summary,
      status,
      statusLabel: this.getStatusLabel(status),
      activeDescription: definition.activeDescription,
      completionDescription: definition.completionDescription,
      deliveryLabel: deliveryDefinition.label,
      deliveryQuantity: definition.deliveryRequirement.quantity,
      deliveryAvailable,
      tracked: this.trackedObjectiveId === definition.id
    };
  }

  performAction(actionId: string): ObjectiveActionResult {
    if (actionId.startsWith("select:")) {
      const objectiveId = actionId.slice("select:".length);
      if (!this.objectives.has(objectiveId)) {
        return {
          success: false,
          message: "That task is no longer available."
        };
      }

      this.selectedObjectiveId = objectiveId;
      this.emitChange();
      return {
        success: true,
        message: `${this.getDefinition(objectiveId).title} is now in focus.`
      };
    }

    if (actionId === "track") {
      const snapshot = this.getObjectiveSnapshot(this.selectedObjectiveId);
      if (snapshot.status !== "active" && snapshot.status !== "ready_to_turn_in") {
        return {
          success: false,
          message: "Only active work can be tracked right now."
        };
      }

      this.trackedObjectiveId = snapshot.id;
      this.emitChange();
      return {
        success: true,
        message: `${snapshot.title} is now your tracked task.`
      };
    }

    if (actionId === "accept") {
      const definition = this.getDefinition(this.selectedObjectiveId);
      const status = this.getStatus(definition.id);
      if (status !== "not_started") {
        return {
          success: false,
          message: "That task is already underway."
        };
      }

      this.statuses.set(definition.id, "active");
      this.trackedObjectiveId = definition.id;
      this.syncObjectiveProgress(definition.id);
      this.emitChange();
      return {
        success: true,
        message: `${definition.giverName} recorded ${definition.title.toLowerCase()} in the steward's ledger.`
      };
    }

    if (actionId === "turn-in") {
      const definition = this.getDefinition(this.selectedObjectiveId);
      const status = this.getStatus(definition.id);
      if (status !== "ready_to_turn_in") {
        return {
          success: false,
          message: "You still need the requested brew in your pack."
        };
      }

      const removed = this.inventoryStore.removeFromPlayer(
        definition.deliveryRequirement.itemId,
        definition.deliveryRequirement.quantity
      );

      if (!removed) {
        this.statuses.set(definition.id, "active");
        this.emitChange();
        return {
          success: false,
          message: "The requested brew is no longer in your pack."
        };
      }

      this.statuses.set(definition.id, "completed");
      this.trackedObjectiveId = this.normalizeTrackedObjectiveId(this.trackedObjectiveId);
      this.selectedObjectiveId = this.chooseSelectedObjectiveId();
      this.emitChange();
      return {
        success: true,
        message: `${definition.giverName} accepts the brew and marks ${definition.title.toLowerCase()} complete.`
      };
    }

    return {
      success: false,
      message: "That response doesn't fit the current task."
    };
  }

  private getDefinition(objectiveId: string): ObjectiveDefinition {
    const definition = this.objectives.get(objectiveId);
    if (!definition) {
      throw new Error(`Missing objective definition: ${objectiveId}`);
    }

    return definition;
  }

  private getStatus(objectiveId: string): ObjectiveStatus {
    return this.statuses.get(objectiveId) ?? "not_started";
  }

  private getStatusLabel(status: ObjectiveStatus): string {
    switch (status) {
      case "not_started":
        return "Available";
      case "active":
        return "Active";
      case "ready_to_turn_in":
        return "Ready To Turn In";
      case "completed":
        return "Completed";
    }
  }

  private getDialogueObjectiveViews(): DialogueObjectiveView[] {
    return this.objectiveOrder.map((objectiveId) => {
      const snapshot = this.getObjectiveSnapshot(objectiveId);
      return {
        id: snapshot.id,
        title: snapshot.title,
        statusLabel: snapshot.statusLabel,
        tracked: snapshot.tracked,
        selected: snapshot.id === this.selectedObjectiveId
      };
    });
  }

  private getObjectiveLabel(status: ObjectiveStatus): string {
    switch (status) {
      case "not_started":
        return "Offer";
      case "active":
        return "Current Task";
      case "ready_to_turn_in":
        return "Ready To Turn In";
      case "completed":
        return "Completed";
    }
  }

  private getProgressLabel(snapshot: ObjectiveSnapshot): string {
    switch (snapshot.status) {
      case "not_started":
        return `Needed: ${snapshot.deliveryLabel} x${snapshot.deliveryQuantity}`;
      case "active":
        return `Progress: ${snapshot.deliveryAvailable}/${snapshot.deliveryQuantity} ${snapshot.deliveryLabel}`;
      case "ready_to_turn_in":
        return `Ready: ${snapshot.deliveryLabel} x${snapshot.deliveryQuantity}`;
      case "completed":
        return "Filed in the steward's ledger.";
    }
  }

  private getBodyForSnapshot(snapshot: ObjectiveSnapshot): string {
    switch (snapshot.status) {
      case "not_started":
        return `${snapshot.summary}\n\n${snapshot.activeDescription}`;
      case "active":
        return snapshot.activeDescription;
      case "ready_to_turn_in":
        return `You have the requested brew. Return it to ${snapshot.giverName} to close out the task.`;
      case "completed":
        return snapshot.completionDescription;
    }
  }

  private getActionsForSnapshot(snapshot: ObjectiveSnapshot) {
    const actions = [
      ...(snapshot.status === "not_started"
        ? [{ id: "accept", label: "Accept Task", tone: "primary" as const }]
        : []),
      ...(snapshot.status === "ready_to_turn_in"
        ? [
            {
              id: "turn-in",
              label: this.getDefinition(snapshot.id).turnInLabel ?? "Turn In",
              tone: "primary" as const
            }
          ]
        : []),
      ...((snapshot.status === "active" || snapshot.status === "ready_to_turn_in") && !snapshot.tracked
        ? [{ id: "track", label: "Track This Task", tone: "secondary" as const }]
        : [])
    ];

    return actions;
  }

  private getTrackedCandidateIds(): string[] {
    return this.objectiveOrder.filter((objectiveId) => {
      const status = this.getStatus(objectiveId);
      return status === "active" || status === "ready_to_turn_in";
    });
  }

  private chooseSelectedObjectiveId(): string {
    if (this.objectives.has(this.selectedObjectiveId)) {
      return this.selectedObjectiveId;
    }

    const trackedObjectiveId = this.normalizeTrackedObjectiveId(this.trackedObjectiveId);
    if (trackedObjectiveId) {
      return trackedObjectiveId;
    }

    const firstIncomplete = this.objectiveOrder.find((objectiveId) => this.getStatus(objectiveId) !== "completed");
    return firstIncomplete ?? this.objectiveOrder[0];
  }

  private normalizeTrackedObjectiveId(candidate: string | null): string | null {
    if (candidate) {
      const status = this.getStatus(candidate);
      if (status === "active" || status === "ready_to_turn_in") {
        return candidate;
      }
    }

    return this.getTrackedCandidateIds()[0] ?? null;
  }

  private syncProgressFromInventory(): boolean {
    let changed = false;

    this.objectiveOrder.forEach((objectiveId) => {
      changed = this.syncObjectiveProgress(objectiveId) || changed;
    });

    const normalizedTrackedObjectiveId = this.normalizeTrackedObjectiveId(this.trackedObjectiveId);
    if (normalizedTrackedObjectiveId !== this.trackedObjectiveId) {
      this.trackedObjectiveId = normalizedTrackedObjectiveId;
      changed = true;
    }

    return changed;
  }

  private syncObjectiveProgress(objectiveId: string): boolean {
    const status = this.getStatus(objectiveId);
    if (status === "not_started" || status === "completed") {
      return false;
    }

    const definition = this.getDefinition(objectiveId);
    const hasRequiredItem =
      this.inventoryStore.getPlayerQuantity(definition.deliveryRequirement.itemId) >= definition.deliveryRequirement.quantity;
    const nextStatus: ObjectiveStatus = hasRequiredItem ? "ready_to_turn_in" : "active";

    if (nextStatus === status) {
      return false;
    }

    this.statuses.set(objectiveId, nextStatus);
    return true;
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}
