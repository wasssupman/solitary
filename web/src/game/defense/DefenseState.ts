// ==========================================
// Defense Mode — Types & Interfaces
// ==========================================

export enum GamePhase {
  CARD = 'CARD',
  DEPLOY = 'DEPLOY',
  BATTLE = 'BATTLE',
  WAVE_RESULT = 'WAVE_RESULT',
  VICTORY = 'VICTORY',
  GAME_OVER = 'GAME_OVER',
}

export enum UnitClass {
  KNIGHT = 'KNIGHT',   // Spade — melee tank
  CLERIC = 'CLERIC',   // Heart — healer/support
  ARCHER = 'ARCHER',   // Diamond — ranged single
  MAGE = 'MAGE',       // Club — ranged AoE
}

export enum UnitGrade {
  BRONZE = 'BRONZE',   // Rank 1-4
  SILVER = 'SILVER',   // Rank 5-9
  GOLD = 'GOLD',       // Rank 10-13
  CHAMPION = 'CHAMPION',
}

export enum EnemyType {
  GRUNT = 'GRUNT',
  RUNNER = 'RUNNER',
  SHIELD = 'SHIELD',
  HEALER = 'HEALER',
  SIEGE = 'SIEGE',
  RANGER = 'RANGER',
  BRUTE = 'BRUTE',
  SHADOW = 'SHADOW',
  KING_OF_RUIN = 'KING_OF_RUIN',
}

export enum MilestoneType {
  FIRST_BLOOD = 'FIRST_BLOOD',
  SQUAD_READY = 'SQUAD_READY',
  SILVER_GATE = 'SILVER_GATE',
  GOLD_GATE = 'GOLD_GATE',
  FULL_SUIT = 'FULL_SUIT',
}

export interface UnitData {
  id: string;
  unitClass: UnitClass;
  grade: UnitGrade;
  rank: number;       // original card rank
  suit: number;       // original card suit (0-3)
  hp: number;
  maxHp: number;
  atk: number;
  spd: number;
  range: number;
  slotSize: number;   // 1 for normal, 2 for champion
  comboBonus: { atkMul: number; hpMul: number };
  isChampion: boolean;
}

export interface DeployedUnit extends UnitData {
  slotIdx: number;         // initial deploy slot (used for deploy phase positioning)
  laneX: number;           // lane position 0.0 (base) to 1.0 (enemy side) — used in battle
  attackCooldown: number;  // seconds until next attack
  alive: boolean;
}

export interface EnemyData {
  id: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  atk: number;
  spd: number;
  x: number;           // lane position (0 = base side, 1 = spawn side)
  alive: boolean;
  isBoss: boolean;
  // Boss-specific
  bossPhase?: number;
  invisibleTurns?: number;
  // Affinity
  resistSuits: number[];   // suit values this enemy resists
  weakSuits: number[];     // suit values this enemy is weak to
  // Spawn timing
  spawnDelay: number;      // seconds until this enemy enters the lane
  spawned: boolean;
  // Attack cooldown
  attackCooldown: number;  // seconds until next attack
}

export interface DefenseState {
  phase: GamePhase;
  wave: number;           // 1-10
  turnsRemaining: number;
  turnLimit: number;
  score: number;
  baseHp: number;
  baseMaxHp: number;
  unitPool: UnitData[];          // produced but not deployed
  deployedUnits: DeployedUnit[];
  enemies: EnemyData[];
  battleSpeed: number;           // 1, 2, or 4
  // Combo tracking
  lastFoundationSuit: number | null;
  comboCount: number;
  totalCombos: number;
  // Milestone tracking
  achievedMilestones: MilestoneType[];
  // Scoring
  enemiesDefeated: number;
  bossesDefeated: number;
  perfectWaves: number;
  unusedTurns: number;
  championsProduced: number;
  foundationCardsPlayed: number;
  // Wave affinity
  waveAffinity: { resistSuits: number[] } | null;
  // Wave result
  waveDamageToBase: number;
}

/** Serializable state for React display */
export interface DefenseDisplayState {
  phase: GamePhase;
  wave: number;
  turnsRemaining: number;
  turnLimit: number;
  score: number;
  baseHp: number;
  baseMaxHp: number;
  unitPoolCount: number;
  unitPool: { id: string; unitClass: UnitClass; grade: UnitGrade; rank: number; suit: number }[];
  deployedUnits: { id: string; unitClass: UnitClass; grade: UnitGrade; slotIdx: number; hp: number; maxHp: number; alive: boolean }[];
  enemyCount: number;
  enemiesAlive: number;
  battleSpeed: number;
  comboCount: number;
  achievedMilestones: MilestoneType[];
  waveAffinity: { resistSuits: number[] } | null;
  enemiesDefeated: number;
  foundationCardsPlayed: number;
  championsProduced: number;
}

export interface DefenseSnapshot {
  state: DefenseState;
  solitaireState: unknown; // SolverSnapshot
}
