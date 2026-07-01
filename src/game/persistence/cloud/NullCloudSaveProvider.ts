import type { CloudSaveEnvelope, CloudSaveProvider } from "./types";

/**
 * No-op provider used when cloud save is unconfigured or intentionally
 * disabled. Every operation is a safe no-op so the rest of the system can treat
 * "cloud disabled" as just another provider rather than a special case.
 */
export class NullCloudSaveProvider implements CloudSaveProvider {
  isConfigured(): boolean {
    return false;
  }

  async pull(): Promise<CloudSaveEnvelope | null> {
    return null;
  }

  async push(): Promise<void> {
    // Intentionally does nothing.
  }

  async clear(): Promise<void> {
    // Intentionally does nothing.
  }
}
