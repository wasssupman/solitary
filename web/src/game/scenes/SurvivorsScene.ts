import Phaser from 'phaser';
import { SurvivorsCore } from '../survivors/SurvivorsCore';
import { SurvivorsLayoutManager } from '../survivors/SurvivorsLayoutManager';
import { SurvivorsGamePhase } from '../survivors/SurvivorsState';
import {
  SUIT_COLORS, SUIT_COLOR_STRINGS,
  PLAYER_COLLISION_RADIUS, ENEMY_COLLISION_RADIUS, PROJECTILE_RADIUS,
  PLAYER_INVINCIBILITY_DURATION, WAVE_DURATION,
} from '../survivors/constants';
import { InteractionController } from '../interaction/InteractionController';
import { CardRenderer } from '../rendering/CardRenderer';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import { HintRenderer } from '../effects/HintRenderer';
import { ThemeManager } from '../rendering/ThemeManager';
import { SpriteManager } from '../sprites/SpriteManager';
import { showFloatingText, showDamageNumber } from '../objects/DamageNumber';
import { GlitchFXPipeline } from '../effects/GlitchFXPipeline';
import { getGameBridge } from '../bridge/GameBridge';
import type { Move } from '../../solver/types';
import type { PileType } from '../movement/CardMovementData';

export class SurvivorsScene extends Phaser.Scene {
  private survivorsCore!: SurvivorsCore;
  private layout!: SurvivorsLayoutManager;
  private cardSprites!: SpriteManager;
  private cardInteraction!: InteractionController;
  private moveRunner!: CardMovementRunner;
  private hints!: HintRenderer;
  private themeManager!: ThemeManager;

  // Arena visuals
  private arenaBg!: Phaser.GameObjects.Rectangle;
  private separatorLine!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Arc;

  // HUD texts
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  // HP bar
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;

  // Sprite pools for enemies/projectiles
  private enemySprites = new Map<string, Phaser.GameObjects.Arc>();
  private projectileSprites = new Map<string, Phaser.GameObjects.Arc>();

  // Enemy HP bars
  private enemyHpBars = new Map<string, { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle }>();

  private bridgeId = 'default';
  private initialSeed?: number;

  constructor() {
    super({ key: 'SurvivorsScene' });
  }

  init(data?: { seed?: number; bridgeId?: string }): void {
    this.initialSeed = data?.seed;
    this.bridgeId = data?.bridgeId ?? 'default';
  }

  create(): void {
    const { width, height } = this.scale;

    // Register custom PostFX pipelines (WebGL only)
    const renderer = this.game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && renderer.pipelines) {
      renderer.pipelines.addPostPipeline('GlitchFX', GlitchFXPipeline);
    }

    // Layout
    this.layout = new SurvivorsLayoutManager(width, height);

    // Core
    this.survivorsCore = new SurvivorsCore();
    this.survivorsCore.arenaWidth = width;
    this.survivorsCore.arenaHeight = this.layout.arenaHeight;
    this.survivorsCore.spawnRadius = this.layout.spawnRadius;

    // Theme
    this.themeManager = new ThemeManager(this, this.layout.cardLayout, null as unknown as SpriteManager);
    this.themeManager.loadSaved();
    this.cameras.main.setBackgroundColor(this.themeManager.theme.tableColor);

    // Arena background (dark area, upper portion)
    this.createArenaVisuals(width, height);

    // Card textures
    CardRenderer.generateTextures(
      this, this.layout.cardLayout.cardWidth, this.layout.cardLayout.cardHeight,
      this.themeManager.theme,
    );

    // Card sprites
    this.cardSprites = new SpriteManager(this, this.layout.cardLayout, this.themeManager.theme);
    this.cardSprites.createPileZones();

    // Fix ThemeManager sprite reference
    (this.themeManager as unknown as { sprites: SpriteManager }).sprites = this.cardSprites;

    // Movement runner
    this.moveRunner = new CardMovementRunner(this, this.layout.cardLayout, () => {
      this.cardSprites.rebuild(this.survivorsCore.core.state);
      this.cardInteraction.refresh();
    });

    // Hints
    this.hints = new HintRenderer(this, this.layout.cardLayout, this.cardSprites);

    // Card interaction
    this.cardInteraction = new InteractionController(
      this, this.cardSprites, this.layout.cardLayout, this.survivorsCore.core, this.moveRunner,
      (movingSprites, fromPile, fromIndex, toPile, toIndex, endPositions, flipSprite) => {
        this.moveRunner.runMove(
          movingSprites, fromPile as PileType, fromIndex, toPile as PileType, toIndex, endPositions, flipSprite,
        );
      },
      () => { /* win handled by survivors game over */ },
      () => this.hints.clear(),
    );

    // Hook card moves for foundation detection
    this.hookCardMoves();

    // Initialize game
    this.survivorsCore.newGame(this.initialSeed);
    this.cardSprites.buildFromState(this.survivorsCore.core.state);

    // Enable card interaction (drag/drop, stock click)
    this.cardInteraction.enable();

    // Create HUD
    this.createHUD();

    // Wire survivors core events
    this.wireSurvivorsEvents();

    // SolitaireCore events
    this.survivorsCore.core.on('stockDrawn', ({ wasReset }) => {
      if (wasReset) {
        this.cardSprites.rebuild(this.survivorsCore.core.state);
        this.cardInteraction.refresh();
      }
      this.syncBridge();
    });

    this.survivorsCore.core.on('undone', () => {
      this.hints.clear();
      this.survivorsCore.onUndone();
      this.cardSprites.rebuild(this.survivorsCore.core.state);
      this.cardInteraction.refresh();
      this.syncBridge();
    });

    // Wire bridge
    this.wireBridge();

    // Resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  update(_time: number, delta: number): void {
    if (this.survivorsCore.phase !== SurvivorsGamePhase.PLAYING) return;

    const deltaSec = delta / 1000;

    // Tick battle logic
    this.survivorsCore.tickBattle(deltaSec);

    // Sync arena sprites
    this.syncEnemySprites();
    this.syncProjectileSprites();
    this.updatePlayerVisual();
    this.updateHUD();
  }

  // ── Arena Visuals ──

  private createArenaVisuals(width: number, _height: number): void {
    // Dark arena background
    this.arenaBg = this.add.rectangle(
      width / 2, this.layout.arenaHeight / 2,
      width, this.layout.arenaHeight,
      0x0d1117, 1,
    ).setDepth(-10);

    // Separator line
    this.separatorLine = this.add.rectangle(
      width / 2, this.layout.splitY,
      width, this.layout.separatorHeight,
      0x30363d, 1,
    ).setDepth(100);

    // Player character (colored circle at center)
    this.playerSprite = this.add.circle(
      this.layout.playerX, this.layout.playerY,
      PLAYER_COLLISION_RADIUS, 0x58a6ff, 1,
    ).setDepth(500);
    this.playerSprite.setStrokeStyle(2, 0xffffff);
  }

  // ── HUD ──

  private createHUD(): void {
    const hudY = this.layout.getHudY();
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    };

    this.hpText = this.add.text(10, hudY, '', textStyle).setDepth(9500);
    this.waveText = this.add.text(10, hudY + 18, '', textStyle).setDepth(9500);
    this.timeText = this.add.text(160, hudY, '', textStyle).setDepth(9500);
    this.scoreText = this.add.text(160, hudY + 18, '', textStyle).setDepth(9500);

    // HP bar under HUD
    const barX = this.layout.canvasW - 170;
    const barY = hudY + 4;
    const barW = 150;
    const barH = 12;
    this.hpBarBg = this.add.rectangle(barX, barY, barW, barH, 0x333333, 1)
      .setOrigin(0, 0).setDepth(9500);
    this.hpBarFill = this.add.rectangle(barX, barY, barW, barH, 0x2ecc71, 1)
      .setOrigin(0, 0).setDepth(9501);

    this.updateHUD();
  }

  private updateHUD(): void {
    const ss = this.survivorsCore.state;
    this.hpText.setText(`HP: ${Math.max(0, ss.playerHp)}/${ss.playerMaxHp}`);
    this.waveText.setText(`Wave: ${ss.wave}/10`);
    const waveTimeLeft = Math.max(0, WAVE_DURATION - ss.waveTime);
    this.timeText.setText(`Time: ${Math.ceil(waveTimeLeft)}s`);
    this.scoreText.setText(`Score: ${ss.score}`);

    // HP bar
    const ratio = Math.max(0, ss.playerHp / ss.playerMaxHp);
    this.hpBarFill.setSize(150 * ratio, 12);
    if (ratio > 0.5) this.hpBarFill.setFillStyle(0x2ecc71);
    else if (ratio > 0.25) this.hpBarFill.setFillStyle(0xf1c40f);
    else this.hpBarFill.setFillStyle(0xe74c3c);
  }

  // ── Sprite Sync ──

  private syncEnemySprites(): void {
    const enemies = this.survivorsCore.state.enemies;
    const seen = new Set<string>();

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      seen.add(enemy.id);

      let sprite = this.enemySprites.get(enemy.id);
      if (!sprite) {
        sprite = this.add.circle(enemy.x, enemy.y, ENEMY_COLLISION_RADIUS, 0xe74c3c, 1)
          .setDepth(400);
        sprite.setStrokeStyle(1, 0xffffff);
        this.enemySprites.set(enemy.id, sprite);

        // Create HP bar for enemy
        const hpBg = this.add.rectangle(enemy.x - 12, enemy.y - ENEMY_COLLISION_RADIUS - 6, 24, 4, 0x333333, 1)
          .setOrigin(0, 0).setDepth(401);
        const hpFill = this.add.rectangle(enemy.x - 12, enemy.y - ENEMY_COLLISION_RADIUS - 6, 24, 4, 0x2ecc71, 1)
          .setOrigin(0, 0).setDepth(402);
        this.enemyHpBars.set(enemy.id, { bg: hpBg, fill: hpFill });
      }

      sprite.setPosition(enemy.x, enemy.y);

      // Update HP bar
      const hpBar = this.enemyHpBars.get(enemy.id);
      if (hpBar) {
        hpBar.bg.setPosition(enemy.x - 12, enemy.y - ENEMY_COLLISION_RADIUS - 6);
        const ratio = enemy.hp / enemy.maxHp;
        hpBar.fill.setPosition(enemy.x - 12, enemy.y - ENEMY_COLLISION_RADIUS - 6);
        hpBar.fill.setSize(24 * ratio, 4);
      }
    }

    // Remove dead enemy sprites
    for (const [id, sprite] of this.enemySprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
        const hpBar = this.enemyHpBars.get(id);
        if (hpBar) {
          hpBar.bg.destroy();
          hpBar.fill.destroy();
          this.enemyHpBars.delete(id);
        }
      }
    }
  }

  private syncProjectileSprites(): void {
    const projectiles = this.survivorsCore.state.projectiles;
    const seen = new Set<string>();

    for (const proj of projectiles) {
      if (!proj.alive) continue;
      seen.add(proj.id);

      let sprite = this.projectileSprites.get(proj.id);
      if (!sprite) {
        const color = SUIT_COLORS[proj.suit] ?? 0xffffff;
        sprite = this.add.circle(proj.x, proj.y, PROJECTILE_RADIUS, color, 1)
          .setDepth(450);
        this.projectileSprites.set(proj.id, sprite);
      }

      sprite.setPosition(proj.x, proj.y);
    }

    // Remove dead projectile sprites
    for (const [id, sprite] of this.projectileSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  private updatePlayerVisual(): void {
    const ss = this.survivorsCore.state;

    // Flash during invincibility
    if (ss.invincibilityTimer > 0) {
      const flash = Math.sin(ss.invincibilityTimer * 20) > 0;
      this.playerSprite.setAlpha(flash ? 0.3 : 1);
    } else {
      this.playerSprite.setAlpha(1);
    }
  }

  // ── Card Move Hooks ──

  private hookCardMoves(): void {
    this.survivorsCore.core.on('moveExecuted', () => {
      if (this.survivorsCore.phase === SurvivorsGamePhase.PLAYING) {
        this.survivorsCore.detectFoundationChanges();
        this.syncBridge();
      }
    });
  }

  // ── Survivors Core Events ──

  private wireSurvivorsEvents(): void {
    this.survivorsCore.on('foundationPlaced', ({ suit, tier, damage }) => {
      const suitNames = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
      const color = SUIT_COLOR_STRINGS[suit] ?? '#ffffff';
      showFloatingText(this, this.layout.playerX, this.layout.playerY - 30,
        `${suitNames[suit]} T${tier} (${damage} dmg)`, color, 16);
    });

    this.survivorsCore.on('enemyKilled', ({ enemy }) => {
      showDamageNumber(this, enemy.x, enemy.y - 15, '+10', '#ffd700');
    });

    this.survivorsCore.on('playerHit', ({ damage }) => {
      showDamageNumber(this, this.layout.playerX, this.layout.playerY - 20, damage, '#e74c3c');
      this.cameras.main.shake(80, 0.004);
    });

    this.survivorsCore.on('waveCleared', ({ wave }) => {
      showFloatingText(this, this.layout.canvasW / 2, this.layout.arenaHeight / 2,
        `Wave ${wave} Clear!`, '#2ecc71', 24);
    });

    this.survivorsCore.on('survivorsGameOver', ({ victory, score }) => {
      const msg = victory ? `VICTORY! Score: ${score}` : `GAME OVER - Score: ${score}`;
      const color = victory ? '#ffd700' : '#e74c3c';
      showFloatingText(this, this.layout.canvasW / 2, this.layout.canvasH / 2, msg, color, 28);

      // Disable card interaction on game end
      this.cardInteraction.disable();
    });
  }

  // ── Bridge ──

  private syncBridge(): void {
    const bridge = getGameBridge(this.bridgeId);
    bridge.solverState = this.survivorsCore.core.getSerializableState();
    bridge.emit('stateChanged', this.survivorsCore.core.getDisplayState());
    bridge.emit('survivorsStateChanged', this.survivorsCore.getDisplayState());
  }

  private wireBridge(): void {
    const bridge = getGameBridge(this.bridgeId);

    bridge.newGameCallback = (seed?: number) => {
      try {
        if (!this.scene?.isActive()) return;
        this.hints.clear();
        this.destroyArenaSprites();
        this.survivorsCore.newGame(seed);
        this.cardSprites.destroyPileZones();
        this.cardSprites.createPileZones();
        this.cardSprites.buildFromState(this.survivorsCore.core.state);
        this.cardInteraction.enable();
        this.updateHUD();
        this.syncBridge();
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('undo', () => {
      if (!this.sys) return;
      if (this.survivorsCore.phase !== SurvivorsGamePhase.PLAYING) return;
      if (this.moveRunner.isAnimating) this.moveRunner.fastForward();
      this.survivorsCore.core.undo();
    });

    bridge.showHintCallback = (move: unknown) => {
      try {
        if (!this.scene?.isActive()) return;
        this.hints.show(move as Move);
      } catch { /* Scene partially destroyed */ }
    };

    bridge.on('getState', (callback: unknown) => {
      if (!this.sys) return;
      if (typeof callback === 'function') callback(this.survivorsCore.core.getSerializableState());
    });

    // Initial sync
    this.syncBridge();
  }

  // ── Cleanup ──

  private destroyArenaSprites(): void {
    for (const [, sprite] of this.enemySprites) sprite.destroy();
    this.enemySprites.clear();
    for (const [, sprite] of this.projectileSprites) sprite.destroy();
    this.projectileSprites.clear();
    for (const [, bar] of this.enemyHpBars) {
      bar.bg.destroy();
      bar.fill.destroy();
    }
    this.enemyHpBars.clear();
  }

  // ── Resize ──

  private handleResize(width: number, height: number): void {
    this.layout = new SurvivorsLayoutManager(width, height);

    // Update core arena dimensions
    this.survivorsCore.arenaWidth = width;
    this.survivorsCore.arenaHeight = this.layout.arenaHeight;
    this.survivorsCore.spawnRadius = this.layout.spawnRadius;

    // Update player position in state
    this.survivorsCore.state.playerX = this.layout.playerX;
    this.survivorsCore.state.playerY = this.layout.playerY;

    // Update arena visuals
    this.arenaBg.setPosition(width / 2, this.layout.arenaHeight / 2)
      .setSize(width, this.layout.arenaHeight);
    this.separatorLine.setPosition(width / 2, this.layout.splitY)
      .setSize(width, this.layout.separatorHeight);
    this.playerSprite.setPosition(this.layout.playerX, this.layout.playerY);

    // Update HUD positions
    const barX = width - 170;
    this.hpBarBg.setPosition(barX, this.layout.getHudY() + 4);
    this.hpBarFill.setPosition(barX, this.layout.getHudY() + 4);

    // Update card layout
    this.moveRunner.updateLayout(this.layout.cardLayout);
    this.cardSprites.updateLayout(this.layout.cardLayout);
    this.cardSprites.createPileZones();
    this.cardSprites.reposition(this.survivorsCore.core.state);
    this.hints.updateLayout(this.layout.cardLayout);
  }
}
