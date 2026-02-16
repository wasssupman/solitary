'use client';

import { useEffect } from 'react';
import PhaserGame from '../../components/PhaserGame';
import HomeButton from '../../components/HomeButton';
import { getGameBridge } from '../../game/bridge/GameBridge';

export default function SurvivorsPage() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z / Cmd+Z
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        getGameBridge('survivors').emit('undo');
      }
      // New game: N key
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        const bridge = getGameBridge('survivors');
        if (bridge.newGameCallback) bridge.newGameCallback();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-dvh max-h-dvh overflow-hidden bg-black relative">
      <HomeButton />
      <div className="flex-1 relative min-h-0">
        <PhaserGame mode="survivors" bridgeId="survivors" />
      </div>
    </div>
  );
}
