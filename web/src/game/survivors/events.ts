import type { SurvivorsGamePhase, SurvivorsEnemyData } from './SurvivorsState';

export interface SurvivorsEvents {
  survivorsStateChanged: { phase: SurvivorsGamePhase };
  foundationPlaced: { suit: number; tier: number; damage: number };
  projectileFired: { suit: number; x: number; y: number; vx: number; vy: number };
  enemyKilled: { enemy: SurvivorsEnemyData; score: number };
  playerHit: { damage: number; remainingHp: number };
  waveCleared: { wave: number };
  survivorsGameOver: { victory: boolean; score: number; wave: number };
}
