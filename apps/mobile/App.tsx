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

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const codeSent = Boolean(sentTo);

  const sendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: trimmedEmail,
        type: "sign-in",
      });
      if (result.error) throw result.error;
      setSentTo(trimmedEmail);
      setOtp("");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async () => {
    if (!sentTo || otp.length < 6 || isVerifying) return;

    setIsVerifying(true);
    setError(null);
    try {
      const result = await authClient.signIn.emailOtp({
        email: sentTo,
        otp,
        name: sentTo.split("@")[0] ?? sentTo,
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
            <Text style={styles.subtitle}>email code sign in</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>email</Text>
              <TextInput
                accessibilityLabel="email"
                testID="auth-email-input"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (sentTo) setSentTo("");
                  if (otp) setOtp("");
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

            {codeSent ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>code</Text>
                <TextInput
                  value={otp}
                  onChangeText={(value) => {
                    setOtp(value.replace(/\D/g, "").slice(0, 6));
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
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={codeSent ? "sign in" : "send code"}
                accessibilityRole="button"
                testID={codeSent ? "auth-sign-in-button" : "auth-send-code-button"}
                style={[
                  styles.primaryButton,
                  codeSent
                    ? otp.length < 6 || isVerifying
                      ? styles.disabledButton
                      : undefined
                    : !email.trim() || isSending
                      ? styles.disabledButton
                      : undefined,
                ]}
                onPress={codeSent ? verifyCode : sendCode}
                disabled={
                  codeSent
                    ? otp.length < 6 || isVerifying
                    : !email.trim() || isSending
                }
              >
                <Text style={styles.primaryButtonText}>
                  {codeSent
                    ? isVerifying
                      ? "checking..."
                      : "sign in"
                    : isSending
                      ? "sending..."
                      : "send code"}
                </Text>
              </Pressable>

              {codeSent ? (
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

            {codeSent ? (
              <Pressable
                accessibilityLabel="change email"
                accessibilityRole="button"
                testID="auth-change-email-button"
                onPress={() => {
                  setSentTo("");
                  setOtp("");
                  setError(null);
                }}
              >
                <Text style={styles.changeEmailText}>change email</Text>
              </Pressable>
            ) : null}
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

  if (__DEV__ && mobileLocalDevUserId) {
    return <LiftMobileApp localDevUserId={mobileLocalDevUserId} />;
  }

  if (isPending) {
    return <LoadingScreen message="loading..." />;
  }

  if (!session?.user) {
    return <AuthScreen />;
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
  footerText: {
    color: palette.muted,
    fontFamily: "Courier",
    fontSize: 14,
    lineHeight: 20,
  },
});
