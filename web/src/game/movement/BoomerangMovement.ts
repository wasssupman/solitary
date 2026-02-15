import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';

/** Wild boomerang: rockets past target, full 720° spin, curves back dramatically. */
export class BoomerangMovement extends CardMovementImpl {
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

        const dx = ex - sx;
        const dy = ey - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const perpX = dist > 0 ? -dy / dist : 0;
        const perpY = dist > 0 ? dx / dist : 1;
        const overshoot = 0.5;

        const tw = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: cardDuration,
          delay,
          ease: 'Linear',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;

            // Path: rush to 150% of target, then curve back
            let pathT: number;
            if (t < 0.45) {
              // Accelerate past target
              const eased = Math.pow(t / 0.45, 0.7);
              pathT = eased * (1 + overshoot);
            } else {
              // Decelerate back to target
              const retT = (t - 0.45) / 0.55;
              const eased = 1 - Math.pow(1 - retT, 2);
              pathT = (1 + overshoot) - overshoot * eased;
            }

            const baseX = sx + dx * pathT;
            const baseY = sy + dy * pathT;

            // Wide perpendicular curve on return
            const curveOffset = t > 0.4
              ? Math.sin(Math.PI * ((t - 0.4) / 0.6)) * Math.max(60, dist * 0.3)
              : 0;

            sprite.x = baseX + perpX * curveOffset;
            sprite.y = baseY + perpY * curveOffset;

            // 720° spin during overshoot zone
            if (t > 0.3 && t < 0.75) {
              const spinT = (t - 0.3) / 0.45;
              sprite.setRotation(Math.PI * 4 * spinT);
            } else {
              sprite.setRotation(0);
            }

            // Scale: grow during overshoot, shrink back
            if (t > 0.3 && t < 0.6) {
              const growT = (t - 0.3) / 0.3;
              sprite.setScale(1 + Math.sin(Math.PI * growT) * 0.4);
            } else {
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
