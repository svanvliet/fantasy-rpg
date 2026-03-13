import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

import { createCastleInteractables } from "./castleInteractables";
import type { Interactable } from "../interactions/types";

export interface CastleBlockoutData {
  spawnPosition: THREE.Vector3;
  interactables: Interactable[];
}

interface StaticBoxOptions {
  color: number;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  roughness?: number;
  metalness?: number;
  castShadow?: boolean;
  collider?: boolean;
  fog?: boolean;
}

interface LightOptions {
  color: number;
  intensity: number;
  position: THREE.Vector3;
  distance: number;
  castShadow?: boolean;
  showEmber?: boolean;
  emberRadius?: number;
}

const TABLETOP_THICKNESS = 0.18;
const STATIC_SURFACE_FRICTION = 1.0;
const STATIC_CONTACT_SKIN = 0.006;
const PICKUP_BOTTLE_FRICTION = 0.95;
const PICKUP_BOTTLE_CONTACT_SKIN = 0.008;
const CANDLE_BODY_FRICTION = 1.0;

function addStaticBox(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  options: StaticBoxOptions
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(options.scale.x, options.scale.y, options.scale.z);
  const material = new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0.06,
    fog: options.fog ?? false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(options.position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  if (options.collider ?? true) {
    const rigidBody = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    rigidBody.setTranslation(
      {
        x: options.position.x,
        y: options.position.y,
        z: options.position.z
      },
      true
    );

    const collider = rapier.ColliderDesc.cuboid(
      options.scale.x / 2,
      options.scale.y / 2,
      options.scale.z / 2
    )
      .setFriction(STATIC_SURFACE_FRICTION)
      .setRestitution(0)
      .setContactSkin(STATIC_CONTACT_SKIN);
    world.createCollider(collider, rigidBody);
  }

  return mesh;
}

function addPointLight(scene: THREE.Scene, options: LightOptions): void {
  const light = new THREE.PointLight(
    options.color,
    options.intensity,
    options.distance,
    2
  );
  light.position.copy(options.position);
  light.castShadow = options.castShadow ?? true;
  scene.add(light);

  if (options.showEmber === false) {
    return;
  }

  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(options.emberRadius ?? 0.08, 10, 10),
    new THREE.MeshBasicMaterial({ color: options.color })
  );
  ember.position.copy(options.position);
  scene.add(ember);
}

function addBounceLight(
  scene: THREE.Scene,
  color: number,
  intensity: number,
  distance: number,
  position: THREE.Vector3
): void {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.copy(position);
  light.castShadow = false;
  scene.add(light);
}

function addCandles(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  positions: THREE.Vector3[],
  lightIntensity: number,
  lightDistance: number
): THREE.Object3D[] {
  return positions.map((position, index) => {
    const candleHeight = 0.24;
    const flameHeight = candleHeight + 0.06;
    const anchor = new THREE.Group();
    anchor.position.copy(position);
    scene.add(anchor);

    const candleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.24, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe7dcc8,
        roughness: 0.88,
        metalness: 0.03
      })
    );
    candleBody.position.set(0, candleHeight * 0.5, 0);
    candleBody.castShadow = false;
    candleBody.receiveShadow = true;
    anchor.add(candleBody);

    const candleRigidBody = world.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(
        position.x,
        position.y + candleHeight * 0.5,
        position.z
      )
    );
    world.createCollider(
      rapier.ColliderDesc.cylinder(candleHeight * 0.5, 0.05)
        .setFriction(CANDLE_BODY_FRICTION)
        .setRestitution(0)
        .setContactSkin(STATIC_CONTACT_SKIN),
      candleRigidBody
    );

    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.035, 6),
      new THREE.MeshStandardMaterial({
        color: 0x1f1610,
        roughness: 0.9,
        metalness: 0.02
      })
    );
    wick.position.set(0, candleHeight + 0.012, 0);
    wick.castShadow = false;
    anchor.add(wick);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0xffefcb : 0xffdfaa })
    );
    flame.position.set(0, flameHeight, 0);
    anchor.add(flame);

    addPointLight(scene, {
      color: index % 2 === 0 ? 0xffd29a : 0xffcc88,
      intensity: lightIntensity,
      distance: lightDistance,
      position: new THREE.Vector3(position.x, position.y + flameHeight, position.z),
      castShadow: false,
      showEmber: false
    });
    return anchor;
  });
}

function addPickupBottleCollider(
  world: RAPIER.World,
  rapier: typeof RAPIER,
  mesh: THREE.Mesh
): void {
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.fixed().setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
  );
  const collider = world.createCollider(
    rapier.ColliderDesc.cylinder(0.225, 0.1)
      .setFriction(PICKUP_BOTTLE_FRICTION)
      .setRestitution(0)
      .setContactSkin(PICKUP_BOTTLE_CONTACT_SKIN),
    body
  );
  mesh.userData.physicsBody = body;
  mesh.userData.physicsCollider = collider;
}

function addTable(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  position: THREE.Vector3,
  size: THREE.Vector3,
  color: number
): void {
  const topThickness = TABLETOP_THICKNESS;
  const apronThickness = 0.12;
  const apronDrop = 0.2;
  const legThickness = 0.18;
  const tabletopHeight = position.y;
  const topCenterY = tabletopHeight - topThickness * 0.5;
  const apronCenterY = tabletopHeight - topThickness - apronDrop;
  const legHeight = Math.max(tabletopHeight - topThickness, 0.32);
  const legCenterY = legHeight * 0.5;

  addStaticBox(scene, world, rapier, {
    color,
    position: new THREE.Vector3(position.x, topCenterY, position.z),
    scale: new THREE.Vector3(size.x, topThickness, size.z)
  });

  addStaticBox(scene, world, rapier, {
    color: color - 0x060606,
    position: new THREE.Vector3(position.x, apronCenterY, position.z + size.z * 0.36),
    scale: new THREE.Vector3(size.x * 0.76, apronThickness, 0.12),
    collider: false
  });
  addStaticBox(scene, world, rapier, {
    color: color - 0x060606,
    position: new THREE.Vector3(position.x, apronCenterY, position.z - size.z * 0.36),
    scale: new THREE.Vector3(size.x * 0.76, apronThickness, 0.12),
    collider: false
  });
  addStaticBox(scene, world, rapier, {
    color: color - 0x060606,
    position: new THREE.Vector3(position.x + size.x * 0.36, apronCenterY, position.z),
    scale: new THREE.Vector3(0.12, apronThickness, size.z * 0.76),
    collider: false
  });
  addStaticBox(scene, world, rapier, {
    color: color - 0x060606,
    position: new THREE.Vector3(position.x - size.x * 0.36, apronCenterY, position.z),
    scale: new THREE.Vector3(0.12, apronThickness, size.z * 0.76),
    collider: false
  });

  const legOffsets = [
    [-size.x * 0.38, size.z * 0.38],
    [size.x * 0.38, size.z * 0.38],
    [-size.x * 0.38, -size.z * 0.38],
    [size.x * 0.38, -size.z * 0.38]
  ];
  legOffsets.forEach(([offsetX, offsetZ]) => {
    addStaticBox(scene, world, rapier, {
      color: color - 0x101010,
      position: new THREE.Vector3(
        position.x + offsetX,
        legCenterY,
        position.z + offsetZ
      ),
      scale: new THREE.Vector3(legThickness, legHeight, legThickness)
    });
  });
}

function addBed(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  position: THREE.Vector3
): void {
  addStaticBox(scene, world, rapier, {
    color: 0x5f4933,
    position: new THREE.Vector3(position.x, position.y + 0.35, position.z),
    scale: new THREE.Vector3(2.6, 0.7, 4.1)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x85735d,
    position: new THREE.Vector3(position.x, position.y + 0.68, position.z - 0.1),
    scale: new THREE.Vector3(2.2, 0.28, 3.4),
    collider: false
  });
  addStaticBox(scene, world, rapier, {
    color: 0x47301f,
    position: new THREE.Vector3(position.x, position.y + 1.3, position.z - 1.9),
    scale: new THREE.Vector3(2.8, 1.4, 0.18)
  });
}

function addShelf(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  position: THREE.Vector3,
  scale: THREE.Vector3,
  color: number,
  tiers: number
): void {
  addStaticBox(scene, world, rapier, {
    color,
    position: new THREE.Vector3(position.x, position.y + scale.y * 0.5, position.z),
    scale
  });

  for (let tier = 0; tier < tiers; tier += 1) {
    const y = position.y - scale.y * 0.32 + tier * ((scale.y * 0.72) / Math.max(tiers - 1, 1));
    addStaticBox(scene, world, rapier, {
      color: color + 0x060402,
      position: new THREE.Vector3(position.x, y, position.z),
      scale: new THREE.Vector3(scale.x * 0.94, 0.08, scale.z * 0.86),
      collider: false
    });
  }
}

function addCabinet(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  position: THREE.Vector3,
  scale: THREE.Vector3
): void {
  addStaticBox(scene, world, rapier, {
    color: 0x5a4330,
    position: new THREE.Vector3(position.x, position.y + scale.y * 0.5, position.z),
    scale
  });
  addStaticBox(scene, world, rapier, {
    color: 0x6e563d,
    position: new THREE.Vector3(position.x - scale.x * 0.16, position.y + scale.y * 0.5, position.z + scale.z * 0.51),
    scale: new THREE.Vector3(scale.x * 0.44, scale.y * 0.88, 0.04),
    collider: false
  });
  addStaticBox(scene, world, rapier, {
    color: 0x6e563d,
    position: new THREE.Vector3(position.x + scale.x * 0.16, position.y + scale.y * 0.5, position.z + scale.z * 0.51),
    scale: new THREE.Vector3(scale.x * 0.44, scale.y * 0.88, 0.04),
    collider: false
  });
}

function addAlchemySet(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  position: THREE.Vector3
): void {
  const tableSize = new THREE.Vector3(2.8, 0.95, 1.4);
  const tabletopY = position.y - TABLETOP_THICKNESS;

  addTable(scene, world, rapier, position, tableSize, 0x6b5038);

  const bottleLayouts = [
    { color: 0x6e8c69, x: -0.35, z: 0.12, height: 0.22 },
    { color: 0x8596b5, x: 0.1, z: 0.02, height: 0.24 },
    { color: 0xb07c62, x: 0.6, z: 0.12, height: 0.21 },
    { color: 0xd0ba74, x: 1.08, z: 0.34, height: 0.2 }
  ];
  bottleLayouts.forEach(({ color, x, z, height }) => {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 0.45, 10),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.28,
        metalness: 0.08,
        transparent: true,
        opacity: 0.95,
        fog: false
      })
    );
    bottle.position.set(
      position.x + x,
      tabletopY + height,
      position.z + z
    );
    bottle.castShadow = true;
    scene.add(bottle);
  });

  addStaticBox(scene, world, rapier, {
    color: 0x493325,
    position: new THREE.Vector3(position.x + 0.82, tabletopY + 0.03, position.z + 0.52),
    scale: new THREE.Vector3(0.5, 0.2, 0.32),
    collider: false
  });
}

function addRoomFloor(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  centerX: number,
  color: number
): void {
  addStaticBox(scene, world, rapier, {
    color,
    position: new THREE.Vector3(centerX, -0.5, 0),
    scale: new THREE.Vector3(10, 1, 12),
    roughness: 0.96,
    metalness: 0.02
  });
}

function addRoomCeiling(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  centerX: number
): void {
  addStaticBox(scene, world, rapier, {
    color: 0x3b2f24,
    position: new THREE.Vector3(centerX, 4.55, 0),
    scale: new THREE.Vector3(10, 0.42, 12),
    roughness: 0.82
  });
}

function addOuterWalls(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER
): void {
  const wallColor = 0x312720;
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(0, 2, -6),
    scale: new THREE.Vector3(30, 5, 0.8)
  });
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(0, 2, 6),
    scale: new THREE.Vector3(30, 5, 0.8)
  });
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(-15, 2, 0),
    scale: new THREE.Vector3(0.8, 5, 12)
  });
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(15, 2, 0),
    scale: new THREE.Vector3(0.8, 5, 12)
  });
}

function addPartitionWall(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  x: number
): void {
  const wallColor = 0x2c221b;
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(x, 2, -4.45),
    scale: new THREE.Vector3(0.8, 5, 3.1)
  });
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(x, 2, 4.45),
    scale: new THREE.Vector3(0.8, 5, 3.1)
  });
  addStaticBox(scene, world, rapier, {
    color: wallColor,
    position: new THREE.Vector3(x, 4.05, 0),
    scale: new THREE.Vector3(0.8, 0.9, 2.6)
  });
}

function addRug(scene: THREE.Scene, position: THREE.Vector3, scale: THREE.Vector3, color: number): void {
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(scale.x, 0.04, scale.z),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      fog: false
    })
  );
  rug.position.copy(position);
  rug.receiveShadow = true;
  scene.add(rug);
}

export function createCastleBlockout(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER
): CastleBlockoutData {
  scene.background = new THREE.Color(0x090807);
  scene.fog = new THREE.Fog(0x0f0b09, 20, 52);

  const ambientLight = new THREE.AmbientLight(0xf1dcc2, 0.42);
  scene.add(ambientLight);

  const fillLight = new THREE.HemisphereLight(0x9f97a7, 0x2d2118, 0.24);
  scene.add(fillLight);

  [-10, 0, 10].forEach((centerX, index) => {
    addRoomFloor(scene, world, rapier, centerX, [0x564535, 0x4c3b2f, 0x534131][index]);
    addRoomCeiling(scene, world, rapier, centerX);
  });

  addOuterWalls(scene, world, rapier);
  addPartitionWall(scene, world, rapier, -5);
  addPartitionWall(scene, world, rapier, 5);

  addRug(scene, new THREE.Vector3(-10.1, -0.01, 0.2), new THREE.Vector3(4.2, 0.04, 6), 0x6d4c34);
  addRug(scene, new THREE.Vector3(10, -0.01, -0.1), new THREE.Vector3(3.6, 0.04, 4.2), 0x4d5d43);

  addBed(scene, world, rapier, new THREE.Vector3(-11, 0, -1.1));
  const footLocker = addStaticBox(scene, world, rapier, {
    color: 0x5a412c,
    position: new THREE.Vector3(-11, 0.45, 1.6),
    scale: new THREE.Vector3(1.3, 0.9, 0.9)
  });
  addTable(scene, world, rapier, new THREE.Vector3(-7.7, 0.95, -2.9), new THREE.Vector3(1.4, 0.75, 1.1), 0x654d36);
  addStaticBox(scene, world, rapier, {
    color: 0x6a5238,
    position: new THREE.Vector3(-7.8, 1.1, 2.7),
    scale: new THREE.Vector3(1.4, 2.2, 0.7)
  });
  const bedsideCandles = addCandles(
    scene,
    world,
    rapier,
    [
      new THREE.Vector3(-7.95, 0.95, -2.75),
      new THREE.Vector3(-7.45, 0.95, -3.05),
      new THREE.Vector3(-11.1, 0.9, 1.6)
    ],
    4.8,
    3.4
  );

  addShelf(scene, world, rapier, new THREE.Vector3(-0.8, 0, -3.8), new THREE.Vector3(1.5, 2.7, 0.7), 0x5f4731, 4);
  addShelf(scene, world, rapier, new THREE.Vector3(2.1, 0, -3.6), new THREE.Vector3(1.5, 2.5, 0.7), 0x5a4330, 3);
  const cabinetBody = addStaticBox(scene, world, rapier, {
    color: 0x5a4330,
    position: new THREE.Vector3(2.7, 1.3, 2.9),
    scale: new THREE.Vector3(1.8, 2.6, 0.9)
  });
  const cabinetDoorLeft = addStaticBox(scene, world, rapier, {
    color: 0x6e563d,
    position: new THREE.Vector3(2.41, 1.3, 3.359),
    scale: new THREE.Vector3(0.79, 2.288, 0.04),
    collider: false
  });
  const cabinetDoorRight = addStaticBox(scene, world, rapier, {
    color: 0x6e563d,
    position: new THREE.Vector3(2.99, 1.3, 3.359),
    scale: new THREE.Vector3(0.79, 2.288, 0.04),
    collider: false
  });
  addStaticBox(scene, world, rapier, {
    color: 0x72543b,
    position: new THREE.Vector3(-2.5, 0.6, 2.7),
    scale: new THREE.Vector3(1.1, 1.2, 1.1)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x695238,
    position: new THREE.Vector3(-0.8, 0.5, 3.1),
    scale: new THREE.Vector3(1.2, 1, 1.2)
  });
  addCandles(
    scene,
    world,
    rapier,
    [
      new THREE.Vector3(-0.35, 2.7, -3.45),
      new THREE.Vector3(2.45, 2.5, -3.2),
      new THREE.Vector3(2.75, 2.6, 2.95)
    ],
    4.2,
    3.1
  );

  const alchemyTablePosition = new THREE.Vector3(10.3, 0.95, -1.25);
  const alchemyBottleHeight = 0.45;
  const alchemyTableSurfaceY = alchemyTablePosition.y;
  const alchemyBottleCenterY = alchemyTableSurfaceY + alchemyBottleHeight * 0.5;
  addTable(scene, world, rapier, alchemyTablePosition, new THREE.Vector3(2.8, 0.95, 1.4), 0x6b5038);
  const alchemyBottle1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 0.45, 10),
    new THREE.MeshStandardMaterial({
      color: 0x6e8c69,
      roughness: 0.28,
      metalness: 0.08,
      transparent: true,
      opacity: 0.95,
      fog: false
    })
  );
  alchemyBottle1.position.set(9.95, alchemyBottleCenterY, -1.13);
  alchemyBottle1.castShadow = true;
  alchemyBottle1.receiveShadow = true;
  scene.add(alchemyBottle1);
  const alchemyBottle2 = alchemyBottle1.clone();
  (alchemyBottle2.material as THREE.MeshStandardMaterial) = (alchemyBottle2.material as THREE.MeshStandardMaterial).clone();
  (alchemyBottle2.material as THREE.MeshStandardMaterial).color.setHex(0x8596b5);
  alchemyBottle2.position.set(10.4, alchemyBottleCenterY, -1.23);
  alchemyBottle2.receiveShadow = true;
  scene.add(alchemyBottle2);
  const alchemyBottle3 = alchemyBottle1.clone();
  (alchemyBottle3.material as THREE.MeshStandardMaterial) = (alchemyBottle3.material as THREE.MeshStandardMaterial).clone();
  (alchemyBottle3.material as THREE.MeshStandardMaterial).color.setHex(0xb07c62);
  alchemyBottle3.position.set(10.9, alchemyBottleCenterY, -1.13);
  alchemyBottle3.receiveShadow = true;
  scene.add(alchemyBottle3);
  const alchemyBottle4 = alchemyBottle1.clone();
  (alchemyBottle4.material as THREE.MeshStandardMaterial) = (alchemyBottle4.material as THREE.MeshStandardMaterial).clone();
  (alchemyBottle4.material as THREE.MeshStandardMaterial).color.setHex(0xd0ba74);
  alchemyBottle4.position.set(11.38, alchemyBottleCenterY, -0.91);
  scene.add(alchemyBottle4);
  addPickupBottleCollider(world, rapier, alchemyBottle1);
  addPickupBottleCollider(world, rapier, alchemyBottle2);
  addPickupBottleCollider(world, rapier, alchemyBottle3);
  addPickupBottleCollider(world, rapier, alchemyBottle4);
  const alchemyBoard = addStaticBox(scene, world, rapier, {
    color: 0x493325,
    position: new THREE.Vector3(11.12, alchemyTableSurfaceY + 0.015, -0.73),
    scale: new THREE.Vector3(0.9, 0.03, 0.26),
    collider: false
  });
  addShelf(scene, world, rapier, new THREE.Vector3(12.6, 0, 2.5), new THREE.Vector3(1.3, 2.5, 0.7), 0x5f4732, 4);
  addTable(scene, world, rapier, new THREE.Vector3(7.6, 0.85, 2.4), new THREE.Vector3(1.6, 0.7, 1), 0x684d34);
  addStaticBox(scene, world, rapier, {
    color: 0x6c5236,
    position: new THREE.Vector3(7.7, 1.1, -3.3),
    scale: new THREE.Vector3(1.2, 2.2, 0.7)
  });
  addCandles(
    scene,
    world,
    rapier,
    [
      new THREE.Vector3(9.7, 0.95, -1.45),
      new THREE.Vector3(10.95, 0.95, -1.05),
      new THREE.Vector3(7.35, 0.85, 2.35),
      new THREE.Vector3(12.55, 2.5, 2.65)
    ],
    5.2,
    3.6
  );

  addPointLight(scene, {
    color: 0xffc98a,
    intensity: 20,
    position: new THREE.Vector3(-11.8, 2.8, -3.8),
    distance: 8
  });
  addPointLight(scene, {
    color: 0xffe0b6,
    intensity: 16,
    position: new THREE.Vector3(-7.2, 2.6, 3.5),
    distance: 7.5
  });
  addPointLight(scene, {
    color: 0xffd59c,
    intensity: 18,
    position: new THREE.Vector3(-0.4, 3.1, 0),
    distance: 10
  });
  addPointLight(scene, {
    color: 0xffbe78,
    intensity: 22,
    position: new THREE.Vector3(10.3, 2.85, -1.2),
    distance: 10
  });
  addPointLight(scene, {
    color: 0xffd8a0,
    intensity: 15,
    position: new THREE.Vector3(7.5, 2.7, 3),
    distance: 8
  });

  addBounceLight(scene, 0xd8b385, 2.4, 8.5, new THREE.Vector3(-10, 3.15, 0.4));
  addBounceLight(scene, 0xb6a48d, 1.9, 9, new THREE.Vector3(0, 3.3, 0));
  addBounceLight(scene, 0xd7bc93, 2.6, 8.5, new THREE.Vector3(10, 3.2, -0.1));
  addBounceLight(scene, 0x9e8b77, 1.2, 7.5, new THREE.Vector3(-5.2, 2.3, 0));
  addBounceLight(scene, 0x9e8b77, 1.2, 7.5, new THREE.Vector3(5.2, 2.3, 0));
  addBounceLight(scene, 0x876f58, 1.3, 5.8, new THREE.Vector3(-8.8, 1.8, 4.3));
  addBounceLight(scene, 0x876f58, 1.3, 5.8, new THREE.Vector3(8.8, 1.8, 4.3));
  addBounceLight(scene, 0x7c6958, 1.1, 5.2, new THREE.Vector3(0, 1.6, -4.6));

  const focalArch = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.16, 12, 24, Math.PI),
    new THREE.MeshStandardMaterial({
      color: 0x7a634a,
      roughness: 0.82,
      metalness: 0.05,
      fog: false
    })
  );
  focalArch.rotation.z = Math.PI / 2;
  focalArch.scale.setScalar(0.82);
  focalArch.position.set(9.35, 1.72, -1.12);
  focalArch.castShadow = true;
  scene.add(focalArch);

  const interactables = createCastleInteractables({
    bedsideCandles,
    footLocker,
    cabinetDoors: [cabinetDoorLeft, cabinetDoorRight],
    alchemyBottles: [alchemyBottle1, alchemyBottle2, alchemyBottle3, alchemyBottle4],
    alchemyBoard,
    arch: focalArch
  });

  return {
    spawnPosition: new THREE.Vector3(-12, 0.85, 1.8),
    interactables
  };
}
