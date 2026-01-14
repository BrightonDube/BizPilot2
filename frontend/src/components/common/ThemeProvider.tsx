'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'bizpilot-theme';

// Helper function to safely get theme from localStorage (SSR-safe)
function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'; // Default during SSR
  }
  const savedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (savedTheme && ['dark', 'light', 'system'].includes(savedTheme)) {
    return savedTheme;
  }
  return 'dark';
}

// Helper function to safely get system theme (SSR-safe)
function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') {
    return 'dark'; // Default during SSR
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize with stored theme (or default) - use function initializer to avoid SSR issues
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => {
    const stored = getStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  });

  // Apply theme class to document
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme === 'system' ? resolvedTheme : theme);
  }, [theme, resolvedTheme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useMemo(() => (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    setResolvedTheme(newTheme === 'system' ? getSystemTheme() : newTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, setTheme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
