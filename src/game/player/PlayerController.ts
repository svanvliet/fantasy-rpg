import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

export interface PlayerDebugState {
  cameraMode: "firstPerson" | "thirdPerson";
  grounded: boolean;
  pointerLocked: boolean;
  position: THREE.Vector3;
  yaw: number;
}

export interface PlayerPersistenceState {
  position: {
    x: number;
    y: number;
    z: number;
  };
  yaw: number;
  pitch: number;
}

export interface PlayerControllerOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  scene: THREE.Scene;
  world: RAPIER.World;
  rapier: typeof RAPIER;
  spawnPosition: THREE.Vector3;
}

interface JumpProfile {
  jumpVelocity: number;
  ascentGravity: number;
  descentGravity: number;
}

function createJumpProfile(
  jumpHeight: number,
  timeToApex: number,
  timeToDescent: number
): JumpProfile {
  const ascentGravity = -(2 * jumpHeight) / (timeToApex * timeToApex);
  const descentGravity = -(2 * jumpHeight) / (timeToDescent * timeToDescent);

  return {
    jumpVelocity: (2 * jumpHeight) / timeToApex,
    ascentGravity,
    descentGravity
  };
}

const MOVE_SPEED = 4.8;
const GROUND_ACCELERATION = 26;
const GROUND_DECELERATION = 22;
const LANDING_BRAKE_DECELERATION = 44;
const LANDING_BRAKE_TIME = 0.09;
const AIR_ACCELERATION = 7.5;
const AIR_DECELERATION = 1.2;
const JUMP_HEIGHT = 1.15;
const TIME_TO_APEX = 0.48;
const TIME_TO_DESCENT = 0.42;
const JUMP_HOLD_TIME = 0.11;
const JUMP_HOLD_GRAVITY_FACTOR = 0.55;
const TERMINAL_FALL_SPEED = -18;
const LOOK_SENSITIVITY = 0.0022;
const CAPSULE_HALF_HEIGHT = 0.55;
const CAPSULE_RADIUS = 0.3;
const CAMERA_HEIGHT_OFFSET = 0.55;
const CEILING_NORMAL_THRESHOLD = -0.35;
const GROUND_SNAP_DISTANCE = 0.18;
const THIRD_PERSON_DISTANCE = 2.8;
const THIRD_PERSON_SIDE_OFFSET = 0.36;
const THIRD_PERSON_FOCUS_HEIGHT = 1.18;
const THIRD_PERSON_HEIGHT = 1.15;

const JUMP_PROFILE = createJumpProfile(JUMP_HEIGHT, TIME_TO_APEX, TIME_TO_DESCENT);

export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly world: RAPIER.World;
  private readonly rapier: typeof RAPIER;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly characterController: RAPIER.KinematicCharacterController;
  private readonly movementInput = new THREE.Vector3();
  private readonly horizontalVelocity = new THREE.Vector3();
  private readonly desiredHorizontalVelocity = new THREE.Vector3();
  private readonly keyState = new Set<string>();
  private readonly debugPosition = new THREE.Vector3();
  private readonly thirdPersonFocus = new THREE.Vector3();
  private readonly thirdPersonOffset = new THREE.Vector3();
  private readonly thirdPersonSide = new THREE.Vector3();
  private readonly avatarRoot = new THREE.Group();

  private yaw = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private jumpQueued = false;
  private jumpHeld = false;
  private jumpHoldTimer = 0;
  private landingBrakeTimer = 0;
  private grounded = false;
  private pointerLocked = false;
  private cameraMode: "firstPerson" | "thirdPerson" = "firstPerson";

  constructor(options: PlayerControllerOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.scene = options.scene;
    this.world = options.world;
    this.rapier = options.rapier;

    const rigidBodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
      options.spawnPosition.x,
      options.spawnPosition.y,
      options.spawnPosition.z
    );
    this.body = this.world.createRigidBody(rigidBodyDesc);

    const colliderDesc = this.rapier.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS);
    this.collider = this.world.createCollider(colliderDesc, this.body);

    this.characterController = this.world.createCharacterController(0.01);
    this.characterController.setApplyImpulsesToDynamicBodies(true);
    this.characterController.enableSnapToGround(GROUND_SNAP_DISTANCE);

    this.camera.rotation.order = "YXZ";
    this.createAvatarProxy();
    this.syncCameraFromBody();
    this.bindEvents();
  }

  update(deltaSeconds: number): void {
    const wasGrounded = this.grounded;
    const bodyTranslation = this.body.translation();
    const desiredTranslation = this.computeDesiredTranslation(deltaSeconds);

    this.characterController.computeColliderMovement(
      this.collider,
      new this.rapier.Vector3(
        desiredTranslation.x,
        desiredTranslation.y,
        desiredTranslation.z
      )
    );

    const corrected = this.characterController.computedMovement();
    const nextPosition = new THREE.Vector3(
      bodyTranslation.x + corrected.x,
      bodyTranslation.y + corrected.y,
      bodyTranslation.z + corrected.z
    );

    this.body.setNextKinematicTranslation(
      new this.rapier.Vector3(nextPosition.x, nextPosition.y, nextPosition.z)
    );

    const hitCeiling = this.hitCeilingDuringMove();
    this.grounded = this.characterController.computedGrounded();
    const justLanded = !wasGrounded && this.grounded;

    if (hitCeiling && this.verticalVelocity > 0) {
      this.verticalVelocity = 0;
      this.jumpHoldTimer = 0;
    }

    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = 0;
      this.jumpHoldTimer = 0;
    }

    if (justLanded && this.desiredHorizontalVelocity.lengthSq() === 0) {
      this.landingBrakeTimer = LANDING_BRAKE_TIME;
    }

    this.debugPosition.copy(nextPosition);
    this.syncCameraFromPosition(nextPosition);
  }

  getDebugState(): PlayerDebugState {
    return {
      cameraMode: this.cameraMode,
      grounded: this.grounded,
      pointerLocked: this.pointerLocked,
      position: this.debugPosition.clone(),
      yaw: this.yaw
    };
  }

  getPersistenceState(): PlayerPersistenceState {
    return {
      position: {
        x: this.debugPosition.x,
        y: this.debugPosition.y,
        z: this.debugPosition.z
      },
      yaw: this.yaw,
      pitch: this.pitch
    };
  }

  restorePersistenceState(state: PlayerPersistenceState): void {
    const nextPosition = new THREE.Vector3(state.position.x, state.position.y, state.position.z);

    this.yaw = state.yaw;
    this.pitch = THREE.MathUtils.clamp(state.pitch, -Math.PI / 2, Math.PI / 2);
    this.verticalVelocity = 0;
    this.horizontalVelocity.set(0, 0, 0);
    this.desiredHorizontalVelocity.set(0, 0, 0);
    this.jumpQueued = false;
    this.jumpHeld = false;
    this.jumpHoldTimer = 0;
    this.landingBrakeTimer = 0;
    this.grounded = false;
    this.body.setTranslation(
      new this.rapier.Vector3(nextPosition.x, nextPosition.y, nextPosition.z),
      true
    );
    this.body.setNextKinematicTranslation(
      new this.rapier.Vector3(nextPosition.x, nextPosition.y, nextPosition.z)
    );
    this.debugPosition.copy(nextPosition);
    this.syncCameraFromPosition(nextPosition);
  }

  handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.domElement;
  }

  clearTransientInput(): void {
    this.keyState.clear();
    this.jumpQueued = false;
    this.jumpHeld = false;
    this.jumpHoldTimer = 0;
    this.landingBrakeTimer = 0;
  }

  toggleCameraMode(): void {
    this.cameraMode = this.cameraMode === "firstPerson" ? "thirdPerson" : "firstPerson";
    this.syncCameraFromPosition(this.debugPosition);
  }

  private bindEvents(): void {
    this.domElement.addEventListener("click", () => {
      if (!this.pointerLocked) {
        void this.domElement.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.handlePointerLockChange();
    });

    document.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked) {
        return;
      }

      this.yaw -= event.movementX * LOOK_SENSITIVITY;
      this.pitch -= event.movementY * LOOK_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2, Math.PI / 2);
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.y = this.yaw;
    });

    window.addEventListener("keydown", (event) => {
      this.keyState.add(event.code);

      if (event.code === "Space") {
        this.jumpQueued = true;
        this.jumpHeld = true;
      }

      if (event.code === "KeyV") {
        this.toggleCameraMode();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keyState.delete(event.code);

      if (event.code === "Space") {
        this.jumpHeld = false;
      }
    });

    window.addEventListener("blur", () => {
      this.clearTransientInput();
    });
  }

  private computeDesiredTranslation(deltaSeconds: number): THREE.Vector3 {
    this.movementInput.set(0, 0, 0);
    this.desiredHorizontalVelocity.set(0, 0, 0);

    if (this.keyState.has("KeyW")) {
      this.movementInput.z -= 1;
    }
    if (this.keyState.has("KeyS")) {
      this.movementInput.z += 1;
    }
    if (this.keyState.has("KeyA")) {
      this.movementInput.x -= 1;
    }
    if (this.keyState.has("KeyD")) {
      this.movementInput.x += 1;
    }

    if (this.movementInput.lengthSq() > 0) {
      this.desiredHorizontalVelocity
        .copy(this.movementInput)
        .normalize()
        .multiplyScalar(MOVE_SPEED)
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw);
    }

    this.updateHorizontalVelocity(deltaSeconds);

    if (this.grounded && this.jumpQueued) {
      this.verticalVelocity = JUMP_PROFILE.jumpVelocity;
      this.grounded = false;
      this.jumpHoldTimer = JUMP_HOLD_TIME;
    }
    this.jumpQueued = false;

    if (this.jumpHoldTimer > 0) {
      this.jumpHoldTimer = Math.max(this.jumpHoldTimer - deltaSeconds, 0);
    }

    const gravity = this.computeGravity();
    this.verticalVelocity = Math.max(
      this.verticalVelocity + gravity * deltaSeconds,
      TERMINAL_FALL_SPEED
    );

    return new THREE.Vector3(
      this.horizontalVelocity.x * deltaSeconds,
      this.verticalVelocity * deltaSeconds,
      this.horizontalVelocity.z * deltaSeconds
    );
  }

  private updateHorizontalVelocity(deltaSeconds: number): void {
    if (this.desiredHorizontalVelocity.lengthSq() > 0) {
      const acceleration = this.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION;
      this.moveHorizontalVelocityToward(
        this.desiredHorizontalVelocity,
        acceleration * deltaSeconds
      );
      return;
    }

    const deceleration = this.grounded ? GROUND_DECELERATION : AIR_DECELERATION;
    const activeDeceleration =
      this.grounded && this.landingBrakeTimer > 0
        ? LANDING_BRAKE_DECELERATION
        : deceleration;
    const speed = this.horizontalVelocity.length();
    if (speed === 0) {
      this.landingBrakeTimer = 0;
      return;
    }

    const nextSpeed = Math.max(speed - activeDeceleration * deltaSeconds, 0);
    if (nextSpeed === 0) {
      this.horizontalVelocity.set(0, 0, 0);
      this.landingBrakeTimer = 0;
      return;
    }

    this.horizontalVelocity.multiplyScalar(nextSpeed / speed);
    if (this.landingBrakeTimer > 0) {
      this.landingBrakeTimer = Math.max(this.landingBrakeTimer - deltaSeconds, 0);
    }
  }

  private moveHorizontalVelocityToward(targetVelocity: THREE.Vector3, maxDelta: number): void {
    const deltaX = targetVelocity.x - this.horizontalVelocity.x;
    const deltaZ = targetVelocity.z - this.horizontalVelocity.z;
    const deltaLength = Math.hypot(deltaX, deltaZ);

    if (deltaLength <= maxDelta || deltaLength === 0) {
      this.horizontalVelocity.x = targetVelocity.x;
      this.horizontalVelocity.z = targetVelocity.z;
      return;
    }

    const scale = maxDelta / deltaLength;
    this.horizontalVelocity.x += deltaX * scale;
    this.horizontalVelocity.z += deltaZ * scale;
  }

  private computeGravity(): number {
    if (this.grounded && this.verticalVelocity <= 0) {
      return 0;
    }

    if (this.verticalVelocity > 0) {
      const holdFactor =
        this.jumpHeld && this.jumpHoldTimer > 0 ? JUMP_HOLD_GRAVITY_FACTOR : 1;
      return JUMP_PROFILE.ascentGravity * holdFactor;
    }

    return JUMP_PROFILE.descentGravity;
  }

  private hitCeilingDuringMove(): boolean {
    const collisionCount = this.characterController.numComputedCollisions();

    for (let index = 0; index < collisionCount; index += 1) {
      const collision = this.characterController.computedCollision(index);
      if (collision && collision.normal1.y < CEILING_NORMAL_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  private syncCameraFromBody(): void {
    const translation = this.body.translation();
    this.syncCameraFromPosition(
      new THREE.Vector3(translation.x, translation.y, translation.z)
    );
    this.debugPosition.set(translation.x, translation.y, translation.z);
  }

  private syncCameraFromPosition(position: THREE.Vector3): void {
    this.syncAvatarProxy(position);

    if (this.cameraMode === "firstPerson") {
      this.camera.position.set(position.x, position.y + CAMERA_HEIGHT_OFFSET, position.z);
      this.camera.rotation.x = this.pitch;
      this.camera.rotation.y = this.yaw;
      return;
    }

    this.thirdPersonFocus.set(position.x, position.y + THIRD_PERSON_FOCUS_HEIGHT, position.z);
    this.thirdPersonOffset
      .set(0, THIRD_PERSON_HEIGHT + this.pitch * -0.55, THIRD_PERSON_DISTANCE)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw);
    this.thirdPersonSide
      .set(THIRD_PERSON_SIDE_OFFSET, 0, 0)
      .applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw);

    this.camera.position
      .copy(this.thirdPersonFocus)
      .add(this.thirdPersonOffset)
      .add(this.thirdPersonSide);
    this.camera.lookAt(this.thirdPersonFocus);
  }

  private createAvatarProxy(): void {
    this.avatarRoot.visible = false;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.7, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x5b4737, roughness: 0.92, metalness: 0.02 })
    );
    torso.position.set(0, 1.05, 0);
    this.avatarRoot.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xd7b48b, roughness: 0.82, metalness: 0.02 })
    );
    head.position.set(0, 1.56, 0);
    this.avatarRoot.add(head);

    const rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.58, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x654d3a, roughness: 0.94, metalness: 0.02 })
    );
    rightArm.position.set(0.32, 1.03, 0);
    this.avatarRoot.add(rightArm);

    const leftArm = rightArm.clone();
    leftArm.position.x = -0.32;
    this.avatarRoot.add(leftArm);

    const hips = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x443226, roughness: 0.94, metalness: 0.02 })
    );
    hips.position.set(0, 0.62, 0);
    this.avatarRoot.add(hips);

    [torso, head, rightArm, leftArm, hips].forEach((mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });

    this.scene.add(this.avatarRoot);
  }

  private syncAvatarProxy(position: THREE.Vector3): void {
    this.avatarRoot.visible = this.cameraMode === "thirdPerson";
    this.avatarRoot.position.set(position.x, position.y, position.z);
    this.avatarRoot.rotation.set(0, this.yaw, 0);
  }
}
