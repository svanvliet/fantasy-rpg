import type { PlayFabClient } from "./PlayFabClient";
import type { CloudSaveEnvelope, CloudSaveProvider, IdentityProvider } from "./types";

interface StoredSavePayload {
  savedAt: string;
  serialized: string;
}

/**
 * PlayFab-backed cloud save using Entity Files.
 *
 * The save is stored as a single JSON file (`fileName`) on the player's
 * title_player_account entity. Entity Files impose no meaningful size ceiling
 * for our payload, so growing saves need no rework. Authentication is delegated
 * to an {@link IdentityProvider}, keeping anonymous-vs-account concerns out of
 * this class.
 */
export class PlayFabCloudSaveProvider implements CloudSaveProvider {
  private readonly client: PlayFabClient;
  private readonly identity: IdentityProvider;
  private readonly fileName: string;

  constructor(client: PlayFabClient, identity: IdentityProvider, fileName: string) {
    this.client = client;
    this.identity = identity;
    this.fileName = fileName;
  }

  isConfigured(): boolean {
    return true;
  }

  async pull(): Promise<CloudSaveEnvelope | null> {
    const auth = await this.identity.ensureLoggedIn();
    const raw = await this.client.readFile(auth.entity, this.fileName);
    if (!raw) {
      return null;
    }
    return this.parse(raw);
  }

  async push(envelope: CloudSaveEnvelope): Promise<void> {
    const auth = await this.identity.ensureLoggedIn();
    const payload: StoredSavePayload = {
      savedAt: envelope.savedAt,
      serialized: envelope.serialized
    };
    await this.client.writeFile(auth.entity, this.fileName, JSON.stringify(payload));
  }

  async clear(): Promise<void> {
    const auth = await this.identity.ensureLoggedIn();
    await this.client.deleteFile(auth.entity, this.fileName);
  }

  private parse(raw: string): CloudSaveEnvelope | null {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSavePayload>;
      if (typeof parsed.savedAt !== "string" || typeof parsed.serialized !== "string") {
        return null;
      }
      return { savedAt: parsed.savedAt, serialized: parsed.serialized };
    } catch (error) {
      console.warn("Failed to parse cloud save payload.", error);
      return null;
    }
  }
}
