import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthScreen, type AuthDraft } from "./src/auth/AuthScreen";
import { authClient, getBetterAuthCookieHeaders } from "./src/lib/auth-client";
import { MobileErrorBoundary } from "./src/workout/MobileErrorBoundary";
import { LiftMobileApp } from "./src/workout/MobileWorkoutApp";

const initialAuthDraft: AuthDraft = {
  email: "",
  otp: "",
  sentTo: "",
  screen: "email",
};

function AppContent() {
  const { data: session, isPending } = authClient.useSession();
  const [authDraft, setAuthDraft] = useState<AuthDraft>(initialAuthDraft);
  const [authOpen, setAuthOpen] = useState(false);
  const handleAccountDeleted = React.useCallback(() => {
    void authClient.signOut();
  }, []);

  useEffect(() => {
    if (session?.user) setAuthOpen(false);
  }, [session?.user]);

  if (authOpen && !session?.user) {
    return (
      <AuthScreen
        draft={authDraft}
        setDraft={setAuthDraft}
        onCancel={() => setAuthOpen(false)}
      />
    );
  }

  return (
    <LiftMobileApp
      accountId={!isPending ? session?.user.id : undefined}
      getHeaders={
        !isPending && session?.user ? getBetterAuthCookieHeaders : undefined
      }
      onConnectCloud={
        !isPending && !session?.user ? () => setAuthOpen(true) : undefined
      }
      onAccountDeleted={handleAccountDeleted}
      onSignOut={
        session?.user
          ? () => {
              void authClient.signOut();
            }
          : undefined
      }
    />
  );
}

export default function App() {
  const app = (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <MobileErrorBoundary
        scope="mobile-root"
        screen="app"
        title="app crashed"
        getHeaders={getBetterAuthCookieHeaders}
      >
        <AppContent />
      </MobileErrorBoundary>
    </SafeAreaProvider>
  );

  if (!__DEV__) return app;

  const { UiAtlasDevGate } =
    require("./src/ui-atlas/UiAtlasRoot") as typeof import("./src/ui-atlas/UiAtlasRoot");
  return <UiAtlasDevGate app={app} />;
}
