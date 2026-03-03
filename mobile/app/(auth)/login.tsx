/**
 * BizPilot Mobile POS — Login Screen
 *
 * Email/password authentication screen.
 * Tablet-first layout with centered card form.
 *
 * Why a centered card instead of full-width form?
 * On a 10" iPad, full-width inputs look stretched and awkward.
 * A centered card (max 400dp wide) provides a focused, elegant
 * login experience on both phones and tablets.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Button, Input, Card } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { login as authLogin } from "@/services/auth/AuthService";
import { validateEmail, validatePassword } from "@/utils/validators";
import type { MobileUser } from "@/types";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string | null;
    password?: string | null;
  }>({});

  const passwordRef = useRef<TextInput>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleLogin = useCallback(async () => {
    // Validate fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setFieldErrors({ email: emailError, password: passwordError });

    if (emailError || passwordError) return;

    setLoading(true);
    setError(null);

    try {
      const result = await authLogin(email, password);

      if (result.success && result.user) {
        // Map to MobileUser shape for the store
        const mobileUser: MobileUser = {
          id: result.user.id,
          remoteId: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          pinHash: null,
          role: result.user.role as MobileUser["role"],
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          syncedAt: Date.now(),
        };

        setAuth(mobileUser, "token", "refreshToken");
        router.replace("/(tabs)");
      } else {
        setError(result.error ?? "Login failed. Please check your credentials.");
      }
    } catch (err: unknown) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email, password, setAuth]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#1f2937" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 400 }}>
          {/* Brand header */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Text
              style={{
                color: "#3b82f6",
                fontSize: 32,
                fontWeight: "800",
                letterSpacing: 1,
              }}
            >
              BizPilot
            </Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, fontSize: 16 }}>
              Point of Sale
            </Text>
          </View>

          <Card>
            {/* Error banner */}
            {error && (
              <View
                style={{
                  backgroundColor: "#7f1d1d",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#fca5a5", fontSize: 14 }}>
                  {error}
                </Text>
              </View>
            )}

            {/* Email input */}
            <Input
              label="Email"
              placeholder="you@business.co.za"
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            {/* Password input */}
            <Input
              ref={passwordRef}
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />

            {/* Login button */}
            <View style={{ marginTop: 8 }}>
              <Button
                label="Sign In"
                onPress={handleLogin}
                loading={loading}
                size="lg"
              />
            </View>
          </Card>

          {/* PIN login link */}
          <Text
            style={{
              color: "#6b7280",
              textAlign: "center",
              marginTop: 24,
              fontSize: 14,
            }}
          >
            Staff? Use PIN login for quick access
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
