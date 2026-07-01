/**
 * Thin wrapper around the official PlayFab web SDK (`playfab-web-sdk`).
 *
 * The web SDK is authored as classic browser scripts that share a single global
 * `PlayFab` object, which does not survive ES-module bundling. To use it cleanly
 * under Vite we resolve the script URLs at build time (`?url`) and inject them
 * as classic <script> tags at runtime, sharing `window.PlayFab`. The SDK is only
 * loaded when cloud save is actually configured, keeping it out of the hot path.
 *
 * This wrapper exposes just the two capabilities the MVP needs — anonymous login
 * and Entity File read/write — behind small promise-based methods.
 */

// Vite resolves these to served asset URLs; importing the URL does not execute
// the SDK, so it stays out of the main chunk until we inject it.
import clientApiUrl from "playfab-web-sdk/src/PlayFab/PlayFabClientApi.js?url";
import dataApiUrl from "playfab-web-sdk/src/PlayFab/PlayFabDataApi.js?url";

export interface PlayFabEntity {
  id: string;
  type: string;
}

export interface PlayFabLoginResult {
  entity: PlayFabEntity;
}

interface PlayFabError {
  errorMessage?: string;
  error?: string;
  code?: number;
}

interface PlayFabApiResult<T> {
  data: T;
}

type PlayFabCallback<T> = (
  result: PlayFabApiResult<T> | null,
  error: PlayFabError | null
) => void;

interface PlayFabGlobal {
  settings: { titleId: string | null };
  ClientApi: {
    LoginWithCustomID: (
      request: { CustomId: string; CreateAccount?: boolean; TitleId?: string },
      callback: PlayFabCallback<{ EntityToken?: { Entity: { Id: string; Type: string } } }>
    ) => void;
  };
  DataApi: {
    InitiateFileUploads: (
      request: { Entity: { Id: string; Type: string }; FileNames: string[]; ProfileVersion?: number },
      callback: PlayFabCallback<{ ProfileVersion: number; UploadDetails?: Array<{ FileName?: string; UploadUrl?: string }> }>
    ) => void;
    FinalizeFileUploads: (
      request: { Entity: { Id: string; Type: string }; FileNames: string[]; ProfileVersion: number },
      callback: PlayFabCallback<unknown>
    ) => void;
    GetFiles: (
      request: { Entity: { Id: string; Type: string } },
      callback: PlayFabCallback<{ Metadata?: Record<string, { DownloadUrl?: string }> }>
    ) => void;
  };
}

function describeError(error: PlayFabError | null): string {
  if (!error) {
    return "Unknown PlayFab error";
  }
  return error.errorMessage ?? error.error ?? `PlayFab error ${error.code ?? "?"}`;
}

let sdkLoadPromise: Promise<PlayFabGlobal> | null = null;

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const selector = `script[data-playfab-src="${url}"]`;
    if (document.querySelector(selector)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    // Preserve execution order (ClientApi defines the shared core before DataApi).
    script.async = false;
    script.dataset.playfabSrc = url;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error(`Failed to load PlayFab SDK script: ${url}`))
    );
    document.head.appendChild(script);
  });
}

async function ensureSdkLoaded(): Promise<PlayFabGlobal> {
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }
  sdkLoadPromise = (async () => {
    await loadScript(clientApiUrl);
    await loadScript(dataApiUrl);
    const globalPlayFab = (window as unknown as { PlayFab?: PlayFabGlobal }).PlayFab;
    if (!globalPlayFab?.ClientApi || !globalPlayFab.DataApi) {
      throw new Error("PlayFab SDK loaded but global PlayFab surface is missing.");
    }
    return globalPlayFab;
  })();
  return sdkLoadPromise;
}

function promisify<T>(run: (callback: PlayFabCallback<T>) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    run((result, error) => {
      if (result) {
        resolve(result.data);
      } else {
        reject(new Error(describeError(error)));
      }
    });
  });
}

/**
 * Minimal PlayFab client used by the cloud save provider. Owns SDK loading and
 * translates the callback-based SDK into promises.
 */
export class PlayFabClient {
  private readonly titleId: string;

  constructor(titleId: string) {
    this.titleId = titleId;
  }

  /** Log in anonymously with a stable custom id and return the entity. */
  async loginWithCustomId(customId: string): Promise<PlayFabLoginResult> {
    const sdk = await ensureSdkLoaded();
    sdk.settings.titleId = this.titleId;
    const data = await promisify<{ EntityToken?: { Entity: { Id: string; Type: string } } }>(
      (callback) =>
        sdk.ClientApi.LoginWithCustomID(
          { CustomId: customId, CreateAccount: true, TitleId: this.titleId },
          callback
        )
    );
    const entity = data.EntityToken?.Entity;
    if (!entity) {
      throw new Error("PlayFab login succeeded but returned no entity token.");
    }
    return { entity: { id: entity.Id, type: entity.Type } };
  }

  /** Write a text payload to the named entity file (last-write-wins). */
  async writeFile(entity: PlayFabEntity, fileName: string, contents: string): Promise<void> {
    const sdk = await ensureSdkLoaded();
    const target = { Id: entity.id, Type: entity.type };

    const initiated = await promisify<{
      ProfileVersion: number;
      UploadDetails?: Array<{ FileName?: string; UploadUrl?: string }>;
    }>((callback) =>
      sdk.DataApi.InitiateFileUploads({ Entity: target, FileNames: [fileName] }, callback)
    );

    const uploadUrl = initiated.UploadDetails?.find(
      (detail) => detail.FileName === fileName
    )?.UploadUrl;
    if (!uploadUrl) {
      throw new Error("PlayFab did not return an upload URL for the save file.");
    }

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": "application/json"
      },
      body: contents
    });
    if (!putResponse.ok) {
      throw new Error(`Save upload failed with status ${putResponse.status}.`);
    }

    await promisify<unknown>((callback) =>
      sdk.DataApi.FinalizeFileUploads(
        { Entity: target, FileNames: [fileName], ProfileVersion: initiated.ProfileVersion },
        callback
      )
    );
  }

  /** Read a text payload from the named entity file, or null when absent. */
  async readFile(entity: PlayFabEntity, fileName: string): Promise<string | null> {
    const sdk = await ensureSdkLoaded();
    const target = { Id: entity.id, Type: entity.type };

    const files = await promisify<{ Metadata?: Record<string, { DownloadUrl?: string }> }>(
      (callback) => sdk.DataApi.GetFiles({ Entity: target }, callback)
    );

    const downloadUrl = files.Metadata?.[fileName]?.DownloadUrl;
    if (!downloadUrl) {
      return null;
    }

    const response = await fetch(downloadUrl);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Save download failed with status ${response.status}.`);
    }
    return response.text();
  }
}
