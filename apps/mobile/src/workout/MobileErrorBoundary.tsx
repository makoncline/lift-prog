import React from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { reportMobileError } from "../lib/error-reporting";
import {
  controlSize,
  layout,
  monoFont,
  palette,
  radius,
  space,
  typeScale,
} from "./theme";

type MobileErrorBoundaryProps = {
  children: React.ReactNode;
  scope: string;
  screen?: string;
  title?: string;
  getHeaders?: () => Promise<Record<string, string>>;
  recoverLabel?: string;
  onRecover?: () => void;
  initialErrorMessage?: string;
};

type MobileErrorBoundaryState = {
  error: Error | null;
  reportId?: string;
};

export class MobileErrorBoundary extends React.Component<
  MobileErrorBoundaryProps,
  MobileErrorBoundaryState
> {
  state: MobileErrorBoundaryState = {
    error: this.props.initialErrorMessage
      ? new Error(this.props.initialErrorMessage)
      : null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const reportId = reportMobileError({
      error,
      scope: this.props.scope,
      screen: this.props.screen,
      componentStack: info.componentStack ?? undefined,
      getHeaders: this.props.getHeaders,
    });
    this.setState({ reportId });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={boundaryStyles.safeArea}>
        <View style={boundaryStyles.content}>
          <Text style={boundaryStyles.title} selectable>
            {this.props.title ?? "something broke"}
          </Text>
          <Text style={boundaryStyles.meta} selectable>
            reference {this.state.reportId?.slice(0, 8) ?? this.props.scope}
          </Text>
          <Text style={boundaryStyles.message} selectable>
            {this.state.error.message || "Unknown error"}
          </Text>

          <View style={boundaryStyles.actions}>
            <Pressable
              style={boundaryStyles.action}
              onPress={() => {
                this.setState({ error: null, reportId: undefined });
              }}
            >
              <Text style={boundaryStyles.actionText}>try again</Text>
            </Pressable>

            {this.props.onRecover ? (
              <Pressable
                style={boundaryStyles.action}
                onPress={() => {
                  this.setState({ error: null, reportId: undefined });
                  this.props.onRecover?.();
                }}
              >
                <Text style={boundaryStyles.actionText}>
                  {this.props.recoverLabel ?? "back"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="link"
              style={boundaryStyles.action}
              onPress={() => {
                void Linking.openURL("https://lift.makon.dev/support");
              }}
            >
              <Text style={boundaryStyles.actionText}>support</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const boundaryStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: layout.pageGutter,
    paddingBottom: 64,
    gap: space.md,
  },
  title: {
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.title,
    fontWeight: "800",
  },
  meta: {
    color: palette.tertiary,
    fontFamily: monoFont,
    fontSize: typeScale.caption,
  },
  message: {
    alignSelf: "flex-start",
    borderRadius: radius.field,
    backgroundColor: palette.soft,
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.metadata,
    lineHeight: 21,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  actions: {
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.xs,
  },
  action: {
    minHeight: controlSize.row,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
  },
  actionText: {
    color: palette.ink,
    fontFamily: monoFont,
    fontSize: typeScale.metadata,
  },
});
