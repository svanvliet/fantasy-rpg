export interface DebugOverlayMetrics {
  camera: string;
  fps: number;
  phase: string;
  position: string;
  grounded: string;
  pointerLock: string;
  target: string;
  renderScale: string;
  drawCalls: string;
  triangles: string;
  geometries: string;
  textures: string;
}

export interface DebugOverlayOptions {
  initialLightingLevel?: number;
  initialGraphicsQuality?: GraphicsQuality;
  onLightingLevelChange?: (value: number) => void;
  onGraphicsQualityChange?: (value: GraphicsQuality) => void;
  onResetProgress?: () => void;
  onRestockReagents?: () => void;
}

export interface DebugOverlayController {
  setMetrics(metrics: DebugOverlayMetrics): void;
  setHint(message: string): void;
  setLightingLevel(value: number): void;
  setGraphicsQuality(value: GraphicsQuality): void;
}

export type GraphicsQuality = "performance" | "balanced" | "quality";

export function createDebugOverlay(
  parent: HTMLElement,
  options: DebugOverlayOptions = {}
): DebugOverlayController {
  const overlay = document.createElement("aside");
  overlay.className = "debug-overlay";
  overlay.innerHTML = `
    <div class="debug-header">
      <h1>Prototype Status</h1>
      <button type="button" class="debug-collapse" aria-expanded="true" aria-label="Collapse debug overlay">Collapse</button>
    </div>
    <div class="debug-summary">
      <div class="debug-summary-row debug-summary-row--phase">
        <span data-key="phase"></span>
      </div>
      <div class="debug-summary-row debug-summary-row--meta">
        <span data-key="camera"></span>
        <span><strong>FPS</strong> <span data-key="fps"></span></span>
      </div>
    </div>
    <div class="debug-body">
      <dl>
        <dt>Scale</dt><dd data-key="renderScale"></dd>
        <dt>Calls</dt><dd data-key="drawCalls"></dd>
        <dt>Tris</dt><dd data-key="triangles"></dd>
        <dt>Geoms</dt><dd data-key="geometries"></dd>
        <dt>Tex</dt><dd data-key="textures"></dd>
        <dt>Position</dt><dd data-key="position"></dd>
        <dt>Grounded</dt><dd data-key="grounded"></dd>
        <dt>Pointer Lock</dt><dd data-key="pointerLock"></dd>
        <dt>Target</dt><dd data-key="target"></dd>
      </dl>
      <div class="debug-control">
        <label for="lighting-level">Lighting</label>
        <input id="lighting-level" type="range" min="0.05" max="1.15" step="0.01" />
        <span data-key="lightingLevel"></span>
      </div>
      <div class="debug-control">
        <label for="graphics-quality">Graphics</label>
        <select id="graphics-quality">
          <option value="performance">Performance</option>
          <option value="balanced">Balanced</option>
          <option value="quality">Quality</option>
        </select>
        <span data-key="graphicsQuality"></span>
      </div>
      <div class="debug-actions">
        <button type="button" data-action="restock">Add Reagents</button>
        <button type="button" data-action="reset">Reset Progress</button>
      </div>
    </div>
  `;

  const reticle = document.createElement("div");
  reticle.className = "reticle";

  const hint = document.createElement("div");
  hint.className = "lock-hint";
  hint.textContent = "Click the scene to capture the mouse. Use WASD to move and Space to jump.";

  parent.append(overlay, reticle, hint);

  const fields = new Map<string, HTMLElement>();
  overlay.querySelectorAll<HTMLElement>("[data-key]").forEach((element) => {
    const key = element.dataset.key;
    if (key) {
      fields.set(key, element);
    }
  });

  const lightingSlider = overlay.querySelector<HTMLInputElement>("#lighting-level")!;
  const graphicsQualitySelect = overlay.querySelector<HTMLSelectElement>("#graphics-quality")!;
  const collapseButton = overlay.querySelector<HTMLButtonElement>(".debug-collapse")!;
  const body = overlay.querySelector<HTMLElement>(".debug-body")!;
  const initialLightingLevel = options.initialLightingLevel ?? 0.25;
  const initialGraphicsQuality = options.initialGraphicsQuality ?? "balanced";
  lightingSlider.value = initialLightingLevel.toFixed(2);
  fields.get("lightingLevel")!.textContent = initialLightingLevel.toFixed(2);
  graphicsQualitySelect.value = initialGraphicsQuality;
  fields.get("graphicsQuality")!.textContent = initialGraphicsQuality;
  overlay.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="restock"]')?.addEventListener("click", () => {
    options.onRestockReagents?.();
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener("click", () => {
    options.onResetProgress?.();
  });
  collapseButton.addEventListener("click", () => {
    const collapsed = overlay.classList.toggle("is-collapsed");
    body.hidden = collapsed;
    collapseButton.textContent = collapsed ? "Expand" : "Collapse";
    collapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
    collapseButton.setAttribute(
      "aria-label",
      collapsed ? "Expand debug overlay" : "Collapse debug overlay"
    );
  });
  lightingSlider.addEventListener("input", () => {
    const nextValue = Number(lightingSlider.value);
    fields.get("lightingLevel")!.textContent = nextValue.toFixed(2);
    options.onLightingLevelChange?.(nextValue);
  });
  graphicsQualitySelect.addEventListener("change", () => {
    const nextValue = graphicsQualitySelect.value as GraphicsQuality;
    fields.get("graphicsQuality")!.textContent = nextValue;
    options.onGraphicsQualityChange?.(nextValue);
  });

  return {
    setMetrics(metrics) {
      fields.get("phase")!.textContent = metrics.phase;
      fields.get("camera")!.textContent = metrics.camera;
      fields.get("fps")!.textContent = metrics.fps.toFixed(1);
      fields.get("renderScale")!.textContent = metrics.renderScale;
      fields.get("drawCalls")!.textContent = metrics.drawCalls;
      fields.get("triangles")!.textContent = metrics.triangles;
      fields.get("geometries")!.textContent = metrics.geometries;
      fields.get("textures")!.textContent = metrics.textures;
      fields.get("position")!.textContent = metrics.position;
      fields.get("grounded")!.textContent = metrics.grounded;
      fields.get("pointerLock")!.textContent = metrics.pointerLock;
      fields.get("target")!.textContent = metrics.target;
    },
    setHint(message) {
      hint.textContent = message;
    },
    setLightingLevel(value) {
      lightingSlider.value = value.toFixed(2);
      fields.get("lightingLevel")!.textContent = value.toFixed(2);
    },
    setGraphicsQuality(value) {
      graphicsQualitySelect.value = value;
      fields.get("graphicsQuality")!.textContent = value;
    }
  };
}
