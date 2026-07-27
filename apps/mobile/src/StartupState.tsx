import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  controlSize,
  layout,
  monoFont,
  palette,
  radius,
  space,
  typeScale,
} from "./workout/theme";

export function StartupLoadingScreen({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Lift Prog</Text>
        <ActivityIndicator color={palette.ink} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

export function StartupErrorScreen({
  message,
  reference,
  onRetry,
  onSupport,
}: {
  message: string;
  reference?: string;
  onRetry: () => void;
  onSupport?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.errorTitle}>could not open workout log</Text>
        <Text style={styles.errorMessage}>{message}</Text>
        {reference ? (
          <Text style={styles.reference}>reference: {reference}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Try opening workout log again"
            accessibilityRole="button"
            style={styles.button}
            onPress={onRetry}
          >
            <Text style={styles.buttonText}>try again</Text>
          </Pressable>
          {onSupport ? (
            <Pressable
              accessibilityLabel="Open support"
              accessibilityRole="link"
              style={styles.button}
              onPress={onSupport}
            >
              <Text style={styles.buttonText}>support</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    paddingHorizontal: layout.pageGutter,
    paddingBottom: 64,
  },
  title: {
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.screenTitle,
    fontWeight: "700",
    marginBottom: space.sm,
  },
  errorTitle: {
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.title,
    fontWeight: "700",
    maxWidth: 320,
    textAlign: "center",
  },
  message: {
    color: palette.muted,
    fontFamily: monoFont,
    fontSize: typeScale.body,
    textAlign: "center",
  },
  errorMessage: {
    color: palette.danger,
    fontFamily: monoFont,
    fontSize: typeScale.metadata,
    textAlign: "center",
  },
  reference: {
    color: palette.tertiary,
    fontFamily: monoFont,
    fontSize: typeScale.caption,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
  },
  button: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: radius.field,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: controlSize.row,
    paddingHorizontal: space.lg,
  },
  buttonText: {
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.metadata,
  },
});
