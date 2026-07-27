import { describe, expect, it } from "vitest";

import {
  isLocalWorkoutStoreConfigurationCurrent,
  localWorkoutStoreConfigurationKey,
} from "./store-configuration";

describe("local workout store configuration", () => {
  it("hides a local client while a signed-in replacement is loading", () => {
    const localKey = localWorkoutStoreConfigurationKey(undefined, false);
    const signedInKey = localWorkoutStoreConfigurationKey(
      "auth-account-1",
      true,
    );

    expect(isLocalWorkoutStoreConfigurationCurrent(localKey, signedInKey)).toBe(
      false,
    );
  });

  it("keeps the replacement visible for the same signed-in configuration", () => {
    const signedInKey = localWorkoutStoreConfigurationKey(
      "auth-account-1",
      true,
    );

    expect(
      isLocalWorkoutStoreConfigurationCurrent(signedInKey, signedInKey),
    ).toBe(true);
  });
});
