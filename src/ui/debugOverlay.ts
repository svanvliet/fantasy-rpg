export interface DebugOverlayMetrics {
  fps: number;
  phase: string;
  position: string;
  grounded: string;
  pointerLock: string;
  target: string;
}

export interface DebugOverlayController {
  setMetrics(metrics: DebugOverlayMetrics): void;
  setHint(message: string): void;
}

export function createDebugOverlay(parent: HTMLElement): DebugOverlayController {
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
    }
  };
}
