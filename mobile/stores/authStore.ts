/**
 * BizPilot Mobile POS — Auth Zustand Store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSecureItem, getSecureItem, deleteSecureItem } from "@/services/auth/SecureStorage";
import { apiClient, setAccessToken } from "@/services/api/client";
import type { MobileUser } from "@/types";

interface AuthState {
  user: MobileUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pinUser?: MobileUser | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;

  // Compatibility
  setAuth: (user: MobileUser, token: string, refreshToken: string) => void;
  clearAuth: () => void;
  setPinUser: (user: MobileUser | null) => void;
  updateToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      pinUser: null,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.post("/api/v1/auth/login", { email, password });
          const { access_token, user } = response.data;
          await setSecureItem("auth_token", access_token);
          setAccessToken(access_token);
          set({
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName || user.first_name,
              lastName: user.lastName || user.last_name,
              role: user.role,
            } as any,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.detail || error.message || "Login failed");
        }
      },

      logout: async () => {
        await deleteSecureItem("auth_token");
        setAccessToken(null);
        set({ user: null, token: null, isAuthenticated: false, pinUser: null });
      },

      restoreSession: async () => {
        set({ isLoading: true });
        try {
          const token = await getSecureItem("auth_token");
          if (token) {
            setAccessToken(token);
            set({ token, isAuthenticated: true });
          }
        } catch (error) {
          console.error("[AuthStore] Restore session failed:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      setAuth: (user, token, refreshToken) => {
        setAccessToken(token);
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        setAccessToken(null);
        set({ user: null, token: null, isAuthenticated: false, pinUser: null });
      },
      setPinUser: (user) => set({ pinUser: user }),
      updateToken: (token) => {
        setAccessToken(token);
        set({ token });
      },
    }),
    {
      name: "bizpilot-auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
