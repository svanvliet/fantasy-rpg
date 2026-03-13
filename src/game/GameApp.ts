import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import { createFixedStepLoop } from "./core/loop";
import { InventoryStore } from "./inventory/InventoryStore";
import { CONTAINER_SEEDS, ITEM_DEFINITIONS } from "./inventory/prototypeContent";
import { InteractionSystem } from "./interactions/InteractionSystem";
import { SaveManager } from "./persistence/SaveManager";
import { PlayerController } from "./player/PlayerController";
import { createCastleBlockout } from "./world/createCastleBlockout";
import {
  createDebugOverlay,
  type DebugOverlayController,
  type GraphicsQuality
} from "../ui/debugOverlay";
import { createInventoryPanel, type InventoryPanelController } from "../ui/inventoryPanel";

const PHASE_LABEL = "Phase 6 - Feel and Prototype Polish";
const FIXED_STEP = 1 / 60;
const MAX_DELTA = 1 / 15;
const MAX_SUB_STEPS = 5;
const PLAYER_AUTOSAVE_INTERVAL = 1.1;
const DIRTY_SAVE_DELAY = 0.35;
const DEFAULT_LIGHTING_LEVEL = 0.55;
const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = "balanced";

const GRAPHICS_QUALITY_SETTINGS: Record<
  GraphicsQuality,
  { pixelRatioCap: number; shadowsEnabled: boolean; shadowType?: THREE.ShadowMapType }
> = {
  performance: {
    pixelRatioCap: 1,
    shadowsEnabled: false
  },
  balanced: {
    pixelRatioCap: 1.25,
    shadowsEnabled: false
  },
  quality: {
    pixelRatioCap: 1.5,
    shadowsEnabled: true,
    shadowType: THREE.PCFSoftShadowMap
  }
};

export class GameApp {
  private readonly mount: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: RAPIER.World;
  private readonly overlay: DebugOverlayController;
  private readonly inventoryPanel: InventoryPanelController;
  private readonly inventoryStore: InventoryStore;
  private readonly player: PlayerController;
  private readonly interactionSystem: InteractionSystem;
  private readonly saveManager: SaveManager;
  private readonly loop: ReturnType<typeof createFixedStepLoop>;
  private readonly sceneLights: Array<{ light: THREE.Light; baseIntensity: number }> = [];

  private frameCount = 0;
  private fps = 0;
  private fpsAccumulator = 0;
  private saveDirty = false;
  private dirtySaveAccumulator = 0;
  private autosaveAccumulator = 0;
  private lightingLevel = DEFAULT_LIGHTING_LEVEL;
  private graphicsQuality = DEFAULT_GRAPHICS_QUALITY;

  private constructor(
    mount: HTMLElement,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    world: RAPIER.World,
    overlay: DebugOverlayController,
    inventoryPanel: InventoryPanelController,
    inventoryStore: InventoryStore,
    player: PlayerController,
    interactionSystem: InteractionSystem,
    saveManager: SaveManager
  ) {
    this.mount = mount;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.overlay = overlay;
    this.inventoryPanel = inventoryPanel;
    this.inventoryStore = inventoryStore;
    this.player = player;
    this.interactionSystem = interactionSystem;
    this.saveManager = saveManager;

    this.loop = createFixedStepLoop({
      fixedStep: FIXED_STEP,
      maxDelta: MAX_DELTA,
      maxSubSteps: MAX_SUB_STEPS,
      update: (deltaSeconds) => this.update(deltaSeconds),
      render: () => this.render()
    });

    this.handleResize = this.handleResize.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);

    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("beforeunload", this.handleBeforeUnload);

    this.setGraphicsQuality(DEFAULT_GRAPHICS_QUALITY);
    this.handleResize();
    this.captureDirectLightState();
    this.setLightingLevel(DEFAULT_LIGHTING_LEVEL);
  }

  static async create(mount: HTMLElement): Promise<GameApp> {
    await RAPIER.init();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "low-power"
    });
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090807);
    scene.fog = new THREE.Fog(0x0d0a08, 9, 32);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 100);

    const shell = document.createElement("div");
    shell.className = "game-shell";
    shell.append(renderer.domElement);
    mount.append(shell);

    let app: GameApp | null = null;
    const overlay = createDebugOverlay(shell, {
      initialLightingLevel: DEFAULT_LIGHTING_LEVEL,
      initialGraphicsQuality: DEFAULT_GRAPHICS_QUALITY,
      onLightingLevelChange: (value) => {
        app?.setLightingLevel(value);
      },
      onGraphicsQualityChange: (value) => {
        app?.setGraphicsQuality(value);
      }
    });
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const saveManager = new SaveManager(window.localStorage);
    let inventoryPanel!: InventoryPanelController;
    let interactionSystem!: InteractionSystem;
    CONTAINER_SEEDS.forEach((container) => {
      inventoryStore.registerContainer(container.id, container.title, container.items);
    });
    inventoryPanel = createInventoryPanel(shell, {
      onClose: () => {
        interactionSystem.closeInventoryPanel();
      },
      onDropPlayerItem: (itemId) => {
        interactionSystem.dropInventoryItem(itemId);
      },
      onTransferPlayerToContainer: (containerId, itemId, quantity) => {
        inventoryStore.transferPlayerToContainer(containerId, itemId, quantity);
      },
      onTransferContainerToPlayer: (containerId, itemId, quantity) => {
        inventoryStore.transferContainerToPlayer(containerId, itemId, quantity);
      }
    });

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.integrationParameters.dt = FIXED_STEP;

    const room = createCastleBlockout(scene, world, RAPIER);
    const player = new PlayerController({
      camera,
      domElement: renderer.domElement,
      world,
      rapier: RAPIER,
      spawnPosition: room.spawnPosition
    });
    interactionSystem = new InteractionSystem({
      camera,
      domElement: renderer.domElement,
      scene,
      world,
      rapier: RAPIER,
      interactables: room.interactables,
      inventoryStore,
      inventoryPanel,
      onStateDirty: () => {
        app?.queueSave();
      }
    });
    const savedState = saveManager.load();
    if (savedState?.inventory) {
      inventoryStore.restore(savedState.inventory);
    }
    if (savedState?.interaction) {
      interactionSystem.restorePersistenceState(savedState.interaction);
    }
    if (savedState?.player) {
      player.restorePersistenceState(savedState.player);
    }
    inventoryStore.subscribe(() => {
      inventoryPanel.sync(inventoryStore.getSnapshot());
      app?.queueSave();
    });
    inventoryPanel.sync(inventoryStore.getSnapshot());

    overlay.setMetrics({
      fps: 0,
      phase: PHASE_LABEL,
      position: "0.00, 0.00, 0.00",
      grounded: "false",
      pointerLock: "unlocked",
      target: "none"
    });

    app = new GameApp(
      mount,
      renderer,
      scene,
      camera,
      world,
      overlay,
      inventoryPanel,
      inventoryStore,
      player,
      interactionSystem,
      saveManager
    );
    app.queueSave();
    return app;
  }

  start(): void {
    this.loop.start();
  }

  private update(deltaSeconds: number): void {
    if (this.inventoryPanel.isOpen()) {
      this.player.clearTransientInput();
    } else {
      this.player.update(deltaSeconds);
    }
    this.world.step();
    this.interactionSystem.update(deltaSeconds);

    this.frameCount += 1;
    this.fpsAccumulator += deltaSeconds;
    if (this.fpsAccumulator >= 0.25) {
      this.fps = this.frameCount / this.fpsAccumulator;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    const playerState = this.player.getDebugState();
    const interactionState = this.interactionSystem.getDebugState();
    this.overlay.setMetrics({
      fps: this.fps,
      phase: PHASE_LABEL,
      position: `${playerState.position.x.toFixed(2)}, ${playerState.position.y.toFixed(2)}, ${playerState.position.z.toFixed(2)}`,
      grounded: playerState.grounded ? "true" : "false",
      pointerLock: playerState.pointerLocked ? "locked" : "unlocked",
      target: interactionState.targetLabel
    });

    this.overlay.setHint(
      this.inventoryPanel.isOpen()
        ? "Inventory open. Move items with the panel, press I or Escape to close, and use Drop 1 to place items back into the world."
        : playerState.pointerLocked
          ? interactionState.prompt || "Use E to interact, F to hold, I to open inventory, and Q to release a held item."
          : "Click the scene to capture the mouse. Use WASD to move, Space to jump, and I to open inventory."
    );

    this.dirtySaveAccumulator += deltaSeconds;
    this.autosaveAccumulator += deltaSeconds;
    if (this.saveDirty && this.dirtySaveAccumulator >= DIRTY_SAVE_DELAY) {
      this.persistState();
    } else if (this.autosaveAccumulator >= PLAYER_AUTOSAVE_INTERVAL) {
      this.persistState();
    }
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize(): void {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    const qualitySettings = GRAPHICS_QUALITY_SETTINGS[this.graphicsQuality];

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualitySettings.pixelRatioCap));
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.player.clearTransientInput();
      this.persistState();
    }
  }

  private handleBeforeUnload(): void {
    this.persistState();
  }

  private queueSave(): void {
    this.saveDirty = true;
    this.dirtySaveAccumulator = 0;
  }

  private persistState(): void {
    this.saveManager.save({
      version: 1,
      savedAt: new Date().toISOString(),
      player: this.player.getPersistenceState(),
      inventory: this.inventoryStore.getSaveState(),
      interaction: this.interactionSystem.getPersistenceState()
    });
    this.saveDirty = false;
    this.dirtySaveAccumulator = 0;
    this.autosaveAccumulator = 0;
  }

  private captureDirectLightState(): void {
    this.sceneLights.length = 0;
    this.scene.traverse((object) => {
      if (!(object as THREE.Light).isLight) {
        return;
      }

      const light = object as THREE.Light;
      this.sceneLights.push({
        light,
        baseIntensity: light.intensity
      });
    });
  }

  private setGraphicsQuality(value: GraphicsQuality): void {
    this.graphicsQuality = value;
    const qualitySettings = GRAPHICS_QUALITY_SETTINGS[value];
    this.renderer.shadowMap.enabled = qualitySettings.shadowsEnabled;
    if (qualitySettings.shadowType) {
      this.renderer.shadowMap.type = qualitySettings.shadowType;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.handleResize();
    this.overlay.setGraphicsQuality(value);
  }

  private setLightingLevel(value: number): void {
    this.lightingLevel = value;
    this.sceneLights.forEach(({ light, baseIntensity }) => {
      light.intensity = baseIntensity * value;
    });
    this.overlay.setLightingLevel(value);
  }
}
