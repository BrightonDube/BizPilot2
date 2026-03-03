/**
 * BizPilot Mobile POS — Error Boundary
 *
 * Catches unhandled JavaScript errors in the component tree
 * and shows a recovery screen instead of a white crash.
 *
 * Why a class component?
 * React error boundaries MUST be class components — there's no
 * hook equivalent for componentDidCatch / getDerivedStateFromError.
 * This is one of the few places where a class component is mandatory.
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // In production, this would send to Sentry or similar.
    // For now, console.error is sufficient for debugging.
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#1f2937",
            padding: 24,
          }}
        >
          <Text
            style={{
              color: "#ef4444",
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 14,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {this.state.error?.message ?? "An unexpected error occurred"}
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={{
              backgroundColor: "#2563eb",
              borderRadius: 8,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
