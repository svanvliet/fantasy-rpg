import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

export type InteractionKind = "inspect" | "pickup" | "toggle" | "blocked";

export interface InteractionPrompt {
  title: string;
  actionLabel: string;
  description?: string;
  blockedReason?: string;
}

export interface InspectPayload {
  message: string;
}

export interface PickupItemDefinition {
  id: string;
  label: string;
  color: number;
  shape: "bottle" | "book" | "satchel" | "ingredient";
  size: THREE.Vector3;
}

export interface InteractionContext {
  scene: THREE.Scene;
  world: RAPIER.World;
  rapier: typeof RAPIER;
  playerPosition: THREE.Vector3;
  cameraDirection: THREE.Vector3;
  hitPointWorld?: THREE.Vector3;
}

export interface Interactable {
  id: string;
  object: THREE.Object3D;
  actionDistance: number;
  hoverDistance?: number;
  kind: InteractionKind;
  getPrompt: () => InteractionPrompt;
  onFocus?: (focused: boolean) => void;
  interact: (context: InteractionContext) => InteractionResult;
}

export interface InteractionResult {
  type: "none" | "message" | "pickup" | "toggle";
  message?: string;
  pickupItem?: PickupItemDefinition;
  pickupPosition?: THREE.Vector3;
  pickupQuaternion?: THREE.Quaternion;
  pickupLocalAnchor?: THREE.Vector3;
  pickupDistance?: number;
}

export interface HeldItemState {
  definition: PickupItemDefinition;
  mesh: THREE.Mesh;
  linearVelocity: THREE.Vector3;
  localAnchor: THREE.Vector3;
  rotationOffset: THREE.Quaternion;
  anchorDistance: number;
}

export interface TargetInfo {
  interactable: Interactable;
  distance: number;
  blocked: boolean;
  hitPointWorld: THREE.Vector3;
}
