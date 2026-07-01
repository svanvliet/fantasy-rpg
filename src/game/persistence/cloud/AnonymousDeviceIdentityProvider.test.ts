import { describe, expect, it, vi } from "vitest";

import type { StorageLike } from "../SaveManager";

import { AnonymousDeviceIdentityProvider } from "./AnonymousDeviceIdentityProvider";
import type { PlayFabClient } from "./PlayFabClient";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function fakeClient(entityId = "entity-1") {
  const loginWithCustomId = vi.fn(async (customId: string) => ({
    entity: { id: entityId, type: "title_player_account" },
    playerId: customId
  }));
  return { loginWithCustomId } as unknown as PlayFabClient & {
    loginWithCustomId: ReturnType<typeof vi.fn>;
  };
}

const KEY = "device-id-key";

describe("AnonymousDeviceIdentityProvider", () => {
  it("generates and persists a device id on first use", () => {
    const storage = new MemoryStorage();
    const client = fakeClient();
    const provider = new AnonymousDeviceIdentityProvider(client, storage, KEY);

    const id = provider.getDeviceId();

    expect(id).toBeTruthy();
    expect(storage.getItem(KEY)).toBe(id);
  });

  it("reuses the stored device id across instances", () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY, "existing-device");
    const provider = new AnonymousDeviceIdentityProvider(fakeClient(), storage, KEY);

    expect(provider.getDeviceId()).toBe("existing-device");
  });

  it("logs in with the device id and returns the entity", async () => {
    const storage = new MemoryStorage();
    const client = fakeClient("entity-42");
    const provider = new AnonymousDeviceIdentityProvider(client, storage, KEY);

    const auth = await provider.ensureLoggedIn();

    expect(client.loginWithCustomId).toHaveBeenCalledWith(storage.getItem(KEY));
    expect(auth.entity).toEqual({ id: "entity-42", type: "title_player_account" });
    expect(auth.playerId).toBe(storage.getItem(KEY));
  });

  it("caches the auth context and only logs in once", async () => {
    const storage = new MemoryStorage();
    const client = fakeClient();
    const provider = new AnonymousDeviceIdentityProvider(client, storage, KEY);

    const [a, b] = await Promise.all([provider.ensureLoggedIn(), provider.ensureLoggedIn()]);
    await provider.ensureLoggedIn();

    expect(a).toBe(b);
    expect(client.loginWithCustomId).toHaveBeenCalledTimes(1);
  });
});
