import Phaser from 'phaser';
import { LayoutManager } from '../rendering/LayoutManager';
import { CardRenderer } from '../rendering/CardRenderer';
import { SolitaireCore } from '../core/SolitaireCore';
import { SpriteManager } from '../sprites/SpriteManager';
import { ThemeManager } from '../rendering/ThemeManager';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import { CardSprite } from '../objects/CardSprite';
import { getGameBridge } from '../bridge/GameBridge';
import { ActionType, type Move } from '../../solver/types';
import type { PileType } from '../movement/CardMovementData';

export class SimulateScene extends Phaser.Scene {
  private layout!: LayoutManager;
  private core!: SolitaireCore;
  private sprites!: SpriteManager;
  private themeManager!: ThemeManager;
  private moveRunner!: CardMovementRunner;

  private initialSeed?: number;
  private bridgeId = 'default';

  constructor() {
    super({ key: 'SimulateScene' });
  }

  init(data?: { seed?: number; bridgeId?: string }): void {
    this.initialSeed = data?.seed;
    this.bridgeId = data?.bridgeId ?? 'default';
  }

  create(): void {
    const { width, height } = this.scale;
    this.layout = new LayoutManager(width, height);

    // Core
    this.core = new SolitaireCore();

    // Theme
    this.themeManager = new ThemeManager(this, this.layout, null as unknown as SpriteManager);
    this.themeManager.loadSaved();
    this.cameras.main.setBackgroundColor(this.themeManager.theme.tableColor);

    // Textures
    CardRenderer.generateTextures(this, this.layout.cardWidth, this.layout.cardHeight, this.themeManager.theme);

    // Sprites
    this.sprites = new SpriteManager(this, this.layout, this.themeManager.theme);
    this.sprites.createPileZones();

    // Fix ThemeManager's sprite reference
    (this.themeManager as unknown as { sprites: SpriteManager }).sprites = this.sprites;

    // Movement
    this.moveRunner = new CardMovementRunner(this, this.layout, () => {
      this.sprites.rebuild(this.core.state);
    });

    // Core event subscriptions
    this.core.on('moveExecuted', () => {
      this.syncBridge();
    });

    this.core.on('stockDrawn', () => {
      this.syncBridge();
    });

    this.core.on('gameWon', () => {
      const bridge = getGameBridge(this.bridgeId);
      bridge.emit('gameWon');
    });

    this.core.on('newGame', () => {
      this.syncBridge();
    });

    // Start game
    this.core.newGame(this.initialSeed);
    this.sprites.buildFromState(this.core.state);

    // Wire bridge
    this.wireBridge();

    // Resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  private syncBridge(): void {
    const bridge = getGameBridge(this.bridgeId);
    bridge.solverState = this.core.getSerializableState();
    bridge.emit('stateChanged', this.core.getDisplayState());
  }

  private wireBridge(): void {
    const bridge = getGameBridge(this.bridgeId);

    bridge.newGameCallback = (seed?: number) => {
      try {
        if (!this.scene?.isActive()) return;
        this.sprites.clearAll();
        this.sprites.tableauSprites = [[], [], [], [], [], [], []];
        this.sprites.foundationSprites = [[], [], [], []];
        this.sprites.stockSprites = [];
        this.sprites.wasteSprites = [];
        this.core.newGame(seed);
        this.sprites.buildFromState(this.core.state);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.applySimMoveCallback = (move: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.applySolverMove(move as Move);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('simMove', (move: unknown) => {
      if (!this.sys) return;
      if (move) this.applySolverMove(move as Move);
    });

    bridge.on('getState', (callback: unknown) => {
      if (!this.sys) return;
      if (typeof callback === 'function') callback(this.core.getSerializableState());
    });

    bridge.applyThemeCallback = (themeId: string) => {
      try {
        if (!this.scene?.isActive()) return;
        this.themeManager.apply(themeId, this.core.state);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('setTheme', (themeId: unknown) => {
      if (!this.sys) return;
      if (typeof themeId === 'string') this.themeManager.apply(themeId, this.core.state);
    });

    // Initial state sync
    this.syncBridge();
  }

  private applySolverMove(move: Move): void {
    if (this.moveRunner.isAnimating) { this.moveRunner.fastForward(); }

    const at = Number(move.actionType);

    // Handle stock turns first
    if (move.stockTurns > 0) {
      this.core.applyStockTurns(move.stockTurns);
      this.sprites.rebuild(this.core.state);
    }

    // Extract sprites based on action type
    let movingSprites: CardSprite[] = [];
    let fromPile: string = 'waste';
    let fromIndex = 0;
    let toPile: 'tableau' | 'foundation' = 'tableau';
    const toIndex = move.destIdx;
    let flipSprite: CardSprite | undefined;

    if (at === ActionType.WASTE_TO_FOUNDATION || at === ActionType.WASTE_TO_TABLEAU) {
      fromPile = 'waste';
      const s = this.sprites.wasteSprites.pop();
      if (s) movingSprites = [s];
      toPile = at === ActionType.WASTE_TO_FOUNDATION ? 'foundation' : 'tableau';
    } else if (at === ActionType.TABLEAU_TO_FOUNDATION) {
      fromPile = 'tableau';
      fromIndex = move.srcIdx;
      const s = this.sprites.tableauSprites[move.srcIdx].pop();
      if (s) movingSprites = [s];
      toPile = 'foundation';
      const srcCol = this.sprites.tableauSprites[move.srcIdx];
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    } else if (at === ActionType.TABLEAU_TO_TABLEAU) {
      fromPile = 'tableau';
      fromIndex = move.srcIdx;
      const srcCol = this.sprites.tableauSprites[move.srcIdx];
      const startIdx = srcCol.length - move.numCards;
      movingSprites = srcCol.splice(startIdx, move.numCards);
      toPile = 'tableau';
      if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
        flipSprite = srcCol[srcCol.length - 1];
      }
    } else if (at === ActionType.FOUNDATION_TO_TABLEAU) {
      fromPile = 'foundation';
      fromIndex = move.srcIdx;
      const s = this.sprites.foundationSprites[move.srcIdx].pop();
      if (s) movingSprites = [s];
      toPile = 'tableau';
    }

    // Execute move on core
    this.core.executeMove(move);

    if (movingSprites.length === 0) {
      this.sprites.rebuild(this.core.state);
      return;
    }

    // Compute end positions & animate
    const endPositions = this.sprites.computeEndPositions(toPile, toIndex, movingSprites.length, this.core.state);
    this.moveRunner.runMove(movingSprites, fromPile as PileType, fromIndex, toPile as PileType, toIndex, endPositions, flipSprite);
  }

  private handleResize(width: number, height: number): void {
    this.layout = new LayoutManager(width, height);
    this.moveRunner.updateLayout(this.layout);
    this.sprites.updateLayout(this.layout);
    this.sprites.createPileZones();
    this.sprites.reposition(this.core.state);
  }
}
