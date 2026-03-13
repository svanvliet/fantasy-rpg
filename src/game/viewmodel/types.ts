import type { InteractionKind, PickupItemDefinition } from "../interactions/types";

export type HandPoseState = "idle" | "ready" | "inspect" | "carry";

export interface HeldPresentationState {
  visible: boolean;
  pose: HandPoseState;
  heldLabel: string | null;
  heldShape: PickupItemDefinition["shape"] | null;
  targetKind: InteractionKind | "none";
  targetDistance: number | null;
}

export interface ViewModelFrameState extends HeldPresentationState {
  cameraMode: "firstPerson" | "thirdPerson";
  pointerLocked: boolean;
}
