import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import { createFixedStepLoop } from "./core/loop";
import { AlchemySystem } from "./alchemy/AlchemySystem";
import { ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE } from "./alchemy/prototypeRecipes";
import { InventoryStore } from "./inventory/InventoryStore";
import { CONTAINER_SEEDS, ITEM_DEFINITIONS } from "./inventory/prototypeContent";
import { InteractionSystem } from "./interactions/InteractionSystem";
import { SaveManager } from "./persistence/SaveManager";
import { PlayerController } from "./player/PlayerController";
import { ViewModelController } from "./viewmodel/ViewModelController";
import { createCastleBlockout } from "./world/createCastleBlockout";
import {
  createDebugOverlay,
  type DebugOverlayController,
  type GraphicsQuality
} from "../ui/debugOverlay";
import { createAlchemyPanel, type AlchemyPanelController } from "../ui/alchemyPanel";
import { createInventoryPanel, type InventoryPanelController } from "../ui/inventoryPanel";

const PHASE_LABEL = "Phase 9 - Alchemy Loop and Item-System Depth";
const FIXED_STEP = 1 / 60;
const MAX_DELTA = 1 / 15;
const MAX_SUB_STEPS = 5;
const PLAYER_AUTOSAVE_INTERVAL = 1.1;
const DIRTY_SAVE_DELAY = 0.35;
const DEFAULT_LIGHTING_LEVEL = 0.55;
const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = "balanced";
const DEBUG_REAGENT_RESTOCK = [
  { itemId: "bittermoss-extract", quantity: 2 },
  { itemId: "moonwater-vial", quantity: 2 },
  { itemId: "emberflower-oil", quantity: 2 },
  { itemId: "golden-resin-tonic", quantity: 2 }
] as const;

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
  private readonly alchemyPanel: AlchemyPanelController;
  private readonly inventoryStore: InventoryStore;
  private readonly player: PlayerController;
  private readonly interactionSystem: InteractionSystem;
  private readonly viewModelController: ViewModelController;
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
  private resettingProgress = false;

  private constructor(
    mount: HTMLElement,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    world: RAPIER.World,
    overlay: DebugOverlayController,
    inventoryPanel: InventoryPanelController,
    alchemyPanel: AlchemyPanelController,
    inventoryStore: InventoryStore,
    player: PlayerController,
    interactionSystem: InteractionSystem,
    viewModelController: ViewModelController,
    saveManager: SaveManager
  ) {
    this.mount = mount;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.overlay = overlay;
    this.inventoryPanel = inventoryPanel;
    this.alchemyPanel = alchemyPanel;
    this.inventoryStore = inventoryStore;
    this.player = player;
    this.interactionSystem = interactionSystem;
    this.viewModelController = viewModelController;
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
    renderer.autoClear = false;
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
      },
      onResetProgress: () => {
        app?.resetProgress();
      },
      onRestockReagents: () => {
        app?.restockReagents();
      }
    });
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const alchemySystem = new AlchemySystem(inventoryStore, ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE);
    const saveManager = new SaveManager(window.localStorage);
    let inventoryPanel!: InventoryPanelController;
    let alchemyPanel!: AlchemyPanelController;
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
    alchemyPanel = createAlchemyPanel(shell, {
      onClose: () => {
        interactionSystem.closeAlchemyPanel();
      },
      onCraft: (recipeId) => {
        const result = alchemySystem.craft(recipeId);
        if (result.success) {
          app?.queueSave();
        }
        return result;
      }
    });

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.integrationParameters.dt = FIXED_STEP;

    const room = createCastleBlockout(scene, world, RAPIER);
    const player = new PlayerController({
      camera,
      domElement: renderer.domElement,
      scene,
      world,
      rapier: RAPIER,
      spawnPosition: room.spawnPosition
    });
    const viewModelController = new ViewModelController();
    interactionSystem = new InteractionSystem({
      camera,
      domElement: renderer.domElement,
      scene,
      world,
      rapier: RAPIER,
      interactables: room.interactables,
      inventoryStore,
      inventoryPanel,
      alchemyPanel,
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
      alchemyPanel.sync(alchemySystem.getSnapshot());
      app?.queueSave();
    });
    inventoryPanel.sync(inventoryStore.getSnapshot());
    alchemyPanel.sync(alchemySystem.getSnapshot());

    overlay.setMetrics({
      camera: "first_person",
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
      alchemyPanel,
      inventoryStore,
      player,
      interactionSystem,
      viewModelController,
      saveManager
    );
    app.queueSave();
    return app;
  }

  start(): void {
    this.loop.start();
  }

  private update(deltaSeconds: number): void {
    if (this.inventoryPanel.isOpen() || this.alchemyPanel.isOpen()) {
      this.player.clearTransientInput();
    } else {
      this.player.update(deltaSeconds);
    }
    this.world.step();
    const playerState = this.player.getDebugState();
    this.interactionSystem.update(deltaSeconds, {
      cameraMode: playerState.cameraMode,
      playerPosition: playerState.position,
      playerYaw: playerState.yaw
    });

    this.frameCount += 1;
    this.fpsAccumulator += deltaSeconds;
    if (this.fpsAccumulator >= 0.25) {
      this.fps = this.frameCount / this.fpsAccumulator;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    const interactionState = this.interactionSystem.getDebugState();
    this.viewModelController.update(deltaSeconds, this.camera, {
      ...this.interactionSystem.getViewModelState(),
      cameraMode: playerState.cameraMode,
      pointerLocked: playerState.pointerLocked
    });
    this.overlay.setMetrics({
      camera: playerState.cameraMode === "firstPerson" ? "first_person" : "third_person",
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
        : this.alchemyPanel.isOpen()
          ? "Alchemy open. Brew using ingredients from your pack, then press Escape to close the station."
        : playerState.pointerLocked
          ? interactionState.prompt || "Use E to interact, F to hold, I to open inventory, Q to release a held item, and V to toggle camera."
          : "Click the scene to capture the mouse. Use WASD to move, Space to jump, I to open inventory, and V to toggle camera."
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
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.viewModelController.render(this.renderer);
  }

  private handleResize(): void {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    const qualitySettings = GRAPHICS_QUALITY_SETTINGS[this.graphicsQuality];

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.viewModelController.handleResize(this.camera);

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualitySettings.pixelRatioCap));
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.resettingProgress) {
        return;
      }
      this.player.clearTransientInput();
      this.persistState();
    }
  }

  private handleBeforeUnload(): void {
    if (this.resettingProgress) {
      return;
    }
    this.persistState();
  }

  private queueSave(): void {
    this.saveDirty = true;
    this.dirtySaveAccumulator = 0;
  }

  private persistState(): void {
    if (this.resettingProgress) {
      return;
    }
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

  private resetProgress(): void {
    this.resettingProgress = true;
    this.saveDirty = false;
    this.dirtySaveAccumulator = 0;
    this.autosaveAccumulator = 0;
    this.saveManager.clear();
    window.location.reload();
  }

  private restockReagents(): void {
    this.inventoryStore.addManyToPlayer([...DEBUG_REAGENT_RESTOCK]);
    if (this.alchemyPanel.isOpen()) {
      this.alchemyPanel.setStatus("Added fresh reagents to your pack.", "success");
    }
    this.queueSave();
  }
}
