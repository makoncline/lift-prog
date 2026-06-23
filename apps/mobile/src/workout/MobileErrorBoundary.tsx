import React from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { reportMobileError } from "../lib/error-reporting";
import { palette } from "./theme";

type MobileErrorBoundaryProps = {
  children: React.ReactNode;
  scope: string;
  screen?: string;
  title?: string;
  getToken?: () => Promise<string | null>;
  recoverLabel?: string;
  onRecover?: () => void;
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
    error: null,
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
      getToken: this.props.getToken,
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
            error reported
            {this.state.reportId ? ` · ${this.state.reportId.slice(0, 8)}` : ""}
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
    padding: 20,
    gap: 10,
  },
  title: {
    color: palette.ink,
    fontFamily: "Menlo",
    fontSize: 28,
    fontWeight: "800",
  },
  meta: {
    color: palette.muted,
    fontFamily: "Menlo",
    fontSize: 13,
  },
  message: {
    alignSelf: "flex-start",
    borderRadius: 6,
    backgroundColor: palette.soft,
    color: palette.ink,
    fontFamily: "Menlo",
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
  },
  action: {
    minHeight: 34,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 7,
    paddingHorizontal: 10,
  },
  actionText: {
    color: palette.ink,
    fontFamily: "Menlo",
    fontSize: 14,
  },
});
