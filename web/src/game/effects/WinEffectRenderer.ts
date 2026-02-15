import Phaser from 'phaser';

export class WinEffectRenderer {
  constructor(private scene: Phaser.Scene) {}

  show(): void {
    const { width, height } = this.scene.scale;
    const text = this.scene.add.text(width / 2, height / 2, 'You Win!', {
      fontSize: '64px',
      fontFamily: 'Arial',
      color: '#ffd700',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(3000);

    this.scene.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      yoyo: true,
      repeat: 2,
      duration: 400,
    });
  }
}
