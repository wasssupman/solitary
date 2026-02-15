import Phaser from 'phaser';
import type { CardSprite } from '../objects/CardSprite';
import type { LayoutManager } from '../rendering/LayoutManager';
import type { PileType, CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';
import { SineMovement } from './SineMovement';
import { SpiralRotationMovement } from './SpiralRotationMovement';
import { BounceMovement } from './BounceMovement';
import { ZigzagMovement } from './ZigzagMovement';
import { BoomerangMovement } from './BoomerangMovement';
import { ElasticSnapMovement } from './ElasticSnapMovement';
import { HearthstoneMovement } from './HearthstoneMovement';

export type ImplFactory = (
  scene: Phaser.Scene,
  data: CardMovementData,
  sprites: CardSprite[],
) => CardMovementImpl;

/** Randomly selects a movement pattern for each move. */
const randomImplFactory: ImplFactory = (scene, data, sprites) => {
  const r = Math.random();
  if (r < 0.143) return new SineMovement(scene, data, sprites);
  if (r < 0.286) return new SpiralRotationMovement(scene, data, sprites);
  if (r < 0.429) return new BounceMovement(scene, data, sprites);
  if (r < 0.571) return new ZigzagMovement(scene, data, sprites);
  if (r < 0.714) return new BoomerangMovement(scene, data, sprites);
  if (r < 0.857) return new ElasticSnapMovement(scene, data, sprites);
  return new HearthstoneMovement(scene, data, sprites);
};

export class CardMovementRunner {
  private scene: Phaser.Scene;
  private layout: LayoutManager;
  private onComplete: () => void;
  private currentImpl: CardMovementImpl | null = null;
  private _isAnimating = false;
  private _fastForwarded = false;
  private animatedSprites: CardSprite[] = [];
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  implFactory: ImplFactory = randomImplFactory;

  constructor(scene: Phaser.Scene, layout: LayoutManager, onComplete: () => void) {
    this.scene = scene;
    this.layout = layout;
    this.onComplete = onComplete;
  }

  get isAnimating(): boolean {
    return this._isAnimating;
  }

  updateLayout(layout: LayoutManager): void {
    this.layout = layout;
  }

  async runMove(
    movingSprites: CardSprite[],
    from: PileType,
    fromIndex: number,
    to: PileType,
    toIndex: number,
    endPositions: { x: number; y: number }[],
    flipSprite?: CardSprite,
    duration = 1000,
  ): Promise<void> {
    if (movingSprites.length === 0) return;

    // Track animated sprites for cleanup
    this.animatedSprites = movingSprites;
    this._fastForwarded = false;

    // 1. Capture start positions
    const startPositions = movingSprites.map(s => ({ x: s.x, y: s.y }));

    // 2. Build movement data
    const data: CardMovementData = {
      from,
      to,
      fromIndex,
      toIndex,
      cards: movingSprites.map(s => ({ rank: s.rank, suit: s.suit, faceUp: s.faceUp })),
      startPositions,
      endPositions,
    };

    // 3. Raise sprites above all scene objects so they render on top during animation
    for (let i = 0; i < movingSprites.length; i++) {
      movingSprites[i].setDepth(10000 + i);
    }

    // 4. Create particle trail emitters for each sprite (also in layer)
    this.createParticleTrails(movingSprites);

    // 5. Create impl and execute
    this._isAnimating = true;
    this.currentImpl = this.implFactory(this.scene, data, movingSprites);

    try {
      await this.currentImpl.execute(duration);
    } catch {
      // Tween killed during fastForward — that's OK
    }

    // If fastForward was called during execute, it already handled cleanup
    if (this._fastForwarded) return;

    // 6. Flip the revealed card if needed
    if (flipSprite) {
      flipSprite.flip(true, true);
      await new Promise<void>(resolve => {
        this.scene.time.delayedCall(200, resolve);
      });
      // Check again in case fastForward was called during flip delay
      if (this._fastForwarded) return;
    }

    // 7. Destroy particles and animated sprites
    this.destroyParticleTrails();
    this.destroyAnimatedSprites();

    // 8. Animation complete — rebuild sprites from state
    this._isAnimating = false;
    this.currentImpl = null;
    this.onComplete();
  }

  fastForward(): void {
    if (this.currentImpl) {
      this.currentImpl.fastForward();
      this.currentImpl = null;
    }
    // Destroy particles and orphaned animated sprites
    this.destroyParticleTrails();
    this.destroyAnimatedSprites();
    this._isAnimating = false;
    this._fastForwarded = true;
    this.onComplete();
  }

  private createParticleTrails(sprites: CardSprite[]): void {
    if (!this.scene.textures.exists('particle_glow')) return;

    for (const sprite of sprites) {
      const emitter = this.scene.add.particles(0, 0, 'particle_glow', {
        speed: { min: 8, max: 35 },
        lifespan: { min: 250, max: 450 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.85, end: 0 },
        blendMode: 'ADD',
        frequency: 16,
        quantity: 2,
        radial: true,
        rotate: { min: 0, max: 360 },
      });
      emitter.setDepth(10000);
      emitter.startFollow(sprite);
      this.particleEmitters.push(emitter);
    }
  }

  private destroyParticleTrails(): void {
    for (const emitter of this.particleEmitters) {
      emitter.stop();
      emitter.destroy();
    }
    this.particleEmitters = [];
  }

  private destroyAnimatedSprites(): void {
    for (const s of this.animatedSprites) {
      s.destroy();
    }
    this.animatedSprites = [];
  }
}
