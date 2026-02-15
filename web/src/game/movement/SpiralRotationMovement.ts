import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';

/** Wild spiral: 3 full rotations with expanding radius and scale pulse. */
export class SpiralRotationMovement extends CardMovementImpl {
  execute(duration: number): Promise<void> {
    return new Promise<void>(resolve => {
      this.resolvePromise = resolve;
      const n = this.sprites.length;
      const staggerDelay = 60;
      const perCardExtra = 80;

      for (let i = 0; i < n; i++) {
        const sprite = this.sprites[i];
        const sx = this.data.startPositions[i].x;
        const sy = this.data.startPositions[i].y;
        const ex = this.data.endPositions[i].x;
        const ey = this.data.endPositions[i].y;
        const cardDuration = duration + i * perCardExtra;
        const delay = i * staggerDelay;
        const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        const radius = Math.max(50, dist * 0.3);

        const tw = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: cardDuration,
          delay,
          ease: 'Sine.easeInOut',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;
            const baseX = sx + (ex - sx) * t;
            const baseY = sy + (ey - sy) * t;
            // 3 full rotations
            const angle = Math.PI * 6 * t;
            const envelope = Math.sin(Math.PI * t) * radius;
            sprite.x = baseX + Math.cos(angle) * envelope;
            sprite.y = baseY + Math.sin(angle) * envelope;
            // Full card rotation
            sprite.setRotation(angle * 0.5);
            // Scale pulse: grow in middle, shrink at ends
            const s = 1 + Math.sin(Math.PI * t) * 0.3;
            sprite.setScale(s);
          },
          onComplete: () => {
            sprite.x = ex;
            sprite.y = ey;
            sprite.setRotation(0);
            sprite.setScale(1);
            if (i === n - 1 && this.resolvePromise) {
              this.resolvePromise();
              this.resolvePromise = null;
            }
          },
        });
        this.tweens.push(tw);
      }
    });
  }
}
