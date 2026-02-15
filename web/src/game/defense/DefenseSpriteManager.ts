import Phaser from 'phaser';
import { SpriteManager } from '../sprites/SpriteManager';
import { UnitSprite } from '../objects/UnitSprite';
import { EnemySprite } from '../objects/EnemySprite';
import { BaseSprite } from '../objects/BaseSprite';
import type { DefenseLayoutManager } from './DefenseLayoutManager';
import type { DefenseState, DeployedUnit, EnemyData, UnitData } from './DefenseState';
import type { ThemeConfig } from '../themes/ThemeConfig';
import type { SolitaireState } from '../../solver/SolitaireState';

/** Mini card item in the unit pool bar */
export class UnitPoolItem extends Phaser.GameObjects.Container {
  unitId: string;

  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    unit: UnitData,
    size: number,
  ) {
    super(scene, x, y);
    this.unitId = unit.id;

    const SUIT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6];
    const GRADE_BORDERS: Record<string, number> = {
      BRONZE: 0xcd7f32, SILVER: 0xc0c0c0, GOLD: 0xffd700, CHAMPION: 0xff4500,
    };

    this.bg = scene.add.rectangle(0, 0, size, size, SUIT_COLORS[unit.suit] ?? 0x666666, 0.8);
    this.bg.setStrokeStyle(2, GRADE_BORDERS[unit.grade] ?? 0x666666);

    const fontSize = Math.round(size * 0.5);
    this.label = scene.add.text(0, 0, `${unit.rank}`, {
      fontSize: `${fontSize}px`,
      color: '#fff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.add([this.bg, this.label]);
    this.setSize(size, size);
    this.setInteractive({ draggable: true });

    scene.add.existing(this);
  }
}

export class DefenseSpriteManager {
  /** Card sprites (solitaire area) */
  cardSprites: SpriteManager;

  unitSprites = new Map<string, UnitSprite>();
  enemySprites = new Map<string, EnemySprite>();
  unitPoolItems = new Map<string, UnitPoolItem>();
  baseSprite: BaseSprite | null = null;

  constructor(
    private scene: Phaser.Scene,
    private layout: DefenseLayoutManager,
    theme: ThemeConfig,
  ) {
    this.cardSprites = new SpriteManager(scene, layout.cardLayout, theme);
  }

  createBase(): void {
    if (this.baseSprite) this.baseSprite.destroy();
    this.baseSprite = new BaseSprite(
      this.scene,
      this.layout.baseX,
      this.layout.baseY,
      this.layout.slotSize,
    );
  }

  syncUnits(deployedUnits: DeployedUnit[], isBattle = false): void {
    const activeIds = new Set<string>();
    for (const u of deployedUnits) {
      if (!u.alive) {
        const sprite = this.unitSprites.get(u.id);
        if (sprite) {
          sprite.playDeath();
          this.unitSprites.delete(u.id);
        }
        continue;
      }
      activeIds.add(u.id);
      let sprite = this.unitSprites.get(u.id);
      if (!sprite) {
        const pos = this.layout.getSlotPosition(u.slotIdx);
        sprite = new UnitSprite(
          this.scene, pos.x, pos.y,
          u.id, u.unitClass, u.grade, u.suit,
          this.layout.slotSize, u.slotSize,
        );
        this.unitSprites.set(u.id, sprite);
      }
      // Position: use laneX during battle, slot position during deploy
      const x = isBattle ? this.layout.lanePositionToX(u.laneX) : this.layout.getSlotPosition(u.slotIdx).x;
      sprite.setPosition(x, this.layout.laneY);
      sprite.updateHp(u.hp, u.maxHp);
    }
    // Remove sprites for units no longer present
    for (const [id, sprite] of this.unitSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.unitSprites.delete(id);
      }
    }
  }

  syncEnemies(enemies: EnemyData[]): void {
    const activeIds = new Set<string>();
    for (const e of enemies) {
      if (!e.alive || !e.spawned) {
        const sprite = this.enemySprites.get(e.id);
        if (sprite && !e.alive) {
          sprite.playDeath();
          this.enemySprites.delete(e.id);
        }
        continue;
      }
      activeIds.add(e.id);
      let sprite = this.enemySprites.get(e.id);
      if (!sprite) {
        const x = this.layout.lanePositionToX(e.x);
        sprite = new EnemySprite(
          this.scene, x, this.layout.laneY,
          e.id, e.type, this.layout.slotSize * 0.9, e.isBoss,
        );
        this.enemySprites.set(e.id, sprite);
      }
      sprite.updatePosition(this.layout.lanePositionToX(e.x));
      sprite.updateHp(e.hp, e.maxHp);
    }
    for (const [id, sprite] of this.enemySprites) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }
  }

  syncUnitPool(unitPool: UnitData[]): void {
    const activeIds = new Set<string>();
    for (let i = 0; i < unitPool.length; i++) {
      const u = unitPool[i];
      activeIds.add(u.id);
      let item = this.unitPoolItems.get(u.id);
      if (!item) {
        const pos = this.layout.getUnitPoolPosition(i);
        const size = Math.round(this.layout.unitPoolHeight * 0.75);
        item = new UnitPoolItem(this.scene, pos.x, pos.y, u, size);
        this.unitPoolItems.set(u.id, item);
      }
      const pos = this.layout.getUnitPoolPosition(i);
      item.setPosition(pos.x, pos.y);
    }
    for (const [id, item] of this.unitPoolItems) {
      if (!activeIds.has(id)) {
        item.destroy();
        this.unitPoolItems.delete(id);
      }
    }
  }

  rebuildCards(state: SolitaireState): void {
    this.cardSprites.rebuild(state);
  }

  destroyAll(): void {
    this.cardSprites.clearAll();
    for (const s of this.unitSprites.values()) s.destroy();
    this.unitSprites.clear();
    for (const s of this.enemySprites.values()) s.destroy();
    this.enemySprites.clear();
    for (const s of this.unitPoolItems.values()) s.destroy();
    this.unitPoolItems.clear();
    if (this.baseSprite) {
      this.baseSprite.destroy();
      this.baseSprite = null;
    }
  }

  updateLayout(layout: DefenseLayoutManager): void {
    this.layout = layout;
    this.cardSprites.updateLayout(layout.cardLayout);
  }
}
