import { LayoutManager } from '../rendering/LayoutManager';
import type { SpriteManager } from '../sprites/SpriteManager';
import type { SolitaireCore } from '../core/SolitaireCore';
import type { CardSprite } from '../objects/CardSprite';

export class DropTargetResolver {
  constructor(
    private layout: LayoutManager,
    private sprites: SpriteManager,
    private core: SolitaireCore,
  ) {}

  findTarget(
    x: number, y: number, card: CardSprite,
  ): { pile: 'tableau' | 'foundation'; index: number } | null {
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    const threshold = cw * 0.6;

    // Check foundations (only single card drops)
    for (let fi = 0; fi < 4; fi++) {
      const pos = this.layout.getFoundationPosition(fi);
      if (Math.abs(x - pos.x) < threshold && Math.abs(y - pos.y) < threshold) {
        if (this.core.canDropOnFoundation(card.rank, card.suit, fi)) {
          return { pile: 'foundation', index: fi };
        }
      }
    }

    // Check tableau columns
    for (let col = 0; col < 7; col++) {
      const colCards = this.sprites.tableauSprites[col];
      let targetY: number;
      if (colCards.length === 0) {
        targetY = this.layout.getTableauY(col, 0, 0);
      } else {
        const lastCard = colCards[colCards.length - 1];
        targetY = lastCard.y;
      }
      const colX = this.layout.getTableauX(col);

      if (Math.abs(x - colX) < threshold && Math.abs(y - targetY) < ch) {
        if (this.core.canDropOnTableau(card.rank, card.suit < 2, col)) {
          return { pile: 'tableau', index: col };
        }
      }
    }

    return null;
  }

  updateLayout(layout: LayoutManager): void {
    this.layout = layout;
  }
}
