export function localWorkoutStoreConfigurationKey(
  accountId: string | undefined,
  cloudEnabled: boolean,
) {
  return `${accountId ?? "local"}:${cloudEnabled ? "cloud" : "local"}`;
}

export function isLocalWorkoutStoreConfigurationCurrent(
  readyConfigurationKey: string,
  requestedConfigurationKey: string,
) {
  return readyConfigurationKey === requestedConfigurationKey;
}
