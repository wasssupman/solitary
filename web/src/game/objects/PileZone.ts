import Phaser from 'phaser';

export type PileType = 'tableau' | 'foundation' | 'stock' | 'waste';

export class PileZone extends Phaser.GameObjects.Container {
  pileType: PileType;
  index: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    pileType: PileType,
    index: number,
    outlineColor: number = 0xffffff,
    outlineAlpha: number = 0.15,
  ) {
    super(scene, x, y);

    this.pileType = pileType;
    this.index = index;

    // Subtle rounded rectangle outline
    const g = scene.add.graphics();
    g.lineStyle(2, outlineColor, outlineAlpha);
    g.strokeRoundedRect(
      -width / 2,
      -height / 2,
      width,
      height,
      Math.round(width * 0.08),
    );
    this.add(g);

    this.setSize(width, height);
    scene.add.existing(this);
  }
}
