export interface DebugOverlayMetrics {
  fps: number;
  phase: string;
  position: string;
  grounded: string;
  pointerLock: string;
  target: string;
}

export interface DebugOverlayOptions {
  initialLightingLevel?: number;
  onLightingLevelChange?: (value: number) => void;
}

export interface DebugOverlayController {
  setMetrics(metrics: DebugOverlayMetrics): void;
  setHint(message: string): void;
  setLightingLevel(value: number): void;
}

export function createDebugOverlay(
  parent: HTMLElement,
  options: DebugOverlayOptions = {}
): DebugOverlayController {
  const overlay = document.createElement("aside");
  overlay.className = "debug-overlay";
  overlay.innerHTML = `
    <h1>Prototype Status</h1>
    <dl>
      <dt>Phase</dt><dd data-key="phase"></dd>
      <dt>FPS</dt><dd data-key="fps"></dd>
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
  const initialLightingLevel = options.initialLightingLevel ?? 0.25;
  lightingSlider.value = initialLightingLevel.toFixed(2);
  fields.get("lightingLevel")!.textContent = initialLightingLevel.toFixed(2);
  overlay.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  overlay.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  lightingSlider.addEventListener("input", () => {
    const nextValue = Number(lightingSlider.value);
    fields.get("lightingLevel")!.textContent = nextValue.toFixed(2);
    options.onLightingLevelChange?.(nextValue);
  });

  return {
    setMetrics(metrics) {
      fields.get("phase")!.textContent = metrics.phase;
      fields.get("fps")!.textContent = metrics.fps.toFixed(1);
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
    }
  };
}
