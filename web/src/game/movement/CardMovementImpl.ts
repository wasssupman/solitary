import Phaser from 'phaser';
import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';

export abstract class CardMovementImpl {
  protected scene: Phaser.Scene;
  protected data: CardMovementData;
  protected sprites: CardSprite[];
  protected tweens: Phaser.Tweens.Tween[] = [];
  protected resolvePromise: (() => void) | null = null;

  constructor(scene: Phaser.Scene, data: CardMovementData, sprites: CardSprite[]) {
    this.scene = scene;
    this.data = data;
    this.sprites = sprites;
  }

  abstract execute(duration: number): Promise<void>;

  fastForward(): void {
    // Kill all running tweens
    for (const tw of this.tweens) {
      tw.stop();
    }
    this.tweens = [];

    // Snap sprites to final positions and reset transforms
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].x = this.data.endPositions[i].x;
      this.sprites[i].y = this.data.endPositions[i].y;
      this.sprites[i].setRotation(0);
      this.sprites[i].setScale(1);
    }

    // Resolve the execute() promise
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
  }
}
