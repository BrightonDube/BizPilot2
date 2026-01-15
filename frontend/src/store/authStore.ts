/**
 * Authentication store using Zustand.
 * 
 * Authentication Strategy:
 * - Uses HttpOnly cookies for secure token storage (set by backend)
 * - No tokens are stored in localStorage (prevents XSS attacks)
 * - Cookies are sent automatically with withCredentials: true in API client
 * - User state is persisted in memory/localStorage for UI purposes only
 * 
 * Hydration Strategy:
 * - isInitialized: false until first fetchUser() completes (prevents redirect loops)
 * - _hasHydrated: tracks if Zustand has hydrated from localStorage
 * - Hooks wait for initialization before making redirect decisions
 */

import { create } from 'zustand';
import { AxiosError } from 'axios';
import { apiClient } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string | null;
  is_email_verified: boolean;
  status: string;
  is_admin?: boolean;
  is_superadmin?: boolean;
  subscription_status?: string | null;
  current_tier_id?: string | null;
  current_tier_name?: string | null;
}

interface ApiError {
  detail?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean; // True after first fetchUser() completes
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

// Track if fetchUser is already in progress to prevent concurrent calls
let fetchUserPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: false,
    error: null,

    login: async (email: string, password: string) => {
      set({ isLoading: true, error: null });
      try {
        await apiClient.post('/auth/login', { email, password });
        await get().fetchUser();
        set({ isAuthenticated: true, isLoading: false });
      } catch (err) {
        const error = err as AxiosError<ApiError>;
        const errorMessage = error.response?.data?.detail;

        let userMessage = 'Login failed. Please try again.';
        if (errorMessage) {
          if (
            errorMessage.toLowerCase().includes('invalid credentials') ||
            errorMessage.toLowerCase().includes('incorrect')
          ) {
            userMessage = 'Invalid email or password. Please check your credentials.';
          } else {
            userMessage = errorMessage;
          }
        } else if (error.message === 'Network Error' || !error.response) {
          userMessage =
            'We could not reach the server. Please refresh the page and try again. If this keeps happening, contact support.';
        }

        set({
          error: userMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    register: async (data: RegisterData) => {
      set({ isLoading: true, error: null });
      try {
        // Register the user
        await apiClient.post('/auth/register', data);
        
        // Auto-login after successful registration
        await apiClient.post('/auth/login', { email: data.email, password: data.password });
        await get().fetchUser();
        
        set({ isAuthenticated: true, isLoading: false });
      } catch (err) {
        const error = err as AxiosError<ApiError>;
        const errorMessage = error.response?.data?.detail;

        let userMessage = 'Registration failed. Please try again.';
        if (errorMessage) {
          if (errorMessage.toLowerCase().includes('email already registered')) {
            userMessage =
              'This email is already registered. Please use a different email or try logging in.';
          } else {
            userMessage = errorMessage;
          }
        } else if (error.message === 'Network Error') {
          userMessage = 'Unable to connect to server. Please check your connection.';
        }

        set({
          error: userMessage,
          isLoading: false,
        });
        throw error;
      }
    },

    logout: async () => {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Ignore errors during logout
      }
      set({ user: null, isAuthenticated: false, error: null });
    },

    loginWithGoogle: async (credential: string) => {
      set({ isLoading: true, error: null });
      try {
        await apiClient.post('/oauth/google', { credential });
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
      if (fetchUserPromise) {
        return fetchUserPromise;
      }

      set({ isLoading: true });

      fetchUserPromise = (async () => {
        try {
          const response = await apiClient.get('/auth/me');
          set({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          });
        } finally {
          fetchUserPromise = null;
        }
      })();

      return fetchUserPromise;
    },

    clearError: () => {
      set({ error: null });
    },
  })
);

export default useAuthStore;
