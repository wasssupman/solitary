import Phaser from 'phaser';
import { CardSprite } from '../objects/CardSprite';
import { PileZone } from '../objects/PileZone';
import { LayoutManager } from '../rendering/LayoutManager';
import type { ThemeConfig } from '../themes/ThemeConfig';
import type { SolitaireState } from '../../solver/SolitaireState';

export class SpriteManager {
  tableauSprites: CardSprite[][] = [[], [], [], [], [], [], []];
  foundationSprites: CardSprite[][] = [[], [], [], []];
  stockSprites: CardSprite[] = [];
  wasteSprites: CardSprite[] = [];
  pileZones: PileZone[] = [];
  stockCountText: Phaser.GameObjects.Text | null = null;
  stockClickZone: Phaser.GameObjects.Zone | null = null;

  constructor(
    private scene: Phaser.Scene,
    private layout: LayoutManager,
    private theme: ThemeConfig,
  ) {}

  buildFromState(state: SolitaireState): void {
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    let depth = 0;

    // Stock
    const stockPos = this.layout.getStockPosition();
    for (const c of state.stock) {
      const s = new CardSprite(this.scene, stockPos.x, stockPos.y, c.rank, c._sv, false, cw, ch);
      s.setDepth(depth++);
      this.stockSprites.push(s);
    }

    // Stock count label
    if (this.stockCountText) {
      this.stockCountText.destroy();
      this.stockCountText = null;
    }
    if (state.stock.length > 0) {
      const fontSize = Math.round(cw * 0.22);
      this.stockCountText = this.scene.add.text(
        stockPos.x + cw * 0.38, stockPos.y - ch * 0.38,
        `${state.stock.length}`,
        { fontSize: `${fontSize}px`, color: '#ffffff', fontFamily: 'monospace',
          backgroundColor: '#00000088', padding: { x: 3, y: 1 } },
      );
      this.stockCountText.setOrigin(0.5, 0.5);
      this.stockCountText.setDepth(depth++);
    }

    // Waste
    const wastePos = this.layout.getWastePosition();
    for (const c of state.waste) {
      const s = new CardSprite(this.scene, wastePos.x, wastePos.y, c.rank, c._sv, true, cw, ch);
      s.setDepth(depth++);
      this.wasteSprites.push(s);
    }

    // Foundations
    for (let fi = 0; fi < 4; fi++) {
      const pos = this.layout.getFoundationPosition(fi);
      for (const c of state.foundation[fi]) {
        const s = new CardSprite(this.scene, pos.x, pos.y, c.rank, c._sv, true, cw, ch);
        s.setDepth(depth++);
        this.foundationSprites[fi].push(s);
      }
    }

    // Tableau
    for (let col = 0; col < 7; col++) {
      const cards = state.tableau[col];
      let fdCount = 0;
      let fuIndex = 0;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const x = this.layout.getTableauX(col);
        let y: number;
        if (!c.faceUp) {
          y = this.layout.getTableauY(col, i, 0);
          fdCount = i + 1;
        } else {
          fuIndex = i - fdCount;
          y = this.layout.getTableauY(col, fdCount, fuIndex);
        }
        const s = new CardSprite(this.scene, x, y, c.rank, c._sv, c.faceUp, cw, ch);
        s.setDepth(depth++);
        this.tableauSprites[col].push(s);
      }
    }
  }

  rebuild(state: SolitaireState): void {
    this.clearAll();
    this.tableauSprites = [[], [], [], [], [], [], []];
    this.foundationSprites = [[], [], [], []];
    this.stockSprites = [];
    this.wasteSprites = [];
    this.buildFromState(state);
  }

  clearAll(): void {
    const destroyArr = (arr: CardSprite[]) => {
      for (const s of arr) s.destroy();
      arr.length = 0;
    };
    for (const col of this.tableauSprites) destroyArr(col);
    for (const pile of this.foundationSprites) destroyArr(pile);
    destroyArr(this.stockSprites);
    destroyArr(this.wasteSprites);
    if (this.stockCountText) {
      this.stockCountText.destroy();
      this.stockCountText = null;
    }
  }

  reposition(state: SolitaireState): void {
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;

    const stockPos = this.layout.getStockPosition();
    for (const s of this.stockSprites) {
      s.setPosition(stockPos.x, stockPos.y);
      s.resizeCard(cw, ch);
    }

    const wastePos = this.layout.getWastePosition();
    for (const s of this.wasteSprites) {
      s.setPosition(wastePos.x, wastePos.y);
      s.resizeCard(cw, ch);
    }

    for (let fi = 0; fi < 4; fi++) {
      const pos = this.layout.getFoundationPosition(fi);
      for (const s of this.foundationSprites[fi]) {
        s.setPosition(pos.x, pos.y);
        s.resizeCard(cw, ch);
      }
    }

    for (let col = 0; col < 7; col++) {
      const colCards = this.tableauSprites[col];
      const stateCol = state.tableau[col];
      let fdCount = 0;
      for (let i = 0; i < colCards.length; i++) {
        const x = this.layout.getTableauX(col);
        let y: number;
        if (!stateCol[i].faceUp) {
          y = this.layout.getTableauY(col, i, 0);
          fdCount = i + 1;
        } else {
          y = this.layout.getTableauY(col, fdCount, i - fdCount);
        }
        colCards[i].setPosition(x, y);
        colCards[i].resizeCard(cw, ch);
      }
    }
  }

  createPileZones(): void {
    for (const z of this.pileZones) z.destroy();
    this.pileZones = [];

    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    const oc = this.theme.pileOutlineColor;
    const oa = this.theme.pileOutlineAlpha;

    const stockPos = this.layout.getStockPosition();
    this.pileZones.push(new PileZone(this.scene, stockPos.x, stockPos.y, cw, ch, 'stock', 0, oc, oa));

    const wastePos = this.layout.getWastePosition();
    this.pileZones.push(new PileZone(this.scene, wastePos.x, wastePos.y, cw, ch, 'waste', 0, oc, oa));

    for (let i = 0; i < 4; i++) {
      const pos = this.layout.getFoundationPosition(i);
      this.pileZones.push(new PileZone(this.scene, pos.x, pos.y, cw, ch, 'foundation', i, oc, oa));
    }

    for (let col = 0; col < 7; col++) {
      const x = this.layout.getTableauX(col);
      const y = this.layout.getTableauY(col, 0, 0);
      this.pileZones.push(new PileZone(this.scene, x, y, cw, ch, 'tableau', col, oc, oa));
    }
  }

  destroyPileZones(): void {
    for (const z of this.pileZones) z.destroy();
    this.pileZones = [];
  }

  computeEndPositions(
    toPile: 'tableau' | 'foundation',
    toIndex: number,
    numCards: number,
    state: SolitaireState,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    if (toPile === 'foundation') {
      const pos = this.layout.getFoundationPosition(toIndex);
      for (let i = 0; i < numCards; i++) {
        positions.push({ x: pos.x, y: pos.y });
      }
    } else {
      const stateCol = state.tableau[toIndex];
      const colLen = stateCol.length;
      const baseIdx = colLen - numCards;
      let fdCount = 0;
      for (let i = 0; i < baseIdx; i++) {
        if (!stateCol[i].faceUp) fdCount = i + 1;
      }
      for (let i = 0; i < numCards; i++) {
        const idx = baseIdx + i;
        const fuIdx = idx - fdCount;
        const x = this.layout.getTableauX(toIndex);
        const y = this.layout.getTableauY(toIndex, fdCount, fuIdx);
        positions.push({ x, y });
      }
    }
    return positions;
  }

  updateLayout(layout: LayoutManager): void {
    this.layout = layout;
  }

  updateTheme(theme: ThemeConfig): void {
    this.theme = theme;
  }
}
