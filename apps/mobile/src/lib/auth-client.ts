import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

import { mobileAuthBaseUrl } from "./config";

export const authClient = createAuthClient({
  baseURL: mobileAuthBaseUrl,
  plugins: [
    expoClient({
      scheme: "lift-prog",
      storagePrefix: "lift-prog",
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});

export const getBetterAuthCookieHeaders = async (): Promise<Record<string, string>> => {
  const cookie = authClient.getCookie();
  return cookie ? { cookie } : {};
};
