import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authClient } from "../lib/auth-client";
import {
  controlSize,
  layout,
  monoFont,
  palette,
  radius,
  space,
  typeScale,
} from "../workout/theme";

export type AuthDraft = {
  email: string;
  otp: string;
  sentTo: string;
  screen: "email" | "code";
};

export type AuthScreenInitialState = {
  error?: string;
  isSending?: boolean;
  isVerifying?: boolean;
  autoFocus?: boolean;
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
  return error instanceof Error ? error.message : "could not sign in";
}

export function AuthScreen({
  draft,
  setDraft,
  onCancel,
  initialState,
}: {
  draft: AuthDraft;
  setDraft: React.Dispatch<React.SetStateAction<AuthDraft>>;
  onCancel?: () => void;
  initialState?: AuthScreenInitialState;
}) {
  const [error, setError] = useState<string | null>(
    initialState?.error ?? null,
  );
  const [isSending, setIsSending] = useState(initialState?.isSending ?? false);
  const [isVerifying, setIsVerifying] = useState(
    initialState?.isVerifying ?? false,
  );
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
          {onCancel ? (
            <Pressable
              accessibilityLabel="Close cloud backup sign in"
              accessibilityRole="button"
              hitSlop={8}
              style={styles.authTextAction}
              onPress={onCancel}
            >
              <Text style={styles.changeEmailText}>close</Text>
            </Pressable>
          ) : null}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Lift Prog</Text>
            <Text style={styles.subtitle}>
              {isCodeScreen ? "enter email code" : "connect cloud backup"}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>
                {isCodeScreen ? "code" : "email"}
              </Text>
              {isCodeScreen ? (
                <TextInput
                  autoFocus={initialState?.autoFocus}
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
              ) : (
                <TextInput
                  accessibilityLabel="email"
                  autoFocus={initialState?.autoFocus}
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
              )}
            </View>

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

            <Pressable
              accessibilityLabel={
                isCodeScreen ? "change email" : "already have a code"
              }
              accessibilityRole="button"
              testID={
                isCodeScreen
                  ? "auth-change-email-button"
                  : "auth-already-have-code-button"
              }
              style={styles.authTextAction}
              onPress={() => {
                if (!isCodeScreen && !trimmedEmail) {
                  setError("enter email first");
                  return;
                }
                setDraft((current) => ({
                  ...current,
                  email: trimmedEmail || current.email,
                  sentTo: isCodeScreen ? "" : trimmedEmail,
                  otp: "",
                  screen: isCodeScreen ? "email" : "code",
                }));
                setError(null);
              }}
            >
              <Text style={styles.changeEmailText}>
                {isCodeScreen ? "change email" : "already have a code"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footerText}>
            One code, long-lived session. No password.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.canvas },
  keyboardAvoider: { flex: 1 },
  authShell: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 56,
    paddingHorizontal: layout.pageGutter,
    gap: space.page,
  },
  titleBlock: { gap: space.xs },
  title: {
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.screenTitle,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.muted,
    fontFamily: monoFont,
    fontSize: typeScale.metadata,
  },
  form: { gap: space.md },
  fieldBlock: { gap: space.xs },
  label: {
    color: palette.muted,
    fontFamily: monoFont,
    fontSize: typeScale.caption,
    fontWeight: "700",
  },
  textInput: {
    minHeight: controlSize.row,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.field,
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.input,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  otpInput: { letterSpacing: 4 },
  errorText: {
    color: palette.danger,
    fontFamily: monoFont,
    fontSize: typeScale.caption,
  },
  actions: { flexDirection: "row", gap: space.sm },
  primaryButton: {
    flex: 1,
    minHeight: controlSize.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.field,
    backgroundColor: palette.active,
    paddingHorizontal: space.lg,
  },
  primaryButtonText: {
    color: palette.raised,
    fontFamily: monoFont,
    fontSize: typeScale.input,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: controlSize.row,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
  },
  secondaryButtonText: {
    color: palette.muted,
    fontFamily: monoFont,
    fontSize: typeScale.metadata,
  },
  disabledButton: { opacity: 0.55 },
  changeEmailText: {
    color: palette.muted,
    fontFamily: monoFont,
    fontSize: typeScale.caption,
  },
  authTextAction: {
    alignSelf: "flex-start",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    minHeight: controlSize.compact,
    justifyContent: "center",
    paddingHorizontal: space.xxs,
  },
  footerText: {
    color: palette.muted,
    fontFamily: monoFont,
    fontSize: typeScale.caption,
    lineHeight: 20,
  },
});
