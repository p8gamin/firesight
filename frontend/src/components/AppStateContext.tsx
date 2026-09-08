/**
 * Lightweight app-level state: switches between the immersive hero and the
 * monitoring shell, and remembers the selected location. Uses React context
 * (no extra dependency) so any screen can return to the hero.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Location } from '../types';

interface AppState {
  entered: boolean;
  enter: () => void;
  exitToHero: () => void;
  selectedLocation: Location | null;
  setSelectedLocation: (l: Location | null) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const enter = useCallback(() => setEntered(true), []);
  const exitToHero = useCallback(() => setEntered(false), []);

  return (
    <AppStateContext.Provider value={{ entered, enter, exitToHero, selectedLocation, setSelectedLocation }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
