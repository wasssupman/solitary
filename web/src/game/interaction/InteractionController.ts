import Phaser from 'phaser';
import { CardSprite } from '../objects/CardSprite';
import { LayoutManager } from '../rendering/LayoutManager';
import type { SpriteManager } from '../sprites/SpriteManager';
import type { SolitaireCore } from '../core/SolitaireCore';
import type { CardMovementRunner } from '../movement/CardMovementRunner';
import { DropTargetResolver } from './DropTargetResolver';
import { makeCard, makeMove, ActionType, type Move } from '../../solver/types';

interface DragData {
  cards: CardSprite[];
  originX: number[];
  originY: number[];
  originDepths: number[];
  sourcePile: 'tableau' | 'waste' | 'foundation';
  sourceIndex: number;
  cardIndex: number;
}

export class InteractionController {
  private dragData: DragData | null = null;
  private dropResolver: DropTargetResolver;

  constructor(
    private scene: Phaser.Scene,
    private sprites: SpriteManager,
    private layout: LayoutManager,
    private core: SolitaireCore,
    private moveRunner: CardMovementRunner,
    private onMoveAnimated: (movingSprites: CardSprite[], fromPile: string, fromIndex: number,
      toPile: string, toIndex: number, endPositions: { x: number; y: number }[],
      flipSprite?: CardSprite) => void,
    private onWin: () => void,
    private onHintClear: () => void,
  ) {
    this.dropResolver = new DropTargetResolver(layout, sprites, core);
  }

  enable(): void {
    // Stock click zone
    const stockPos = this.layout.getStockPosition();
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;

    if (!this.sprites.stockClickZone) {
      this.sprites.stockClickZone = this.scene.add.zone(stockPos.x, stockPos.y, cw, ch).setInteractive();
      this.sprites.stockClickZone.on('pointerdown', () => this.onStockClick());
    } else {
      this.sprites.stockClickZone.setPosition(stockPos.x, stockPos.y);
      this.sprites.stockClickZone.setSize(cw, ch);
    }

    this.updateStockInteraction();
    this.updateCardInteractivity();
  }

  disable(): void {
    if (this.sprites.stockClickZone) {
      this.sprites.stockClickZone.destroy();
      this.sprites.stockClickZone = null;
    }
  }

  refresh(): void {
    this.updateStockInteraction();
    this.updateCardInteractivity();
  }

  private updateStockInteraction(): void {
    if (this.sprites.stockSprites.length > 0) {
      const top = this.sprites.stockSprites[this.sprites.stockSprites.length - 1];
      top.setInteractive();
      top.removeAllListeners('pointerdown');
      top.on('pointerdown', () => this.onStockClick());
    }
  }

  private updateCardInteractivity(): void {
    // Waste top card: draggable + double-click
    for (const s of this.sprites.wasteSprites) {
      s.removeInteractive();
      s.removeAllListeners();
    }
    if (this.sprites.wasteSprites.length > 0) {
      const top = this.sprites.wasteSprites[this.sprites.wasteSprites.length - 1];
      this.makeCardDraggable(top, 'waste', 0, this.sprites.wasteSprites.length - 1);
      top.on('pointerdown', () => {
        const now = Date.now();
        const last = (top as unknown as { _lastClick?: number })._lastClick ?? 0;
        (top as unknown as { _lastClick: number })._lastClick = now;
        if (now - last < 300) {
          this.autoMoveToFoundation('waste', 0);
        }
      });
    }

    // Tableau cards: face-up cards are draggable
    for (let col = 0; col < 7; col++) {
      const colCards = this.sprites.tableauSprites[col];
      for (let i = 0; i < colCards.length; i++) {
        const s = colCards[i];
        s.removeInteractive();
        s.removeAllListeners();
        if (s.faceUp) {
          this.makeCardDraggable(s, 'tableau', col, i);
          if (i === colCards.length - 1) {
            s.on('pointerdown', () => {
              const now = Date.now();
              const last = (s as unknown as { _lastClick?: number })._lastClick ?? 0;
              (s as unknown as { _lastClick: number })._lastClick = now;
              if (now - last < 300) {
                this.autoMoveToFoundation('tableau', col);
              }
            });
          }
        }
      }
    }

    // Foundation top cards: draggable back to tableau
    for (let fi = 0; fi < 4; fi++) {
      const pile = this.sprites.foundationSprites[fi];
      for (const s of pile) {
        s.removeInteractive();
        s.removeAllListeners();
      }
      if (pile.length > 0) {
        const top = pile[pile.length - 1];
        this.makeCardDraggable(top, 'foundation', fi, pile.length - 1);
      }
    }
  }

  private makeCardDraggable(
    sprite: CardSprite,
    pile: 'tableau' | 'waste' | 'foundation',
    pileIndex: number,
    cardIndex: number,
  ): void {
    sprite.setInteractive({ draggable: true });
    this.scene.input.setDraggable(sprite);

    sprite.on('dragstart', () => {
      if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); return; }
      this.onHintClear();

      const cards: CardSprite[] = [];
      const originX: number[] = [];
      const originY: number[] = [];
      const originDepths: number[] = [];

      if (pile === 'tableau') {
        const col = this.sprites.tableauSprites[pileIndex];
        for (let i = cardIndex; i < col.length; i++) {
          cards.push(col[i]);
          originX.push(col[i].x);
          originY.push(col[i].y);
          originDepths.push(col[i].depth);
          col[i].setDepth(10000 + i);
        }
      } else {
        cards.push(sprite);
        originX.push(sprite.x);
        originY.push(sprite.y);
        originDepths.push(sprite.depth);
        sprite.setDepth(10000);
      }

      this.dragData = {
        cards, originX, originY, originDepths,
        sourcePile: pile, sourceIndex: pileIndex, cardIndex,
      };
    });

    sprite.on('drag', (_p: unknown, dragX: number, dragY: number) => {
      if (!this.dragData) return;
      const dx = dragX - this.dragData.originX[0];
      const dy = dragY - this.dragData.originY[0];
      for (let i = 0; i < this.dragData.cards.length; i++) {
        this.dragData.cards[i].x = this.dragData.originX[i] + dx;
        this.dragData.cards[i].y = this.dragData.originY[i] + dy;
      }
    });

    sprite.on('dragend', () => {
      if (!this.dragData) return;
      const dd = this.dragData;
      this.dragData = null;

      const dropCard = dd.cards[0];
      if (!dropCard) return;
      const target = this.dropResolver.findTarget(dropCard.x, dropCard.y, dropCard);

      if (target) {
        this.executePlayerMove(dd, target);
      } else {
        // Snap back
        for (let i = 0; i < dd.cards.length; i++) {
          dd.cards[i].x = dd.originX[i];
          dd.cards[i].y = dd.originY[i];
          dd.cards[i].setDepth(dd.originDepths[i]);
        }
      }
    });
  }

  private executePlayerMove(
    dd: DragData,
    target: { pile: 'tableau' | 'foundation'; index: number },
  ): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); return; }

    const card = dd.cards[0];
    const numCards = dd.cards.length;
    const c = makeCard(card.rank, card.suit as 0 | 1 | 2 | 3, true);

    let move: Move;
    if (dd.sourcePile === 'waste') {
      move = target.pile === 'foundation'
        ? makeMove(ActionType.WASTE_TO_FOUNDATION, -1, target.index, c)
        : makeMove(ActionType.WASTE_TO_TABLEAU, -1, target.index, c);
    } else if (dd.sourcePile === 'tableau') {
      move = target.pile === 'foundation'
        ? makeMove(ActionType.TABLEAU_TO_FOUNDATION, dd.sourceIndex, target.index, c)
        : makeMove(ActionType.TABLEAU_TO_TABLEAU, dd.sourceIndex, target.index, c, numCards);
    } else {
      move = makeMove(ActionType.FOUNDATION_TO_TABLEAU, dd.sourceIndex, target.index, c);
    }

    // Extract moving sprites from source pile
    const movingSprites = dd.cards;
    if (dd.sourcePile === 'tableau') {
      this.sprites.tableauSprites[dd.sourceIndex].splice(dd.cardIndex, numCards);
    } else if (dd.sourcePile === 'waste') {
      this.sprites.wasteSprites.pop();
    } else {
      this.sprites.foundationSprites[dd.sourceIndex].pop();
    }

    // Identify flip sprite
    let flipSprite: CardSprite | undefined;
    if (dd.sourcePile === 'tableau') {
      const srcCol = this.sprites.tableauSprites[dd.sourceIndex];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    }

    // Execute move on core (emits events)
    this.core.executeMove(move);

    // Compute end positions & animate
    const endPositions = this.sprites.computeEndPositions(target.pile, target.index, numCards, this.core.state);
    this.onMoveAnimated(movingSprites, dd.sourcePile, dd.sourceIndex, target.pile, target.index, endPositions, flipSprite);
  }

  private onStockClick(): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }
    this.onHintClear();

    const result = this.core.drawStock();
    if (!result) return;

    if (result.wasReset) {
      // Full rebuild for stock reset
      return; // core event handler will rebuild sprites
    }

    // Animate drawn cards
    const movingSprites: CardSprite[] = [];
    for (let d = 0; d < result.drawnCount; d++) {
      const s = this.sprites.stockSprites.pop();
      if (s) {
        s.flip(true, false);
        movingSprites.push(s);
      }
    }

    const wastePos = this.layout.getWastePosition();
    const endPositions = movingSprites.map(() => ({ x: wastePos.x, y: wastePos.y }));
    this.onMoveAnimated(movingSprites, 'stock', 0, 'waste', 0, endPositions);
  }

  private autoMoveToFoundation(pile: 'tableau' | 'waste', pileIndex: number): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }

    const fi = this.core.canAutoMoveToFoundation(pile, pileIndex);
    if (fi === null) return;

    this.onHintClear();

    // Get card info before move
    const state = this.core.state;
    const card = pile === 'waste'
      ? state.waste[state.waste.length - 1]
      : state.tableau[pileIndex][state.tableau[pileIndex].length - 1];

    // Extract sprite
    let movingSprite: CardSprite;
    let flipSprite: CardSprite | undefined;
    if (pile === 'waste') {
      movingSprite = this.sprites.wasteSprites.pop()!;
    } else {
      movingSprite = this.sprites.tableauSprites[pileIndex].pop()!;
      const srcCol = this.sprites.tableauSprites[pileIndex];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    }

    // Build and execute move
    const move = pile === 'waste'
      ? makeMove(ActionType.WASTE_TO_FOUNDATION, -1, fi, card)
      : makeMove(ActionType.TABLEAU_TO_FOUNDATION, pileIndex, fi, card);

    this.core.executeMove(move);

    // Animate
    const endPos = this.layout.getFoundationPosition(fi);
    this.onMoveAnimated([movingSprite], pile, pileIndex, 'foundation', fi, [{ x: endPos.x, y: endPos.y }], flipSprite);
  }

  updateLayout(layout: LayoutManager): void {
    this.layout = layout;
    this.dropResolver.updateLayout(layout);
  }
}
