import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { InventoryStore } from "../inventory/InventoryStore";
import type { DroppedItemSaveState, InteractionSaveState } from "../persistence/SaveManager";
import type {
  HeldItemState,
  InteractionContext,
  InteractionResult,
  Interactable,
  PickupItemDefinition,
  TargetInfo
} from "./types";
import type { InventoryPanelController } from "../../ui/inventoryPanel";
import type { HeldPresentationState } from "../viewmodel/types";

const INTERACTION_REACH = 2.35;
const HOVER_REACH = 3.1;
const HELD_ITEM_DISTANCE = 0.9;
const THIRD_PERSON_HELD_DISTANCE = 0.58;
const THIRD_PERSON_HELD_HEIGHT = 0.98;
const HELD_ITEM_DEPTH_LERP = 10;
const HELD_ITEM_ROTATION_LERP = 10;
const MAX_RELEASE_SPEED = 4.5;
const RELEASE_SURFACE_CLEARANCE = 0.02;
const DROPPED_LINEAR_DAMPING = 0.95;
const DROPPED_ANGULAR_DAMPING = 2.4;
const DROPPED_ITEM_FRICTION = 0.95;
const DROPPED_ITEM_CONTACT_SKIN = 0.008;

interface DroppedItem {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Mesh;
  interactable: Interactable;
}

export interface InteractionSystemOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  scene: THREE.Scene;
  world: RAPIER.World;
  rapier: typeof RAPIER;
  interactables: Interactable[];
  inventoryStore: InventoryStore;
  inventoryPanel: InventoryPanelController;
  onStateDirty?: () => void;
}

export interface InteractionDebugState {
  targetLabel: string;
  prompt: string;
  heldItemLabel: string;
}

export interface InteractionPresentationState {
  cameraMode: "firstPerson" | "thirdPerson";
  playerPosition: THREE.Vector3;
  playerYaw: number;
}

export class InteractionSystem {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly world: RAPIER.World;
  private readonly rapier: typeof RAPIER;
  private readonly interactables: Interactable[];
  private readonly inventoryStore: InventoryStore;
  private readonly inventoryPanel: InventoryPanelController;
  private readonly raycaster = new THREE.Raycaster();
  private readonly workingDirection = new THREE.Vector3();
  private readonly workingOrigin = new THREE.Vector3();
  private readonly workingPlayerPosition = new THREE.Vector3();
  private readonly workingAnchorOffset = new THREE.Vector3();
  private readonly workingAnchorWorld = new THREE.Vector3();
  private readonly workingBaseOrientation = new THREE.Quaternion();
  private readonly heldTargetPosition = new THREE.Vector3();
  private readonly heldTargetQuaternion = new THREE.Quaternion();
  private readonly droppedItems: DroppedItem[] = [];
  private readonly initialPickupIds: string[];
  private readonly onStateDirty?: () => void;

  private currentTarget: TargetInfo | null = null;
  private activeContainerInteractable: Interactable | null = null;
  private heldItem: HeldItemState | null = null;
  private cameraMode: "firstPerson" | "thirdPerson" = "firstPerson";
  private playerYaw = 0;
  private statusMessage = "Look at an object to interact.";
  private statusMessageTtl = 0;
  private shouldRecapturePointerLock = false;

  constructor(options: InteractionSystemOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.scene = options.scene;
    this.world = options.world;
    this.rapier = options.rapier;
    this.interactables = options.interactables;
    this.inventoryStore = options.inventoryStore;
    this.inventoryPanel = options.inventoryPanel;
    this.initialPickupIds = options.interactables
      .filter((interactable) => interactable.kind === "pickup")
      .map((interactable) => interactable.id);
    this.onStateDirty = options.onStateDirty;

    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyE") {
        this.tryInteract();
      }

      if (event.code === "KeyQ") {
        this.tryDropHeldItem();
      }

      if (event.code === "KeyF") {
        this.tryHoldCurrentTarget();
      }

      if (event.code === "KeyI") {
        this.togglePlayerInventory();
      }

      if (event.code === "Escape" && this.inventoryPanel.isOpen()) {
        this.closeInventoryPanel();
      }
    });
  }

  update(deltaSeconds: number, presentationState: InteractionPresentationState): void {
    this.cameraMode = presentationState.cameraMode;
    this.workingPlayerPosition.copy(presentationState.playerPosition);
    this.playerYaw = presentationState.playerYaw;
    this.syncDroppedItems();
    this.updateHeldItem(deltaSeconds);
    this.updateTargeting();

    if (this.statusMessageTtl > 0) {
      this.statusMessageTtl = Math.max(this.statusMessageTtl - deltaSeconds, 0);
      if (this.statusMessageTtl === 0 && !this.currentTarget) {
        this.statusMessage = this.heldItem
          ? `Holding ${this.heldItem.definition.label}. Press Q to drop.`
          : "Look at an object to interact.";
      }
    }
  }

  getDebugState(): InteractionDebugState {
    const heldItemLabel = this.heldItem ? this.heldItem.definition.label : "none";

    if (this.inventoryPanel.isOpen()) {
      return {
        targetLabel: "none",
        prompt: "Inventory open. Transfer items with the panel or press Escape to close.",
        heldItemLabel
      };
    }

    if (this.heldItem) {
      return {
        targetLabel: "none",
        prompt: `Holding ${this.heldItem.definition.label}. Press Q to release it.`,
        heldItemLabel
      };
    }

    if (this.statusMessageTtl > 0) {
      return {
        targetLabel: this.currentTarget?.interactable.getPrompt().title ?? "none",
        prompt: this.statusMessage,
        heldItemLabel
      };
    }

    if (this.currentTarget) {
      const prompt = this.currentTarget.interactable.getPrompt();
      const actionText = this.currentTarget.blocked
        ? prompt.blockedReason ?? "Out of range"
        : prompt.actionLabel;
      return {
        targetLabel: prompt.title,
        prompt: actionText,
        heldItemLabel
      };
    }

    return {
      targetLabel: "none",
      prompt: this.statusMessage,
      heldItemLabel
    };
  }

  getViewModelState(): HeldPresentationState {
    if (this.inventoryPanel.isOpen()) {
      return {
        visible: false,
        pose: "idle",
        heldLabel: null,
        heldShape: null,
        targetKind: "none",
        targetDistance: null
      };
    }

    if (this.heldItem) {
      return {
        visible: true,
        pose: "carry",
        heldLabel: this.heldItem.definition.label,
        heldShape: this.heldItem.definition.shape,
        targetKind: "none",
        targetDistance: null
      };
    }

    if (!this.currentTarget) {
      return {
        visible: true,
        pose: "idle",
        heldLabel: null,
        heldShape: null,
        targetKind: "none",
        targetDistance: null
      };
    }

    const targetKind = this.currentTarget.interactable.kind;
    const pose =
      targetKind === "inspect" || targetKind === "container" || targetKind === "toggle"
        ? "inspect"
        : "ready";

    return {
      visible: true,
      pose,
      heldLabel: null,
      heldShape: null,
      targetKind,
      targetDistance: this.currentTarget.distance
    };
  }

  getPersistenceState(): InteractionSaveState {
    const activePickupIds = new Set(
      this.interactables
        .filter(
          (interactable) => interactable.kind === "pickup" && interactable.object.parent !== null
        )
        .map((interactable) => interactable.id)
    );

    const collectedPickupIds = this.initialPickupIds.filter((pickupId) => !activePickupIds.has(pickupId));
    const droppedItems = this.droppedItems.map((item) => this.serializeDroppedItem(item));

    if (this.heldItem) {
      droppedItems.push({
        id: this.heldItem.persistenceId,
        itemId: this.heldItem.definition.id,
        position: this.vectorToSave(this.heldItem.mesh.position),
        rotation: this.quaternionToSave(this.heldItem.mesh.quaternion),
        linearVelocity: this.vectorToSave(this.heldItem.linearVelocity),
        angularVelocity: this.vectorToSave(new THREE.Vector3()),
        localAnchor: this.vectorToSave(this.heldItem.localAnchor)
      });
    }

    return {
      collectedPickupIds,
      droppedItems
    };
  }

  restorePersistenceState(saveState: InteractionSaveState): void {
    const collectedIds = new Set(saveState.collectedPickupIds);

    for (const pickupId of collectedIds) {
      const interactable = this.interactables.find((candidate) => candidate.id === pickupId);
      if (!interactable || interactable.kind !== "pickup") {
        continue;
      }

      this.removePickupInteractable(interactable);
    }

    saveState.droppedItems.forEach((droppedItem) => {
      const definition = this.inventoryStore.getItemDefinition(droppedItem.itemId);
      const mesh = this.createItemMesh(definition);
      mesh.position.set(droppedItem.position.x, droppedItem.position.y, droppedItem.position.z);
      mesh.quaternion.set(
        droppedItem.rotation.x,
        droppedItem.rotation.y,
        droppedItem.rotation.z,
        droppedItem.rotation.w
      );
      this.scene.add(mesh);
      this.registerDroppedMesh(
        definition,
        mesh,
        new THREE.Vector3(
          droppedItem.linearVelocity.x,
          droppedItem.linearVelocity.y,
          droppedItem.linearVelocity.z
        ),
        new THREE.Vector3(
          droppedItem.localAnchor.x,
          droppedItem.localAnchor.y,
          droppedItem.localAnchor.z
        ),
        droppedItem.id,
        new THREE.Vector3(
          droppedItem.angularVelocity.x,
          droppedItem.angularVelocity.y,
          droppedItem.angularVelocity.z
        ),
        false
      );
    });
  }

  private updateTargeting(): void {
    if (this.heldItem || this.inventoryPanel.isOpen()) {
      if (this.currentTarget) {
        this.currentTarget.interactable.onFocus?.(false);
        this.currentTarget = null;
      }
      return;
    }

    this.camera.getWorldPosition(this.workingOrigin);
    this.camera.getWorldDirection(this.workingDirection);
    this.workingPlayerPosition.copy(this.camera.position);

    this.raycaster.set(this.workingOrigin, this.workingDirection);
    this.raycaster.far = HOVER_REACH;

    const candidates = this.interactables
      .filter((interactable) => interactable.object.parent !== null)
      .map((interactable) => {
        const intersections = this.raycaster.intersectObject(interactable.object, true);
        if (intersections.length === 0) {
          return null;
        }

        return {
          interactable,
          distance: intersections[0].distance,
          hitPointWorld: intersections[0].point.clone()
        };
      })
      .filter(
        (
          value
        ): value is {
          interactable: Interactable;
          distance: number;
          hitPointWorld: THREE.Vector3;
        } => value !== null
      )
      .sort((a, b) => a.distance - b.distance);

    const nextTarget = candidates[0]
      ? {
          interactable: candidates[0].interactable,
          distance: candidates[0].distance,
          blocked: candidates[0].distance > (candidates[0].interactable.actionDistance ?? INTERACTION_REACH),
          hitPointWorld: candidates[0].hitPointWorld
        }
      : null;

    if (this.currentTarget?.interactable.id !== nextTarget?.interactable.id) {
      this.currentTarget?.interactable.onFocus?.(false);
      nextTarget?.interactable.onFocus?.(true);
    }

    this.currentTarget = nextTarget;
  }

  private tryInteract(): void {
    if (this.inventoryPanel.isOpen()) {
      this.setStatusMessage("Close the inventory panel before interacting with the world.", 1.6);
      return;
    }

    if (this.heldItem) {
      this.tryStowHeldItem();
      return;
    }

    if (!this.currentTarget) {
      this.setStatusMessage("Nothing to interact with.", 1.5);
      return;
    }

    const prompt = this.currentTarget.interactable.getPrompt();
    if (this.currentTarget.blocked) {
      this.setStatusMessage(prompt.blockedReason ?? `${prompt.title} is out of reach.`, 1.8);
      return;
    }

    const context: InteractionContext = {
      scene: this.scene,
      world: this.world,
      rapier: this.rapier,
      playerPosition: this.workingPlayerPosition.clone(),
      cameraDirection: this.workingDirection.clone(),
      hitPointWorld: this.currentTarget.hitPointWorld.clone()
    };

    const result = this.currentTarget.interactable.interact(context);
    this.handleResult(result, prompt.title, "inventory");
  }

  private tryHoldCurrentTarget(): void {
    if (this.inventoryPanel.isOpen()) {
      this.setStatusMessage("Close the inventory panel before grabbing an item.", 1.6);
      return;
    }

    if (this.heldItem) {
      this.setStatusMessage(`Already holding ${this.heldItem.definition.label}. Press Q to release it first.`, 1.8);
      return;
    }

    if (!this.currentTarget || this.currentTarget.interactable.kind !== "pickup") {
      this.setStatusMessage("Look at a loose item to hold it.", 1.5);
      return;
    }

    const prompt = this.currentTarget.interactable.getPrompt();
    if (this.currentTarget.blocked) {
      this.setStatusMessage(prompt.blockedReason ?? `${prompt.title} is out of reach.`, 1.8);
      return;
    }

    const context: InteractionContext = {
      scene: this.scene,
      world: this.world,
      rapier: this.rapier,
      playerPosition: this.workingPlayerPosition.clone(),
      cameraDirection: this.workingDirection.clone(),
      hitPointWorld: this.currentTarget.hitPointWorld.clone()
    };

    const result = this.currentTarget.interactable.interact(context);
    this.handleResult(result, prompt.title, "hold");
  }

  private handleResult(
    result: InteractionResult,
    fallbackTitle: string,
    pickupMode: "inventory" | "hold"
  ): void {
    switch (result.type) {
      case "pickup":
        if (result.pickupItem) {
          if (pickupMode === "hold") {
            this.beginHoldingItem(result.pickupItem, result);
            this.setStatusMessage(`Holding ${result.pickupItem.label}. Press Q to release it.`, 1.9);
            this.markStateDirty();
          } else {
            this.inventoryStore.addToPlayer(result.pickupItem.id, 1);
            this.setStatusMessage(`Collected ${result.pickupItem.label}.`, 1.9);
            this.markStateDirty();
          }
        }
        return;
      case "container":
        if (result.containerId) {
          this.shouldRecapturePointerLock = document.pointerLockElement === this.domElement;
          document.exitPointerLock?.();
          this.activeContainerInteractable = this.currentTarget?.interactable ?? null;
          this.inventoryPanel.openContainer(result.containerId);
          this.setStatusMessage(
            result.message ?? `Opened ${result.containerTitle ?? fallbackTitle}.`,
            1.8
          );
        }
        return;
      case "message":
        this.setStatusMessage(result.message ?? `${fallbackTitle} inspected.`, 2.2);
        return;
      case "toggle":
        this.setStatusMessage(result.message ?? `${fallbackTitle} toggled.`, 1.8);
        return;
      case "none":
      default:
        this.setStatusMessage(result.message ?? `${fallbackTitle} does nothing.`, 1.5);
    }
  }

  closeInventoryPanel(): void {
    this.inventoryPanel.close();
    this.activeContainerInteractable?.close?.();
    this.activeContainerInteractable = null;

    if (this.shouldRecapturePointerLock) {
      this.shouldRecapturePointerLock = false;
      void this.domElement.requestPointerLock();
    }
  }

  private tryDropHeldItem(): void {
    if (!this.heldItem) {
      this.setStatusMessage("You are not holding anything.", 1.4);
      return;
    }

    const heldItem = this.heldItem;
    const mesh = heldItem.mesh;
    const releaseVelocity = heldItem.linearVelocity.clone().clampLength(0, MAX_RELEASE_SPEED);
    this.registerDroppedMesh(
      heldItem.definition,
      mesh,
      releaseVelocity,
      heldItem.localAnchor.clone(),
      heldItem.persistenceId
    );

    this.setStatusMessage(`Dropped ${heldItem.definition.label}.`, 1.7);
    this.heldItem = null;
    this.markStateDirty();
  }

  private tryStowHeldItem(): void {
    if (!this.heldItem) {
      return;
    }

    if (!this.heldItem.definition.stowable) {
      this.setStatusMessage(
        `${this.heldItem.definition.label} can be moved but cannot be stowed.`,
        1.8
      );
      return;
    }

    this.inventoryStore.addToPlayer(this.heldItem.definition.id, 1);
    this.scene.remove(this.heldItem.mesh);
    this.setHighlight(this.heldItem.mesh, false);
    this.setStatusMessage(`Stowed ${this.heldItem.definition.label}.`, 1.7);
    this.heldItem = null;
    this.markStateDirty();
  }

  dropInventoryItem(itemId: string): boolean {
    if (!this.inventoryStore.removeFromPlayer(itemId, 1)) {
      return false;
    }

    const definition = this.inventoryStore.getItemDefinition(itemId);
    const mesh = this.createItemMesh(definition);
    this.camera.getWorldPosition(this.workingOrigin);
    this.camera.getWorldDirection(this.workingDirection);
    mesh.position.copy(this.workingOrigin).addScaledVector(this.workingDirection, 1.05);
    mesh.quaternion.copy(this.camera.quaternion);
    this.scene.add(mesh);
    this.registerDroppedMesh(definition, mesh, new THREE.Vector3(), new THREE.Vector3());
    this.setStatusMessage(`Dropped ${definition.label} from inventory.`, 1.7);
    this.markStateDirty();
    return true;
  }

  togglePlayerInventory(): void {
    if (this.inventoryPanel.isOpen()) {
      this.closeInventoryPanel();
      return;
    }

    this.shouldRecapturePointerLock = document.pointerLockElement === this.domElement;
    document.exitPointerLock?.();
    this.inventoryPanel.openPlayerInventory();
  }

  private beginHoldingItem(
    definition: PickupItemDefinition,
    result: InteractionResult
  ): void {
    const mesh = this.createItemMesh(definition);
    if (result.pickupPosition) {
      mesh.position.copy(result.pickupPosition);
    } else {
      mesh.position.copy(this.camera.position);
    }

    if (result.pickupQuaternion) {
      mesh.quaternion.copy(result.pickupQuaternion);
    } else {
      mesh.quaternion.copy(this.camera.quaternion);
    }

    this.scene.add(mesh);
    const baseOrientation = this.getHeldOrientationBase();
    this.heldItem = {
      definition,
      mesh,
      linearVelocity: new THREE.Vector3(),
      localAnchor: result.pickupLocalAnchor?.clone() ?? new THREE.Vector3(),
      rotationOffset: baseOrientation
        .clone()
        .invert()
        .multiply(mesh.quaternion.clone()),
      anchorDistance: result.pickupDistance ?? HELD_ITEM_DISTANCE,
      persistenceId: result.pickupPersistenceId ?? this.createDroppedItemId(definition.id)
    };
  }

  private syncDroppedItems(): void {
    this.droppedItems.forEach((item) => {
      const translation = item.body.translation();
      const rotation = item.body.rotation();
      item.mesh.position.set(translation.x, translation.y, translation.z);
      item.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
  }

  private updateHeldItem(deltaSeconds: number): void {
    if (!this.heldItem) {
      return;
    }

    this.getHeldAnchorBasis(this.workingOrigin, this.workingDirection);

    const previousPosition = this.heldItem.mesh.position.clone();
    this.heldItem.anchorDistance = THREE.MathUtils.lerp(
      this.heldItem.anchorDistance,
      this.cameraMode === "firstPerson" ? HELD_ITEM_DISTANCE : THIRD_PERSON_HELD_DISTANCE,
      1 - Math.exp(-HELD_ITEM_DEPTH_LERP * deltaSeconds)
    );
    this.workingAnchorWorld
      .copy(this.workingOrigin)
      .addScaledVector(this.workingDirection, this.heldItem.anchorDistance);

    this.heldTargetQuaternion
      .copy(this.getHeldOrientationBase())
      .multiply(this.heldItem.rotationOffset);
    this.workingAnchorOffset
      .copy(this.heldItem.localAnchor)
      .applyQuaternion(this.heldTargetQuaternion);
    this.heldTargetPosition
      .copy(this.workingAnchorWorld)
      .sub(this.workingAnchorOffset);
    this.heldItem.mesh.position.copy(this.heldTargetPosition);
    this.heldItem.mesh.quaternion.slerp(
      this.heldTargetQuaternion,
      1 - Math.exp(-HELD_ITEM_ROTATION_LERP * deltaSeconds)
    );

    const safeDelta = Math.max(deltaSeconds, 1 / 240);
    this.heldItem.linearVelocity
      .copy(this.heldItem.mesh.position)
      .sub(previousPosition)
      .divideScalar(safeDelta);
  }

  private getHeldAnchorBasis(origin: THREE.Vector3, direction: THREE.Vector3): void {
    if (this.cameraMode === "firstPerson") {
      this.camera.getWorldPosition(origin);
      this.camera.getWorldDirection(direction);
      return;
    }

    origin.copy(this.workingPlayerPosition);
    origin.y += THIRD_PERSON_HELD_HEIGHT;
    direction.set(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.playerYaw);
  }

  private getHeldOrientationBase(): THREE.Quaternion {
    if (this.cameraMode === "firstPerson") {
      return this.workingBaseOrientation.copy(this.camera.quaternion);
    }

    return this.workingBaseOrientation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.playerYaw);
  }

  private createItemMesh(definition: PickupItemDefinition): THREE.Mesh {
    let geometry: THREE.BufferGeometry;

    switch (definition.shape) {
      case "bottle":
        geometry = new THREE.CylinderGeometry(0.08, 0.12, 0.45, 10);
        break;
      case "book":
        geometry = new THREE.BoxGeometry(definition.size.x, definition.size.y, definition.size.z);
        break;
      case "satchel":
        geometry = new THREE.BoxGeometry(definition.size.x, definition.size.y, definition.size.z);
        break;
      case "ingredient":
      default:
        geometry = new THREE.IcosahedronGeometry(0.12, 0);
        break;
    }

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: definition.color,
        roughness: 0.5,
        metalness: 0.08
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.itemId = definition.id;
    return mesh;
  }

  private createColliderDesc(definition: PickupItemDefinition): RAPIER.ColliderDesc {
    return definition.shape === "bottle"
      ? this.rapier.ColliderDesc.cylinder(0.225, 0.1)
          .setFriction(DROPPED_ITEM_FRICTION)
          .setRestitution(0)
          .setContactSkin(DROPPED_ITEM_CONTACT_SKIN)
      : this.rapier.ColliderDesc.cuboid(
          Math.max(definition.size.x / 2, 0.08),
          Math.max(definition.size.y / 2, 0.08),
          Math.max(definition.size.z / 2, 0.08)
        )
          .setFriction(DROPPED_ITEM_FRICTION)
          .setRestitution(0)
          .setContactSkin(DROPPED_ITEM_CONTACT_SKIN);
  }

  private registerDroppedMesh(
    definition: PickupItemDefinition,
    mesh: THREE.Mesh,
    releaseVelocity: THREE.Vector3,
    fallbackLocalAnchor: THREE.Vector3,
    persistenceId = this.createDroppedItemId(definition.id),
    angularVelocity = new THREE.Vector3(),
    notifyStateDirty = true
  ): void {
    const colliderDesc = this.createColliderDesc(definition);
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.dynamic()
        .setTranslation(
          mesh.position.x,
          mesh.position.y + RELEASE_SURFACE_CLEARANCE,
          mesh.position.z
        )
        .setCcdEnabled(true)
        .setLinearDamping(DROPPED_LINEAR_DAMPING)
        .setAngularDamping(DROPPED_ANGULAR_DAMPING)
    );
    body.setLinvel(
      {
        x: releaseVelocity.x,
        y: releaseVelocity.y,
        z: releaseVelocity.z
      },
      true
    );
    body.setAngvel(
      {
        x: angularVelocity.x,
        y: angularVelocity.y,
        z: angularVelocity.z
      },
      true
    );
    body.setRotation(
      {
        x: mesh.quaternion.x,
        y: mesh.quaternion.y,
        z: mesh.quaternion.z,
        w: mesh.quaternion.w
      },
      true
    );

    const collider = this.world.createCollider(colliderDesc, body);
    mesh.userData.localAnchor = fallbackLocalAnchor.clone();
    const interactable: Interactable = {
      id: persistenceId,
      object: mesh,
      actionDistance: 2.15,
      kind: "pickup",
      getPrompt: () => ({
        title: definition.label,
        actionLabel: "[E] Take / [F] Hold",
        blockedReason: `${definition.label} is too far away.`
      }),
      onFocus: (focused) => this.setHighlight(mesh, focused),
      interact: (context) => {
        const pickupLocalAnchor = context.hitPointWorld
          ? mesh.worldToLocal(context.hitPointWorld.clone())
          : fallbackLocalAnchor.clone();
        this.scene.remove(mesh);
        this.setHighlight(mesh, false);
        this.world.removeCollider(collider, true);
        this.world.removeRigidBody(body);
        const droppedIndex = this.droppedItems.findIndex((item) => item.interactable.id === interactable.id);
        if (droppedIndex >= 0) {
          this.droppedItems.splice(droppedIndex, 1);
        }
        const interactableIndex = this.interactables.findIndex((item) => item.id === interactable.id);
        if (interactableIndex >= 0) {
          this.interactables.splice(interactableIndex, 1);
        }

        if (this.currentTarget?.interactable.id === interactable.id) {
          this.currentTarget = null;
        }

        return {
          type: "pickup",
          pickupItem: definition,
          pickupPersistenceId: persistenceId,
          pickupPosition: mesh.position.clone(),
          pickupQuaternion: mesh.quaternion.clone(),
          pickupLocalAnchor,
          pickupDistance: context.hitPointWorld
            ? context.hitPointWorld.distanceTo(context.playerPosition)
            : HELD_ITEM_DISTANCE
        };
      }
    };

    this.interactables.push(interactable);
    this.droppedItems.push({ body, collider, mesh, interactable });
    if (notifyStateDirty) {
      this.markStateDirty();
    }
  }

  private setHighlight(object: THREE.Object3D, focused: boolean): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material;
      if (!material || Array.isArray(material) || !("emissive" in material)) {
        return;
      }

      const standard = material as THREE.MeshStandardMaterial;
      if (!(standard.userData.originalEmissive instanceof THREE.Color)) {
        standard.userData.originalEmissive = standard.emissive.clone();
        standard.userData.originalEmissiveIntensity = standard.emissiveIntensity;
      }

      if (focused) {
        standard.emissive = new THREE.Color(0x5a3b1a);
        standard.emissiveIntensity = 0.85;
        return;
      }

      standard.emissive.copy(standard.userData.originalEmissive);
      standard.emissiveIntensity = standard.userData.originalEmissiveIntensity;
    });
  }

  private setStatusMessage(message: string, ttl: number): void {
    this.statusMessage = message;
    this.statusMessageTtl = ttl;
  }

  private removePickupInteractable(interactable: Interactable): void {
    const object = interactable.object;
    const physicsCollider = object.userData.physicsCollider as RAPIER.Collider | undefined;
    const physicsBody = object.userData.physicsBody as RAPIER.RigidBody | undefined;

    if (physicsCollider) {
      this.world.removeCollider(physicsCollider, true);
      delete object.userData.physicsCollider;
    }
    if (physicsBody) {
      this.world.removeRigidBody(physicsBody);
      delete object.userData.physicsBody;
    }

    object.parent?.remove(object);
    const interactableIndex = this.interactables.findIndex((candidate) => candidate.id === interactable.id);
    if (interactableIndex >= 0) {
      this.interactables.splice(interactableIndex, 1);
    }

    if (this.currentTarget?.interactable.id === interactable.id) {
      this.currentTarget = null;
    }
  }

  private serializeDroppedItem(item: DroppedItem): DroppedItemSaveState {
    const translation = item.body.translation();
    const rotation = item.body.rotation();
    const linearVelocity = item.body.linvel();
    const angularVelocity = item.body.angvel();
    const localAnchor = item.mesh.userData.localAnchor as THREE.Vector3 | undefined;
    const itemId = item.mesh.userData.itemId as string;

    return {
      id: item.interactable.id,
      itemId,
      position: {
        x: translation.x,
        y: translation.y,
        z: translation.z
      },
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w
      },
      linearVelocity: {
        x: linearVelocity.x,
        y: linearVelocity.y,
        z: linearVelocity.z
      },
      angularVelocity: {
        x: angularVelocity.x,
        y: angularVelocity.y,
        z: angularVelocity.z
      },
      localAnchor: this.vectorToSave(localAnchor ?? new THREE.Vector3())
    };
  }

  private vectorToSave(vector: THREE.Vector3): { x: number; y: number; z: number } {
    return {
      x: vector.x,
      y: vector.y,
      z: vector.z
    };
  }

  private quaternionToSave(quaternion: THREE.Quaternion): { x: number; y: number; z: number; w: number } {
    return {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w
    };
  }

  private createDroppedItemId(itemId: string): string {
    return `dropped-${itemId}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  }

  private markStateDirty(): void {
    this.onStateDirty?.();
  }
}
