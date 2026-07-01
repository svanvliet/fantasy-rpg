import { describe, expect, it, vi } from "vitest";

import { SaveSyncCoordinator } from "./SaveSyncCoordinator";
import type { CloudSaveEnvelope, CloudSaveProvider } from "./types";

interface TestState {
  savedAt: string;
  value: string;
}

function stateOptions() {
  return {
    serialize: (state: TestState) => JSON.stringify(state),
    deserialize: (serialized: string): TestState | null => {
      try {
        return JSON.parse(serialized) as TestState;
      } catch {
        return null;
      }
    },
    getSavedAt: (state: TestState) => state.savedAt
  };
}

class FakeProvider implements CloudSaveProvider {
  pushes: CloudSaveEnvelope[] = [];
  clears = 0;
  private cloud: CloudSaveEnvelope | null;
  private readonly configured: boolean;
  failNextPush = false;

  constructor(cloud: CloudSaveEnvelope | null = null, configured = true) {
    this.cloud = cloud;
    this.configured = configured;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async pull(): Promise<CloudSaveEnvelope | null> {
    return this.cloud;
  }

  async push(envelope: CloudSaveEnvelope): Promise<void> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error("boom");
    }
    this.pushes.push(envelope);
    this.cloud = envelope;
  }

  async clear(): Promise<void> {
    this.clears += 1;
    this.cloud = null;
  }
}

/** Injectable scheduler that records callbacks so tests can fire them on demand. */
class ManualScheduler {
  private nextId = 0;
  private readonly callbacks = new Map<number, () => void>();

  schedule = (callback: () => void): ReturnType<typeof setTimeout> => {
    const id = ++this.nextId;
    this.callbacks.set(id, callback);
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  cancel = (handle: ReturnType<typeof setTimeout>): void => {
    this.callbacks.delete(handle as unknown as number);
  };

  runPending(): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    pending.forEach((callback) => callback());
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeCoordinator(provider: CloudSaveProvider, scheduler = new ManualScheduler()) {
  const coordinator = new SaveSyncCoordinator<TestState>({
    provider,
    ...stateOptions(),
    now: () => Date.parse("2026-07-01T00:00:00.000Z"),
    schedule: scheduler.schedule,
    cancel: scheduler.cancel
  });
  return { coordinator, scheduler };
}

describe("SaveSyncCoordinator.resolveInitialState", () => {
  it("reports disabled and returns local when the provider is unconfigured", async () => {
    const provider = new FakeProvider(null, false);
    const { coordinator } = makeCoordinator(provider);
    const local: TestState = { savedAt: "2026-07-01T00:00:00.000Z", value: "local" };

    const resolved = await coordinator.resolveInitialState(local);

    expect(resolved.source).toBe("local");
    expect(resolved.state).toEqual(local);
    expect(coordinator.getStatus().status).toBe("disabled");
  });

  it("prefers the cloud save when it is newer", async () => {
    const cloud: TestState = { savedAt: "2026-07-02T00:00:00.000Z", value: "cloud" };
    const provider = new FakeProvider({ savedAt: cloud.savedAt, serialized: JSON.stringify(cloud) });
    const { coordinator } = makeCoordinator(provider);
    const local: TestState = { savedAt: "2026-07-01T00:00:00.000Z", value: "local" };

    const resolved = await coordinator.resolveInitialState(local);

    expect(resolved.source).toBe("cloud");
    expect(resolved.state).toEqual(cloud);
    expect(coordinator.getStatus().status).toBe("synced");
  });

  it("keeps the local save when it is newer than the cloud", async () => {
    const cloud: TestState = { savedAt: "2026-06-01T00:00:00.000Z", value: "cloud" };
    const provider = new FakeProvider({ savedAt: cloud.savedAt, serialized: JSON.stringify(cloud) });
    const { coordinator } = makeCoordinator(provider);
    const local: TestState = { savedAt: "2026-07-01T00:00:00.000Z", value: "local" };

    const resolved = await coordinator.resolveInitialState(local);

    expect(resolved.source).toBe("local");
    expect(resolved.state).toEqual(local);
  });

  it("falls back to local and reports error when the pull rejects", async () => {
    const provider = new FakeProvider();
    vi.spyOn(provider, "pull").mockRejectedValue(new Error("offline"));
    const { coordinator } = makeCoordinator(provider);
    const local: TestState = { savedAt: "2026-07-01T00:00:00.000Z", value: "local" };

    const resolved = await coordinator.resolveInitialState(local);

    expect(resolved.source).toBe("local");
    expect(resolved.state).toEqual(local);
    expect(coordinator.getStatus().status).toBe("error");
    expect(coordinator.getStatus().lastError).toBe("offline");
  });
});

describe("SaveSyncCoordinator push behaviour", () => {
  it("debounces autosave-driven pushes and pushes the newest state", async () => {
    const provider = new FakeProvider();
    const { coordinator, scheduler } = makeCoordinator(provider);
    await coordinator.resolveInitialState(null);

    coordinator.notifySaved({ savedAt: "2026-07-01T00:00:01.000Z", value: "a" });
    coordinator.notifySaved({ savedAt: "2026-07-01T00:00:02.000Z", value: "b" });

    expect(provider.pushes).toHaveLength(0);

    scheduler.runPending();
    await flush();

    expect(provider.pushes).toHaveLength(1);
    expect(provider.pushes[0].savedAt).toBe("2026-07-01T00:00:02.000Z");
    expect(coordinator.getStatus().status).toBe("synced");
  });

  it("does not schedule pushes when the provider is disabled", async () => {
    const provider = new FakeProvider(null, false);
    const { coordinator } = makeCoordinator(provider);
    await coordinator.resolveInitialState(null);

    coordinator.notifySaved({ savedAt: "2026-07-01T00:00:01.000Z", value: "a" });
    await coordinator.flush();

    expect(provider.pushes).toHaveLength(0);
  });

  it("syncNow pushes immediately and cancels the pending debounce", async () => {
    const provider = new FakeProvider();
    const { coordinator } = makeCoordinator(provider);
    await coordinator.resolveInitialState(null);

    coordinator.notifySaved({ savedAt: "2026-07-01T00:00:01.000Z", value: "a" });
    await coordinator.syncNow();

    expect(provider.pushes).toHaveLength(1);
  });

  it("keeps the state dirty and reports error when a push fails", async () => {
    const provider = new FakeProvider();
    provider.failNextPush = true;
    const { coordinator } = makeCoordinator(provider);
    await coordinator.resolveInitialState(null);

    coordinator.notifySaved({ savedAt: "2026-07-01T00:00:01.000Z", value: "a" });
    await coordinator.syncNow();

    expect(coordinator.getStatus().status).toBe("error");

    // A subsequent flush retries the still-dirty state.
    await coordinator.flush();
    expect(provider.pushes).toHaveLength(1);
  });

  it("clearCloud clears the cloud and drops pending pushes", async () => {
    const provider = new FakeProvider();
    const { coordinator } = makeCoordinator(provider);
    await coordinator.resolveInitialState(null);

    coordinator.notifySaved({ savedAt: "2026-07-01T00:00:01.000Z", value: "a" });
    await coordinator.clearCloud();

    expect(provider.clears).toBe(1);

    await coordinator.flush();
    expect(provider.pushes).toHaveLength(0);
    expect(coordinator.getStatus().status).toBe("idle");
  });
});

describe("SaveSyncCoordinator status subscription", () => {
  it("emits the current snapshot immediately on subscribe", () => {
    const provider = new FakeProvider(null, false);
    const { coordinator } = makeCoordinator(provider);
    const seen: string[] = [];

    coordinator.subscribe((snapshot) => seen.push(snapshot.status));

    expect(seen).toEqual(["disabled"]);
  });
});
