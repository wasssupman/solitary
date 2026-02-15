import Phaser from 'phaser';
import { LANE_SLOTS } from './constants';
import type { DefenseLayoutManager } from './DefenseLayoutManager';

export class DefenseLane extends Phaser.GameObjects.Container {
  private slotBgs: Phaser.GameObjects.Rectangle[] = [];
  private highlights: Phaser.GameObjects.Rectangle[] = [];
  private laneBg: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private layout: DefenseLayoutManager,
  ) {
    super(scene, 0, 0);

    // Lane background strip
    const laneW = layout.laneRightX - layout.laneLeftX + layout.slotSize * 2;
    this.laneBg = scene.add.rectangle(
      (layout.laneLeftX + layout.laneRightX) / 2,
      layout.laneY,
      laneW,
      layout.slotSize + 20,
      0x21262d, 0.9,
    );
    this.add(this.laneBg);

    // Individual slot backgrounds
    for (let i = 0; i < LANE_SLOTS; i++) {
      const pos = layout.getSlotPosition(i);

      const bg = scene.add.rectangle(
        pos.x, pos.y,
        layout.slotSize, layout.slotSize,
        0x30363d, 0.9,
      );
      bg.setStrokeStyle(2, 0x58a6ff);
      this.slotBgs.push(bg);
      this.add(bg);

      // Highlight (hidden by default)
      const hl = scene.add.rectangle(
        pos.x, pos.y,
        layout.slotSize, layout.slotSize,
        0x2ecc71, 0.3,
      );
      hl.setVisible(false);
      this.highlights.push(hl);
      this.add(hl);
    }

    // Slot labels
    for (let i = 0; i < LANE_SLOTS; i++) {
      const pos = layout.getSlotPosition(i);
      const label = scene.add.text(pos.x, pos.y + layout.slotSize / 2 + 6, `${i + 1}`, {
        fontSize: '10px',
        color: '#666',
        fontFamily: 'monospace',
      }).setOrigin(0.5, 0);
      this.add(label);
    }

    scene.add.existing(this);
  }

  highlightSlots(available: boolean[]): void {
    for (let i = 0; i < LANE_SLOTS; i++) {
      this.highlights[i].setVisible(available[i] ?? false);
    }
  }

  clearHighlights(): void {
    for (const hl of this.highlights) hl.setVisible(false);
  }

  setDimmed(dimmed: boolean): void {
    this.setAlpha(dimmed ? 0.7 : 1.0);
  }

  destroy(): void {
    super.destroy(true);
  }
}
