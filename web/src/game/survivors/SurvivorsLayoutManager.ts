import { LayoutManager } from '../rendering/LayoutManager';
import { ARENA_HEIGHT_RATIO, ENEMY_SPAWN_RADIUS_MARGIN } from './constants';

/**
 * Layout for survivors mode.
 * Upper 55% = battle arena (2D, player at center), lower 45% = solitaire.
 */
export class SurvivorsLayoutManager {
  /** Solitaire card layout (operates in the lower portion) */
  cardLayout: LayoutManager;

  readonly canvasW: number;
  readonly canvasH: number;

  /** Y where the arena ends and solitaire begins */
  readonly splitY: number;
  /** Height of the arena area */
  readonly arenaHeight: number;

  /** Player position (center of arena) */
  readonly playerX: number;
  readonly playerY: number;

  /** Radius of the spawn ring around the player */
  readonly spawnRadius: number;

  /** Separator line thickness */
  readonly separatorHeight = 3;

  constructor(width: number, height: number) {
    this.canvasW = width;
    this.canvasH = height;

    // Arena takes upper portion
    this.arenaHeight = Math.round(height * ARENA_HEIGHT_RATIO);
    this.splitY = this.arenaHeight;

    // Solitaire occupies the rest below the split
    const solHeight = height - this.splitY;
    this.cardLayout = new LayoutManager(width, solHeight, this.splitY);

    // Player is at center of arena
    this.playerX = width / 2;
    this.playerY = this.arenaHeight / 2;

    // Spawn radius: just beyond visible arena edge
    this.spawnRadius = Math.max(width, this.arenaHeight) / 2 + ENEMY_SPAWN_RADIUS_MARGIN;
  }

  /** HUD Y position (top of arena) */
  getHudY(): number {
    return 8;
  }

  /** Get the arena bounds for clamping/rendering */
  getArenaBounds(): { x: number; y: number; w: number; h: number } {
    return { x: 0, y: 0, w: this.canvasW, h: this.arenaHeight };
  }
}
