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
      this.updateDiceCount();
      this.updateHUD();
      return;
    }

    const roll = Math.ceil(Math.random() * 6);
    this.diceState.lastRoll = roll;
    this.applyModifier(roll);
    this.animateDice(roll);
    this.updateHUD();
  }

  private applyModifier(roll: number): void {
    switch (roll) {
      case 1: // Stumble
        if (this.diceState.shieldActive) {
          this.diceState.shieldActive = false;
        } else {
          this.applyStumble();
        }
        break;

      case 2: // Slow (visual only — shield absorbs)
        if (this.diceState.shieldActive) {
          this.diceState.shieldActive = false;
        }
        // else: cosmetic slow, no state change
        break;

      case 3: // Bonus Draw
        this.applyBonusDraw();
        break;

      case 4: // Shield
        this.diceState.shieldActive = true;
        break;

      case 5: // Frenzy
        this.diceState.frenzyMovesLeft = 3;
        this.showFrenzyEffect();
        break;

      case 6: // Jackpot
        this.diceState.jackpotActive = true;
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

  private updateDiceCount(): void {
    // Called during frenzy to update frenzy moves remaining in HUD without a new roll
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
  }

  private updateHUD(): void {
    if (!this.scoreText) return;

    this.checkFoundationScoring();

    this.scoreText.setText(`Score: ${this.diceState.score}`);

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
      },
    });

    // After animation, set final value (done by updateHUD called after rollDice)
    this.time.delayedCall(total * 40 + 50, () => {
      const colors: Record<number, string> = {
        1: '#e74c3c', 2: '#95a5a6', 3: '#2ecc71', 4: '#3498db', 5: '#ff6b00', 6: '#ffd700',
      };
      this.diceText.setText(`[ ${finalRoll} ]`);
      this.diceText.setColor(colors[finalRoll] ?? '#ffffff');
      this.updateHUD();
    });
  }

  private showFrenzyEffect(): void {
    if (!this.frenzyOverlay) return;
    this.frenzyOverlay.setVisible(true);
    this.frenzyOverlay.setAlpha(0.15);
    this.tweens.add({
      targets: this.frenzyOverlay,
      alpha: 0.0,
      duration: 600,
      yoyo: true,
      repeat: 2,
    });
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
  }
}
