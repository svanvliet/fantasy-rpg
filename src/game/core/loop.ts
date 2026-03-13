export interface FixedStepResult {
  accumulator: number;
  steps: number;
}

export interface FixedStepOptions {
  fixedStep: number;
  maxDelta: number;
  maxSubSteps: number;
  update: (deltaSeconds: number) => void;
  render: (alpha: number) => void;
}

export function clampDeltaSeconds(deltaSeconds: number, maxDelta: number): number {
  if (deltaSeconds < 0) {
    return 0;
  }

  return Math.min(deltaSeconds, maxDelta);
}

export function consumeFixedSteps(
  accumulator: number,
  deltaSeconds: number,
  fixedStep: number,
  maxSubSteps: number
): FixedStepResult {
  let remaining = accumulator + deltaSeconds;
  let steps = 0;

  while (remaining >= fixedStep && steps < maxSubSteps) {
    remaining -= fixedStep;
    steps += 1;
  }

  if (steps === maxSubSteps && remaining > fixedStep) {
    remaining = fixedStep;
  }

  return {
    accumulator: remaining,
    steps
  };
}

export function createFixedStepLoop(options: FixedStepOptions) {
  const { fixedStep, maxDelta, maxSubSteps, update, render } = options;

  let accumulator = 0;
  let frameHandle = 0;
  let previousTime = 0;
  let running = false;

  const frame = (timeMs: number) => {
    if (!running) {
      return;
    }

    if (previousTime === 0) {
      previousTime = timeMs;
    }

    const deltaSeconds = clampDeltaSeconds((timeMs - previousTime) / 1000, maxDelta);
    previousTime = timeMs;

    const result = consumeFixedSteps(accumulator, deltaSeconds, fixedStep, maxSubSteps);
    accumulator = result.accumulator;

    for (let step = 0; step < result.steps; step += 1) {
      update(fixedStep);
    }

    render(accumulator / fixedStep);
    frameHandle = window.requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) {
        return;
      }

      running = true;
      previousTime = 0;
      accumulator = 0;
      frameHandle = window.requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      window.cancelAnimationFrame(frameHandle);
    }
  };
}

