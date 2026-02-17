'use client';

import { useEffect } from 'react';
import PhaserGame from '../../components/PhaserGame';
import RandDiceControls from '../../components/RandDiceControls';
import HomeButton from '../../components/HomeButton';
import { getGameBridge } from '../../game/bridge/GameBridge';

export default function RandDicePage() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // New game: N key
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        const bridge = getGameBridge('rand-dice');
        if (bridge.newGameCallback) bridge.newGameCallback();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen relative">
      <HomeButton />
      <RandDiceControls bridgeId="rand-dice" />
      <div className="flex-1 relative">
        <PhaserGame mode="rand-dice" bridgeId="rand-dice" />
      </div>
    </div>
  );
}
