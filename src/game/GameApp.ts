import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import { AssetCatalog } from "./assets/AssetCatalog";
import {
  PROTOTYPE_ASSET_SWAPS,
  type PrototypeAssetSwapSpec
} from "./assets/prototypeAssetSwaps";
import { createFixedStepLoop } from "./core/loop";
import { AlchemySystem } from "./alchemy/AlchemySystem";
import { ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE } from "./alchemy/prototypeRecipes";
import { InventoryStore } from "./inventory/InventoryStore";
import { CONTAINER_SEEDS, ITEM_DEFINITIONS } from "./inventory/prototypeContent";
import { InteractionSystem } from "./interactions/InteractionSystem";
import { ObjectiveSystem } from "./objectives/ObjectiveSystem";
import { STEWARD_OBJECTIVES } from "./objectives/prototypeObjectives";
import { SaveManager, type GameSaveState } from "./persistence/SaveManager";
import { createCloudSave, type SaveSyncCoordinator } from "./persistence/cloud";
import { PlayerController } from "./player/PlayerController";
import { ViewModelController } from "./viewmodel/ViewModelController";
import {
  createCastleBlockout,
  type AssetSwapAnchor
} from "./world/createCastleBlockout";
import {
  createDebugOverlay,
  type DebugOverlayController,
  type GraphicsQuality
} from "../ui/debugOverlay";
import { createAlchemyPanel, type AlchemyPanelController } from "../ui/alchemyPanel";
import { createDialoguePanel, type DialoguePanelController } from "../ui/dialoguePanel";
import { createInventoryPanel, type InventoryPanelController } from "../ui/inventoryPanel";
import { createObjectiveTracker, type ObjectiveTrackerController } from "../ui/objectiveTracker";

const PHASE_LABEL = "Phase 13 - Item Use Effects and Inventory Pressure";
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
const IMPORTED_ITEM_VISUALS = [
  {
    itemId: "verdant-restorative",
    path: "/assets/models/elixir-bottle.glb",
    uniformScale: 2,
    positionOffset: new THREE.Vector3(0, -0.22, 0),
    rotationYRadians: 0
  },
  {
    itemId: "moonveil-tonic",
    path: "/assets/models/tincture-bottle.glb",
    uniformScale: 2,
    positionOffset: new THREE.Vector3(0, -0.22, 0),
    rotationYRadians: 0
  },
  {
    itemId: "emberguard-draught",
    path: "/assets/models/draught-bottle.glb",
    uniformScale: 2,
    positionOffset: new THREE.Vector3(0, -0.22, 0),
    rotationYRadians: 0
  }
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
  private readonly assetCatalog: AssetCatalog;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: RAPIER.World;
  private readonly overlay: DebugOverlayController;
  private readonly inventoryPanel: InventoryPanelController;
  private readonly alchemyPanel: AlchemyPanelController;
  private readonly dialoguePanel: DialoguePanelController;
  private readonly objectiveTracker: ObjectiveTrackerController;
  private readonly inventoryStore: InventoryStore;
  private readonly objectiveSystem: ObjectiveSystem;
  private readonly player: PlayerController;
  private readonly interactionSystem: InteractionSystem;
  private readonly viewModelController: ViewModelController;
  private readonly saveManager: SaveManager;
  private readonly cloudCoordinator: SaveSyncCoordinator<GameSaveState>;
  private readonly loop: ReturnType<typeof createFixedStepLoop>;
  private readonly sceneLights: Array<{ light: THREE.Light; baseIntensity: number }> = [];

  private renderFrameCount = 0;
  private fps = 0;
  private fpsAccumulatorSeconds = 0;
  private lastRenderTimeMs = 0;
  private saveDirty = false;
  private dirtySaveAccumulator = 0;
  private autosaveAccumulator = 0;
  private lightingLevel = DEFAULT_LIGHTING_LEVEL;
  private graphicsQuality = DEFAULT_GRAPHICS_QUALITY;
  private resettingProgress = false;

  private constructor(
    mount: HTMLElement,
    renderer: THREE.WebGLRenderer,
    assetCatalog: AssetCatalog,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    world: RAPIER.World,
    overlay: DebugOverlayController,
    inventoryPanel: InventoryPanelController,
    alchemyPanel: AlchemyPanelController,
    dialoguePanel: DialoguePanelController,
    objectiveTracker: ObjectiveTrackerController,
    inventoryStore: InventoryStore,
    objectiveSystem: ObjectiveSystem,
    player: PlayerController,
    interactionSystem: InteractionSystem,
    viewModelController: ViewModelController,
    saveManager: SaveManager,
    cloudCoordinator: SaveSyncCoordinator<GameSaveState>
  ) {
    this.mount = mount;
    this.renderer = renderer;
    this.assetCatalog = assetCatalog;
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.overlay = overlay;
    this.inventoryPanel = inventoryPanel;
    this.alchemyPanel = alchemyPanel;
    this.dialoguePanel = dialoguePanel;
    this.objectiveTracker = objectiveTracker;
    this.inventoryStore = inventoryStore;
    this.objectiveSystem = objectiveSystem;
    this.player = player;
    this.interactionSystem = interactionSystem;
    this.viewModelController = viewModelController;
    this.saveManager = saveManager;
    this.cloudCoordinator = cloudCoordinator;

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
    renderer.info.autoReset = false;
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
      },
      onCloudSyncNow: () => {
        void app?.syncCloudNow();
      }
    });
    const inventoryStore = new InventoryStore(ITEM_DEFINITIONS);
    const alchemySystem = new AlchemySystem(inventoryStore, ALCHEMY_RECIPES, ALCHEMY_STATION_TITLE);
    const objectiveSystem = new ObjectiveSystem(inventoryStore, STEWARD_OBJECTIVES);
    const saveManager = new SaveManager(window.localStorage);
    const cloudSave = createCloudSave(window.localStorage);
    let inventoryPanel!: InventoryPanelController;
    let alchemyPanel!: AlchemyPanelController;
    let dialoguePanel!: DialoguePanelController;
    const objectiveTracker = createObjectiveTracker(shell);
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
    dialoguePanel = createDialoguePanel(shell, {
      onClose: () => {
        interactionSystem.closeDialoguePanel();
      },
      onAction: (actionId) => {
        const result = objectiveSystem.performAction(actionId);
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
    await viewModelController.loadPlaceholderHands(assetCatalog);
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
      dialoguePanel,
      onStateDirty: () => {
        app?.queueSave();
      }
    });
    await Promise.all(
      IMPORTED_ITEM_VISUALS.map(async (visual) => {
        const model = await assetCatalog.loadOptionalScene(visual.path);
        if (!model) {
          return;
        }

        interactionSystem.registerImportedItemVisual(visual.itemId, model, {
          uniformScale: visual.uniformScale,
          positionOffset: visual.positionOffset,
          rotationYRadians: visual.rotationYRadians
        });
      })
    );
    const localState = saveManager.load();
    const resolved = await cloudSave.coordinator.resolveInitialState(localState);
    const savedState = resolved.state;
    if (resolved.source === "cloud") {
      console.info("Cloud save was newer than local; restoring from cloud.");
    }
    if (savedState?.inventory) {
      inventoryStore.restore(savedState.inventory);
    }
    if (savedState?.interaction) {
      interactionSystem.restorePersistenceState(savedState.interaction);
    }
    if (savedState?.player) {
      player.restorePersistenceState(savedState.player);
    }
    if (savedState?.objective) {
      objectiveSystem.restore(savedState.objective);
    }
    inventoryStore.subscribe(() => {
      inventoryPanel.sync(inventoryStore.getSnapshot());
      alchemyPanel.sync(alchemySystem.getSnapshot());
      dialoguePanel.sync(objectiveSystem.getDialogueSnapshot());
      objectiveTracker.sync(objectiveSystem.getTrackerSnapshot());
      app?.queueSave();
    });
    objectiveSystem.subscribe(() => {
      dialoguePanel.sync(objectiveSystem.getDialogueSnapshot());
      objectiveTracker.sync(objectiveSystem.getTrackerSnapshot());
      app?.queueSave();
    });
    inventoryPanel.sync(inventoryStore.getSnapshot());
    alchemyPanel.sync(alchemySystem.getSnapshot());
    dialoguePanel.sync(objectiveSystem.getDialogueSnapshot());
    objectiveTracker.sync(objectiveSystem.getTrackerSnapshot());

    overlay.setMetrics({
      camera: "first_person",
      fps: 0,
      renderScale: "1.00x",
      drawCalls: "0",
      triangles: "0",
      geometries: "0",
      textures: "0",
      phase: PHASE_LABEL,
      position: "0.00, 0.00, 0.00",
      grounded: "false",
      pointerLock: "unlocked",
      target: "none"
    });

    app = new GameApp(
      mount,
      renderer,
      assetCatalog,
      scene,
      camera,
      world,
      overlay,
      inventoryPanel,
      alchemyPanel,
      dialoguePanel,
      objectiveTracker,
      inventoryStore,
      objectiveSystem,
      player,
      interactionSystem,
      viewModelController,
      saveManager,
      cloudSave.coordinator
    );
    cloudSave.coordinator.subscribe((snapshot) => {
      overlay.setCloudSaveStatus(snapshot);
    });
    await app.applyOptionalAssetSwaps(room.assetSwapAnchors);
    app.queueSave();
    return app;
  }

  start(): void {
    this.loop.start();
  }

  private update(deltaSeconds: number): void {
    if (this.inventoryPanel.isOpen() || this.alchemyPanel.isOpen() || this.dialoguePanel.isOpen()) {
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

    const interactionState = this.interactionSystem.getDebugState();
    this.viewModelController.update(deltaSeconds, this.camera, {
      ...this.interactionSystem.getViewModelState(),
      cameraMode: playerState.cameraMode,
      pointerLocked: playerState.pointerLocked
    });
    this.overlay.setMetrics({
      camera: playerState.cameraMode === "firstPerson" ? "first_person" : "third_person",
      fps: this.fps,
      renderScale: `${this.renderer.getPixelRatio().toFixed(2)}x`,
      drawCalls: this.formatMetric(this.renderer.info.render.calls),
      triangles: this.formatMetric(this.renderer.info.render.triangles),
      geometries: this.formatMetric(this.renderer.info.memory.geometries),
      textures: this.formatMetric(this.renderer.info.memory.textures),
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
          : this.dialoguePanel.isOpen()
            ? "Dialogue open. Accept, track, or turn in steward tasks, then press Escape to close the panel."
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
    const nowMs = performance.now();
    if (this.lastRenderTimeMs > 0) {
      const deltaSeconds = (nowMs - this.lastRenderTimeMs) / 1000;
      this.renderFrameCount += 1;
      this.fpsAccumulatorSeconds += deltaSeconds;
      if (this.fpsAccumulatorSeconds >= 0.25) {
        this.fps = this.renderFrameCount / this.fpsAccumulatorSeconds;
        this.renderFrameCount = 0;
        this.fpsAccumulatorSeconds = 0;
      }
    }
    this.lastRenderTimeMs = nowMs;

    this.renderer.info.reset();
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
      void this.cloudCoordinator.flush();
    }
  }

  private handleBeforeUnload(): void {
    if (this.resettingProgress) {
      return;
    }
    this.persistState();
    void this.cloudCoordinator.flush();
  }

  private queueSave(): void {
    this.saveDirty = true;
    this.dirtySaveAccumulator = 0;
  }

  private persistState(): void {
    if (this.resettingProgress) {
      return;
    }
    const state: GameSaveState = {
      version: 1,
      savedAt: new Date().toISOString(),
      player: this.player.getPersistenceState(),
      inventory: this.inventoryStore.getSaveState(),
      interaction: this.interactionSystem.getPersistenceState(),
      objective: this.objectiveSystem.getSaveState()
    };
    this.saveManager.save(state);
    this.cloudCoordinator.notifySaved(state);
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
    // Clear the cloud copy first so a stale cloud save can't win reconciliation
    // on reload; reload regardless of the cloud result so reset stays reliable.
    void this.cloudCoordinator
      .clearCloud()
      .catch((error: unknown) => {
        console.warn("Failed to clear cloud save during reset.", error);
      })
      .finally(() => {
        window.location.reload();
      });
  }

  private async syncCloudNow(): Promise<void> {
    this.persistState();
    await this.cloudCoordinator.syncNow();
  }

  private restockReagents(): void {
    this.inventoryStore.addManyToPlayer([...DEBUG_REAGENT_RESTOCK]);
    if (this.alchemyPanel.isOpen()) {
      this.alchemyPanel.setStatus("Added fresh reagents to your pack.", "success");
    }
    this.queueSave();
  }

  private formatMetric(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return `${value}`;
  }

  private async applyOptionalAssetSwaps(anchors: AssetSwapAnchor[]): Promise<void> {
    const specsById = new Map<string, PrototypeAssetSwapSpec>(
      Object.values(PROTOTYPE_ASSET_SWAPS).map((spec) => [spec.id, spec])
    );

    await Promise.all(
      anchors.map(async (anchor) => {
        const spec = specsById.get(anchor.id);
        if (!spec) {
          return;
        }

        const model = await this.assetCatalog.loadOptionalScene(spec.path);
        if (!model) {
          return;
        }

        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) {
            return;
          }
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });

        if (spec.uniformScale !== undefined) {
          model.scale.setScalar(spec.uniformScale);
        }
        if (spec.scale) {
          model.scale.set(...spec.scale);
        }

        if (spec.positionOffset) {
          model.position.set(...spec.positionOffset);
        }

        if (spec.rotationYDegrees) {
          model.rotation.y = THREE.MathUtils.degToRad(spec.rotationYDegrees);
        }

        anchor.mount.add(model);
        anchor.hiddenFallbackObjects.forEach((object) => {
          this.disableHiddenFallbackObject(object);
        });
        anchor.ghostFallbackObjects.forEach((object) => {
          this.ghostStaticFallbackObject(object);
        });
      })
    );
  }

  private disableHiddenFallbackObject(object: THREE.Object3D): void {
    object.userData.assetSwapDisabled = true;
    object.visible = false;
  }

  private ghostStaticFallbackObject(object: THREE.Object3D): void {
    object.userData.assetSwapDisabled = false;
    object.visible = true;
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((entry) => this.createGhostMaterial(entry));
      } else {
        mesh.material = this.createGhostMaterial(mesh.material);
      }
    });
  }

  private createGhostMaterial(material: THREE.Material): THREE.Material {
    const cloned = material.clone();
    if (!(cloned instanceof THREE.MeshStandardMaterial)) {
      return cloned;
    }

    cloned.transparent = true;
    cloned.opacity = 0;
    cloned.depthWrite = false;
    cloned.colorWrite = false;
    cloned.emissiveIntensity = 0;
    return cloned;
  }
}
    const assetCatalog = new AssetCatalog();
