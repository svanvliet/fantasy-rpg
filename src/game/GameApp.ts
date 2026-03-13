import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import { createFixedStepLoop } from "./core/loop";
import { PlayerController } from "./player/PlayerController";
import { createDebugRoom } from "./world/createDebugRoom";
import { createDebugOverlay, type DebugOverlayController } from "../ui/debugOverlay";

const PHASE_LABEL = "Phase 1 - Traversal Foundation";
const FIXED_STEP = 1 / 60;
const MAX_DELTA = 1 / 15;
const MAX_SUB_STEPS = 5;

export class GameApp {
  private readonly mount: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: RAPIER.World;
  private readonly overlay: DebugOverlayController;
  private readonly player: PlayerController;
  private readonly loop: ReturnType<typeof createFixedStepLoop>;

  private frameCount = 0;
  private fps = 0;
  private fpsAccumulator = 0;

  private constructor(
    mount: HTMLElement,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    world: RAPIER.World,
    overlay: DebugOverlayController,
    player: PlayerController
  ) {
    this.mount = mount;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.overlay = overlay;
    this.player = player;

    this.loop = createFixedStepLoop({
      fixedStep: FIXED_STEP,
      maxDelta: MAX_DELTA,
      maxSubSteps: MAX_SUB_STEPS,
      update: (deltaSeconds) => this.update(deltaSeconds),
      render: () => this.render()
    });

    this.handleResize = this.handleResize.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    this.handleResize();
  }

  static async create(mount: HTMLElement): Promise<GameApp> {
    await RAPIER.init();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a08);
    scene.fog = new THREE.Fog(0x0f0b08, 8, 22);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);

    const shell = document.createElement("div");
    shell.className = "game-shell";
    shell.append(renderer.domElement);
    mount.append(shell);

    const overlay = createDebugOverlay(shell);

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.integrationParameters.dt = FIXED_STEP;

    const room = createDebugRoom(scene, world, RAPIER);
    const player = new PlayerController({
      camera,
      domElement: renderer.domElement,
      world,
      rapier: RAPIER,
      spawnPosition: room.spawnPosition
    });

    overlay.setMetrics({
      fps: 0,
      phase: PHASE_LABEL,
      position: "0.00, 0.00, 0.00",
      grounded: "false",
      pointerLock: "unlocked",
      target: "none"
    });

    return new GameApp(mount, renderer, scene, camera, world, overlay, player);
  }

  start(): void {
    this.loop.start();
  }

  private update(deltaSeconds: number): void {
    this.player.update(deltaSeconds);
    this.world.step();

    this.frameCount += 1;
    this.fpsAccumulator += deltaSeconds;
    if (this.fpsAccumulator >= 0.25) {
      this.fps = this.frameCount / this.fpsAccumulator;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    const playerState = this.player.getDebugState();
    this.overlay.setMetrics({
      fps: this.fps,
      phase: PHASE_LABEL,
      position: `${playerState.position.x.toFixed(2)}, ${playerState.position.y.toFixed(2)}, ${playerState.position.z.toFixed(2)}`,
      grounded: playerState.grounded ? "true" : "false",
      pointerLock: playerState.pointerLocked ? "locked" : "unlocked",
      target: "none"
    });

    this.overlay.setHint(
      playerState.pointerLocked
        ? "Use WASD to move and Space to jump. Phase 1 is focused on feel and collision stability."
        : "Click the scene to capture the mouse. Use WASD to move and Space to jump."
    );
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize(): void {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.player.clearTransientInput();
    }
  }
}

