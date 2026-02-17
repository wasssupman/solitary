import Phaser from 'phaser';
import { LayoutManager } from '../rendering/LayoutManager';
import { CardRenderer } from '../rendering/CardRenderer';
import { SolitaireCore } from '../core/SolitaireCore';
import { SpriteManager } from '../sprites/SpriteManager';
import { InteractionController } from '../interaction/InteractionController';
import { WinEffectRenderer } from '../effects/WinEffectRenderer';
import { ThemeManager } from '../rendering/ThemeManager';
import { CardMovementRunner } from '../movement/CardMovementRunner';
import { getGameBridge } from '../bridge/GameBridge';
import type { PileType } from '../movement/CardMovementData';

// ── Dice State ──────────────────────────────────────────────────────────────

interface DiceState {
  score: number;
  lastRoll: number | null;
  shieldActive: boolean;
  frenzyMovesLeft: number;
  jackpotActive: boolean;
  foundationCount: number;
  isWin: boolean;
}

// ── Scene ───────────────────────────────────────────────────────────────────

export class RandDiceScene extends Phaser.Scene {
  private layout!: LayoutManager;
  private core!: SolitaireCore;
  private sprites!: SpriteManager;
  private interaction!: InteractionController;
  private winEffect!: WinEffectRenderer;
  private themeManager!: ThemeManager;
  private moveRunner!: CardMovementRunner;

  private bridgeId = 'default';
  private initialSeed?: number;

  // Dice state
  private diceState: DiceState = {
    score: 0,
    lastRoll: null,
    shieldActive: false,
    frenzyMovesLeft: 0,
    jackpotActive: false,
    foundationCount: 0,
    isWin: false,
  };

  // HUD game objects
  private hudBg!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private diceText!: Phaser.GameObjects.Text;
  private modifierText!: Phaser.GameObjects.Text;
  private frenzyOverlay!: Phaser.GameObjects.Rectangle;

  // Visual effect objects
  private frenzyBorder: Phaser.GameObjects.Graphics | null = null;
  private shieldGraphic: Phaser.GameObjects.Graphics | null = null;
  private jackpotGlows: Phaser.GameObjects.Graphics[] = [];
  private diceGlowCircle!: Phaser.GameObjects.Arc;
  private prevScore = 0;

  // Bonus draw in progress guard (prevents recursive roll on stock event)
  private isBonusDraw = false;

  constructor() {
    super({ key: 'RandDiceScene' });
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
    (this.themeManager as unknown as { sprites: SpriteManager }).sprites = this.sprites;

    // Movement
    this.moveRunner = new CardMovementRunner(this, this.layout, () => {
      this.sprites.rebuild(this.core.state);
      this.interaction.refresh();
    });

    // Effects
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
      () => { /* no hint renderer in this mode */ },
    );

    // Core events
    this.core.on('moveExecuted', () => {
      this.rollDice();
      this.syncBridge();
    });

    this.core.on('stockDrawn', () => {
      if (!this.isBonusDraw) {
        this.rollDice();
      }
      this.syncBridge();
    });

    this.core.on('gameWon', () => {
      this.diceState.score += 5000;
      this.diceState.isWin = true;
      const bridge = getGameBridge(this.bridgeId);
      bridge.emit('gameWon');
      this.syncBridge();
      this.updateHUD();
    });

    // Frenzy overlay (below HUD, above game area — purely cosmetic pulse)
    this.frenzyOverlay = this.add.rectangle(
      width / 2, height / 2, width, height,
      0xff6600, 0.0,
    ).setDepth(8000).setVisible(false);

    // HUD
    this.createHUD();

    // Start game
    this.core.newGame(this.initialSeed);
    this.sprites.buildFromState(this.core.state);
    this.interaction.enable();

    this.wireBridge();

    // Resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    });
  }

  // ── Dice Logic ─────────────────────────────────────────────────────────────

  private rollDice(): void {
    if (this.diceState.isWin) return;

    // Frenzy: consume a free move instead of rolling
    if (this.diceState.frenzyMovesLeft > 0) {
      this.diceState.frenzyMovesLeft--;
      this.showFrenzyCountdown();
      this.updateHUD();
      return;
    }

    const roll = Math.ceil(Math.random() * 6);
    this.diceState.lastRoll = roll;
    this.applyModifier(roll);
    this.animateDice(roll);
    this.showRollFeedback(roll);
    this.updateHUD();
  }

  private applyModifier(roll: number): void {
    switch (roll) {
      case 1: // Stumble
        if (this.diceState.shieldActive) {
          this.diceState.shieldActive = false;
          this.cameras.main.shake(100, 0.003);
          this.showShieldBreak();
        } else {
          this.applyStumble();
          this.cameras.main.shake(200, 0.008);
        }
        break;

      case 2: // Slow (visual only — shield absorbs)
        if (this.diceState.shieldActive) {
          this.diceState.shieldActive = false;
          this.cameras.main.shake(100, 0.003);
          this.showShieldBreak();
        }
        break;

      case 3: // Bonus Draw
        this.applyBonusDraw();
        break;

      case 4: // Shield
        this.diceState.shieldActive = true;
        this.showShieldAcquire();
        break;

      case 5: // Frenzy
        this.diceState.frenzyMovesLeft = 3;
        this.showFrenzyEffect();
        break;

      case 6: // Jackpot
        this.diceState.jackpotActive = true;
        this.cameras.main.shake(150, 0.005);
        this.showJackpotGlow();
        break;
    }
  }

  private applyStumble(): void {
    // Collect tableau piles with at least one face-up card
    const candidates: number[] = [];
    for (let col = 0; col < 7; col++) {
      const pile = this.core.state.tableau[col];
      if (pile.length > 0 && pile[pile.length - 1].faceUp) {
        candidates.push(col);
      }
    }
    if (candidates.length === 0) return;

    const col = candidates[Math.floor(Math.random() * candidates.length)];
    const pile = this.core.state.tableau[col];

    // Find the topmost face-up card and flip it face-down
    for (let i = pile.length - 1; i >= 0; i--) {
      if (pile[i].faceUp) {
        // Replace the card with a face-down version
        pile[i] = { ...pile[i], faceUp: false };
        break;
      }
    }

    this.sprites.rebuild(this.core.state);
    this.interaction.refresh();
  }

  private applyBonusDraw(): void {
    if (this.core.state.stock.length === 0 && this.core.state.waste.length === 0) return;
    this.isBonusDraw = true;
    this.core.drawStock();
    this.isBonusDraw = false;
    this.sprites.rebuild(this.core.state);
    this.interaction.refresh();
  }

  // ── Foundation Score Tracking ───────────────────────────────────────────────

  private countFoundation(): number {
    return this.core.state.foundation.reduce((sum, pile) => sum + pile.length, 0);
  }

  private checkFoundationScoring(): void {
    const current = this.countFoundation();
    const prev = this.diceState.foundationCount;
    if (current > prev) {
      const placed = current - prev;
      const pts = this.diceState.jackpotActive ? 200 : 100;
      this.diceState.score += pts * placed;
      if (this.diceState.jackpotActive) {
        this.diceState.jackpotActive = false;
        this.clearJackpotGlows();
        this.showJackpotText();
      }
      this.diceState.foundationCount = current;
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const { width } = this.scale;
    const hudH = 36;
    const y = hudH / 2;

    this.hudBg = this.add.rectangle(width / 2, y, width, hudH, 0x1a1a2e, 0.85)
      .setDepth(9500);

    const textStyle = { fontSize: '14px', color: '#ffffff', fontFamily: 'monospace' };

    this.scoreText = this.add.text(8, y, 'Score: 0', textStyle)
      .setOrigin(0, 0.5).setDepth(9600);

    this.diceText = this.add.text(width / 2, y, '[ - ]', {
      ...textStyle, fontSize: '18px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(9600);

    this.modifierText = this.add.text(width - 8, y, '', {
      ...textStyle, color: '#58a6ff',
    }).setOrigin(1, 0.5).setDepth(9600);

    // Glow circle behind dice text (hidden by default)
    this.diceGlowCircle = this.add.circle(width / 2, y, 24, 0xffffff, 0)
      .setDepth(9550).setVisible(false);
  }

  private updateHUD(): void {
    if (!this.scoreText) return;

    this.checkFoundationScoring();

    const scoreChanged = this.diceState.score !== this.prevScore;
    this.scoreText.setText(`Score: ${this.diceState.score}`);

    if (scoreChanged && this.prevScore > 0) {
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 100,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
      if (this.diceState.jackpotActive || this.diceState.lastRoll === 6) {
        this.scoreText.setColor('#ffd700');
        this.time.delayedCall(400, () => this.scoreText?.setColor('#ffffff'));
      }
    }
    this.prevScore = this.diceState.score;

    if (this.diceState.lastRoll !== null) {
      const faces = ['', '1', '2', '3', '4', '5', '6'];
      this.diceText.setText(`[ ${faces[this.diceState.lastRoll]} ]`);

      const colors: Record<number, string> = {
        1: '#e74c3c', // Stumble — red
        2: '#95a5a6', // Slow — grey
        3: '#2ecc71', // Bonus — green
        4: '#3498db', // Shield — blue
        5: '#ff6b00', // Frenzy — orange
        6: '#ffd700', // Jackpot — gold
      };
      this.diceText.setColor(colors[this.diceState.lastRoll] ?? '#ffffff');
    }

    // Modifier label
    if (this.diceState.frenzyMovesLeft > 0) {
      this.modifierText.setText(`FRENZY x${this.diceState.frenzyMovesLeft}`).setColor('#ff6b00');
    } else if (this.diceState.shieldActive) {
      this.modifierText.setText('SHIELD').setColor('#3498db');
    } else if (this.diceState.jackpotActive) {
      this.modifierText.setText('JACKPOT x2').setColor('#ffd700');
    } else if (this.diceState.isWin) {
      this.modifierText.setText('WIN!').setColor('#ffd700');
    } else {
      this.modifierText.setText('');
    }

    // Frenzy overlay pulse
    this.frenzyOverlay.setVisible(this.diceState.frenzyMovesLeft > 0);

    this.syncBridge();
  }

  // ── Animations ─────────────────────────────────────────────────────────────

  private animateDice(finalRoll: number): void {
    if (!this.diceText) return;
    let ticks = 0;
    const total = 8;
    const timer = this.time.addEvent({
      delay: 40,
      repeat: total,
      callback: () => {
        ticks++;
        if (ticks >= total) {
          timer.remove();
          return;
        }
        const faces = ['1', '2', '3', '4', '5', '6'];
        this.diceText.setText(`[ ${faces[Math.floor(Math.random() * 6)]} ]`);
        this.diceText.setColor('#ffffff');
        // Scale bounce per tick
        this.tweens.add({
          targets: this.diceText,
          scaleX: 1.4,
          scaleY: 1.4,
          duration: 20,
          yoyo: true,
        });
      },
    });

    // After animation, set final value
    this.time.delayedCall(total * 40 + 50, () => {
      const colors: Record<number, string> = {
        1: '#e74c3c', 2: '#95a5a6', 3: '#2ecc71', 4: '#3498db', 5: '#ff6b00', 6: '#ffd700',
      };
      const color = colors[finalRoll] ?? '#ffffff';
      this.diceText.setText(`[ ${finalRoll} ]`);
      this.diceText.setColor(color);

      // Big scale punch on final result
      this.tweens.add({
        targets: this.diceText,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 150,
        yoyo: true,
        ease: 'Quad.easeOut',
      });

      // Glow circle flash behind dice
      if (this.diceGlowCircle) {
        const colorNum = parseInt(color.replace('#', ''), 16);
        this.diceGlowCircle.setFillStyle(colorNum, 0.4).setVisible(true).setScale(1).setAlpha(1);
        this.tweens.add({
          targets: this.diceGlowCircle,
          alpha: 0,
          scaleX: 2,
          scaleY: 2,
          duration: 400,
          onComplete: () => {
            this.diceGlowCircle?.setVisible(false).setScale(1).setAlpha(1);
          },
        });
      }

      this.updateHUD();
    });
  }

  private showFrenzyEffect(): void {
    if (!this.frenzyOverlay) return;

    // Overlay pulse
    this.frenzyOverlay.setVisible(true);
    this.frenzyOverlay.setAlpha(0.15);
    this.tweens.add({
      targets: this.frenzyOverlay,
      alpha: 0.0,
      duration: 600,
      yoyo: true,
      repeat: 2,
    });

    // Border glow pulse
    this.showFrenzyBorder();

    // Large "FRENZY" popup
    const { width, height } = this.scale;
    const frenzyLabel = this.add.text(width / 2, height / 2 - 60, 'FRENZY!', {
      fontSize: '40px', color: '#ff6b00', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9999).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: frenzyLabel,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: frenzyLabel,
          alpha: 0,
          y: height / 2 - 100,
          duration: 800,
          delay: 400,
          onComplete: () => frenzyLabel.destroy(),
        });
      },
    });
  }

  private showFrenzyBorder(): void {
    this.clearFrenzyBorder();
    const { width, height } = this.scale;
    const g = this.add.graphics().setDepth(8500);
    g.lineStyle(4, 0xff6b00, 0.7);
    g.strokeRect(2, 2, width - 4, height - 4);
    this.frenzyBorder = g;
    this.tweens.add({
      targets: g,
      alpha: { from: 0.3, to: 0.8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  private clearFrenzyBorder(): void {
    if (this.frenzyBorder) {
      this.tweens.killTweensOf(this.frenzyBorder);
      this.frenzyBorder.destroy();
      this.frenzyBorder = null;
    }
  }

  private showFrenzyCountdown(): void {
    const { width } = this.scale;
    const left = this.diceState.frenzyMovesLeft;
    const label = left > 0 ? `${left} LEFT` : 'FRENZY END';
    const color = left > 0 ? '#ff6b00' : '#e74c3c';

    const text = this.add.text(width / 2, 65, label, {
      fontSize: '20px', color, fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9999);

    this.tweens.add({
      targets: text,
      y: 25,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });

    // Clear frenzy border when frenzy ends
    if (left === 0) {
      this.clearFrenzyBorder();
    }
  }

  // ── Roll Feedback ───────────────────────────────────────────────────────────

  private showRollFeedback(roll: number): void {
    const { width } = this.scale;
    const names: Record<number, string> = {
      1: 'STUMBLE', 2: 'SLOW', 3: 'BONUS DRAW',
      4: 'SHIELD', 5: 'FRENZY', 6: 'JACKPOT',
    };
    const colors: Record<number, string> = {
      1: '#e74c3c', 2: '#95a5a6', 3: '#2ecc71',
      4: '#3498db', 5: '#ff6b00', 6: '#ffd700',
    };

    const text = this.add.text(width / 2, 60, names[roll], {
      fontSize: '24px', color: colors[roll], fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9999);

    this.tweens.add({
      targets: text,
      y: 10,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  // ── Shield Visuals ──────────────────────────────────────────────────────────

  private showShieldAcquire(): void {
    this.clearShieldGraphic();
    const { width } = this.scale;
    const cx = width - 50;
    const cy = 60;
    const g = this.add.graphics().setDepth(9400);

    // Blue shield circle
    g.fillStyle(0x3498db, 0.3);
    g.fillCircle(cx, cy, 18);
    g.lineStyle(2, 0x3498db, 0.8);
    g.strokeCircle(cx, cy, 18);

    // Shield chevron icon
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.moveTo(cx - 6, cy - 6);
    g.lineTo(cx, cy + 10);
    g.lineTo(cx + 6, cy - 6);
    g.closePath();
    g.strokePath();

    this.shieldGraphic = g;
    g.setScale(0);
    this.tweens.add({
      targets: g,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  private showShieldBreak(): void {
    if (!this.shieldGraphic) return;
    const g = this.shieldGraphic;
    this.shieldGraphic = null;
    this.tweens.killTweensOf(g);
    this.tweens.add({
      targets: g,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  private clearShieldGraphic(): void {
    if (this.shieldGraphic) {
      this.tweens.killTweensOf(this.shieldGraphic);
      this.shieldGraphic.destroy();
      this.shieldGraphic = null;
    }
  }

  // ── Jackpot Foundation Glow ─────────────────────────────────────────────────

  private showJackpotGlow(): void {
    this.clearJackpotGlows();
    for (let i = 0; i < 4; i++) {
      const pos = this.layout.getFoundationPosition(i);
      const g = this.add.graphics().setDepth(9300);
      g.lineStyle(3, 0xffd700, 0.6);
      g.strokeRoundedRect(
        pos.x - this.layout.cardWidth / 2 - 4,
        pos.y - this.layout.cardHeight / 2 - 4,
        this.layout.cardWidth + 8,
        this.layout.cardHeight + 8,
        6,
      );
      this.jackpotGlows.push(g);
      this.tweens.add({
        targets: g,
        alpha: { from: 0.3, to: 1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private clearJackpotGlows(): void {
    for (const g of this.jackpotGlows) {
      this.tweens.killTweensOf(g);
      g.destroy();
    }
    this.jackpotGlows = [];
  }

  private showJackpotText(): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2 - 40, 'JACKPOT x2!', {
      fontSize: '28px', color: '#ffd700', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9999);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: height / 2 - 80,
      duration: 1200,
      onComplete: () => text.destroy(),
    });
  }

  // ── Bridge ─────────────────────────────────────────────────────────────────

  private syncBridge(): void {
    const bridge = getGameBridge(this.bridgeId);
    bridge.solverState = this.core.getSerializableState();
    bridge.emit('stateChanged', this.core.getDisplayState());
    bridge.emit('randDiceStateChanged', { ...this.diceState });
  }

  private wireBridge(): void {
    const bridge = getGameBridge(this.bridgeId);

    bridge.newGameCallback = (seed?: number) => {
      try {
        if (!this.scene?.isActive()) return;
        if (this.sprites.stockClickZone) {
          this.sprites.stockClickZone.destroy();
          this.sprites.stockClickZone = null;
        }
        this.sprites.clearAll();
        this.sprites.tableauSprites = [[], [], [], [], [], [], []];
        this.sprites.foundationSprites = [[], [], [], []];
        this.sprites.stockSprites = [];
        this.sprites.wasteSprites = [];

        // Reset dice state
        this.diceState = {
          score: 0,
          lastRoll: null,
          shieldActive: false,
          frenzyMovesLeft: 0,
          jackpotActive: false,
          foundationCount: 0,
          isWin: false,
        };

        this.core.newGame(seed);
        this.sprites.buildFromState(this.core.state);
        this.interaction.enable();
        this.frenzyOverlay.setVisible(false);
        this.clearFrenzyBorder();
        this.clearShieldGraphic();
        this.clearJackpotGlows();
        this.prevScore = 0;
        this.updateHUD();
      } catch { /* Scene partially destroyed */ }
    };

    // Initial state
    this.syncBridge();
    this.updateHUD();
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private handleResize(width: number, height: number): void {
    this.layout = new LayoutManager(width, height);
    this.moveRunner.updateLayout(this.layout);
    this.sprites.updateLayout(this.layout);
    this.sprites.createPileZones();
    this.sprites.reposition(this.core.state);
    this.interaction.updateLayout(this.layout);

    // Reposition HUD elements
    const hudH = 36;
    const y = hudH / 2;
    this.hudBg.setPosition(width / 2, y).setSize(width, hudH);
    this.diceText.setPosition(width / 2, y);
    this.modifierText.setPosition(width - 8, y);
    this.frenzyOverlay.setPosition(width / 2, height / 2).setSize(width, height);

    // Reposition glow circle
    if (this.diceGlowCircle) {
      this.diceGlowCircle.setPosition(width / 2, hudH / 2);
    }
  }
}
