/**
 * Authentication store using Zustand.
 * 
 * Authentication Strategy:
 * - Uses HttpOnly cookies for secure token storage (set by backend)
 * - No tokens are stored in localStorage (prevents XSS attacks)
 * - Cookies are sent automatically with withCredentials: true in API client
 * - User state is persisted in memory/localStorage for UI purposes only
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AxiosError } from 'axios';
import apiClient from '@/lib/api';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_email_verified: boolean;
  status: string;
}

interface ApiError {
  detail?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          // Login endpoint sets HttpOnly cookies automatically
          await apiClient.post('/auth/login', { email, password });
          
          // Fetch user data (cookies will be sent automatically)
          await get().fetchUser();
          set({ isAuthenticated: true, isLoading: false });
        } catch (err) {
          const error = err as AxiosError<ApiError>;
          set({
            error: error.response?.data?.detail || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.post('/auth/register', data);
          set({ isLoading: false });
        } catch (err) {
          const error = err as AxiosError<ApiError>;
          set({
            error: error.response?.data?.detail || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          // Call logout endpoint to clear cookies
          await apiClient.post('/auth/logout');
        } catch {
          // Ignore errors during logout
        }
        set({ user: null, isAuthenticated: false, error: null });
      },

      loginWithGoogle: async (credential: string) => {
        set({ isLoading: true, error: null });
        try {
          // Google OAuth endpoint sets HttpOnly cookies automatically
          await apiClient.post('/oauth/google', { credential });
          
          // Fetch user data (cookies will be sent automatically)
          await get().fetchUser();
          set({ isAuthenticated: true, isLoading: false });
        } catch (err) {
          const error = err as AxiosError<ApiError>;
          set({
            error: error.response?.data?.detail || 'Google login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.post('/auth/forgot-password', { email });
          set({ isLoading: false });
        } catch (err) {
          const error = err as AxiosError<ApiError>;
          set({
            error: error.response?.data?.detail || 'Failed to send reset email',
            isLoading: false,
          });
          throw error;
        }
      },

      resetPassword: async (token: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.post('/auth/reset-password', {
            token,
            new_password: newPassword,
          });
          set({ isLoading: false });
        } catch (err) {
          const error = err as AxiosError<ApiError>;
          set({
            error: error.response?.data?.detail || 'Password reset failed',
            isLoading: false,
          });
          throw error;
        }
      },

      fetchUser: async () => {
        set({ isLoading: true });
        try {
          // Cookies are sent automatically with the request
          const response = await apiClient.get('/auth/me');
          set({ user: response.data, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user data for UI purposes (not security-sensitive)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;
