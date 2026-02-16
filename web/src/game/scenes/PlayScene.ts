import Phaser from 'phaser';
import { LayoutManager } from '../rendering/LayoutManager';
import { CardRenderer } from '../rendering/CardRenderer';
import { SolitaireCore } from '../core/SolitaireCore';
import { SpriteManager } from '../sprites/SpriteManager';
import { InteractionController } from '../interaction/InteractionController';
import { HintRenderer } from '../effects/HintRenderer';
import { WinEffectRenderer } from '../effects/WinEffectRenderer';
import { ThemeManager } from '../rendering/ThemeManager';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import { getGameBridge } from '../bridge/GameBridge';
import { GameRecorder } from '../recording/GameRecorder';
import { RecordingStorage } from '../recording/RecordingStorage';
import type { Move } from '../../solver/types';
import type { PileType } from '../movement/CardMovementData';

export class PlayScene extends Phaser.Scene {
  private layout!: LayoutManager;
  private core!: SolitaireCore;
  private sprites!: SpriteManager;
  private interaction!: InteractionController;
  private hints!: HintRenderer;
  private winEffect!: WinEffectRenderer;
  private themeManager!: ThemeManager;
  private moveRunner!: CardMovementRunner;
  private recorder!: GameRecorder;

  private initialSeed?: number;
  private bridgeId = 'default';

  constructor() {
    super({ key: 'PlayScene' });
  }

  init(data?: { seed?: number; bridgeId?: string }): void {
    this.initialSeed = data?.seed;
    this.bridgeId = data?.bridgeId ?? 'default';
  }

  create(): void {
    const { width, height } = this.scale;
    this.layout = new LayoutManager(width, height);

    // Core (pure logic)
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
      this.interaction.refresh();
    });

    // Effects
    this.hints = new HintRenderer(this, this.layout, this.sprites);
    this.winEffect = new WinEffectRenderer(this);

    // Interaction
    this.interaction = new InteractionController(
      this, this.sprites, this.layout, this.core, this.moveRunner,
      (movingSprites, fromPile, fromIndex, toPile, toIndex, endPositions, flipSprite) => {
        this.moveRunner.runMove(
          movingSprites, fromPile as PileType, fromIndex, toPile as PileType, toIndex, endPositions, flipSprite,
        ).then(() => {
          if (this.core.isWin) {
            this.winEffect.show();
          }
        });
      },
      () => {
        this.winEffect.show();
      },
      () => this.hints.clear(),
    );

    // Core event subscriptions
    this.core.on('moveExecuted', () => {
      this.syncBridge();
    });

    this.core.on('stockDrawn', ({ wasReset }) => {
      if (wasReset) {
        this.sprites.rebuild(this.core.state);
        this.interaction.refresh();
      }
      this.syncBridge();
    });

    this.core.on('gameWon', () => {
      const bridge = getGameBridge(this.bridgeId);
      bridge.emit('gameWon');
      const rec = this.recorder.finalize('win');
      if (rec) RecordingStorage.save(rec);
    });

    this.core.on('undone', () => {
      this.hints.clear();
      this.sprites.rebuild(this.core.state);
      this.interaction.refresh();
      this.syncBridge();
    });

    this.core.on('newGame', () => {
      this.syncBridge();
    });

    // Recorder
    this.recorder = new GameRecorder(this.core, 'play');

    // Start game
    this.core.newGame(this.initialSeed);
    this.sprites.buildFromState(this.core.state);
    this.interaction.enable();

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
        const rec = this.recorder.finalize('abandoned');
        if (rec) RecordingStorage.save(rec);
        this.hints.clear();
        if (this.sprites.stockClickZone) {
          this.sprites.stockClickZone.destroy();
          this.sprites.stockClickZone = null;
        }
        this.sprites.clearAll();
        this.sprites.tableauSprites = [[], [], [], [], [], [], []];
        this.sprites.foundationSprites = [[], [], [], []];
        this.sprites.stockSprites = [];
        this.sprites.wasteSprites = [];
        this.core.newGame(seed);
        this.sprites.buildFromState(this.core.state);
        this.interaction.enable();
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('undo', () => {
      if (!this.sys) return;
      if (this.moveRunner.isAnimating) this.moveRunner.fastForward();
      this.core.undo();
    });

    bridge.showHintCallback = (move: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.hints.show(move as Move);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('getState', (callback: unknown) => {
      if (!this.sys) return;
      if (typeof callback === 'function') callback(this.core.getSerializableState());
    });

    bridge.applyThemeCallback = (themeId: string) => {
      try {
        if (!this.scene?.isActive()) return;
        this.themeManager.apply(themeId, this.core.state);
        this.interaction.enable();
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('setTheme', (themeId: unknown) => {
      if (!this.sys) return;
      if (typeof themeId === 'string') {
        this.themeManager.apply(themeId, this.core.state);
        this.interaction.enable();
      }
    });

    bridge.sceneCleanupCallback = () => {
      const rec = this.recorder.finalize('abandoned');
      if (rec) RecordingStorage.save(rec);
      this.recorder.destroy();
    };

    // Initial state sync
    this.syncBridge();
  }

  private handleResize(width: number, height: number): void {
    this.layout = new LayoutManager(width, height);
    this.moveRunner.updateLayout(this.layout);
    this.sprites.updateLayout(this.layout);
    this.sprites.createPileZones();
    this.sprites.reposition(this.core.state);
    this.hints.updateLayout(this.layout);
    this.interaction.updateLayout(this.layout);
  }
}
