import type { ObjectiveDefinition } from "./types";

export const STEWARD_REMEDY_OBJECTIVE: ObjectiveDefinition = {
  id: "steward-remedy",
  title: "Steward's Remedy",
  giverName: "Steward Rowan",
  summary: "Brew a Verdant Restorative for the castle steward and return it.",
  activeDescription:
    "The steward needs a Verdant Restorative for the keep's field kit. Gather what you need, brew it at the alchemy table, and bring it back.",
  completionDescription:
    "The steward accepts the restorative and notes that the keep can field another patrol with confidence.",
  deliveryRequirement: {
    itemId: "verdant-restorative",
    quantity: 1
  }
};

export const STEWARD_WATCH_OBJECTIVE: ObjectiveDefinition = {
  id: "steward-watch",
  title: "Night Watch Draught",
  giverName: "Steward Rowan",
  summary: "Brew an Emberguard Draught for the keep's cold-weather sentries.",
  activeDescription:
    "The outer watch needs something warming before the next patrol rotation. Brew an Emberguard Draught at the alchemy table and bring it back to the steward.",
  completionDescription:
    "The steward tucks the draught into the watch supply ledger and notes the sentries are provisioned for the cold.",
  deliveryRequirement: {
    itemId: "emberguard-draught",
    quantity: 1
  },
  turnInLabel: "Hand Over Draught"
};

export const STEWARD_OBJECTIVES: ObjectiveDefinition[] = [STEWARD_REMEDY_OBJECTIVE, STEWARD_WATCH_OBJECTIVE];
