import { ClerkProvider, useAuth, useClerk, useSignIn, useSignUp } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { mobileClerkPublishableKey } from "./src/lib/config";

const palette = {
  canvas: "#f4efe6",
  surface: "#fffaf2",
  surfaceStrong: "#f9f2e4",
  line: "#d8ccba",
  ink: "#1e293b",
  muted: "#6b7280",
  accent: "#0f766e",
  danger: "#b91c1c",
};

type AuthMode = "sign-in" | "sign-up";
type VerificationStage = "none" | "sign-in-email" | "sign-up-email";

const getClerkErrorMessage = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray(
      (error as { errors?: Array<{ longMessage?: string; message?: string }> })
        .errors,
    )
  ) {
    const firstError = (error as {
      errors: Array<{ longMessage?: string; message?: string }>;
    }).errors[0];

    if (firstError?.longMessage) {
      return firstError.longMessage;
    }

    if (firstError?.message) {
      return firstError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
};

function LoadingScreen({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.centeredView}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function ConfigurationErrorScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.centeredView}>
        <Text style={styles.loadingText}>Missing Clerk publishable key.</Text>
        <Text style={styles.configBody}>
          Symlink `apps/mobile/.env` to the repo root `.env`, or set a mobile
          Clerk publishable key before launching Expo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [verificationStage, setVerificationStage] =
    useState<VerificationStage>("none");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!signIn || !signUp) {
    return <LoadingScreen message="Loading authentication…" />;
  }

  const finalizeFlow = async (
    flow: {
      finalize: (options: {
        navigate: (payload: unknown) => void;
      }) => Promise<{ error: unknown | null }>;
    },
  ) => {
    const result = await flow.finalize({
      navigate: () => undefined,
    });

    if (result.error) {
      throw result.error;
    }
  };

  const handleSwitchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setVerificationStage("none");
    setAuthError(null);
    setCode("");
  };

  const handleSignUp = async () => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const result = await signUp.password({
        emailAddress,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      await signUp.verifications.sendEmailCode();
      setVerificationStage("sign-up-email");
    } catch (error) {
      setAuthError(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const result = await signIn.password({
        emailAddress,
        password,
      });

      if (result.error) {
        throw result.error;
      }

      if (signIn.status === "complete") {
        await finalizeFlow(signIn);
        return;
      }

      if (
        signIn.status === "needs_client_trust" ||
        signIn.status === "needs_second_factor"
      ) {
        await signIn.mfa.sendEmailCode();
        setVerificationStage("sign-in-email");
        return;
      }

      setAuthError(
        "Clerk still needs another step. Finish sign-in on web once, then try again here.",
      );
    } catch (error) {
      setAuthError(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySignUp = async () => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await signUp.verifications.verifyEmailCode({ code });

      if (signUp.status !== "complete") {
        setAuthError("Email verification is still incomplete.");
        return;
      }

      await finalizeFlow(signUp);
    } catch (error) {
      setAuthError(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySignIn = async () => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      await signIn.mfa.verifyEmailCode({ code });

      if (signIn.status !== "complete") {
        setAuthError("Sign-in is still waiting for another factor.");
        return;
      }

      await finalizeFlow(signIn);
    } catch (error) {
      setAuthError(getClerkErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerificationScreen = verificationStage !== "none";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Lift Prog</Text>
          <Text style={styles.heroTitle}>A fresh iPhone app, starting from auth.</Text>
          <Text style={styles.heroBody}>
            The old workout-specific mobile flow has been removed. Sign in with
            your existing account while the new iOS product takes shape.
          </Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            style={[
              styles.modeChip,
              mode === "sign-in" ? styles.modeChipActive : undefined,
            ]}
            onPress={() => handleSwitchMode("sign-in")}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "sign-in" ? styles.modeChipTextActive : undefined,
              ]}
            >
              Sign in
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeChip,
              mode === "sign-up" ? styles.modeChipActive : undefined,
            ]}
            onPress={() => handleSwitchMode("sign-up")}
            disabled={isSubmitting}
          >
            <Text
              style={[
                styles.modeChipText,
                mode === "sign-up" ? styles.modeChipTextActive : undefined,
              ]}
            >
              Create account
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {verificationStage === "sign-up-email"
              ? "Verify your email"
              : verificationStage === "sign-in-email"
                ? "Confirm this device"
                : mode === "sign-up"
                  ? "Create your account"
                  : "Welcome back"}
          </Text>
          <Text style={styles.cardBody}>
            {verificationStage === "none"
              ? "Use the same Clerk account as the web app."
              : "Enter the email code Clerk just sent you."}
          </Text>

          {verificationStage === "none" ? (
            <>
              <TextInput
                style={styles.textField}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Email address"
                placeholderTextColor={palette.muted}
              />
              <TextInput
                style={styles.textField}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Password"
                placeholderTextColor={palette.muted}
              />
              <Pressable
                style={[
                  styles.primaryAction,
                  isSubmitting ? styles.buttonDisabled : undefined,
                ]}
                onPress={mode === "sign-up" ? handleSignUp : handleSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryActionText}>
                    {mode === "sign-up" ? "Create account" : "Sign in"}
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.textField}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="Verification code"
                placeholderTextColor={palette.muted}
              />
              <Pressable
                style={[
                  styles.primaryAction,
                  isSubmitting ? styles.buttonDisabled : undefined,
                ]}
                onPress={
                  verificationStage === "sign-up-email"
                    ? handleVerifySignUp
                    : handleVerifySignIn
                }
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.primaryActionText}>Verify code</Text>
                )}
              </Pressable>
              {verificationStage === "sign-up-email" ? (
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() => {
                    setVerificationStage("none");
                    setCode("");
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.secondaryActionText}>Back</Text>
                </Pressable>
              ) : null}
            </>
          )}

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SignedInHomeScreen() {
  const { signOut } = useClerk();
  const { isLoaded, sessionId, userId } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen message="Loading account…" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Lift Prog</Text>
          <Text style={styles.heroTitle}>Mobile has been reset.</Text>
          <Text style={styles.heroBody}>
            Auth is still wired up and working. The old workout experience is
            gone so the iPhone app can be rebuilt around a new format.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current state</Text>
          <Text style={styles.cardBody}>
            You are signed in successfully. This is the new clean starting
            point for the iOS app.
          </Text>

          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>User ID</Text>
            <Text style={styles.metaValue}>{userId ?? "Unavailable"}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Session ID</Text>
            <Text style={styles.metaValue}>{sessionId ?? "Unavailable"}</Text>
          </View>

          <Pressable
            style={styles.primaryAction}
            onPress={() => {
              void signOut();
            }}
          >
            <Text style={styles.primaryActionText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MobileRoot() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen message="Loading authentication…" />;
  }

  if (!isSignedIn) {
    return <AuthScreen />;
  }

  return <SignedInHomeScreen />;
}

export default function App() {
  if (!mobileClerkPublishableKey) {
    return <ConfigurationErrorScreen />;
  }

  return (
    <ClerkProvider
      publishableKey={mobileClerkPublishableKey}
      tokenCache={tokenCache}
    >
      <MobileRoot />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  centeredView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  loadingText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  configBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  hero: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    padding: 22,
    gap: 10,
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  heroBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  modeSwitch: {
    flexDirection: "row",
    gap: 10,
  },
  modeChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingVertical: 12,
  },
  modeChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  modeChipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  modeChipTextActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  cardBody: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  textField: {
    backgroundColor: palette.surfaceStrong,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: palette.ink,
    fontSize: 15,
  },
  primaryAction: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: palette.accent,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  secondaryActionText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  metaBlock: {
    gap: 4,
  },
  metaLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaValue: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
