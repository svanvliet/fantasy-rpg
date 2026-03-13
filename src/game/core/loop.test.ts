import { describe, expect, it } from "vitest";

import { clampDeltaSeconds, consumeFixedSteps } from "./loop";

describe("clampDeltaSeconds", () => {
  it("clamps negative values to zero", () => {
    expect(clampDeltaSeconds(-0.2, 0.05)).toBe(0);
  });

  it("limits large deltas to the configured max", () => {
    expect(clampDeltaSeconds(0.2, 0.05)).toBe(0.05);
  });
});

describe("consumeFixedSteps", () => {
  it("returns the expected number of fixed steps and remainder", () => {
    const result = consumeFixedSteps(0, 0.05, 1 / 60, 5);

    expect(result.steps).toBe(3);
    expect(result.accumulator).toBeGreaterThan(0);
    expect(result.accumulator).toBeLessThan(1 / 60);
  });

  it("caps the number of substeps and preserves a bounded remainder", () => {
    const result = consumeFixedSteps(0, 0.5, 1 / 60, 4);

    expect(result.steps).toBe(4);
    expect(result.accumulator).toBeLessThanOrEqual(1 / 60);
  });
});
