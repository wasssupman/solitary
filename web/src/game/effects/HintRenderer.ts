import Phaser from 'phaser';
import { LayoutManager } from '../rendering/LayoutManager';
import type { SpriteManager } from '../sprites/SpriteManager';
import { ActionType, type Move } from '../../solver/types';

export class HintRenderer {
  private hintGraphics: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private scene: Phaser.Scene,
    private layout: LayoutManager,
    private sprites: SpriteManager,
  ) {}

  show(move: Move): void {
    if (!move) return;
    this.clear();

    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    const hw = cw / 2 + 6;
    const hh = ch / 2 + 6;
    const at = Number(move.actionType);

    // Source highlight (gold glow)
    let srcPos: { x: number; y: number } | null = null;

    if (move.stockTurns > 0) {
      srcPos = this.layout.getStockPosition();
    } else if (at === ActionType.TABLEAU_TO_FOUNDATION || at === ActionType.TABLEAU_TO_TABLEAU) {
      const col = this.sprites.tableauSprites[move.srcIdx];
      if (col.length > 0) {
        const idx = Math.max(0, col.length - move.numCards);
        srcPos = { x: col[idx].x, y: col[idx].y };
      }
    } else if (at === ActionType.WASTE_TO_FOUNDATION || at === ActionType.WASTE_TO_TABLEAU) {
      if (this.sprites.wasteSprites.length > 0) {
        const top = this.sprites.wasteSprites[this.sprites.wasteSprites.length - 1];
        srcPos = { x: top.x, y: top.y };
      }
    } else if (at === ActionType.FOUNDATION_TO_TABLEAU) {
      const pile = this.sprites.foundationSprites[move.srcIdx];
      if (pile.length > 0) {
        const top = pile[pile.length - 1];
        srcPos = { x: top.x, y: top.y };
      }
    }

    if (srcPos) {
      const g1 = this.scene.add.graphics();
      g1.setDepth(2000);
      g1.lineStyle(4, 0xffd700, 1);
      g1.strokeRoundedRect(srcPos.x - hw, srcPos.y - hh, hw * 2, hh * 2, 8);
      this.hintGraphics.push(g1);

      this.scene.tweens.add({
        targets: g1,
        alpha: { from: 1, to: 0.3 },
        duration: 600,
        yoyo: true,
        repeat: 4,
      });
    }

    // Destination highlight (green)
    let destPos: { x: number; y: number } | null = null;
    if (at === ActionType.TABLEAU_TO_FOUNDATION || at === ActionType.WASTE_TO_FOUNDATION) {
      destPos = this.layout.getFoundationPosition(move.destIdx);
    } else if (at === ActionType.TABLEAU_TO_TABLEAU || at === ActionType.WASTE_TO_TABLEAU || at === ActionType.FOUNDATION_TO_TABLEAU) {
      const col = this.sprites.tableauSprites[move.destIdx];
      if (col.length === 0) {
        destPos = {
          x: this.layout.getTableauX(move.destIdx),
          y: this.layout.getTableauY(move.destIdx, 0, 0),
        };
      } else {
        const last = col[col.length - 1];
        destPos = { x: last.x, y: last.y + this.layout.faceUpOverlap };
      }
    }

    if (destPos) {
      const g2 = this.scene.add.graphics();
      g2.setDepth(2000);
      g2.lineStyle(4, 0x00ff88, 1);
      g2.strokeRoundedRect(destPos.x - hw, destPos.y - hh, hw * 2, hh * 2, 8);
      this.hintGraphics.push(g2);

      this.scene.tweens.add({
        targets: g2,
        alpha: { from: 1, to: 0.3 },
        duration: 600,
        yoyo: true,
        repeat: 4,
      });
    }

    // Stock turns hint text
    if (move.stockTurns > 0) {
      const stockPos = this.layout.getStockPosition();
      const text = this.scene.add.text(
        stockPos.x, stockPos.y - ch / 2 - 16,
        `Click stock ${move.stockTurns}x`,
        { fontSize: '12px', fontFamily: 'Arial', color: '#ffd700', align: 'center' },
      ).setOrigin(0.5).setDepth(2001);
      this.hintGraphics.push(text);
    }

    // Auto-dismiss after 5 seconds
    this.scene.time.delayedCall(5000, () => this.clear());
  }

  clear(): void {
    for (const g of this.hintGraphics) {
      this.scene.tweens.killTweensOf(g);
      g.destroy();
    }
    this.hintGraphics = [];
  }

  updateLayout(layout: LayoutManager): void {
    this.layout = layout;
  }
}
