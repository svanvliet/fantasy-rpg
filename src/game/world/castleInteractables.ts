import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import type { Interactable, PickupItemDefinition } from "../interactions/types";

function setHighlight(object: THREE.Object3D, focused: boolean): void {
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
      standard.emissiveIntensity = 0.9;
      return;
    }

    standard.emissive.copy(standard.userData.originalEmissive);
    standard.emissiveIntensity = standard.userData.originalEmissiveIntensity;
  });
}

function createPickupInteractable(
  id: string,
  object: THREE.Object3D,
  definition: PickupItemDefinition,
  description: string
): Interactable {
  return {
    id,
    object,
    actionDistance: 2.15,
    kind: "pickup",
    getPrompt: () => ({
      title: definition.label,
      actionLabel: "[E] Pick up",
      description,
      blockedReason: `${definition.label} is too far away.`
    }),
    onFocus: (focused) => setHighlight(object, focused),
    interact: (context) => {
      const pickupPosition = new THREE.Vector3();
      const pickupQuaternion = new THREE.Quaternion();
      object.getWorldPosition(pickupPosition);
      object.getWorldQuaternion(pickupQuaternion);
      const pickupLocalAnchor = context.hitPointWorld
        ? object.worldToLocal(context.hitPointWorld.clone())
        : new THREE.Vector3();
      const physicsCollider = object.userData.physicsCollider as RAPIER.Collider | undefined;
      const physicsBody = object.userData.physicsBody as RAPIER.RigidBody | undefined;
      if (physicsCollider) {
        context.world.removeCollider(physicsCollider, true);
        delete object.userData.physicsCollider;
      }
      if (physicsBody) {
        context.world.removeRigidBody(physicsBody);
        delete object.userData.physicsBody;
      }
      setHighlight(object, false);
      object.parent?.remove(object);
      return {
        type: "pickup",
        pickupItem: definition,
        pickupPosition,
        pickupQuaternion,
        pickupLocalAnchor,
        pickupDistance: context.hitPointWorld
          ? context.hitPointWorld.distanceTo(context.playerPosition)
          : undefined
      };
    }
  };
}

function createInspectInteractable(
  id: string,
  object: THREE.Object3D,
  title: string,
  message: string
): Interactable {
  return {
    id,
    object,
    actionDistance: 2.4,
    kind: "inspect",
    getPrompt: () => ({
      title,
      actionLabel: "[E] Inspect",
      blockedReason: `${title} is too far away.`
    }),
    onFocus: (focused) => setHighlight(object, focused),
    interact: () => ({
      type: "message",
      message
    })
  };
}

function createToggleInteractable(
  id: string,
  object: THREE.Object3D,
  title: string,
  openMessage: string,
  closeMessage: string
): Interactable {
  let isOpen = false;
  const closedX = object.position.x;
  const openX = closedX + 0.36;

  return {
    id,
    object,
    actionDistance: 2.4,
    kind: "toggle",
    getPrompt: () => ({
      title,
      actionLabel: isOpen ? "[E] Close" : "[E] Open",
      blockedReason: `${title} is too far away.`
    }),
    onFocus: (focused) => setHighlight(object, focused),
    interact: () => {
      isOpen = !isOpen;
      object.position.x = isOpen ? openX : closedX;
      return {
        type: "toggle",
        message: isOpen ? openMessage : closeMessage
      };
    }
  };
}

export interface CastleInteractableSeeds {
  bedsideCandles: THREE.Object3D[];
  footLocker: THREE.Object3D | null;
  cabinetDoors: THREE.Object3D[];
  alchemyBottles: THREE.Object3D[];
  alchemyBoard: THREE.Object3D | null;
  arch: THREE.Object3D | null;
}

export function createCastleInteractables(seeds: CastleInteractableSeeds): Interactable[] {
  const interactables: Interactable[] = [];

  seeds.bedsideCandles.forEach((candle, index) => {
    interactables.push(
      createInspectInteractable(
        `candle-${index}`,
        candle,
        "Candle",
        "A simple wax candle keeps the room warm and readable."
      )
    );
  });

  if (seeds.footLocker) {
    interactables.push(
      createToggleInteractable(
        "foot-locker",
        seeds.footLocker,
        "Foot locker",
        "The foot locker creaks open. Inventory support will land in Phase 4.",
        "The foot locker shuts with a heavy wooden thud."
      )
    );
  }

  seeds.cabinetDoors.forEach((door, index) => {
    interactables.push(
      createToggleInteractable(
        `cabinet-door-${index}`,
        door,
        "Cabinet",
        "The cabinet opens. Container transfers will arrive in Phase 4.",
        "The cabinet closes."
      )
    );
  });

  const bottleDefinitions: PickupItemDefinition[] = [
    {
      id: "bittermoss-extract",
      label: "Bittermoss Extract",
      color: 0x6e8c69,
      shape: "bottle",
      size: new THREE.Vector3(0.18, 0.45, 0.18)
    },
    {
      id: "moonwater-vial",
      label: "Moonwater Vial",
      color: 0x8596b5,
      shape: "bottle",
      size: new THREE.Vector3(0.18, 0.45, 0.18)
    },
    {
      id: "emberflower-oil",
      label: "Emberflower Oil",
      color: 0xb07c62,
      shape: "bottle",
      size: new THREE.Vector3(0.18, 0.45, 0.18)
    },
    {
      id: "golden-resin-tonic",
      label: "Golden Resin Tonic",
      color: 0xd0ba74,
      shape: "bottle",
      size: new THREE.Vector3(0.18, 0.45, 0.18)
    }
  ];

  seeds.alchemyBottles.forEach((bottle, index) => {
    interactables.push(
      createPickupInteractable(
        `alchemy-bottle-${index}`,
        bottle,
        bottleDefinitions[index],
        "A collectable alchemy ingredient bottle."
      )
    );
  });

  if (seeds.alchemyBoard) {
    interactables.push(
      createInspectInteractable(
        "alchemy-notes",
        seeds.alchemyBoard,
        "Alchemy board",
        "Scored markings and stains hint at recipes that will become craftable in a later phase."
      )
    );
  }

  if (seeds.arch) {
    interactables.push(
      createInspectInteractable(
        "moon-arch",
        seeds.arch,
        "Moon arch",
        "A ceremonial arch frames the alchemy station and suggests this room's ritual purpose."
      )
    );
  }

  return interactables;
}
