import * as THREE from "three";

import type { ViewModelFrameState } from "./types";

const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 8;
const ARM_LERP = 10;
const ARM_SCALE = 0.828;

interface ArmRig {
  pivot: THREE.Group;
  forearm: THREE.Mesh;
  hand: THREE.Mesh;
}

interface ArmPose {
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

type CarryStyle = "bottle" | "book" | "satchel" | "ingredient" | "default";

export class ViewModelController {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly root: THREE.Group;
  private readonly leftArm: ArmRig;
  private readonly rightArm: ArmRig;
  private readonly rightTargetPosition = new THREE.Vector3();
  private readonly leftTargetPosition = new THREE.Vector3();
  private readonly rightTargetQuaternion = new THREE.Quaternion();
  private readonly leftTargetQuaternion = new THREE.Quaternion();

  private time = 0;
  private visible = true;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, CAMERA_NEAR, CAMERA_FAR);
    this.root = new THREE.Group();
    this.camera.add(this.root);
    this.scene.add(this.camera);

    const ambient = new THREE.AmbientLight(0xf3debd, 1.2);
    this.scene.add(ambient);

    const fill = new THREE.HemisphereLight(0xf5e8d4, 0x261b12, 0.8);
    this.scene.add(fill);

    const key = new THREE.DirectionalLight(0xffd9a6, 0.55);
    key.position.set(0.8, 0.4, 1.4);
    this.scene.add(key);

    this.leftArm = this.createArmRig("left");
    this.rightArm = this.createArmRig("right");
    this.root.add(this.leftArm.pivot, this.rightArm.pivot);
  }

  handleResize(sourceCamera: THREE.PerspectiveCamera): void {
    this.camera.fov = sourceCamera.fov;
    this.camera.aspect = sourceCamera.aspect;
    this.camera.updateProjectionMatrix();
  }

  update(deltaSeconds: number, sourceCamera: THREE.PerspectiveCamera, state: ViewModelFrameState): void {
    this.time += deltaSeconds;
    this.visible = state.visible && state.cameraMode === "firstPerson";
    this.root.visible = this.visible;

    this.camera.position.copy(sourceCamera.position);
    this.camera.quaternion.copy(sourceCamera.quaternion);
    this.camera.fov = sourceCamera.fov;
    this.camera.aspect = sourceCamera.aspect;
    this.camera.updateProjectionMatrix();

    if (!this.visible) {
      return;
    }

    const swayTime = this.time * 1.75;
    const swayX = Math.sin(swayTime) * 0.01;
    const swayY = Math.cos(swayTime * 0.7) * 0.008;
    const engagement = this.getEngagementWeight(state);
    const supportWeight = state.pose === "carry" && this.needsLeftHandSupport(state) ? 1 : 0;

    const rightPose = this.resolveRightPose(state, engagement);
    const leftPose = this.resolveLeftPose(state, engagement, supportWeight);

    this.rightTargetPosition.copy(rightPose.position).add(new THREE.Vector3(swayX, swayY, 0));
    this.leftTargetPosition.copy(leftPose.position).add(new THREE.Vector3(-swayX * 0.85, swayY, 0));
    this.rightTargetQuaternion.setFromEuler(rightPose.rotation);
    this.leftTargetQuaternion.setFromEuler(leftPose.rotation);

    const lerpAlpha = 1 - Math.exp(-ARM_LERP * deltaSeconds);
    this.rightArm.pivot.position.lerp(this.rightTargetPosition, lerpAlpha);
    this.leftArm.pivot.position.lerp(this.leftTargetPosition, lerpAlpha);
    this.rightArm.pivot.quaternion.slerp(this.rightTargetQuaternion, lerpAlpha);
    this.leftArm.pivot.quaternion.slerp(this.leftTargetQuaternion, lerpAlpha);

    const handOpenness = state.pointerLocked ? 1 : 0.92;
    this.rightArm.hand.scale.setScalar(handOpenness);
    this.leftArm.hand.scale.setScalar(handOpenness);
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (!this.visible) {
      return;
    }

    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }

  private createArmRig(side: "left" | "right"): ArmRig {
    const pivot = new THREE.Group();

    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.4, 0.13),
      new THREE.MeshStandardMaterial({
        color: side === "left" ? 0x534335 : 0x5d4a39,
        roughness: 0.92,
        metalness: 0.03
      })
    );
    sleeve.position.set(0, -0.16, 0);
    sleeve.castShadow = false;
    sleeve.receiveShadow = false;
    pivot.add(sleeve);

    const cuff = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.075, 0.145),
      new THREE.MeshStandardMaterial({
        color: 0xb99a74,
        roughness: 0.88,
        metalness: 0.02
      })
    );
    cuff.position.set(0, -0.32, 0);
    cuff.castShadow = false;
    cuff.receiveShadow = false;
    pivot.add(cuff);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.11, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0xd7b48b,
        roughness: 0.8,
        metalness: 0.02
      })
    );
    hand.position.set(0, -0.39, 0.025);
    hand.castShadow = false;
    hand.receiveShadow = false;
    pivot.add(hand);

    pivot.scale.setScalar(ARM_SCALE);

    return {
      pivot,
      forearm: sleeve,
      hand
    };
  }

  private getEngagementWeight(state: ViewModelFrameState): number {
    if (state.pose === "carry") {
      return 1;
    }

    if (state.targetDistance === null) {
      return 0;
    }

    const normalized = THREE.MathUtils.clamp((2.35 - state.targetDistance) / 1.75, 0, 1);
    return normalized;
  }

  private resolveRightPose(state: ViewModelFrameState, engagement: number): ArmPose {
    const basePosition = new THREE.Vector3(0.3, -0.2, -0.5);
    const baseRotation = new THREE.Euler(-0.56, -0.08, 0.52);

    switch (state.pose) {
      case "carry":
        return this.resolveCarryRightPose(state);
      case "inspect":
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.lerp(basePosition.x, 0.2, engagement),
            THREE.MathUtils.lerp(basePosition.y, -0.12, engagement),
            THREE.MathUtils.lerp(basePosition.z, -0.42, engagement)
          ),
          rotation: new THREE.Euler(
            THREE.MathUtils.lerp(baseRotation.x, -0.18, engagement),
            THREE.MathUtils.lerp(baseRotation.y, -0.02, engagement),
            THREE.MathUtils.lerp(baseRotation.z, 0.2, engagement)
          )
        };
      case "ready":
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.lerp(basePosition.x, 0.28, engagement),
            THREE.MathUtils.lerp(basePosition.y, -0.18, engagement),
            THREE.MathUtils.lerp(basePosition.z, -0.46, engagement)
          ),
          rotation: new THREE.Euler(
            THREE.MathUtils.lerp(baseRotation.x, -0.18, engagement),
            THREE.MathUtils.lerp(baseRotation.y, -0.04, engagement),
            THREE.MathUtils.lerp(baseRotation.z, 0.24, engagement)
          )
        };
      case "idle":
      default:
        return {
          position: basePosition,
          rotation: baseRotation
        };
    }
  }

  private resolveLeftPose(
    state: ViewModelFrameState,
    engagement: number,
    supportWeight: number
  ): ArmPose {
    const basePosition = new THREE.Vector3(-0.34, -0.28, -0.56);
    const baseRotation = new THREE.Euler(-0.72, 0.28, -0.48);

    if (state.pose === "carry") {
      return this.resolveCarryLeftPose(state, supportWeight, basePosition, baseRotation);
    }

    if (state.pose === "inspect") {
      return {
        position: new THREE.Vector3(
          THREE.MathUtils.lerp(basePosition.x, -0.28, engagement * 0.5),
          THREE.MathUtils.lerp(basePosition.y, -0.2, engagement * 0.45),
          THREE.MathUtils.lerp(basePosition.z, -0.48, engagement * 0.4)
        ),
        rotation: new THREE.Euler(
          THREE.MathUtils.lerp(baseRotation.x, -0.28, engagement * 0.45),
          THREE.MathUtils.lerp(baseRotation.y, 0.18, engagement * 0.45),
          THREE.MathUtils.lerp(baseRotation.z, -0.24, engagement * 0.45)
        )
      };
    }

    return {
      position: basePosition,
      rotation: baseRotation
    };
  }

  private needsLeftHandSupport(state: ViewModelFrameState): boolean {
    return state.heldShape === "book" || state.heldShape === "satchel";
  }

  private resolveCarryRightPose(state: ViewModelFrameState): ArmPose {
    switch (this.getCarryStyle(state)) {
      case "bottle":
        return {
          position: new THREE.Vector3(0.24, -0.2, -0.5),
          rotation: new THREE.Euler(-0.06, -0.16, 0.18)
        };
      case "ingredient":
        return {
          position: new THREE.Vector3(0.2, -0.16, -0.46),
          rotation: new THREE.Euler(0.08, -0.2, 0.06)
        };
      case "book":
        return {
          position: new THREE.Vector3(0.26, -0.24, -0.56),
          rotation: new THREE.Euler(-0.22, -0.08, 0.3)
        };
      case "satchel":
        return {
          position: new THREE.Vector3(0.24, -0.26, -0.58),
          rotation: new THREE.Euler(-0.28, -0.04, 0.24)
        };
      case "default":
      default:
        return {
          position: new THREE.Vector3(0.25, -0.24, -0.54),
          rotation: new THREE.Euler(-0.18, -0.08, 0.28)
        };
    }
  }

  private resolveCarryLeftPose(
    state: ViewModelFrameState,
    supportWeight: number,
    basePosition: THREE.Vector3,
    baseRotation: THREE.Euler
  ): ArmPose {
    switch (this.getCarryStyle(state)) {
      case "book":
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.lerp(basePosition.x, -0.14, supportWeight),
            THREE.MathUtils.lerp(basePosition.y, -0.18, supportWeight),
            THREE.MathUtils.lerp(basePosition.z, -0.49, supportWeight)
          ),
          rotation: new THREE.Euler(
            THREE.MathUtils.lerp(baseRotation.x, -0.2, supportWeight),
            THREE.MathUtils.lerp(baseRotation.y, 0.14, supportWeight),
            THREE.MathUtils.lerp(baseRotation.z, -0.16, supportWeight)
          )
        };
      case "satchel":
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.lerp(basePosition.x, -0.2, supportWeight),
            THREE.MathUtils.lerp(basePosition.y, -0.24, supportWeight),
            THREE.MathUtils.lerp(basePosition.z, -0.54, supportWeight)
          ),
          rotation: new THREE.Euler(
            THREE.MathUtils.lerp(baseRotation.x, -0.32, supportWeight),
            THREE.MathUtils.lerp(baseRotation.y, 0.08, supportWeight),
            THREE.MathUtils.lerp(baseRotation.z, -0.24, supportWeight)
          )
        };
      case "ingredient":
        return {
          position: new THREE.Vector3(-0.38, -0.3, -0.62),
          rotation: new THREE.Euler(-0.84, 0.32, -0.58)
        };
      case "bottle":
      case "default":
      default:
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.lerp(basePosition.x, -0.18, supportWeight),
            THREE.MathUtils.lerp(basePosition.y, -0.22, supportWeight),
            THREE.MathUtils.lerp(basePosition.z, -0.5, supportWeight)
          ),
          rotation: new THREE.Euler(
            THREE.MathUtils.lerp(baseRotation.x, -0.26, supportWeight),
            THREE.MathUtils.lerp(baseRotation.y, 0.1, supportWeight),
            THREE.MathUtils.lerp(baseRotation.z, -0.22, supportWeight)
          )
        };
    }
  }

  private getCarryStyle(state: ViewModelFrameState): CarryStyle {
    switch (state.heldShape) {
      case "bottle":
      case "book":
      case "satchel":
      case "ingredient":
        return state.heldShape;
      default:
        return "default";
    }
  }
}
