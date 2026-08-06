import { describe, expect, it } from "vitest";
import { normalizeUserSettings } from "../../features/identity/identity-service/totp-settings.js";

describe("normalizeUserSettings", () => {
  it("clamps panel and notification settings to supported ranges", () => {
    expect(
      normalizeUserSettings({
        maxOpenPanels: 99,
        maxNotifications: 0,
        notificationDuration: 45,
      }),
    ).toEqual({
      maxOpenPanels: 10,
      maxNotifications: 1,
      notificationDuration: 30,
    });
  });

  it("keeps booleans and omits fields that were not provided", () => {
    expect(normalizeUserSettings({ enableNotifications: false })).toEqual({
      enableNotifications: false,
    });
  });

  it("passes enableSecondBrain through untouched", () => {
    expect(normalizeUserSettings({ enableSecondBrain: true })).toEqual({
      enableSecondBrain: true,
    });
    expect(normalizeUserSettings({ enableSecondBrain: false })).toEqual({
      enableSecondBrain: false,
    });
  });
});
