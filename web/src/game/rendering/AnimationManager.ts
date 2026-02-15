import Phaser from 'phaser';
import type { CardSprite } from '../objects/CardSprite';

export class AnimationManager {
  private scene: Phaser.Scene;
  private queue: (() => Promise<void>)[] = [];
  private running = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Animate card(s) moving to a position */
  moveCard(card: CardSprite, x: number, y: number, duration = 200): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: card,
        x, y,
        duration,
        ease: 'Power2',
        onComplete: () => resolve(),
      });
    });
  }

  /** Animate multiple cards moving together */
  moveCards(cards: CardSprite[], positions: { x: number; y: number }[], duration = 200): Promise<void> {
    if (cards.length === 0) return Promise.resolve();
    return new Promise(resolve => {
      let completed = 0;
      const total = cards.length;
      for (let i = 0; i < total; i++) {
        this.scene.tweens.add({
          targets: cards[i],
          x: positions[i].x,
          y: positions[i].y,
          duration,
          ease: 'Power2',
          onComplete: () => {
            completed++;
            if (completed === total) resolve();
          },
        });
      }
    });
  }

  /** Deal animation: cards fly from stock position to their tableau positions */
  async dealAnimation(
    cards: CardSprite[],
    targets: { x: number; y: number }[],
    stagger = 30,
  ): Promise<void> {
    return new Promise(resolve => {
      let completed = 0;
      for (let i = 0; i < cards.length; i++) {
        this.scene.tweens.add({
          targets: cards[i],
          x: targets[i].x,
          y: targets[i].y,
          duration: 200,
          delay: i * stagger,
          ease: 'Power2',
          onComplete: () => {
            completed++;
            if (completed === cards.length) resolve();
          },
        });
      }
    });
  }

  /** Queue an animation and play sequentially */
  enqueue(fn: () => Promise<void>): void {
    this.queue.push(fn);
    if (!this.running) this.processQueue();
  }

  private async processQueue(): Promise<void> {
    this.running = true;
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
    }
    this.running = false;
  }

  clearQueue(): void {
    this.queue = [];
  }

  get isProcessing(): boolean {
    return this.running;
  }
}
