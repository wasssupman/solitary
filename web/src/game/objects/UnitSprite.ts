import Phaser from 'phaser';
import { UnitClass, UnitGrade } from '../defense/DefenseState';

const SUIT_COLORS: Record<number, number> = {
  0: 0xe74c3c, // Hearts - red
  1: 0x3498db, // Diamonds - blue
  2: 0x2ecc71, // Clubs - green
  3: 0x9b59b6, // Spades - purple
};

const GRADE_BORDER_COLORS: Record<UnitGrade, number> = {
  [UnitGrade.BRONZE]: 0xcd7f32,
  [UnitGrade.SILVER]: 0xc0c0c0,
  [UnitGrade.GOLD]: 0xffd700,
  [UnitGrade.CHAMPION]: 0xff4500,
};

const CLASS_SYMBOLS: Record<UnitClass, string> = {
  [UnitClass.KNIGHT]: '\u2694', // crossed swords
  [UnitClass.CLERIC]: '\u2764', // heart
  [UnitClass.ARCHER]: '\u2192', // arrow
  [UnitClass.MAGE]: '\u2605',   // star
};

export class UnitSprite extends Phaser.GameObjects.Container {
  unitId: string;
  unitClass: UnitClass;
  grade: UnitGrade;

  private bg: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private symbol: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private slotSize: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unitId: string,
    unitClass: UnitClass,
    grade: UnitGrade,
    suit: number,
    size: number,
    slotSize: number = 1,
  ) {
    super(scene, x, y);

    this.unitId = unitId;
    this.unitClass = unitClass;
    this.grade = grade;
    this.slotSize = slotSize;

    const w = size * slotSize;
    const h = size;

    // Border (grade color)
    this.border = scene.add.rectangle(0, 0, w + 4, h + 4, GRADE_BORDER_COLORS[grade]);
    this.border.setStrokeStyle(2, GRADE_BORDER_COLORS[grade]);

    // Background (suit color)
    this.bg = scene.add.rectangle(0, 0, w, h, SUIT_COLORS[suit] ?? 0x666666, 0.8);

    // Class symbol
    const fontSize = Math.round(size * 0.45);
    this.symbol = scene.add.text(0, -4, CLASS_SYMBOLS[unitClass], {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'serif',
    }).setOrigin(0.5, 0.5);

    // HP bar background
    const barW = w - 8;
    const barH = 4;
    const barY = h / 2 - 6;
    this.hpBarBg = scene.add.rectangle(0, barY, barW, barH, 0x333333);
    this.hpBar = scene.add.rectangle(0, barY, barW, barH, 0x2ecc71);

    this.add([this.border, this.bg, this.symbol, this.hpBarBg, this.hpBar]);
    this.setSize(w + 4, h + 4);
    this.setDepth(500);

    scene.add.existing(this);
  }

  updateHp(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    const fullW = (this.bg.width - 8);
    this.hpBar.width = fullW * ratio;
    this.hpBar.x = -(fullW * (1 - ratio)) / 2;

    // Color: green -> yellow -> red
    if (ratio > 0.6) this.hpBar.setFillStyle(0x2ecc71);
    else if (ratio > 0.3) this.hpBar.setFillStyle(0xf1c40f);
    else this.hpBar.setFillStyle(0xe74c3c);
  }

  playAttack(targetX: number, targetY: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const lungeX = (dx / dist) * 10;
    const lungeY = (dy / dist) * 10;

    this.scene.tweens.add({
      targets: this,
      x: this.x + lungeX,
      y: this.y + lungeY,
      duration: 80,
      yoyo: true,
      ease: 'Power2',
    });
  }

  playDeath(): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }
}
