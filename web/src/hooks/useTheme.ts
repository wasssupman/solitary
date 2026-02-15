'use client';

import { useState, useCallback } from 'react';
import { THEMES, DEFAULT_THEME_ID } from '../game/themes/themes';
import { getGameBridge } from '../game/bridge/GameBridge';

const STORAGE_KEY = 'solitaire-theme';

function getStoredThemeId(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && THEMES[stored] ? stored : DEFAULT_THEME_ID;
}

export function useTheme() {
  const [themeId, setThemeIdState] = useState(getStoredThemeId);

  const setTheme = useCallback((id: string) => {
    if (!THEMES[id]) return;
    setThemeIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    const bridge = getGameBridge();
    if (bridge.applyThemeCallback) {
      bridge.applyThemeCallback(id);
    } else {
      bridge.emit('setTheme', id);
    }
  }, []);

  const themes = Object.values(THEMES).map(t => ({ id: t.id, name: t.name }));

  return { themeId, setTheme, themes };
}
