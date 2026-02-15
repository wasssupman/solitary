import Phaser from 'phaser';
import { TableScene } from './scenes/TableScene';

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
    scene: [TableScene],
  };
}
