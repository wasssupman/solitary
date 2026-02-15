import Phaser from 'phaser';
import { GamePhase } from './DefenseState';
import { LANE_SLOTS } from './constants';
import type { DefenseLayoutManager } from './DefenseLayoutManager';
import type { DefenseSpriteManager, UnitPoolItem } from './DefenseSpriteManager';
import type { DefenseCore } from './DefenseCore';
import type { InteractionController } from '../interaction/InteractionController';

export class DefenseInteractionController {
  private deployDragData: { item: UnitPoolItem; originX: number; originY: number } | null = null;

  constructor(
    private scene: Phaser.Scene,
    private layout: DefenseLayoutManager,
    private sprites: DefenseSpriteManager,
    private defenseCore: DefenseCore,
    private cardInteraction: InteractionController,
  ) {}

  /** Enable interactions for the current phase */
  enable(phase: GamePhase): void {
    this.disableAll();

    if (phase === GamePhase.CARD) {
      this.cardInteraction.enable();
    } else if (phase === GamePhase.DEPLOY) {
      this.enableDeployInteraction();
    }
    // Battle phase: no interaction needed
  }

  private disableAll(): void {
    this.cardInteraction.disable();
    this.disableDeployInteraction();
  }

  private enableDeployInteraction(): void {
    // Make unit pool items draggable to deploy
    for (const [, item] of this.sprites.unitPoolItems) {
      this.scene.input.setDraggable(item);

      item.on('dragstart', () => {
        this.deployDragData = {
          item,
          originX: item.x,
          originY: item.y,
        };
        item.setDepth(10000);

        // Highlight available slots
        const available = this.getAvailableSlots(item.unitId);
        // Import DefenseLane would be circular, we use the scene's lane reference
        this.scene.events.emit('highlightSlots', available);
      });

      item.on('drag', (_p: unknown, dragX: number, dragY: number) => {
        item.setPosition(dragX, dragY);
      });

      item.on('dragend', () => {
        this.scene.events.emit('clearHighlights');

        if (!this.deployDragData) return;
        const dd = this.deployDragData;
        this.deployDragData = null;

        // Check if dropped on a slot
        const slotIdx = this.findDropSlot(item.x, item.y);
        if (slotIdx !== null) {
          const deployed = this.defenseCore.deployUnit(item.unitId, slotIdx);
          if (deployed) {
            item.destroy();
            this.sprites.unitPoolItems.delete(item.unitId);
            return;
          }
        }

        // Snap back
        item.setPosition(dd.originX, dd.originY);
        item.setDepth(0);
      });
    }
  }

  private disableDeployInteraction(): void {
    for (const [, item] of this.sprites.unitPoolItems) {
      item.removeAllListeners();
    }
    this.deployDragData = null;
  }

  private getAvailableSlots(unitId: string): boolean[] {
    const unit = this.defenseCore.state.unitPool.find(u => u.id === unitId);
    if (!unit) return new Array(LANE_SLOTS).fill(false);

    const available: boolean[] = [];
    const deployed = this.defenseCore.state.deployedUnits;

    for (let i = 0; i < LANE_SLOTS; i++) {
      let canPlace = true;
      for (let s = i; s < i + unit.slotSize; s++) {
        if (s >= LANE_SLOTS) { canPlace = false; break; }
        if (deployed.some(u => u.alive && u.slotIdx === s)) { canPlace = false; break; }
      }
      available.push(canPlace);
    }
    return available;
  }

  private findDropSlot(x: number, y: number): number | null {
    for (let i = 0; i < LANE_SLOTS; i++) {
      const pos = this.layout.getSlotPosition(i);
      const halfSize = this.layout.slotSize / 2;
      if (
        Math.abs(x - pos.x) < halfSize + 10 &&
        Math.abs(y - pos.y) < halfSize + 10
      ) {
        return i;
      }
    }
    return null;
  }

  updateLayout(layout: DefenseLayoutManager): void {
    this.layout = layout;
    this.cardInteraction.updateLayout(layout.cardLayout);
  }
}
