/**
 * Authentication store using Zustand.
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
  logout: () => void;
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
          const response = await apiClient.post('/auth/login', { email, password });
          const { access_token, refresh_token } = response.data;
          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          // Fetch user data
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

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, isAuthenticated: false, error: null });
      },

      loginWithGoogle: async (credential: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post('/oauth/google', { credential });
          const { access_token, refresh_token } = response.data;
          
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          // Fetch user data
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
        try {
          const response = await apiClient.get('/auth/me');
          set({ user: response.data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;
