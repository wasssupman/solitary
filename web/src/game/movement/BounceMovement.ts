import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';

/** Giant parabolic arc with 3 diminishing bounces. */
export class BounceMovement extends CardMovementImpl {
  execute(duration: number): Promise<void> {
    return new Promise<void>(resolve => {
      this.resolvePromise = resolve;
      const n = this.sprites.length;
      const staggerDelay = 50;
      const perCardExtra = 70;

      for (let i = 0; i < n; i++) {
        const sprite = this.sprites[i];
        const sx = this.data.startPositions[i].x;
        const sy = this.data.startPositions[i].y;
        const ex = this.data.endPositions[i].x;
        const ey = this.data.endPositions[i].y;
        const cardDuration = duration + i * perCardExtra;
        const delay = i * staggerDelay;

        const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        const arcHeight = Math.max(150, dist * 0.7);

        const tw = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: cardDuration,
          delay,
          ease: 'Linear',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;
            sprite.x = sx + (ex - sx) * t;

            if (t < 0.5) {
              // Main arc (0 → 0.5): huge parabola
              const at = t / 0.5;
              const parabola = -4 * at * (at - 1);
              sprite.y = sy + (ey - sy) * at - parabola * arcHeight;
              // Spin during flight
              sprite.setRotation(at * Math.PI * 2);
              sprite.setScale(1 + parabola * 0.25);
            } else if (t < 0.7) {
              // Bounce 1 (0.5 → 0.7)
              const bt = (t - 0.5) / 0.2;
              const bounce = -4 * bt * (bt - 1) * (arcHeight * 0.35);
              sprite.y = ey - bounce;
              sprite.setRotation(0);
              sprite.setScale(1 + (-4 * bt * (bt - 1)) * 0.15);
            } else if (t < 0.85) {
              // Bounce 2 (0.7 → 0.85)
              const bt = (t - 0.7) / 0.15;
              const bounce = -4 * bt * (bt - 1) * (arcHeight * 0.12);
              sprite.y = ey - bounce;
              sprite.setScale(1);
            } else {
              // Bounce 3 — tiny settle (0.85 → 1.0)
              const bt = (t - 0.85) / 0.15;
              const bounce = -4 * bt * (bt - 1) * (arcHeight * 0.04);
              sprite.y = ey - bounce;
              sprite.setScale(1);
            }
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
