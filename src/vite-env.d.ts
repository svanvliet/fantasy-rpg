/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PlayFab Title ID. When unset, cloud save is disabled. */
  readonly VITE_PLAYFAB_TITLE_ID?: string;
  /** Optional override for the cloud save Entity File name. */
  readonly VITE_PLAYFAB_SAVE_FILE?: string;
  /** Optional override for the localStorage key holding the device id. */
  readonly VITE_PLAYFAB_DEVICE_ID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
