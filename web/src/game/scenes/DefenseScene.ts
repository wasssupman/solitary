import Phaser from 'phaser';
import { DefenseCore } from '../defense/DefenseCore';
import { DefenseLayoutManager } from '../defense/DefenseLayoutManager';
import { DefenseSpriteManager } from '../defense/DefenseSpriteManager';
import { DefenseLane } from '../defense/DefenseLane';
import { DefenseInteractionController } from '../defense/DefenseInteractionController';
import { InteractionController } from '../interaction/InteractionController';
import { CardRenderer } from '../rendering/CardRenderer';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import { HintRenderer } from '../effects/HintRenderer';
import { ThemeManager } from '../rendering/ThemeManager';
import { SpriteManager } from '../sprites/SpriteManager';
import { showFloatingText, showDamageNumber } from '../objects/DamageNumber';
import { getGameBridge } from '../bridge/GameBridge';
import { GamePhase } from '../defense/DefenseState';
import { LANE_SLOTS } from '../defense/constants';
import type { Move } from '../../solver/types';
import type { PileType } from '../movement/CardMovementData';

export class DefenseScene extends Phaser.Scene {
  private defenseCore!: DefenseCore;
  private layout!: DefenseLayoutManager;
  private sprites!: DefenseSpriteManager;
  private lane!: DefenseLane;
  private interaction!: DefenseInteractionController;
  private cardInteraction!: InteractionController;
  private moveRunner!: CardMovementRunner;
  private hints!: HintRenderer;
  private themeManager!: ThemeManager;

  // Defense area backgrounds
  private defenseBg!: Phaser.GameObjects.Rectangle;
  private unitPoolBg!: Phaser.GameObjects.Rectangle;
  private separatorLine!: Phaser.GameObjects.Rectangle;

  // HUD texts
  private waveText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private baseHpText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  // Dim overlay for inactive solitaire area
  private solDimOverlay!: Phaser.GameObjects.Rectangle;

  // In-canvas phase action button
  private actionBtn!: Phaser.GameObjects.Container;
  private actionBtnBg!: Phaser.GameObjects.Rectangle;
  private actionBtnText!: Phaser.GameObjects.Text;

  private bridgeId = 'default';
  private initialSeed?: number;

  constructor() {
    super({ key: 'DefenseScene' });
  }

  init(data?: { seed?: number; bridgeId?: string }): void {
    this.initialSeed = data?.seed;
    this.bridgeId = data?.bridgeId ?? 'default';
  }

  create(): void {
    const { width, height } = this.scale;

    // Layout
    this.layout = new DefenseLayoutManager(width, height);

    // Defense core
    this.defenseCore = new DefenseCore();

    // Theme
    this.themeManager = new ThemeManager(this, this.layout.cardLayout, null as unknown as SpriteManager);
    this.themeManager.loadSaved();
    this.cameras.main.setBackgroundColor(this.themeManager.theme.tableColor);

    // Defense area backgrounds (rendered before everything else)
    this.createDefenseBackgrounds(width, height);

    // Card textures
    CardRenderer.generateTextures(this, this.layout.cardLayout.cardWidth, this.layout.cardLayout.cardHeight, this.themeManager.theme);

    // Sprites
    this.sprites = new DefenseSpriteManager(this, this.layout, this.themeManager.theme);
    this.sprites.cardSprites.createPileZones();

    // Fix ThemeManager reference
    (this.themeManager as unknown as { sprites: SpriteManager }).sprites = this.sprites.cardSprites;

    // Movement runner
    this.moveRunner = new CardMovementRunner(this, this.layout.cardLayout, () => {
      this.sprites.cardSprites.rebuild(this.defenseCore.core.state);
      this.cardInteraction.refresh();
    });

    // Hints
    this.hints = new HintRenderer(this, this.layout.cardLayout, this.sprites.cardSprites);

    // Card interaction (for card phase)
    this.cardInteraction = new InteractionController(
      this, this.sprites.cardSprites, this.layout.cardLayout, this.defenseCore.core, this.moveRunner,
      (movingSprites, fromPile, fromIndex, toPile, toIndex, endPositions, flipSprite) => {
        this.moveRunner.runMove(
          movingSprites, fromPile as PileType, fromIndex, toPile as PileType, toIndex, endPositions, flipSprite,
        );
      },
      () => { /* win not applicable in defense mode from card play alone */ },
      () => this.hints.clear(),
    );

    // Override card interaction's executeMove to route through DefenseCore
    this.hookCardMoves();

    // Defense interaction
    this.interaction = new DefenseInteractionController(
      this, this.layout, this.sprites, this.defenseCore, this.cardInteraction,
    );

    // Defense lane
    this.lane = new DefenseLane(this, this.layout);
    this.sprites.createBase();

    // Lane slot highlighting events
    this.events.on('highlightSlots', (available: boolean[]) => {
      this.lane.highlightSlots(available);
    });
    this.events.on('clearHighlights', () => {
      this.lane.clearHighlights();
    });

    // Dim overlay for solitaire area (used during deploy/battle phases)
    this.solDimOverlay = this.add.rectangle(
      width / 2, this.layout.splitY + (height - this.layout.splitY) / 2,
      width, height - this.layout.splitY,
      0x000000, 0.4,
    ).setDepth(9000).setVisible(false);

    // In-canvas action button (End Phase / Start Battle)
    this.createActionButton();

    // Initialize game state BEFORE HUD/events (they read defenseCore.state)
    this.defenseCore.newGame(this.initialSeed);
    this.sprites.cardSprites.buildFromState(this.defenseCore.core.state);

    // Create HUD
    this.createHUD();

    // Defense core events
    this.defenseCore.on('defenseStateChanged', () => {
      this.updatePhaseVisuals();
      this.syncBridge();
    });

    this.defenseCore.on('phaseChanged', ({ to }) => {
      if (to === GamePhase.BATTLE) {
        const n = this.defenseCore.state.enemies.length;
        showFloatingText(this, this.layout.canvasW / 2, this.layout.laneY,
          `BATTLE START! (${n} enemies)`, '#ff6b6b', 18);
      } else if (to === GamePhase.DEPLOY) {
        const n = this.defenseCore.state.unitPool.length;
        showFloatingText(this, this.layout.canvasW / 2, this.layout.laneY,
          `DEPLOY PHASE (${n} units)`, '#58a6ff', 18);
      }
    });

    this.defenseCore.on('unitProduced', ({ unit }) => {
      this.sprites.syncUnitPool(this.defenseCore.state.unitPool);
      showFloatingText(this, this.layout.canvasW / 2, this.layout.unitPoolY, `+${unit.unitClass}`, '#2ecc71');
    });

    this.defenseCore.on('comboTriggered', ({ suit, count }) => {
      const suitNames = ['Heart', 'Diamond', 'Club', 'Spade'];
      showFloatingText(this, this.layout.canvasW / 2, this.layout.unitPoolY - 20, `${suitNames[suit]} Combo x${count}!`, '#ffd700', 20);
    });

    this.defenseCore.on('milestoneAchieved', ({ milestone }) => {
      showFloatingText(this, this.layout.canvasW / 2, this.layout.laneY - 40, `Milestone: ${milestone}`, '#ff4500', 22);
    });

    this.defenseCore.on('unitDeployed', () => {
      this.sprites.syncUnits(this.defenseCore.state.deployedUnits);
      this.sprites.syncUnitPool(this.defenseCore.state.unitPool);
    });

    this.defenseCore.on('baseDamaged', ({ damage }) => {
      if (this.sprites.baseSprite) {
        this.sprites.baseSprite.playHit();
        this.sprites.baseSprite.updateHp(this.defenseCore.state.baseHp, this.defenseCore.state.baseMaxHp);
      }
      showDamageNumber(this, this.layout.baseX, this.layout.baseY - 20, damage, '#e74c3c');
      this.cameras.main.shake(100, 0.005);
    });

    this.defenseCore.on('enemyDefeated', ({ enemy }) => {
      const sprite = this.sprites.enemySprites.get(enemy.id);
      if (sprite) {
        showDamageNumber(this, sprite.x, sprite.y - 15, enemy.isBoss ? '+50' : '+10', '#ffd700');
      }
    });

    this.defenseCore.on('waveCleared', ({ wave, perfect }) => {
      showFloatingText(this, this.layout.canvasW / 2, this.layout.laneY, `Wave ${wave} Clear!`, '#2ecc71', 24);
      if (perfect) {
        showFloatingText(this, this.layout.canvasW / 2, this.layout.laneY + 30, 'PERFECT!', '#ffd700', 20);
      }
    });

    this.defenseCore.on('defenseGameOver', ({ victory, score, grade }) => {
      const msg = victory ? `VICTORY! Score: ${score} (${grade})` : `GAME OVER - Score: ${score} (${grade})`;
      const color = victory ? '#ffd700' : '#e74c3c';
      showFloatingText(this, this.layout.canvasW / 2, this.layout.canvasH / 2, msg, color, 28);
    });

    // SolitaireCore events for card phase
    this.defenseCore.core.on('stockDrawn', ({ wasReset }) => {
      if (wasReset) {
        this.sprites.cardSprites.rebuild(this.defenseCore.core.state);
        this.cardInteraction.refresh();
      }
      // Defense turn tracking — route through DefenseCore.consumeTurn()
      this.defenseCore.consumeTurn();
      this.updateHUD();
      this.syncBridge();
    });

    this.defenseCore.core.on('undone', () => {
      this.hints.clear();
      this.defenseCore.onUndone(); // restore turn + foundation snapshot (core already undone)
      this.sprites.cardSprites.rebuild(this.defenseCore.core.state);
      this.cardInteraction.refresh();
      this.syncBridge();
    });

    // Initial visual state
    this.updatePhaseVisuals();

    // Wire bridge
    this.wireBridge();

    // Resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  update(_time: number, delta: number): void {
    if (this.defenseCore.state.phase === GamePhase.BATTLE) {
      this.defenseCore.tickBattle(delta / 1000); // convert ms to seconds
      this.sprites.syncUnits(this.defenseCore.state.deployedUnits, true);
      this.sprites.syncEnemies(this.defenseCore.state.enemies);
      if (this.sprites.baseSprite) {
        this.sprites.baseSprite.updateHp(this.defenseCore.state.baseHp, this.defenseCore.state.baseMaxHp);
      }
      this.updateHUD();
    }
  }

  private hookCardMoves(): void {
    // InteractionController calls core.executeMove() directly, firing 'moveExecuted'.
    // We intercept to update DefenseCore's turn tracking & foundation detection.
    // NOTE: Must snapshot foundation BEFORE the move is applied, but 'moveExecuted'
    // fires AFTER. So we snapshot in a 'pre-move' style by snapshotting every frame
    // during card phase... OR we just let detectFoundationChanges compare current
    // state against its own prevFoundationCounts (already maintained by DefenseCore).
    this.defenseCore.core.on('moveExecuted', () => {
      if (this.defenseCore.state.phase === GamePhase.CARD) {
        this.defenseCore.detectFoundationChanges();
        this.defenseCore.consumeTurn();
        this.syncBridge();
        this.updateHUD();
      }
    });
  }

  private createActionButton(): void {
    const btnW = 160;
    const btnH = 36;
    const x = this.layout.canvasW - btnW / 2 - 16;
    const y = this.layout.unitPoolY;

    this.actionBtnBg = this.add.rectangle(0, 0, btnW, btnH, 0xdc2626, 1)
      .setStrokeStyle(2, 0xfca5a5);
    this.actionBtnText = this.add.text(0, 0, 'Start Battle', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.actionBtn = this.add.container(x, y, [this.actionBtnBg, this.actionBtnText]);
    this.actionBtn.setSize(btnW, btnH);
    this.actionBtn.setInteractive({ useHandCursor: true });
    this.actionBtn.setDepth(9600);
    this.actionBtn.setVisible(false);

    this.actionBtn.on('pointerover', () => {
      this.actionBtnBg.setFillStyle(0xef4444);
    });
    this.actionBtn.on('pointerout', () => {
      this.actionBtnBg.setFillStyle(0xdc2626);
    });
    this.actionBtn.on('pointerdown', () => {
      const phase = this.defenseCore.state.phase;
      if (phase === GamePhase.CARD) {
        this.defenseCore.endCardPhase();
      } else if (phase === GamePhase.DEPLOY) {
        this.defenseCore.startBattle();
      }
    });
  }

  private createDefenseBackgrounds(width: number, height: number): void {
    const { splitY, unitPoolY, unitPoolHeight } = this.layout;
    const defenseHeight = splitY - unitPoolHeight;

    // Dark background for defense lane area
    this.defenseBg = this.add.rectangle(
      width / 2, defenseHeight / 2,
      width, defenseHeight,
      0x0d1117, 1,
    ).setDepth(-10);

    // Slightly lighter bar for unit pool area
    this.unitPoolBg = this.add.rectangle(
      width / 2, unitPoolY,
      width, unitPoolHeight,
      0x161b22, 1,
    ).setDepth(-10);

    // Separator line between defense area and solitaire
    this.separatorLine = this.add.rectangle(
      width / 2, splitY,
      width, 3,
      0x30363d, 1,
    ).setDepth(100);
  }

  private createHUD(): void {
    const hudY = 8;
    const fs = Math.max(13, Math.round(this.layout.slotSize * 0.22));
    const textStyle = { fontSize: `${fs}px`, color: '#ffffff', fontFamily: 'monospace' };

    this.waveText = this.add.text(10, hudY, '', textStyle).setDepth(9500);
    this.turnText = this.add.text(10 + fs * 9, hudY, '', textStyle).setDepth(9500);
    this.scoreText = this.add.text(10 + fs * 22, hudY, '', textStyle).setDepth(9500);
    this.phaseText = this.add.text(10 + fs * 34, hudY, '', textStyle).setDepth(9500);

    // Base HP near the base sprite
    const hpFs = Math.max(11, Math.round(this.layout.slotSize * 0.18));
    this.baseHpText = this.add.text(
      this.layout.baseX, this.layout.baseY + this.layout.slotSize / 2 + 12,
      '', { fontSize: `${hpFs}px`, color: '#2ecc71', fontFamily: 'monospace' },
    ).setOrigin(0.5, 0).setDepth(9500);

    this.updateHUD();
  }

  private updateHUD(): void {
    const ds = this.defenseCore.state;
    this.waveText.setText(`Wave ${ds.wave}/10`);
    this.scoreText.setText(`Score: ${this.defenseCore.calculateScore()}`);
    this.phaseText.setText(`[${ds.phase}]`);
    this.baseHpText.setText(`${ds.baseHp}/${ds.baseMaxHp}`);

    if (ds.phase === GamePhase.CARD) {
      this.turnText.setText(`Turns: ${ds.turnsRemaining}/${ds.turnLimit}`);
      // Color turns remaining
      const ratio = ds.turnsRemaining / ds.turnLimit;
      if (ratio > 0.5) this.turnText.setColor('#2ecc71');
      else if (ratio > 0.25) this.turnText.setColor('#f1c40f');
      else this.turnText.setColor('#e74c3c');
    } else if (ds.phase === GamePhase.BATTLE) {
      this.turnText.setText(`Enemies: ${ds.enemies.filter(e => e.alive).length}`);
      this.turnText.setColor('#e74c3c');
    } else {
      this.turnText.setText('');
    }
  }

  private updatePhaseVisuals(): void {
    const phase = this.defenseCore.state.phase;

    // Dim solitaire area when not in card phase
    this.solDimOverlay.setVisible(phase !== GamePhase.CARD);

    // Lane dimming: slightly dim during card phase to show it's not active yet
    this.lane.setDimmed(phase === GamePhase.CARD);

    // Action button: show during CARD and DEPLOY phases
    if (phase === GamePhase.CARD) {
      this.actionBtn.setVisible(true);
      this.actionBtnText.setText('End Phase');
      this.actionBtnBg.setFillStyle(0x2563eb);
      this.actionBtn.on('pointerover', () => this.actionBtnBg.setFillStyle(0x3b82f6));
      this.actionBtn.on('pointerout', () => this.actionBtnBg.setFillStyle(0x2563eb));
    } else if (phase === GamePhase.DEPLOY) {
      this.actionBtn.setVisible(true);
      this.actionBtnText.setText('Start Battle');
      this.actionBtnBg.setFillStyle(0xdc2626);
      this.actionBtn.on('pointerover', () => this.actionBtnBg.setFillStyle(0xef4444));
      this.actionBtn.on('pointerout', () => this.actionBtnBg.setFillStyle(0xdc2626));
    } else {
      this.actionBtn.setVisible(false);
    }

    // Enable/disable interactions
    this.interaction.enable(phase);

    // Sync sprites
    this.sprites.syncUnitPool(this.defenseCore.state.unitPool);
    this.sprites.syncUnits(this.defenseCore.state.deployedUnits, phase === GamePhase.BATTLE);

    this.updateHUD();
  }

  private get canvasW(): number {
    return this.scale.width;
  }

  private syncBridge(): void {
    const bridge = getGameBridge(this.bridgeId);
    bridge.solverState = this.defenseCore.core.getSerializableState();
    bridge.emit('stateChanged', this.defenseCore.core.getDisplayState());
    bridge.emit('defenseStateChanged', this.defenseCore.getDisplayState());
  }

  private wireBridge(): void {
    const bridge = getGameBridge(this.bridgeId);

    bridge.newGameCallback = (seed?: number) => {
      try {
        if (!this.scene?.isActive()) return;
        this.hints.clear();
        this.sprites.destroyAll();
        this.defenseCore.newGame(seed);
        this.sprites.cardSprites.createPileZones();
        this.sprites.cardSprites.buildFromState(this.defenseCore.core.state);
        this.sprites.createBase();
        this.updatePhaseVisuals();
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('undo', () => {
      if (!this.sys) return;
      if (this.defenseCore.state.phase !== GamePhase.CARD) return;
      if (this.moveRunner.isAnimating) this.moveRunner.fastForward();
      this.defenseCore.core.undo(); // fires 'undone' -> scene listener calls defenseCore.onUndone()
    });

    bridge.showHintCallback = (move: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.hints.show(move as Move);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('getState', (callback: unknown) => {
      if (!this.sys) return;
      if (typeof callback === 'function') callback(this.defenseCore.core.getSerializableState());
    });

    // Defense-specific callbacks
    bridge.endCardPhaseCallback = () => {
      try {
        if (!this.scene?.isActive()) return;
        this.defenseCore.endCardPhase();
      } catch { /* Scene partially destroyed */ }
    };

    bridge.startBattleCallback = () => {
      try {
        if (!this.scene?.isActive()) return;
        this.defenseCore.startBattle();
      } catch { /* Scene partially destroyed */ }
    };

    bridge.setBattleSpeedCallback = (speed: number) => {
      try {
        if (!this.scene?.isActive()) return;
        this.defenseCore.setBattleSpeed(speed);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.deployUnitCallback = (unitId: string, slotIdx: number) => {
      try {
        if (!this.scene?.isActive()) return;
        this.defenseCore.deployUnit(unitId, slotIdx);
      } catch { /* Scene partially destroyed */ }
    };

    // Initial sync
    this.syncBridge();
  }

  private handleResize(width: number, height: number): void {
    this.layout = new DefenseLayoutManager(width, height);

    // Update backgrounds
    const defenseHeight = this.layout.splitY - this.layout.unitPoolHeight;
    this.defenseBg.setPosition(width / 2, defenseHeight / 2).setSize(width, defenseHeight);
    this.unitPoolBg.setPosition(width / 2, this.layout.unitPoolY).setSize(width, this.layout.unitPoolHeight);
    this.separatorLine.setPosition(width / 2, this.layout.splitY).setSize(width, 3);
    this.actionBtn.setPosition(width - 96, this.layout.unitPoolY);
    this.solDimOverlay.setPosition(
      width / 2, this.layout.splitY + (height - this.layout.splitY) / 2,
    ).setSize(width, height - this.layout.splitY);

    this.moveRunner.updateLayout(this.layout.cardLayout);
    this.sprites.updateLayout(this.layout);
    this.sprites.cardSprites.createPileZones();
    this.sprites.cardSprites.reposition(this.defenseCore.core.state);
    this.hints.updateLayout(this.layout.cardLayout);
    this.interaction.updateLayout(this.layout);
  }
}
