import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';

/** Rubber-band snap: rockets to target in 30%, then violent spring oscillation. */
export class ElasticSnapMovement extends CardMovementImpl {
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
        const springAmp = Math.max(50, dist * 0.3);

        const tw = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: cardDuration,
          delay,
          ease: 'Linear',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;

            // Rocket to target in first 30%
            const travelT = Math.min(1, t / 0.3);
            const eased = 1 - Math.pow(1 - travelT, 4); // quartic ease-out (very fast start)

            const baseX = sx + dx * eased;
            const baseY = sy + dy * eased;

            // Violent spring oscillation after arrival
            let springOffset = 0;
            let springRot = 0;
            if (t > 0.3) {
              const springT = (t - 0.3) / 0.7;
              // Aggressive damped oscillation: 8 oscillations
              const decay = Math.exp(-springT * 4);
              springOffset = Math.sin(springT * Math.PI * 8) * springAmp * decay;
              springRot = Math.sin(springT * Math.PI * 8) * 0.5 * decay;
            }

            sprite.x = baseX + perpX * springOffset;
            sprite.y = baseY + perpY * springOffset;
            sprite.setRotation(springRot);

            // Impact scale punch
            if (t > 0.28 && t < 0.4) {
              const impactT = (t - 0.28) / 0.12;
              sprite.setScale(1 + Math.sin(Math.PI * impactT) * 0.35);
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
