import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';

/** Hearthstone-style: lift → weighted glide with subtle arc → overshoot → settle. Heavy and satisfying. */
export class HearthstoneMovement extends CardMovementImpl {
  execute(duration: number): Promise<void> {
    return new Promise<void>(resolve => {
      this.resolvePromise = resolve;
      const n = this.sprites.length;
      const staggerDelay = 40;
      const perCardExtra = 50;

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

        const tw = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: cardDuration,
          delay,
          ease: 'Linear',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;

            if (t < 0.12) {
              // Phase 1: Lift — card rises and scales up (pickup feel)
              const liftT = t / 0.12;
              const eased = 1 - Math.pow(1 - liftT, 3); // ease-out for snappy pickup
              sprite.x = sx + dx * eased * 0.05;
              sprite.y = sy + dy * eased * 0.05 - 25 * eased;
              sprite.setScale(1 + 0.1 * eased);
            } else if (t < 0.82) {
              // Phase 2: Weighted glide — smooth heavy movement with subtle arc
              const glideT = (t - 0.12) / 0.70;
              // Custom weighted easing: fast start, slow middle, accelerate to end
              const eased = glideT < 0.5
                ? 2 * glideT * glideT
                : 1 - Math.pow(-2 * glideT + 2, 2) / 2;
              const progress = 0.05 + 0.93 * eased;

              sprite.x = sx + dx * progress;
              // Subtle perpendicular arc — gives a slight curve to the path
              const arcOffset = Math.sin(Math.PI * glideT) * Math.max(15, dist * 0.06);
              sprite.y = sy + dy * progress + perpY * arcOffset * 0.3 - perpX * arcOffset;
              // Gently correct x for the arc
              sprite.x += perpX * arcOffset * 0.3;

              // Scale settles back smoothly during glide
              sprite.setScale(1.1 - 0.1 * eased);
            } else if (t < 0.94) {
              // Phase 3: Overshoot — slight push past target (satisfying weight)
              const overT = (t - 0.82) / 0.12;
              const overshoot = 0.035;
              const eased = Math.sin(Math.PI * 0.5 * overT);
              sprite.x = ex + dx * overshoot * eased;
              sprite.y = ey + dy * overshoot * eased;
              sprite.setScale(1);
            } else {
              // Phase 4: Settle — gentle ease back to exact target
              const settleT = (t - 0.94) / 0.06;
              const overshoot = 0.035;
              const eased = settleT * settleT; // ease-in for soft landing
              sprite.x = ex + dx * overshoot * (1 - eased);
              sprite.y = ey + dy * overshoot * (1 - eased);
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
