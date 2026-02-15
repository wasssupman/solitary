import Phaser from 'phaser';
import { LayoutManager } from '../rendering/LayoutManager';
import { CardRenderer } from '../rendering/CardRenderer';
import { CardSprite } from '../objects/CardSprite';
import { PileZone } from '../objects/PileZone';
import { getGameBridge, type GameDisplayState } from '../bridge/GameBridge';
import { SolitaireState } from '../../solver/SolitaireState';
import { makeCard, flipCard, makeMove, ActionType, type Card, type Move } from '../../solver/types';
import { createDeck, seedShuffle } from '../../solver/Deck';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import type { ThemeConfig } from '../themes/ThemeConfig';
import { THEMES, CLASSIC_THEME } from '../themes/themes';

interface DragData {
  cards: CardSprite[];
  originX: number[];
  originY: number[];
  originDepths: number[];
  sourcePile: 'tableau' | 'waste' | 'foundation';
  sourceIndex: number;
  cardIndex: number; // index within pile
}

export class TableScene extends Phaser.Scene {
  private layout!: LayoutManager;
  private moveRunner!: CardMovementRunner;

  // Card sprite tracking (mirrors game state)
  private tableauSprites: CardSprite[][] = [];
  private foundationSprites: CardSprite[][] = [];
  private stockSprites: CardSprite[] = [];
  private wasteSprites: CardSprite[] = [];
  private pileZones: PileZone[] = [];

  // Game logic
  private gameState!: SolitaireState;
  private undoStack: SolitaireState[] = [];
  private moveCount = 0;
  private currentSeed = 0;

  // Drag state
  private dragData: DragData | null = null;

  // Hint
  private hintGraphics: Phaser.GameObjects.GameObject[] = [];

  // Stock count label
  private stockCountText: Phaser.GameObjects.Text | null = null;

  // Stock click zone (must be tracked to avoid accumulation)
  private stockClickZone: Phaser.GameObjects.Zone | null = null;

  // Mode
  private mode: 'play' | 'simulate' = 'play';

  // Theme
  private currentTheme: ThemeConfig = CLASSIC_THEME;

  constructor() {
    super({ key: 'TableScene' });
  }

  init(data?: { seed?: number; mode?: 'play' | 'simulate' }): void {
    this.currentSeed = data?.seed ?? Math.floor(Math.random() * 1000000);
    this.mode = data?.mode ?? 'play';
  }

  create(): void {
    const { width, height } = this.scale;
    this.layout = new LayoutManager(width, height);
    this.moveRunner = new CardMovementRunner(this, this.layout, () => this.refreshSpritesFromState());

    // Load saved theme
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('solitaire-theme');
      if (savedId && THEMES[savedId]) this.currentTheme = THEMES[savedId];
    }
    this.cameras.main.setBackgroundColor(this.currentTheme.tableColor);

    CardRenderer.generateTextures(this, this.layout.cardWidth, this.layout.cardHeight, this.currentTheme);
    this.createPileZones();
    this.newGame(this.currentSeed);

    // Bridge events (cleanup handled by PhaserGameInner via clearSceneListeners)
    const bridge = getGameBridge();
    bridge.on('newGame', (seed?: unknown) => {
      if (!this.sys) return;
      this.newGame(typeof seed === 'number' ? seed : undefined);
    });
    bridge.newGameCallback = (seed?: number) => {
      try {
        if (!this.scene?.isActive()) return;
        this.newGame(seed);
      } catch {
        // Scene partially destroyed — ignore
      }
    };
    bridge.on('undo', () => {
      if (!this.sys) return;
      this.undo();
    });
    // showHint uses a direct callback (not bridge event) to avoid stale listener issues.
    bridge.showHintCallback = (move: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.showHint(move as Move);
      } catch {
        // Scene partially destroyed — ignore
      }
    };
    bridge.on('getState', (callback: unknown) => {
      if (!this.sys) return;
      if (typeof callback === 'function') {
        callback(this.getSerializableState());
      }
    });
    bridge.on('simMove', (move: unknown) => {
      if (!this.sys) return;
      if (move) this.applySolverMove(move as Move);
    });
    bridge.applySimMoveCallback = (move: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.applySolverMove(move as Move);
      } catch {
        // Scene partially destroyed — ignore
      }
    };

    // Theme change (use direct callback pattern like other bridge callbacks)
    bridge.applyThemeCallback = (themeId: string) => {
      try {
        if (!this.scene?.isActive()) return;
        this.applyTheme(themeId);
      } catch {
        // Scene partially destroyed — ignore
      }
    };
    bridge.on('setTheme', (themeId: unknown) => {
      if (!this.sys) return;
      if (typeof themeId === 'string') this.applyTheme(themeId);
    });

    // Resize handler
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  // ===========================
  // Game Management
  // ===========================

  newGame(seed?: number): void {
    this.currentSeed = seed ?? Math.floor(Math.random() * 1000000);
    this.clearAllSprites();
    if (this.stockClickZone) {
      this.stockClickZone.destroy();
      this.stockClickZone = null;
    }
    this.clearHint();

    this.gameState = new SolitaireState();
    this.gameState.dealThoughtful(this.currentSeed);
    this.undoStack = [];
    this.moveCount = 0;

    this.tableauSprites = [[], [], [], [], [], [], []];
    this.foundationSprites = [[], [], [], []];
    this.stockSprites = [];
    this.wasteSprites = [];

    this.buildSpritesFromState();
    this.emitState();
  }

  private clearAllSprites(): void {
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

  private buildSpritesFromState(): void {
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    let depth = 0;

    // Stock
    const stockPos = this.layout.getStockPosition();
    for (const c of this.gameState.stock) {
      const s = new CardSprite(this, stockPos.x, stockPos.y, c.rank, c._sv, false, cw, ch);
      s.setDepth(depth++);
      this.stockSprites.push(s);
    }

    // Stock count label
    if (this.stockCountText) {
      this.stockCountText.destroy();
      this.stockCountText = null;
    }
    if (this.gameState.stock.length > 0) {
      const fontSize = Math.round(cw * 0.22);
      this.stockCountText = this.add.text(
        stockPos.x + cw * 0.38, stockPos.y - ch * 0.38,
        `${this.gameState.stock.length}`,
        { fontSize: `${fontSize}px`, color: '#ffffff', fontFamily: 'monospace',
          backgroundColor: '#00000088', padding: { x: 3, y: 1 } },
      );
      this.stockCountText.setOrigin(0.5, 0.5);
      this.stockCountText.setDepth(depth++);
    }

    // Waste
    const wastePos = this.layout.getWastePosition();
    for (const c of this.gameState.waste) {
      const s = new CardSprite(this, wastePos.x, wastePos.y, c.rank, c._sv, true, cw, ch);
      s.setDepth(depth++);
      this.wasteSprites.push(s);
    }

    // Foundations
    for (let fi = 0; fi < 4; fi++) {
      const pos = this.layout.getFoundationPosition(fi);
      for (const c of this.gameState.foundation[fi]) {
        const s = new CardSprite(this, pos.x, pos.y, c.rank, c._sv, true, cw, ch);
        s.setDepth(depth++);
        this.foundationSprites[fi].push(s);
      }
    }

    // Tableau
    for (let col = 0; col < 7; col++) {
      const cards = this.gameState.tableau[col];
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
        const s = new CardSprite(this, x, y, c.rank, c._sv, c.faceUp, cw, ch);
        s.setDepth(depth++);
        this.tableauSprites[col].push(s);
      }
    }

    // Make interactive if play mode
    if (this.mode === 'play') {
      this.setupInteraction();
    }
  }

  // ===========================
  // Interaction (Play Mode)
  // ===========================

  private setupInteraction(): void {
    // Stock click zone — create only once, reposition on subsequent calls
    const stockPos = this.layout.getStockPosition();
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;

    if (!this.stockClickZone) {
      this.stockClickZone = this.add.zone(stockPos.x, stockPos.y, cw, ch).setInteractive();
      this.stockClickZone.on('pointerdown', () => this.onStockClick());
    } else {
      this.stockClickZone.setPosition(stockPos.x, stockPos.y);
      this.stockClickZone.setSize(cw, ch);
    }

    // Also make the top stock card clickable
    this.updateStockInteraction();

    // Make tableau and waste cards draggable
    this.updateCardInteractivity();
  }

  private updateStockInteraction(): void {
    // Top stock card should be clickable
    if (this.stockSprites.length > 0) {
      const top = this.stockSprites[this.stockSprites.length - 1];
      top.setInteractive();
      top.removeAllListeners('pointerdown');
      top.on('pointerdown', () => this.onStockClick());
    }
  }

  private updateCardInteractivity(): void {
    // Waste top card: draggable + double-click
    for (const s of this.wasteSprites) {
      s.removeInteractive();
      s.removeAllListeners();
    }
    if (this.wasteSprites.length > 0) {
      const top = this.wasteSprites[this.wasteSprites.length - 1];
      this.makeCardDraggable(top, 'waste', 0, this.wasteSprites.length - 1);
      top.on('pointerdown', (_p: Phaser.Input.Pointer) => {
        // Track for double-click
        const now = Date.now();
        const last = (top as unknown as { _lastClick?: number })._lastClick ?? 0;
        (top as unknown as { _lastClick: number })._lastClick = now;
        if (now - last < 300) {
          this.autoMoveToFoundation('waste', 0, this.wasteSprites.length - 1);
        }
      });
    }

    // Tableau cards: face-up cards are draggable
    for (let col = 0; col < 7; col++) {
      const colCards = this.tableauSprites[col];
      for (let i = 0; i < colCards.length; i++) {
        const s = colCards[i];
        s.removeInteractive();
        s.removeAllListeners();
        if (s.faceUp) {
          this.makeCardDraggable(s, 'tableau', col, i);
          // Double-click: auto-move to foundation (only top card)
          if (i === colCards.length - 1) {
            s.on('pointerdown', () => {
              const now = Date.now();
              const last = (s as unknown as { _lastClick?: number })._lastClick ?? 0;
              (s as unknown as { _lastClick: number })._lastClick = now;
              if (now - last < 300) {
                this.autoMoveToFoundation('tableau', col, colCards.length - 1);
              }
            });
          }
        }
      }
    }

    // Foundation top cards: draggable back to tableau
    for (let fi = 0; fi < 4; fi++) {
      const pile = this.foundationSprites[fi];
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

    this.input.setDraggable(sprite);

    sprite.on('dragstart', () => {
      if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); return; }
      this.clearHint();
      // Collect cards to drag (for tableau, include cards below in the stack)
      const cards: CardSprite[] = [];
      const originX: number[] = [];
      const originY: number[] = [];
      const originDepths: number[] = [];

      if (pile === 'tableau') {
        const col = this.tableauSprites[pileIndex];
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
        sourcePile: pile,
        sourceIndex: pileIndex,
        cardIndex,
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

      // Find drop target
      const dropCard = dd.cards[0];
      if (!dropCard) return;
      const target = this.findDropTarget(dropCard.x, dropCard.y, dropCard);

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

  private findDropTarget(
    x: number, y: number, card: CardSprite,
  ): { pile: 'tableau' | 'foundation'; index: number } | null {
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    const threshold = cw * 0.6;

    // Check foundations (only single card drops)
    for (let fi = 0; fi < 4; fi++) {
      const pos = this.layout.getFoundationPosition(fi);
      if (Math.abs(x - pos.x) < threshold && Math.abs(y - pos.y) < threshold) {
        if (this.canDropOnFoundation(card, fi)) {
          return { pile: 'foundation', index: fi };
        }
      }
    }

    // Check tableau columns
    for (let col = 0; col < 7; col++) {
      const colCards = this.tableauSprites[col];
      let targetY: number;
      if (colCards.length === 0) {
        targetY = this.layout.getTableauY(col, 0, 0);
      } else {
        const lastCard = colCards[colCards.length - 1];
        targetY = lastCard.y;
      }
      const colX = this.layout.getTableauX(col);

      if (Math.abs(x - colX) < threshold && Math.abs(y - targetY) < ch) {
        if (this.canDropOnTableau(card, col)) {
          return { pile: 'tableau', index: col };
        }
      }
    }

    return null;
  }

  private canDropOnFoundation(card: CardSprite, fi: number): boolean {
    const fPile = this.gameState.foundation[fi];
    if (fPile.length === 0) return card.rank === 1 && card.suit === fi;
    const top = fPile[fPile.length - 1];
    return card.suit === top._sv && card.rank === top.rank + 1;
  }

  private canDropOnTableau(card: CardSprite, col: number): boolean {
    const colCards = this.gameState.tableau[col];
    if (colCards.length === 0) return card.rank === 13;
    const top = colCards[colCards.length - 1];
    const cardRed = card.suit < 2;
    return card.rank === top.rank - 1 && cardRed !== top._red;
  }

  private executePlayerMove(
    dd: DragData,
    target: { pile: 'tableau' | 'foundation'; index: number },
  ): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); return; }

    // Save state for undo
    this.undoStack.push(this.gameState.clone());

    const card = dd.cards[0];
    const numCards = dd.cards.length;
    const c = makeCard(card.rank, card.suit as 0 | 1 | 2 | 3, true);

    let move: Move;
    if (dd.sourcePile === 'waste') {
      if (target.pile === 'foundation') {
        move = makeMove(ActionType.WASTE_TO_FOUNDATION, -1, target.index, c);
      } else {
        move = makeMove(ActionType.WASTE_TO_TABLEAU, -1, target.index, c);
      }
    } else if (dd.sourcePile === 'tableau') {
      if (target.pile === 'foundation') {
        move = makeMove(ActionType.TABLEAU_TO_FOUNDATION, dd.sourceIndex, target.index, c);
      } else {
        move = makeMove(ActionType.TABLEAU_TO_TABLEAU, dd.sourceIndex, target.index, c, numCards);
      }
    } else {
      // foundation -> tableau
      move = makeMove(ActionType.FOUNDATION_TO_TABLEAU, dd.sourceIndex, target.index, c);
    }

    // Extract moving sprites from their source pile
    const movingSprites = dd.cards;
    if (dd.sourcePile === 'tableau') {
      this.tableauSprites[dd.sourceIndex].splice(dd.cardIndex, numCards);
    } else if (dd.sourcePile === 'waste') {
      this.wasteSprites.pop();
    } else {
      // foundation
      this.foundationSprites[dd.sourceIndex].pop();
    }

    // Identify flip sprite (face-down card revealed in source tableau)
    let flipSprite: CardSprite | undefined;
    if (dd.sourcePile === 'tableau') {
      const srcCol = this.tableauSprites[dd.sourceIndex];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    }

    // Apply move to game state
    this.gameState.applyMove(move);
    this.moveCount++;
    this.emitState();

    // Compute end positions
    const endPositions = this.computeEndPositions(target.pile, target.index, numCards);

    // Animate
    this.moveRunner.runMove(
      movingSprites, dd.sourcePile, dd.sourceIndex,
      target.pile, target.index, endPositions, flipSprite,
    ).then(() => {
      if (this.gameState.isWin()) {
        getGameBridge().emit('gameWon');
        this.showWinEffect();
      }
    });
  }

  private onStockClick(): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }
    this.clearHint();

    this.undoStack.push(this.gameState.clone());

    if (this.gameState.stock.length === 0) {
      // Reset: move all waste back to stock — instant rebuild
      if (this.gameState.waste.length === 0) {
        this.undoStack.pop(); // no-op, remove saved state
        return;
      }
      for (let i = this.gameState.waste.length - 1; i >= 0; i--) {
        this.gameState.stock.push(this.gameState.waste[i]);
      }
      this.gameState.waste = [];
      this.moveCount++;
      this.refreshSpritesFromState();
      this.emitState();
    } else {
      // Draw up to 3 cards
      const draw = Math.min(3, this.gameState.stock.length);

      // Pop sprites from stock
      const movingSprites: CardSprite[] = [];
      for (let d = 0; d < draw; d++) {
        const s = this.stockSprites.pop();
        if (s) {
          s.flip(true, false); // Show face immediately (no animation for flip here)
          movingSprites.push(s);
        }
      }

      // Apply state
      for (let d = 0; d < draw; d++) {
        this.gameState.waste.push(flipCard(this.gameState.stock.pop()!));
      }
      this.moveCount++;
      this.emitState();

      // Compute end position (all go to waste position)
      const wastePos = this.layout.getWastePosition();
      const endPositions = movingSprites.map(() => ({ x: wastePos.x, y: wastePos.y }));

      this.moveRunner.runMove(
        movingSprites, 'stock', 0, 'waste', 0, endPositions,
      );
    }
  }

  private autoMoveToFoundation(
    pile: 'tableau' | 'waste',
    pileIndex: number,
    _cardIndex: number,
  ): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }

    let card: Card;
    if (pile === 'waste') {
      if (this.gameState.waste.length === 0) return;
      card = this.gameState.waste[this.gameState.waste.length - 1];
    } else {
      const col = this.gameState.tableau[pileIndex];
      if (col.length === 0) return;
      card = col[col.length - 1];
      if (!card.faceUp) return;
    }

    // Check if card can go to its foundation
    const fi = card._sv;
    const fPile = this.gameState.foundation[fi];
    const canF = (fPile.length === 0 && card.rank === 1) ||
                 (fPile.length > 0 && fPile[fPile.length - 1].rank === card.rank - 1);
    if (!canF) return;

    this.clearHint();
    this.undoStack.push(this.gameState.clone());

    // Extract sprite
    let movingSprite: CardSprite;
    let flipSprite: CardSprite | undefined;
    if (pile === 'waste') {
      movingSprite = this.wasteSprites.pop()!;
      const move = makeMove(ActionType.WASTE_TO_FOUNDATION, -1, fi, card);
      this.gameState.applyMove(move);
    } else {
      movingSprite = this.tableauSprites[pileIndex].pop()!;
      // Check if we need to flip the card below
      const srcCol = this.tableauSprites[pileIndex];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
      const move = makeMove(ActionType.TABLEAU_TO_FOUNDATION, pileIndex, fi, card);
      this.gameState.applyMove(move);
    }

    this.moveCount++;
    this.emitState();

    // End position
    const endPos = this.layout.getFoundationPosition(fi);
    const endPositions = [{ x: endPos.x, y: endPos.y }];

    this.moveRunner.runMove(
      [movingSprite], pile, pileIndex, 'foundation', fi,
      endPositions, flipSprite,
    ).then(() => {
      if (this.gameState.isWin()) {
        getGameBridge().emit('gameWon');
        this.showWinEffect();
      }
    });
  }

  undo(): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }
    if (this.undoStack.length === 0) return;
    this.clearHint();
    this.gameState = this.undoStack.pop()!;
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.refreshSpritesFromState();
    this.emitState();
  }

  /** Compute end positions for cards moving to a pile. */
  private computeEndPositions(
    toPile: 'tableau' | 'foundation',
    toIndex: number,
    numCards: number,
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    if (toPile === 'foundation') {
      const pos = this.layout.getFoundationPosition(toIndex);
      for (let i = 0; i < numCards; i++) {
        positions.push({ x: pos.x, y: pos.y });
      }
    } else {
      // Tableau: need to figure out where cards will stack
      const stateCol = this.gameState.tableau[toIndex];
      // The cards have already been applied to state, so the last numCards are ours
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

  // ===========================
  // Sprite <-> State Sync
  // ===========================

  private refreshSpritesFromState(): void {
    this.clearAllSprites();
    this.tableauSprites = [[], [], [], [], [], [], []];
    this.foundationSprites = [[], [], [], []];
    this.stockSprites = [];
    this.wasteSprites = [];
    this.buildSpritesFromState();
  }

  // ===========================
  // State Emission
  // ===========================

  private emitState(): void {
    const toDisplay = (c: Card) => ({ rank: c.rank, suit: c._sv, faceUp: c.faceUp });
    const bridge = getGameBridge();

    const state: GameDisplayState = {
      tableau: this.gameState.tableau.map(col => col.map(toDisplay)),
      foundation: this.gameState.foundation.map(pile => pile.map(toDisplay)),
      stock: this.gameState.stock.map(toDisplay),
      waste: this.gameState.waste.map(toDisplay),
      moveCount: this.moveCount,
      isWin: this.gameState.isWin(),
    };
    // Also store solver-compatible snapshot for direct access (avoids callback pattern)
    bridge.solverState = this.getSerializableState();
    bridge.emit('stateChanged', state);
  }

  /** Get the current state for the solver (serializable). */
  getSerializableState() {
    return {
      tableau: this.gameState.tableau.map(col =>
        col.map(c => ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red })),
      ),
      foundation: this.gameState.foundation.map(pile =>
        pile.map(c => ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red })),
      ),
      stock: this.gameState.stock.map(c =>
        ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red }),
      ),
      waste: this.gameState.waste.map(c =>
        ({ rank: c.rank, suit: c.suit, faceUp: c.faceUp, _sv: c._sv, _red: c._red }),
      ),
    };
  }

  getCurrentSeed(): number {
    return this.currentSeed;
  }

  // ===========================
  // Hint Display
  // ===========================

  showHint(move: Move): void {
    if (!move || !this.sys) return;
    this.clearHint();

    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    const hw = cw / 2 + 6;
    const hh = ch / 2 + 6;
    const at = Number(move.actionType);

    // Source highlight (gold glow)
    let srcPos: { x: number; y: number } | null = null;

    // If this is a waste move with stockTurns > 0, highlight the stock pile
    // to indicate "click stock first"
    if (move.stockTurns > 0) {
      srcPos = this.layout.getStockPosition();
    } else if (at === ActionType.TABLEAU_TO_FOUNDATION || at === ActionType.TABLEAU_TO_TABLEAU) {
      const col = this.tableauSprites[move.srcIdx];
      if (col.length > 0) {
        const idx = Math.max(0, col.length - move.numCards);
        srcPos = { x: col[idx].x, y: col[idx].y };
      }
    } else if (at === ActionType.WASTE_TO_FOUNDATION || at === ActionType.WASTE_TO_TABLEAU) {
      if (this.wasteSprites.length > 0) {
        const top = this.wasteSprites[this.wasteSprites.length - 1];
        srcPos = { x: top.x, y: top.y };
      }
    } else if (at === ActionType.FOUNDATION_TO_TABLEAU) {
      const pile = this.foundationSprites[move.srcIdx];
      if (pile.length > 0) {
        const top = pile[pile.length - 1];
        srcPos = { x: top.x, y: top.y };
      }
    }

    if (srcPos) {
      const g1 = this.add.graphics();
      g1.setDepth(2000);
      g1.lineStyle(4, 0xffd700, 1);
      g1.strokeRoundedRect(srcPos.x - hw, srcPos.y - hh, hw * 2, hh * 2, 8);
      this.hintGraphics.push(g1);

      // Pulsing glow animation
      this.tweens.add({
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
      const col = this.tableauSprites[move.destIdx];
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
      const g2 = this.add.graphics();
      g2.setDepth(2000);
      g2.lineStyle(4, 0x00ff88, 1);
      g2.strokeRoundedRect(destPos.x - hw, destPos.y - hh, hw * 2, hh * 2, 8);
      this.hintGraphics.push(g2);

      this.tweens.add({
        targets: g2,
        alpha: { from: 1, to: 0.3 },
        duration: 600,
        yoyo: true,
        repeat: 4,
      });
    }

    // Show hint text if stock turns needed
    if (move.stockTurns > 0) {
      const stockPos = this.layout.getStockPosition();
      const text = this.add.text(
        stockPos.x, stockPos.y - ch / 2 - 16,
        `Click stock ${move.stockTurns}x`,
        { fontSize: '12px', fontFamily: 'Arial', color: '#ffd700', align: 'center' },
      ).setOrigin(0.5).setDepth(2001);
      this.hintGraphics.push(text);
    }

    // Auto-dismiss after 5 seconds
    this.time.delayedCall(5000, () => this.clearHint());
  }

  clearHint(): void {
    for (const g of this.hintGraphics) {
      this.tweens.killTweensOf(g);
      g.destroy();
    }
    this.hintGraphics = [];
  }

  // ===========================
  // Win Effect
  // ===========================

  private showWinEffect(): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, 'You Win!', {
      fontSize: '64px',
      fontFamily: 'Arial',
      color: '#ffd700',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(3000);

    this.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      yoyo: true,
      repeat: 2,
      duration: 400,
    });
  }

  // ===========================
  // Simulation Mode Support
  // ===========================

  /** Apply a move from the solver (for simulation mode). */
  applySolverMove(move: Move): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }

    const at = Number(move.actionType);

    // Handle stock turns first (apply in state only, no animation for cycling)
    if (move.stockTurns > 0) {
      for (let t = 0; t < move.stockTurns; t++) {
        if (this.gameState.stock.length === 0) {
          // Reset waste to stock
          for (let i = this.gameState.waste.length - 1; i >= 0; i--) {
            this.gameState.stock.push(this.gameState.waste[i]);
          }
          this.gameState.waste = [];
        }
        const draw = Math.min(3, this.gameState.stock.length);
        for (let d = 0; d < draw; d++) {
          this.gameState.waste.push(flipCard(this.gameState.stock.pop()!));
        }
      }
      // Rebuild sprites to reflect stock cycling before animating the final move
      this.refreshSpritesFromState();
    }

    // Extract sprites based on action type
    let movingSprites: CardSprite[] = [];
    let fromPile: 'tableau' | 'waste' | 'foundation' | 'stock' = 'waste';
    let fromIndex = 0;
    let toPile: 'tableau' | 'foundation' = 'tableau';
    let toIndex = move.destIdx;
    let flipSprite: CardSprite | undefined;

    if (at === ActionType.WASTE_TO_FOUNDATION || at === ActionType.WASTE_TO_TABLEAU) {
      fromPile = 'waste';
      fromIndex = 0;
      const s = this.wasteSprites.pop();
      if (s) movingSprites = [s];
      toPile = at === ActionType.WASTE_TO_FOUNDATION ? 'foundation' : 'tableau';
    } else if (at === ActionType.TABLEAU_TO_FOUNDATION) {
      fromPile = 'tableau';
      fromIndex = move.srcIdx;
      const s = this.tableauSprites[move.srcIdx].pop();
      if (s) movingSprites = [s];
      toPile = 'foundation';
      // Check flip
      const srcCol = this.tableauSprites[move.srcIdx];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    } else if (at === ActionType.TABLEAU_TO_TABLEAU) {
      fromPile = 'tableau';
      fromIndex = move.srcIdx;
      const srcCol = this.tableauSprites[move.srcIdx];
      const startIdx = srcCol.length - move.numCards;
      movingSprites = srcCol.splice(startIdx, move.numCards);
      toPile = 'tableau';
      // Check flip
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    } else if (at === ActionType.FOUNDATION_TO_TABLEAU) {
      fromPile = 'foundation';
      fromIndex = move.srcIdx;
      const s = this.foundationSprites[move.srcIdx].pop();
      if (s) movingSprites = [s];
      toPile = 'tableau';
    }

    // Apply move
    this.gameState.applyMove(move);
    this.moveCount++;
    this.emitState();

    if (movingSprites.length === 0) {
      this.refreshSpritesFromState();
      return;
    }

    // Compute end positions
    const endPositions = this.computeEndPositions(toPile, toIndex, movingSprites.length);

    this.moveRunner.runMove(
      movingSprites, fromPile, fromIndex, toPile, toIndex,
      endPositions, flipSprite,
    );
  }

  /** Set a fresh state for simulation. */
  setStateForSimulation(state: SolitaireState, seed: number): void {
    this.currentSeed = seed;
    this.clearAllSprites();
    this.clearHint();

    this.gameState = state;
    this.undoStack = [];
    this.moveCount = 0;
    this.tableauSprites = [[], [], [], [], [], [], []];
    this.foundationSprites = [[], [], [], []];
    this.stockSprites = [];
    this.wasteSprites = [];

    this.buildSpritesFromState();
    this.emitState();
  }

  // ===========================
  // Layout
  // ===========================

  private createPileZones(): void {
    for (const z of this.pileZones) z.destroy();
    this.pileZones = [];

    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;

    const oc = this.currentTheme.pileOutlineColor;
    const oa = this.currentTheme.pileOutlineAlpha;

    const stockPos = this.layout.getStockPosition();
    this.pileZones.push(new PileZone(this, stockPos.x, stockPos.y, cw, ch, 'stock', 0, oc, oa));

    const wastePos = this.layout.getWastePosition();
    this.pileZones.push(new PileZone(this, wastePos.x, wastePos.y, cw, ch, 'waste', 0, oc, oa));

    for (let i = 0; i < 4; i++) {
      const pos = this.layout.getFoundationPosition(i);
      this.pileZones.push(new PileZone(this, pos.x, pos.y, cw, ch, 'foundation', i, oc, oa));
    }

    for (let col = 0; col < 7; col++) {
      const x = this.layout.getTableauX(col);
      const y = this.layout.getTableauY(col, 0, 0);
      this.pileZones.push(new PileZone(this, x, y, cw, ch, 'tableau', col, oc, oa));
    }
  }

  private applyTheme(themeId: string): void {
    const theme = THEMES[themeId];
    if (!theme) return;
    this.currentTheme = theme;

    // Update background
    this.cameras.main.setBackgroundColor(theme.tableColor);

    // Remove existing card textures
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        const key = `card_${rank}_${suit}_full`;
        if (this.textures.exists(key)) this.textures.remove(key);
      }
    }
    if (this.textures.exists('card_back')) this.textures.remove('card_back');
    if (this.textures.exists('particle_glow')) this.textures.remove('particle_glow');

    // Regenerate textures with new theme
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    CardRenderer.generateTextures(this, cw, ch, theme);

    // Rebuild visuals
    this.clearAllSprites();
    if (this.stockClickZone) {
      this.stockClickZone.destroy();
      this.stockClickZone = null;
    }
    this.createPileZones();
    this.buildSpritesFromState();
  }

  private handleResize(width: number, height: number): void {
    this.layout = new LayoutManager(width, height);
    this.moveRunner.updateLayout(this.layout);
    this.createPileZones();
    this.repositionAllCards();
  }

  private repositionAllCards(): void {
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;

    // Stock
    const stockPos = this.layout.getStockPosition();
    for (const s of this.stockSprites) {
      s.setPosition(stockPos.x, stockPos.y);
      s.resizeCard(cw, ch);
    }

    // Waste
    const wastePos = this.layout.getWastePosition();
    for (const s of this.wasteSprites) {
      s.setPosition(wastePos.x, wastePos.y);
      s.resizeCard(cw, ch);
    }

    // Foundations
    for (let fi = 0; fi < 4; fi++) {
      const pos = this.layout.getFoundationPosition(fi);
      for (const s of this.foundationSprites[fi]) {
        s.setPosition(pos.x, pos.y);
        s.resizeCard(cw, ch);
      }
    }

    // Tableau
    for (let col = 0; col < 7; col++) {
      const colCards = this.tableauSprites[col];
      const stateCol = this.gameState.tableau[col];
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
}
