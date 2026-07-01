import type { StorageLike } from "../SaveManager";

import type { PlayFabClient } from "./PlayFabClient";
import type { AuthContext, IdentityProvider } from "./types";

/**
 * Generates a random, opaque device id. Prefers `crypto.randomUUID` and falls
 * back to a timestamp+random string so the provider still works in constrained
 * environments.
 */
function generateDeviceId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Anonymous, device-scoped identity for the MVP.
 *
 * A random device id is generated once, persisted to local storage, and used as
 * the PlayFab `CustomId`. Because it implements the same {@link IdentityProvider}
 * contract as any future account-based strategy (email, Xbox, etc.), the cloud
 * provider and sync coordinator need no changes when we add real accounts.
 */
export class AnonymousDeviceIdentityProvider implements IdentityProvider {
  private readonly client: PlayFabClient;
  private readonly storage: StorageLike;
  private readonly storageKey: string;
  private cached: AuthContext | null = null;
  private inFlight: Promise<AuthContext> | null = null;

  constructor(client: PlayFabClient, storage: StorageLike, storageKey: string) {
    this.client = client;
    this.storage = storage;
    this.storageKey = storageKey;
  }

  /** Returns the stored device id, generating and persisting one if needed. */
  getDeviceId(): string {
    const existing = this.readStoredDeviceId();
    if (existing) {
      return existing;
    }
    const generated = generateDeviceId();
    try {
      this.storage.setItem(this.storageKey, generated);
    } catch (error) {
      console.warn("Failed to persist PlayFab device id; using ephemeral id.", error);
    }
    return generated;
  }

  async ensureLoggedIn(): Promise<AuthContext> {
    if (this.cached) {
      return this.cached;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const deviceId = this.getDeviceId();
    this.inFlight = this.client
      .loginWithCustomId(deviceId)
      .then((result) => {
        this.cached = { entity: result.entity, playerId: deviceId };
        return this.cached;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private readStoredDeviceId(): string | null {
    try {
      const value = this.storage.getItem(this.storageKey);
      return value && value.trim().length > 0 ? value : null;
    } catch (error) {
      console.warn("Failed to read stored PlayFab device id.", error);
      return null;
    }
  }
}
