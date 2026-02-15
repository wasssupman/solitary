'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../game/config';
import { getGameBridge } from '../game/bridge/GameBridge';

function getDpr(): number {
  return typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
}

export default function PhaserGameInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const dpr = getDpr();
    const rect = containerRef.current.getBoundingClientRect();

    const config: Phaser.Types.Core.GameConfig = {
      ...createGameConfig(
        Math.round(rect.width * dpr),
        Math.round(rect.height * dpr),
      ),
      parent: containerRef.current,
    };

    gameRef.current = new Phaser.Game(config);

    // Canvas renders at device pixels, CSS displays at container size
    const canvas = gameRef.current.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Handle resize: update canvas to new device-pixel dimensions
    const container = containerRef.current;
    roRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && gameRef.current) {
          const d = getDpr();
          gameRef.current.scale.resize(
            Math.round(width * d),
            Math.round(height * d),
          );
          // Ensure CSS stays at container size after Phaser resize
          gameRef.current.canvas.style.width = '100%';
          gameRef.current.canvas.style.height = '100%';
        }
      }
    });
    roRef.current.observe(container);

    return () => {
      if (roRef.current) {
        roRef.current.disconnect();
        roRef.current = null;
      }

      const bridge = getGameBridge();
      // Clear direct callbacks BEFORE destroying the game.
      bridge.showHintCallback = null;
      bridge.applySimMoveCallback = null;
      bridge.newGameCallback = null;
      bridge.applyThemeCallback = null;
      // Clear Phaser-side bridge listeners.
      bridge.clearSceneListeners();

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id="phaser-game"
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
