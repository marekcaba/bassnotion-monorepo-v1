import { StateCreator, create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

function isValidTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const savedTheme = localStorage.getItem('theme');
  return isValidTheme(savedTheme) ? savedTheme : 'light';
}

const createThemeStore: StateCreator<ThemeState> = (
  set: (fn: (state: ThemeState) => Partial<ThemeState>) => void,
) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    set((state: ThemeState) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    }));
  },
});

export const useThemeStore = create<ThemeState>()(createThemeStore);
