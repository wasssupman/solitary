'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig, PlayScene, SimulateScene, DefenseScene, ReplayScene, SurvivorsScene, RandDiceScene } from '../game/config';
import { getGameBridge } from '../game/bridge/GameBridge';

function getDpr(): number {
  return typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
}

interface Props {
  mode?: 'play' | 'simulate' | 'defense' | 'replay' | 'survivors' | 'rand-dice';
  bridgeId?: string;
}

export default function PhaserGameInner({ mode = 'play', bridgeId = 'default' }: Props) {
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

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Add and start only the scene needed for this mode (no auto-start, no restart)
    const SceneClass = mode === 'simulate' ? SimulateScene : mode === 'defense' ? DefenseScene : mode === 'replay' ? ReplayScene : mode === 'survivors' ? SurvivorsScene : mode === 'rand-dice' ? RandDiceScene : PlayScene;
    const sceneKey = mode === 'simulate' ? 'SimulateScene' : mode === 'defense' ? 'DefenseScene' : mode === 'replay' ? 'ReplayScene' : mode === 'survivors' ? 'SurvivorsScene' : mode === 'rand-dice' ? 'RandDiceScene' : 'PlayScene';

    game.events.once('ready', () => {
      game.scene.add(sceneKey, SceneClass, true, { bridgeId });
    });

    // Canvas renders at device pixels, CSS displays at container size
    const canvas = game.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Handle resize
    const container = containerRef.current;
    roRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Minimum 64px to avoid WebGL framebuffer errors
        if (width >= 64 && height >= 64 && gameRef.current) {
          const d = getDpr();
          gameRef.current.scale.resize(
            Math.round(width * d),
            Math.round(height * d),
          );
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

      const bridge = getGameBridge(bridgeId);
      if (bridge.sceneCleanupCallback) {
        bridge.sceneCleanupCallback();
      }
      bridge.sceneCleanupCallback = null;
      bridge.showHintCallback = null;
      bridge.applySimMoveCallback = null;
      bridge.newGameCallback = null;
      bridge.applyThemeCallback = null;
      bridge.endCardPhaseCallback = null;
      bridge.startBattleCallback = null;
      bridge.setBattleSpeedCallback = null;
      bridge.deployUnitCallback = null;
      bridge.loadRecordingCallback = null;
      bridge.replayStepCallback = null;
      bridge.clearSceneListeners();

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [mode, bridgeId]);

  return (
    <div
      id="phaser-game"
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
