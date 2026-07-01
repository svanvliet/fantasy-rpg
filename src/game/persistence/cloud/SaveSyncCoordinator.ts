import type {
  CloudSaveProvider,
  CloudSaveStatus,
  CloudSaveStatusSnapshot
} from "./types";

/** Where the state used to seed the session came from. */
export type InitialStateSource = "local" | "cloud" | "none";

export interface ResolvedInitialState<T> {
  state: T | null;
  source: InitialStateSource;
}

export interface SaveSyncCoordinatorOptions<T> {
  provider: CloudSaveProvider;
  /** Serialize a save state to the opaque payload stored in the cloud. */
  serialize: (state: T) => string;
  /** Reverse of `serialize`; returns null when the payload is unusable. */
  deserialize: (serialized: string) => T | null;
  /** Extract the ISO-8601 timestamp used for newer-wins reconciliation. */
  getSavedAt: (state: T) => string;
  /** Debounce window for autosave-driven pushes. Default 4000ms. */
  debounceMs?: number;
  /** How long to wait for the startup cloud pull before falling back. Default 3000ms. */
  pullTimeoutMs?: number;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Injectable timer for tests. */
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  /** Injectable timer cancel for tests. */
  cancel?: (handle: ReturnType<typeof setTimeout>) => void;
}

type StatusListener = (snapshot: CloudSaveStatusSnapshot) => void;

const DEFAULT_DEBOUNCE_MS = 4000;
const DEFAULT_PULL_TIMEOUT_MS = 3000;

/**
 * Orchestrates local-first cloud sync.
 *
 * Local storage stays the synchronous source of truth for gameplay; this class
 * layers an eventually-consistent cloud backup on top:
 * - {@link resolveInitialState} reconciles local vs cloud at startup (newer
 *   wins by timestamp) with a bounded wait so gameplay never blocks.
 * - {@link notifySaved} debounces pushes off the game's existing autosave.
 * - {@link flush}/{@link syncNow} force a best-effort push (quit, manual button).
 * It is deliberately generic over the save state type and knows nothing about
 * PlayFab.
 */
export class SaveSyncCoordinator<T> {
  private readonly provider: CloudSaveProvider;
  private readonly serialize: (state: T) => string;
  private readonly deserialize: (serialized: string) => T | null;
  private readonly getSavedAt: (state: T) => string;
  private readonly debounceMs: number;
  private readonly pullTimeoutMs: number;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  private readonly cancel: (handle: ReturnType<typeof setTimeout>) => void;

  private readonly listeners = new Set<StatusListener>();
  private snapshot: CloudSaveStatusSnapshot;

  private latestState: T | null = null;
  private dirty = false;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private pushChain: Promise<void> = Promise.resolve();

  constructor(options: SaveSyncCoordinatorOptions<T>) {
    this.provider = options.provider;
    this.serialize = options.serialize;
    this.deserialize = options.deserialize;
    this.getSavedAt = options.getSavedAt;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.pullTimeoutMs = options.pullTimeoutMs ?? DEFAULT_PULL_TIMEOUT_MS;
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? ((cb, delay) => setTimeout(cb, delay));
    this.cancel = options.cancel ?? ((handle) => clearTimeout(handle));

    this.snapshot = {
      status: this.provider.isConfigured() ? "idle" : "disabled",
      lastSyncedAt: null,
      lastError: null
    };
  }

  getStatus(): CloudSaveStatusSnapshot {
    return this.snapshot;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reconcile local and cloud saves at startup and return the winning state to
   * seed the session with. Never rejects; on any failure it falls back to the
   * local state so gameplay is unaffected.
   */
  async resolveInitialState(local: T | null): Promise<ResolvedInitialState<T>> {
    this.latestState = local;

    if (!this.provider.isConfigured()) {
      this.setStatus("disabled");
      return { state: local, source: local ? "local" : "none" };
    }

    this.setStatus("syncing");
    try {
      const cloud = await this.withTimeout(this.provider.pull());
      let chosen = local;
      let source: InitialStateSource = local ? "local" : "none";

      if (cloud) {
        const cloudState = this.deserialize(cloud.serialized);
        if (cloudState && (!local || cloud.savedAt > this.getSavedAt(local))) {
          chosen = cloudState;
          source = "cloud";
        }
      }

      this.latestState = chosen;
      if (cloud) {
        this.setStatus("synced", { lastSyncedAt: this.nowIso() });
      } else {
        this.setStatus("idle");
      }
      return { state: chosen, source };
    } catch (error) {
      this.setStatus("error", { lastError: this.describe(error) });
      return { state: local, source: local ? "local" : "none" };
    }
  }

  /** Record the newest save and schedule a debounced cloud push. */
  notifySaved(state: T): void {
    this.latestState = state;
    if (!this.provider.isConfigured()) {
      return;
    }
    this.dirty = true;
    if (this.debounceHandle !== null) {
      this.cancel(this.debounceHandle);
    }
    this.debounceHandle = this.schedule(() => {
      this.debounceHandle = null;
      void this.pushLatest();
    }, this.debounceMs);
  }

  /** Force any pending push immediately (best-effort; used on quit). */
  async flush(): Promise<void> {
    if (this.debounceHandle !== null) {
      this.cancel(this.debounceHandle);
      this.debounceHandle = null;
    }
    if (!this.dirty) {
      return;
    }
    await this.pushLatest();
  }

  /** Push the latest known state now, regardless of dirty state (manual button). */
  async syncNow(): Promise<void> {
    if (this.debounceHandle !== null) {
      this.cancel(this.debounceHandle);
      this.debounceHandle = null;
    }
    this.dirty = true;
    await this.pushLatest();
  }

  /**
   * Remove the cloud save and drop any pending push. Used when the player
   * resets progress so a stale cloud copy can't win reconciliation on reload.
   */
  async clearCloud(): Promise<void> {
    if (this.debounceHandle !== null) {
      this.cancel(this.debounceHandle);
      this.debounceHandle = null;
    }
    this.dirty = false;
    this.latestState = null;
    if (!this.provider.isConfigured()) {
      return;
    }
    this.setStatus("syncing");
    try {
      await this.provider.clear();
      this.setStatus("idle");
    } catch (error) {
      this.setStatus("error", { lastError: this.describe(error) });
    }
  }

  private pushLatest(): Promise<void> {
    // Serialize pushes so overlapping triggers never race on the same file.
    this.pushChain = this.pushChain.then(() => this.doPush());
    return this.pushChain;
  }

  private async doPush(): Promise<void> {
    if (!this.dirty || !this.provider.isConfigured() || this.latestState === null) {
      return;
    }
    const state = this.latestState;
    this.dirty = false;
    this.setStatus("syncing");
    try {
      await this.provider.push({
        savedAt: this.getSavedAt(state),
        serialized: this.serialize(state)
      });
      this.setStatus("synced", { lastSyncedAt: this.nowIso() });
    } catch (error) {
      this.dirty = true;
      this.setStatus("error", { lastError: this.describe(error) });
    }
  }

  private withTimeout<V>(promise: Promise<V>): Promise<V> {
    return new Promise<V>((resolve, reject) => {
      const handle = this.schedule(() => {
        reject(new Error("Cloud sync timed out."));
      }, this.pullTimeoutMs);
      promise.then(
        (value) => {
          this.cancel(handle);
          resolve(value);
        },
        (error) => {
          this.cancel(handle);
          reject(error);
        }
      );
    });
  }

  private setStatus(
    status: CloudSaveStatus,
    patch: Partial<Pick<CloudSaveStatusSnapshot, "lastSyncedAt" | "lastError">> = {}
  ): void {
    this.snapshot = {
      status,
      lastSyncedAt: patch.lastSyncedAt ?? this.snapshot.lastSyncedAt,
      lastError: status === "error" ? patch.lastError ?? this.snapshot.lastError : null
    };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown cloud sync error";
  }
}
