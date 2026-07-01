/**
 * Cloud save configuration, resolved from environment with no hard-coded
 * secrets or title identifiers baked into source.
 *
 * The only required value is the PlayFab Title ID (`VITE_PLAYFAB_TITLE_ID`).
 * When it is absent the whole cloud-save feature gracefully disables itself and
 * the prototype behaves exactly as it did before (pure localStorage).
 */
export interface CloudSaveConfig {
  /** PlayFab Title ID. When empty, cloud save is disabled. */
  titleId: string;
  /** Entity file name the save blob is stored under. */
  fileName: string;
  /** localStorage key used to persist the anonymous device id. */
  deviceIdStorageKey: string;
}

const DEFAULT_FILE_NAME = "save-v1.json";
const DEFAULT_DEVICE_ID_KEY = "fantasy-rpg-playfab-device-id";

/** True when the config carries enough to actually reach the cloud. */
export function isCloudConfigured(config: CloudSaveConfig): boolean {
  return config.titleId.trim().length > 0;
}

/**
 * Build a config from a raw env-like record. Accepting the record as a
 * parameter (rather than reading `import.meta.env` directly) keeps this pure
 * and unit-testable.
 */
export function resolveCloudSaveConfig(
  env: Record<string, string | undefined> = readViteEnv()
): CloudSaveConfig {
  return {
    titleId: (env.VITE_PLAYFAB_TITLE_ID ?? "").trim(),
    fileName: (env.VITE_PLAYFAB_SAVE_FILE ?? "").trim() || DEFAULT_FILE_NAME,
    deviceIdStorageKey:
      (env.VITE_PLAYFAB_DEVICE_ID_KEY ?? "").trim() || DEFAULT_DEVICE_ID_KEY
  };
}

/** Read Vite's compile-time env safely (guarded for non-Vite test contexts). */
function readViteEnv(): Record<string, string | undefined> {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env ?? {};
  } catch {
    return {};
  }
}
