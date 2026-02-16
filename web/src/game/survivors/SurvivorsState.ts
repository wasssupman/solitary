// ==========================================
// Survivors Mode — Types & Interfaces
// ==========================================

export enum SurvivorsGamePhase {
  PLAYING = 'PLAYING',
  VICTORY = 'VICTORY',
  GAME_OVER = 'GAME_OVER',
}

export interface SurvivorsEnemyData {
  id: string;
  hp: number;
  maxHp: number;
  atk: number;
  spd: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  alive: boolean;
}

export interface SurvivorsProjectileData {
  id: string;
  suit: number;       // 0-3, determines color
  damage: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  lifetime: number;   // seconds remaining
}

export interface SurvivorsState {
  phase: SurvivorsGamePhase;
  playerHp: number;
  playerMaxHp: number;
  playerX: number;
  playerY: number;
  invincibilityTimer: number;  // seconds remaining of i-frames
  wave: number;                // 1-10
  elapsedTime: number;         // total seconds elapsed
  waveTime: number;            // seconds elapsed in current wave
  score: number;
  foundationTiers: number[];   // [4] current foundation card count per suit
  enemies: SurvivorsEnemyData[];
  projectiles: SurvivorsProjectileData[];
  // Auto-fire cooldowns per suit (seconds until next auto-fire)
  fireCooldowns: number[];     // [4]
  // Spawn timer
  spawnTimer: number;          // seconds until next enemy spawn
  // Stats
  enemiesKilled: number;
  foundationCardsPlayed: number;
}

/** Serializable state for React bridge */
export interface SurvivorsDisplayState {
  phase: SurvivorsGamePhase;
  playerHp: number;
  playerMaxHp: number;
  wave: number;
  elapsedTime: number;
  waveTime: number;
  score: number;
  foundationTiers: number[];
  enemiesAlive: number;
  enemiesKilled: number;
  foundationCardsPlayed: number;
}
