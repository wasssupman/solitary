import Phaser from 'phaser';
import { EnemyType } from '../defense/DefenseState';

const ENEMY_COLORS: Record<EnemyType, number> = {
  [EnemyType.GRUNT]: 0x95a5a6,
  [EnemyType.RUNNER]: 0xe67e22,
  [EnemyType.SHIELD]: 0x7f8c8d,
  [EnemyType.HEALER]: 0x1abc9c,
  [EnemyType.SIEGE]: 0x8e44ad,
  [EnemyType.RANGER]: 0xd4ac0d,
  [EnemyType.BRUTE]: 0xc0392b,
  [EnemyType.SHADOW]: 0x2c3e50,
  [EnemyType.KING_OF_RUIN]: 0xff0000,
};

const ENEMY_LABELS: Record<EnemyType, string> = {
  [EnemyType.GRUNT]: 'G',
  [EnemyType.RUNNER]: 'R',
  [EnemyType.SHIELD]: 'S',
  [EnemyType.HEALER]: 'H',
  [EnemyType.SIEGE]: 'Si',
  [EnemyType.RANGER]: 'Ra',
  [EnemyType.BRUTE]: 'B',
  [EnemyType.SHADOW]: 'Sh',
  [EnemyType.KING_OF_RUIN]: 'K',
};

export class EnemySprite extends Phaser.GameObjects.Container {
  enemyId: string;
  enemyType: EnemyType;

  private shape: Phaser.GameObjects.Shape;
  private label: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Rectangle;
  private hpBarBg: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    enemyId: string,
    type: EnemyType,
    size: number,
    isBoss: boolean,
  ) {
    super(scene, x, y);

    this.enemyId = enemyId;
    this.enemyType = type;

    const s = isBoss ? size * 1.3 : size;
    const color = ENEMY_COLORS[type];

    // Shape based on type
    if (isBoss) {
      // Boss: polygon (star-like)
      this.shape = scene.add.star(0, 0, 5, s * 0.3, s * 0.5, color);
    } else if (type === EnemyType.SHIELD) {
      // Shield: hexagon-like rectangle
      this.shape = scene.add.rectangle(0, 0, s * 0.9, s * 0.9, color);
      (this.shape as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xbdc3c7);
    } else if (type === EnemyType.RANGER) {
      // Ranger: triangle (pointing left toward base)
      this.shape = scene.add.triangle(0, 0, -s*0.4,0, s*0.3,-s*0.4, s*0.3,s*0.4, color);
    } else {
      // Regular: circle
      this.shape = scene.add.circle(0, 0, s * 0.4, color);
    }

    // Label
    const fontSize = Math.round(s * 0.35);
    this.label = scene.add.text(0, -2, ENEMY_LABELS[type], {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // HP bar
    const barW = s - 4;
    const barH = 3;
    const barY = s * 0.45;
    this.hpBarBg = scene.add.rectangle(0, barY, barW, barH, 0x333333);
    this.hpBar = scene.add.rectangle(0, barY, barW, barH, 0xe74c3c);

    this.add([this.shape, this.label, this.hpBarBg, this.hpBar]);
    this.setSize(s, s);
    this.setDepth(500);

    scene.add.existing(this);
  }

  updateHp(current: number, max: number): void {
    const ratio = Math.max(0, current / max);
    const fullW = this.hpBarBg.width;
    this.hpBar.width = fullW * ratio;
    this.hpBar.x = -(fullW * (1 - ratio)) / 2;
  }

  updatePosition(x: number): void {
    this.x = x;
  }

  playDeath(): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 250,
        ease: 'Power2',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }
}
