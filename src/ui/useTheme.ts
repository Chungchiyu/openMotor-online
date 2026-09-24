import { useEffect, useState } from 'react';

const STORAGE_KEY = 'openmotor-online:theme:v1';

export type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Follows the OS light/dark preference until the user manually toggles, at which point the
 * explicit choice is pinned and persisted; the OS listener is only active while no explicit
 * choice has been made.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [stored, setStored] = useState<Theme | null>(() => loadStoredTheme());
  const [system, setSystem] = useState<Theme>(() => systemTheme());

  useEffect(() => {
    if (stored) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [stored]);

  const theme = stored ?? system;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setStored(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort persistence only
    }
  };

  return { theme, toggleTheme };
}
