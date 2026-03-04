/**
 * BizPilot Mobile POS — Error Display Components
 *
 * User-friendly error messages for common POS failure scenarios.
 * Each variant shows a clear problem description, an optional
 * retry action, and avoids technical jargon that confuses staff.
 *
 * Why dedicated error display components?
 * The ErrorBoundary catches crashes, but many errors are non-fatal
 * (network timeout, sync failure, payment declined). These need
 * inline error UI that doesn't replace the entire screen.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ErrorSeverity = "error" | "warning" | "info";

interface ErrorDisplayProps {
  /** Short error title (e.g., "Payment Failed") */
  title: string;
  /** Longer description explaining what happened */
  message: string;
  /** Severity affects icon and color scheme */
  severity?: ErrorSeverity;
  /** If provided, shows a retry button */
  onRetry?: () => void;
  /** Custom retry button label (defaults to "Try Again") */
  retryLabel?: string;
  /** If provided, shows a dismiss/close button */
  onDismiss?: () => void;
  /** If true, renders compact inline variant */
  inline?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
}

interface NetworkErrorProps {
  /** Called when user taps retry */
  onRetry?: () => void;
  /** Additional container styles */
  style?: ViewStyle;
}

interface EmptyStateProps {
  /** Title for the empty state */
  title: string;
  /** Descriptive message */
  message: string;
  /** Icon name from Ionicons */
  icon?: string;
  /** Optional action button */
  actionLabel?: string;
  /** Called when the action button is tapped */
  onAction?: () => void;
  /** Additional container styles */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Color mapping by severity
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<
  ErrorSeverity,
  { bg: string; border: string; icon: string; text: string }
> = {
  error: {
    bg: "rgba(239, 68, 68, 0.1)",
    border: "#dc2626",
    icon: "#ef4444",
    text: "#fca5a5",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.1)",
    border: "#d97706",
    icon: "#f59e0b",
    text: "#fcd34d",
  },
  info: {
    bg: "rgba(59, 130, 246, 0.1)",
    border: "#2563eb",
    icon: "#3b82f6",
    text: "#93c5fd",
  },
};

const SEVERITY_ICONS: Record<ErrorSeverity, string> = {
  error: "alert-circle",
  warning: "warning",
  info: "information-circle",
};

// ---------------------------------------------------------------------------
// ErrorDisplay — Generic error component
// ---------------------------------------------------------------------------

export const ErrorDisplay: React.FC<ErrorDisplayProps> = React.memo(
  function ErrorDisplay({
    title,
    message,
    severity = "error",
    onRetry,
    retryLabel = "Try Again",
    onDismiss,
    inline = false,
    style,
  }) {
    const colors = SEVERITY_COLORS[severity];
    const iconName = SEVERITY_ICONS[severity];

    if (inline) {
      return (
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.bg,
              borderRadius: 8,
              padding: 12,
              borderLeftWidth: 3,
              borderLeftColor: colors.border,
            },
            style,
          ]}
        >
          <Ionicons
            name={iconName as any}
            size={20}
            color={colors.icon}
            style={{ marginRight: 8 }}
          />
          <Text
            style={{ color: colors.text, fontSize: 14, flex: 1 }}
            numberOfLines={2}
          >
            {message}
          </Text>
          {onDismiss && (
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <View
        style={[
          {
            backgroundColor: colors.bg,
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          },
          style,
        ]}
      >
        <Ionicons
          name={iconName as any}
          size={40}
          color={colors.icon}
          style={{ marginBottom: 12 }}
        />
        <Text
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: "700",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: "#9ca3af",
            fontSize: 14,
            textAlign: "center",
            marginBottom: onRetry ? 16 : 0,
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={{
              backgroundColor: "#2563eb",
              borderRadius: 8,
              paddingHorizontal: 24,
              paddingVertical: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
          >
            <Text
              style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}
            >
              {retryLabel}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// NetworkError — Pre-built for network failures
// ---------------------------------------------------------------------------

export const NetworkError: React.FC<NetworkErrorProps> = React.memo(
  function NetworkError({ onRetry, style }) {
    return (
      <ErrorDisplay
        title="No Connection"
        message="Unable to reach the server. Check your internet connection and try again."
        severity="warning"
        onRetry={onRetry}
        retryLabel="Retry Connection"
        style={style}
      />
    );
  }
);

// ---------------------------------------------------------------------------
// EmptyState — When there's no data to display
// ---------------------------------------------------------------------------

export const EmptyState: React.FC<EmptyStateProps> = React.memo(
  function EmptyState({
    title,
    message,
    icon = "folder-open",
    actionLabel,
    onAction,
    style,
  }) {
    return (
      <View
        style={[
          {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 32,
          },
          style,
        ]}
      >
        <Ionicons
          name={icon as any}
          size={48}
          color="#4b5563"
          style={{ marginBottom: 16 }}
        />
        <Text
          style={{
            color: "#9ca3af",
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: "#6b7280",
            fontSize: 14,
            textAlign: "center",
            lineHeight: 20,
            marginBottom: onAction ? 20 : 0,
          }}
        >
          {message}
        </Text>
        {onAction && actionLabel && (
          <Pressable
            onPress={onAction}
            style={{
              backgroundColor: "#374151",
              borderRadius: 8,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text
              style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}
            >
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }
);
