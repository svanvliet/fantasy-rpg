import type { GameSaveState, StorageLike } from "../SaveManager";

import { AnonymousDeviceIdentityProvider } from "./AnonymousDeviceIdentityProvider";
import { isCloudConfigured, resolveCloudSaveConfig } from "./CloudSaveConfig";
import { NullCloudSaveProvider } from "./NullCloudSaveProvider";
import { PlayFabClient } from "./PlayFabClient";
import { PlayFabCloudSaveProvider } from "./PlayFabCloudSaveProvider";
import { SaveSyncCoordinator } from "./SaveSyncCoordinator";
import type { CloudSaveProvider } from "./types";

export interface CloudSave {
  coordinator: SaveSyncCoordinator<GameSaveState>;
  /** True when a real backend is wired up (vs the disabled no-op path). */
  enabled: boolean;
}

function serializeSave(state: GameSaveState): string {
  return JSON.stringify(state);
}

function deserializeSave(serialized: string): GameSaveState | null {
  try {
    const parsed = JSON.parse(serialized) as GameSaveState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Build the cloud-save coordinator for the game's save state.
 *
 * Reads configuration from the environment. When PlayFab is unconfigured this
 * returns a coordinator backed by a no-op provider, so callers can wire it in
 * unconditionally and the prototype runs exactly as before (pure localStorage).
 */
export function createCloudSave(
  storage: StorageLike,
  env?: Record<string, string | undefined>
): CloudSave {
  const config = env ? resolveCloudSaveConfig(env) : resolveCloudSaveConfig();
  const enabled = isCloudConfigured(config);

  let provider: CloudSaveProvider;
  if (enabled) {
    const client = new PlayFabClient(config.titleId);
    const identity = new AnonymousDeviceIdentityProvider(
      client,
      storage,
      config.deviceIdStorageKey
    );
    provider = new PlayFabCloudSaveProvider(client, identity, config.fileName);
  } else {
    provider = new NullCloudSaveProvider();
  }

  const coordinator = new SaveSyncCoordinator<GameSaveState>({
    provider,
    serialize: serializeSave,
    deserialize: deserializeSave,
    getSavedAt: (state) => state.savedAt,
    // Ignore the volatile savedAt timestamp so the ~1.1s autosave heartbeat
    // does not upload identical saves repeatedly.
    getContentKey: (state) => JSON.stringify({ ...state, savedAt: "" })
  });

  return { coordinator, enabled };
}

export { SaveSyncCoordinator } from "./SaveSyncCoordinator";
export type { CloudSaveStatus, CloudSaveStatusSnapshot } from "./types";
