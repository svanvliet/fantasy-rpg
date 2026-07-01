import { describe, expect, it } from "vitest";

import { isCloudConfigured, resolveCloudSaveConfig } from "./CloudSaveConfig";

describe("resolveCloudSaveConfig", () => {
  it("disables cloud save when the title id is missing", () => {
    const config = resolveCloudSaveConfig({});
    expect(config.titleId).toBe("");
    expect(isCloudConfigured(config)).toBe(false);
  });

  it("treats a whitespace-only title id as unconfigured", () => {
    const config = resolveCloudSaveConfig({ VITE_PLAYFAB_TITLE_ID: "   " });
    expect(isCloudConfigured(config)).toBe(false);
  });

  it("reads the title id and applies defaults for optional values", () => {
    const config = resolveCloudSaveConfig({ VITE_PLAYFAB_TITLE_ID: "ABC12" });
    expect(config.titleId).toBe("ABC12");
    expect(isCloudConfigured(config)).toBe(true);
    expect(config.fileName).toBe("save-v1.json");
    expect(config.deviceIdStorageKey).toBe("fantasy-rpg-playfab-device-id");
  });

  it("honours optional overrides", () => {
    const config = resolveCloudSaveConfig({
      VITE_PLAYFAB_TITLE_ID: "ABC12",
      VITE_PLAYFAB_SAVE_FILE: "custom.json",
      VITE_PLAYFAB_DEVICE_ID_KEY: "custom-key"
    });
    expect(config.fileName).toBe("custom.json");
    expect(config.deviceIdStorageKey).toBe("custom-key");
  });

  it("trims surrounding whitespace on the title id", () => {
    const config = resolveCloudSaveConfig({ VITE_PLAYFAB_TITLE_ID: "  ABC12  " });
    expect(config.titleId).toBe("ABC12");
  });
});
