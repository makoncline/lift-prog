import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  authClient,
  getBetterAuthCookieHeaders,
} from "./src/lib/auth-client";
import { mobileLocalDevUserId } from "./src/lib/config";
import { MobileErrorBoundary } from "./src/workout/MobileErrorBoundary";
import { LiftMobileApp } from "./src/workout/MobileWorkoutApp";

const palette = {
  canvas: "#fbfaf7",
  line: "#d9cdb9",
  ink: "#1f1c17",
  muted: "#7a7468",
  fill: "#ede6d9",
  danger: "#9f2f2f",
};

type AuthDraft = {
  email: string;
  otp: string;
  sentTo: string;
  screen: "email" | "code";
};

const initialAuthDraft: AuthDraft = {
  email: "",
  otp: "",
  sentTo: "",
  screen: "email",
};

function getAuthErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "could not sign in";
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.centeredView}>
        <ActivityIndicator color={palette.ink} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({
  draft,
  setDraft,
}: {
  draft: AuthDraft;
  setDraft: React.Dispatch<React.SetStateAction<AuthDraft>>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const trimmedEmail = draft.email.trim().toLowerCase();
  const codeEmail = draft.sentTo || trimmedEmail;
  const isCodeScreen = draft.screen === "code";

  const sendCode = async () => {
    if (!trimmedEmail || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: trimmedEmail,
        type: "sign-in",
      });
      if (result.error) throw result.error;
      setDraft((current) => ({
        ...current,
        email: trimmedEmail,
        sentTo: trimmedEmail,
        otp: "",
        screen: "code",
      }));
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!codeEmail || draft.otp.length < 6 || isVerifying) return;

    setIsVerifying(true);
    setError(null);
    try {
      const result = await authClient.signIn.emailOtp({
        email: codeEmail,
        otp: draft.otp,
        name: codeEmail.split("@")[0] ?? codeEmail,
      });
      if (result.error) throw result.error;
      await authClient.getSession();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoider}
      >
        <View style={styles.authShell}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Lift Prog</Text>
            <Text style={styles.subtitle}>
              {isCodeScreen ? "enter email code" : "email code sign in"}
            </Text>
          </View>

          <View style={styles.form}>
            {isCodeScreen ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>code</Text>
                <TextInput
                  value={draft.otp}
                  onChangeText={(value) => {
                    setDraft((current) => ({
                      ...current,
                      otp: value.replace(/\D/g, "").slice(0, 6),
                    }));
                    if (error) setError(null);
                  }}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={palette.muted}
                  textContentType="oneTimeCode"
                  accessibilityLabel="verification code"
                  testID="auth-code-input"
                  style={[styles.textInput, styles.otpInput]}
                />
              </View>
            ) : (
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>email</Text>
                <TextInput
                  accessibilityLabel="email"
                  testID="auth-email-input"
                  value={draft.email}
                  onChangeText={(value) => {
                    setDraft((current) => ({
                      ...current,
                      email: value,
                      sentTo: "",
                      otp: "",
                    }));
                    if (error) setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  inputMode="email"
                  keyboardType="email-address"
                  placeholder="email@example.com"
                  placeholderTextColor={palette.muted}
                  style={styles.textInput}
                />
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={isCodeScreen ? "sign in" : "send code"}
                accessibilityRole="button"
                testID={
                  isCodeScreen ? "auth-sign-in-button" : "auth-send-code-button"
                }
                style={[
                  styles.primaryButton,
                  isCodeScreen
                    ? draft.otp.length < 6 || !codeEmail || isVerifying
                      ? styles.disabledButton
                      : undefined
                    : !trimmedEmail || isSending
                      ? styles.disabledButton
                      : undefined,
                ]}
                onPress={isCodeScreen ? verifyCode : sendCode}
                disabled={
                  isCodeScreen
                    ? draft.otp.length < 6 || !codeEmail || isVerifying
                    : !trimmedEmail || isSending
                }
              >
                <Text style={styles.primaryButtonText}>
                  {isCodeScreen
                    ? isVerifying
                      ? "checking..."
                      : "sign in"
                    : isSending
                      ? "sending..."
                      : "send code"}
                </Text>
              </Pressable>

              {isCodeScreen ? (
                <Pressable
                  accessibilityLabel="resend code"
                  accessibilityRole="button"
                  testID="auth-resend-code-button"
                  style={styles.secondaryButton}
                  onPress={sendCode}
                  disabled={isSending}
                >
                  <Text style={styles.secondaryButtonText}>resend</Text>
                </Pressable>
              ) : null}
            </View>

            {isCodeScreen ? (
              <Pressable
                accessibilityLabel="change email"
                accessibilityRole="button"
                testID="auth-change-email-button"
                onPress={() => {
                  setDraft((current) => ({
                    ...current,
                    sentTo: "",
                    otp: "",
                    screen: "email",
                  }));
                  setError(null);
                }}
              >
                <Text style={styles.changeEmailText}>change email</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityLabel="already have a code"
                accessibilityRole="button"
                testID="auth-already-have-code-button"
                onPress={() => {
                  if (!trimmedEmail) {
                    setError("enter email first");
                    return;
                  }
                  setDraft((current) => ({
                    ...current,
                    email: trimmedEmail,
                    sentTo: trimmedEmail,
                    screen: "code",
                  }));
                  setError(null);
                }}
              >
                <Text style={styles.changeEmailText}>already have a code</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.footerText}>
            One code, long-lived session. No password.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignedInHomeScreen() {
  return (
    <LiftMobileApp
      getHeaders={getBetterAuthCookieHeaders}
      onSignOut={() => {
        void authClient.signOut();
      }}
    />
  );
}

function AppContent() {
  const { data: session, isPending } = authClient.useSession();
  const [authDraft, setAuthDraft] = useState<AuthDraft>(initialAuthDraft);

  if (__DEV__ && mobileLocalDevUserId) {
    return <LiftMobileApp localDevUserId={mobileLocalDevUserId} />;
  }

  if (isPending) {
    return <LoadingScreen message="loading..." />;
  }

  if (!session?.user) {
    return <AuthScreen draft={authDraft} setDraft={setAuthDraft} />;
  }

  return <SignedInHomeScreen />;
}

export default function App() {
  return (
    <MobileErrorBoundary
      scope="mobile-root"
      screen="app"
      title="app crashed"
      getHeaders={getBetterAuthCookieHeaders}
    >
      <AppContent />
    </MobileErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  keyboardAvoider: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  loadingText: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 16,
  },
  authShell: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 24,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    color: palette.ink,
    fontFamily: "Courier",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 15,
  },
  form: {
    gap: 12,
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 14,
  },
  textInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 6,
    color: palette.ink,
    fontFamily: "Courier",
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  otpInput: {
    letterSpacing: 4,
  },
  readonlyValue: {
    color: palette.ink,
    fontFamily: "Courier",
    fontSize: 18,
    lineHeight: 24,
  },
  errorText: {
    color: palette.danger,
    fontFamily: "Courier",
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 6,
    backgroundColor: palette.fill,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: palette.ink,
    fontFamily: "Courier",
    fontSize: 18,
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 6,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.55,
  },
  changeEmailText: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 14,
  },
  disabledText: {
    opacity: 0.45,
  },
  footerText: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 14,
    lineHeight: 20,
  },
});
