import Phaser from 'phaser';

export class BaseSprite extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private icon: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private barWidth: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
  ) {
    super(scene, x, y);

    // Base background
    this.bg = scene.add.rectangle(0, 0, size, size, 0x2c3e50);
    this.bg.setStrokeStyle(3, 0xecf0f1);

    // Castle icon
    const fontSize = Math.round(size * 0.45);
    this.icon = scene.add.text(0, -4, '\u{1F3F0}', {
      fontSize: `${fontSize}px`,
    }).setOrigin(0.5, 0.5);

    // HP bar
    this.barWidth = size - 8;
    const barH = 5;
    const barY = size / 2 - 8;
    this.hpBarBg = scene.add.rectangle(0, barY, this.barWidth, barH, 0x333333);
    this.hpBar = scene.add.rectangle(0, barY, this.barWidth, barH, 0x2ecc71);

    this.add([this.bg, this.icon, this.hpBarBg, this.hpBar]);
    this.setSize(size, size);

    scene.add.existing(this);
  }

  updateHp(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    this.hpBar.width = this.barWidth * ratio;
    this.hpBar.x = -(this.barWidth * (1 - ratio)) / 2;

    if (ratio > 0.6) this.hpBar.setFillStyle(0x2ecc71);
    else if (ratio > 0.3) this.hpBar.setFillStyle(0xf1c40f);
    else this.hpBar.setFillStyle(0xe74c3c);
  }

  playHit(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 80,
      yoyo: true,
      ease: 'Power2',
    });
    // Brief red flash
    this.bg.setFillStyle(0xe74c3c);
    this.scene.time.delayedCall(100, () => {
      if (this.bg) this.bg.setFillStyle(0x2c3e50);
    });
  }
}
