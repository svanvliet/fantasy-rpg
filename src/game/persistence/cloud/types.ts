/**
 * Transport- and provider-agnostic contracts for cloud save.
 *
 * Nothing in this file references PlayFab. The rest of the game depends only on
 * these interfaces so the backend (PlayFab today, something else tomorrow) and
 * the identity strategy (anonymous device today, real accounts later) can each
 * be swapped without touching gameplay or the sync coordinator.
 */

/** A serialized save plus the timestamp used for newer-wins reconciliation. */
export interface CloudSaveEnvelope {
  /** ISO-8601 timestamp the save was produced (mirrors GameSaveState.savedAt). */
  savedAt: string;
  /** Opaque serialized save payload (JSON string today). */
  serialized: string;
}

/** Coarse lifecycle status surfaced to UI. */
export type CloudSaveStatus =
  | "disabled"
  | "idle"
  | "syncing"
  | "synced"
  | "error";

export interface CloudSaveStatusSnapshot {
  status: CloudSaveStatus;
  /** ISO-8601 time of the last successful push or pull, if any. */
  lastSyncedAt: string | null;
  /** Human-readable last error message, if the last operation failed. */
  lastError: string | null;
}

/**
 * A place to read/write a single save payload in the cloud.
 *
 * Implementations own their own authentication (via an IdentityProvider) and
 * are expected to be resilient: a failed push/pull rejects, it never throws
 * synchronously, and an unconfigured provider reports `isConfigured() === false`
 * and no-ops.
 */
export interface CloudSaveProvider {
  /** True when the provider has enough config to actually talk to the cloud. */
  isConfigured(): boolean;
  /** Fetch the current cloud save, or null when none exists. */
  pull(): Promise<CloudSaveEnvelope | null>;
  /** Overwrite the cloud save with the given payload. */
  push(envelope: CloudSaveEnvelope): Promise<void>;
}

/** Identity/authentication context resolved for the current player. */
export interface AuthContext {
  /** PlayFab-style entity reference (id + type) or equivalent. */
  entity: { id: string; type: string };
  /** Stable per-player id used by the identity strategy (e.g. device id). */
  playerId: string;
}

/**
 * Resolves and caches an authenticated session.
 *
 * The anonymous device implementation is the MVP; an account-based
 * implementation can replace it later without changes to CloudSaveProvider or
 * the coordinator.
 */
export interface IdentityProvider {
  ensureLoggedIn(): Promise<AuthContext>;
}
