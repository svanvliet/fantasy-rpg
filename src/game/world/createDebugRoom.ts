import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

export interface DebugRoomData {
  spawnPosition: THREE.Vector3;
}

interface StaticBoxOptions {
  color: number;
  position: THREE.Vector3;
  scale: THREE.Vector3;
}

function addStaticBox(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER,
  options: StaticBoxOptions
): void {
  const geometry = new THREE.BoxGeometry(options.scale.x, options.scale.y, options.scale.z);
  const material = new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: 0.9,
    metalness: 0.05
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(options.position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

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
  );
  world.createCollider(collider, rigidBody);
}

export function createDebugRoom(
  scene: THREE.Scene,
  world: RAPIER.World,
  rapier: typeof RAPIER
): DebugRoomData {
  const ambientLight = new THREE.AmbientLight(0xf2d8b2, 0.35);
  scene.add(ambientLight);

  const candleLight = new THREE.PointLight(0xffc680, 22, 14, 2);
  candleLight.position.set(-4, 3.2, -2.5);
  candleLight.castShadow = true;
  scene.add(candleLight);

  const corridorLight = new THREE.PointLight(0xffe5b0, 18, 16, 2);
  corridorLight.position.set(4.6, 3.1, 3.8);
  scene.add(corridorLight);

  addStaticBox(scene, world, rapier, {
    color: 0x5a4c3d,
    position: new THREE.Vector3(0, -0.5, 0),
    scale: new THREE.Vector3(16, 1, 16)
  });

  addStaticBox(scene, world, rapier, {
    color: 0x30251d,
    position: new THREE.Vector3(0, 2.5, -8),
    scale: new THREE.Vector3(16, 5, 0.8)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x30251d,
    position: new THREE.Vector3(0, 2.5, 8),
    scale: new THREE.Vector3(16, 5, 0.8)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x30251d,
    position: new THREE.Vector3(-8, 2.5, 0),
    scale: new THREE.Vector3(0.8, 5, 16)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x30251d,
    position: new THREE.Vector3(8, 2.5, 0),
    scale: new THREE.Vector3(0.8, 5, 16)
  });

  addStaticBox(scene, world, rapier, {
    color: 0x403126,
    position: new THREE.Vector3(0, 5.1, 0),
    scale: new THREE.Vector3(16, 0.5, 16)
  });

  addStaticBox(scene, world, rapier, {
    color: 0x6d5b45,
    position: new THREE.Vector3(-2.5, 0.55, -1),
    scale: new THREE.Vector3(1.8, 1.1, 3)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x725c3c,
    position: new THREE.Vector3(3.2, 0.8, 2.3),
    scale: new THREE.Vector3(2, 1.6, 2)
  });
  addStaticBox(scene, world, rapier, {
    color: 0x55432f,
    position: new THREE.Vector3(-4.8, 1.1, 4.4),
    scale: new THREE.Vector3(1.4, 2.2, 1.4)
  });

  const guideGeometry = new THREE.TorusKnotGeometry(0.4, 0.14, 80, 10);
  const guideMaterial = new THREE.MeshStandardMaterial({
    color: 0x9d7a3b,
    emissive: 0x291907,
    roughness: 0.38,
    metalness: 0.3
  });
  const guideMesh = new THREE.Mesh(guideGeometry, guideMaterial);
  guideMesh.position.set(0, 2.5, 0);
  guideMesh.castShadow = true;
  scene.add(guideMesh);

  return {
    spawnPosition: new THREE.Vector3(0, 0.85, 5.75)
  };
}

