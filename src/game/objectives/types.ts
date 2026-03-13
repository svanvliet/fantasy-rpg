import type { InventoryStack } from "../inventory/InventoryStore";

export type ObjectiveStatus = "not_started" | "active" | "ready_to_turn_in" | "completed";

export interface ObjectiveDefinition {
  id: string;
  title: string;
  giverName: string;
  summary: string;
  activeDescription: string;
  completionDescription: string;
  deliveryRequirement: InventoryStack;
  turnInLabel?: string;
}

export interface ObjectiveSaveState {
  objectives: Array<{
    objectiveId: string;
    status: ObjectiveStatus;
  }>;
  trackedObjectiveId: string | null;
}

export interface ObjectiveSnapshot {
  id: string;
  title: string;
  giverName: string;
  summary: string;
  status: ObjectiveStatus;
  statusLabel: string;
  activeDescription: string;
  completionDescription: string;
  deliveryLabel: string;
  deliveryQuantity: number;
  deliveryAvailable: number;
  tracked: boolean;
}

export interface DialogueActionView {
  id: string;
  label: string;
  tone?: "primary" | "secondary";
  disabled?: boolean;
}

export interface DialogueObjectiveView {
  id: string;
  title: string;
  statusLabel: string;
  tracked: boolean;
  selected: boolean;
}

export interface DialogueSnapshot {
  speaker: string;
  title: string;
  body: string;
  objectiveLabel: string;
  progressLabel: string;
  actions: DialogueActionView[];
  objectives: DialogueObjectiveView[];
  activeCountLabel: string;
}

export interface ObjectiveTrackerSnapshot {
  visible: boolean;
  title: string;
  statusLabel: string;
  stepLabel: string;
  activeCountLabel: string;
}

export interface ObjectiveActionResult {
  success: boolean;
  message: string;
}
