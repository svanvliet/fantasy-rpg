import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

export interface PlayerDebugState {
  grounded: boolean;
  pointerLocked: boolean;
  position: THREE.Vector3;
}

export interface PlayerControllerOptions {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
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

const JUMP_PROFILE = createJumpProfile(JUMP_HEIGHT, TIME_TO_APEX, TIME_TO_DESCENT);

export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
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

  private yaw = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private jumpQueued = false;
  private jumpHeld = false;
  private jumpHoldTimer = 0;
  private landingBrakeTimer = 0;
  private grounded = false;
  private pointerLocked = false;

  constructor(options: PlayerControllerOptions) {
    this.camera = options.camera;
    this.domElement = options.domElement;
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
      grounded: this.grounded,
      pointerLocked: this.pointerLocked,
      position: this.debugPosition.clone()
    };
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
    this.camera.position.set(position.x, position.y + CAMERA_HEIGHT_OFFSET, position.z);
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.y = this.yaw;
  }
}
