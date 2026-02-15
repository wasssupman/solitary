import { LayoutManager } from '../rendering/LayoutManager';
import { LANE_SLOTS } from './constants';

/**
 * Layout for defense mode.
 * Upper ~38% = defense lane + unit pool, lower ~62% = solitaire.
 */
export class DefenseLayoutManager {
  /** Solitaire card layout (operates in the lower portion) */
  cardLayout: LayoutManager;

  readonly canvasW: number;
  readonly canvasH: number;

  /** Y where the defense area ends and solitaire begins */
  readonly splitY: number;
  /** Defense lane Y center */
  readonly laneY: number;
  /** Unit pool bar Y (between lane and solitaire) */
  readonly unitPoolY: number;
  /** Slot size (square) */
  readonly slotSize: number;
  /** Lane left X start */
  readonly laneLeftX: number;
  /** Slot gap */
  readonly slotGap: number;
  /** Base sprite position */
  readonly baseX: number;
  readonly baseY: number;
  /** Enemy spawn X (right edge of lane) */
  readonly enemySpawnX: number;
  /** Lane right X end */
  readonly laneRightX: number;
  /** Unit pool bar height */
  readonly unitPoolHeight: number;

  constructor(width: number, height: number) {
    this.canvasW = width;
    this.canvasH = height;

    // Defense area occupies upper ~11% (compact)
    const defenseHeight = Math.round(height * 0.11);

    // Unit pool bar: thin strip between defense and solitaire
    this.unitPoolHeight = Math.round(height * 0.02);

    // Split point: defense + unit pool
    this.splitY = defenseHeight + this.unitPoolHeight;

    // Solitaire occupies the rest below the split
    const solHeight = height - this.splitY;
    this.cardLayout = new LayoutManager(width, solHeight, this.splitY);

    // Unit pool bar sits between defense lane and solitaire
    this.unitPoolY = defenseHeight + this.unitPoolHeight / 2;

    // Slot size based on available defense space (scale with canvas)
    this.slotSize = Math.min(
      Math.round(defenseHeight * 0.5),
      Math.round((width - 100) / (LANE_SLOTS + 3)),
    );

    // Lane centered vertically in defense area
    this.laneY = defenseHeight / 2;

    const totalLaneW = this.slotSize * LANE_SLOTS + (LANE_SLOTS - 1) * 4;
    const centerX = width / 2;
    this.laneLeftX = centerX - totalLaneW / 2;
    this.laneRightX = centerX + totalLaneW / 2;
    this.slotGap = 4;

    // Base is to the left of the lane
    this.baseX = this.laneLeftX - this.slotSize - 10;
    this.baseY = this.laneY;

    // Enemies spawn from the right edge
    this.enemySpawnX = this.laneRightX + this.slotSize;
  }

  /** Get center position of a lane slot */
  getSlotPosition(slotIdx: number): { x: number; y: number } {
    return {
      x: this.laneLeftX + slotIdx * (this.slotSize + this.slotGap) + this.slotSize / 2,
      y: this.laneY,
    };
  }

  /** Convert enemy lane position (0-1) to pixel X */
  lanePositionToX(lanePos: number): number {
    return this.laneLeftX + lanePos * (this.laneRightX - this.laneLeftX + this.slotSize);
  }

  /** Get unit pool item position */
  getUnitPoolPosition(index: number): { x: number; y: number } {
    const itemSize = Math.round(this.unitPoolHeight * 0.8);
    const startX = 20;
    return {
      x: startX + index * (itemSize + 6) + itemSize / 2,
      y: this.unitPoolY,
    };
  }

  /** HUD positions */
  getHudY(): number {
    return 4;
  }
}
