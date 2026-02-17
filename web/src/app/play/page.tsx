'use client';

import { useEffect } from 'react';
import PhaserGame from '../../components/PhaserGame';
import PlayControls from '../../components/PlayControls';
import HomeButton from '../../components/HomeButton';
import { getGameBridge } from '../../game/bridge/GameBridge';

export default function PlayPage() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z / Cmd+Z
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        getGameBridge('play').emit('undo');
      }
      // Hint: H key
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) {
        getGameBridge('play').emit('requestHintFromUI');
      }
      // New game: N key
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        getGameBridge('play').emit('newGame');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen relative">
      <HomeButton />
      <PlayControls />
      <div className="flex-1 relative pt-8">
        <PhaserGame mode="play" bridgeId="play" />
      </div>
    </div>
  );
}
