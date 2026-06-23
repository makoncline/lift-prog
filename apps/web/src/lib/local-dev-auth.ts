export const isLocalDevAuthBypassEnabled = () =>
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_BYPASS === "true";
