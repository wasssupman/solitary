import type { CardSprite } from '../objects/CardSprite';
import type { CardMovementData } from './CardMovementData';
import { CardMovementImpl } from './CardMovementImpl';

/** Triple-sine wave with dramatic weaving and tilt. */
export class SineMovement extends CardMovementImpl {
  execute(duration: number): Promise<void> {
    return new Promise<void>(resolve => {
      this.resolvePromise = resolve;
      const staggerDelay = 60;
      const perCardExtra = 80;
      const n = this.sprites.length;

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
        const amp = Math.max(80, dist * 0.4);

        const tw = this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: cardDuration,
          delay,
          ease: 'Sine.easeInOut',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;
            const baseX = sx + dx * t;
            const baseY = sy + dy * t;
            // Triple sine: large sweep + medium wave + small flutter
            const sweep = Math.sin(Math.PI * t) * amp;
            const wave = Math.sin(Math.PI * 3 * t) * (amp * 0.35);
            const flutter = Math.sin(Math.PI * 7 * t) * (amp * 0.1);
            const offset = sweep + wave + flutter;
            sprite.x = baseX + perpX * offset;
            sprite.y = baseY + perpY * offset;
            // Dramatic tilt follows the wave direction
            sprite.setRotation(Math.sin(Math.PI * 3 * t) * 0.35);
            // Slight scale pulse
            sprite.setScale(1 + Math.sin(Math.PI * 2 * t) * 0.1);
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
