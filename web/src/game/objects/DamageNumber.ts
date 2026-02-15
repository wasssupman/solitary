import Phaser from 'phaser';

export function showDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: number | string,
  color: string = '#ffffff',
): void {
  const text = scene.add.text(x, y, String(value), {
    fontSize: '14px',
    color,
    fontFamily: 'monospace',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5, 0.5).setDepth(10000);

  scene.tweens.add({
    targets: text,
    y: y - 20,
    alpha: 0,
    duration: 800,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}

export function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: string = '#ffd700',
  fontSize: number = 18,
): void {
  const text = scene.add.text(x, y, message, {
    fontSize: `${fontSize}px`,
    color,
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5, 0.5).setDepth(10001);

  scene.tweens.add({
    targets: text,
    y: y - 30,
    alpha: 0,
    scaleX: 1.2,
    scaleY: 1.2,
    duration: 1200,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}
