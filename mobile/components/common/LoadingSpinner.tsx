/**
 * BizPilot Mobile POS — Loading Spinner
 *
 * Full-screen and inline loading indicators.
 */

import React from "react";
import { View, ActivityIndicator, Text } from "react-native";

interface LoadingSpinnerProps {
  /** Message shown below the spinner */
  message?: string;
  /** If true, renders inline instead of full-screen */
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(
  function LoadingSpinner({ message, inline = false }) {
    if (inline) {
      return (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#3b82f6" />
          {message && (
            <Text style={{ color: "#9ca3af", marginTop: 8, fontSize: 14 }}>
              {message}
            </Text>
          )}
        </View>
      );
    }

    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1f2937",
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        {message && (
          <Text style={{ color: "#9ca3af", marginTop: 16, fontSize: 16 }}>
            {message}
          </Text>
        )}
      </View>
    );
  }
);

export default LoadingSpinner;
