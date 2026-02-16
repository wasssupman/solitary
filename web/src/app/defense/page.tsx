'use client';

import { useEffect } from 'react';
import PhaserGame from '../../components/PhaserGame';
import DefenseControls from '../../components/DefenseControls';
import HomeButton from '../../components/HomeButton';
import { getGameBridge } from '../../game/bridge/GameBridge';

export default function DefensePage() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z / Cmd+Z
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        getGameBridge('defense').emit('undo');
      }
      // Hint: H key
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) {
        getGameBridge('defense').emit('requestHintFromUI');
      }
      // New game: N key
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        const bridge = getGameBridge('defense');
        if (bridge.newGameCallback) bridge.newGameCallback();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen relative">
      <HomeButton />
      <DefenseControls bridgeId="defense" />
      <div className="flex-1 relative">
        <PhaserGame mode="defense" bridgeId="defense" />
      </div>
    </div>
  );
}
