import Phaser from 'phaser';
import { PlayScene } from './scenes/PlayScene';
import { SimulateScene } from './scenes/SimulateScene';
import { DefenseScene } from './scenes/DefenseScene';
import { ReplayScene } from './scenes/ReplayScene';

export function createGameConfig(width: number, height: number): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    backgroundColor: 0x35654d,
    width,
    height,
    scale: {
      mode: Phaser.Scale.NONE,
    },
    render: {
      pixelArt: false,
      antialias: true,
    },
    // Scenes are added manually — no auto-start (avoids double create on restart)
    scene: [],
  };
}

export { PlayScene, SimulateScene, DefenseScene, ReplayScene };
