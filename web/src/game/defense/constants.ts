import { UnitClass, UnitGrade, EnemyType, MilestoneType } from './DefenseState';

// ==========================================
// Unit Base Stats (Bronze x1.0)
// ==========================================

export const UNIT_BASE_STATS: Record<UnitClass, { hp: number; atk: number; spd: number; range: number }> = {
  [UnitClass.KNIGHT]:  { hp: 120, atk: 15, spd: 1.0, range: 1 },
  [UnitClass.CLERIC]:  { hp: 60,  atk: 0,  spd: 1.2, range: 2 },
  [UnitClass.ARCHER]:  { hp: 50,  atk: 25, spd: 1.5, range: 4 },
  [UnitClass.MAGE]:    { hp: 70,  atk: 20, spd: 0.8, range: 3 },
};

// ==========================================
// Grade Multipliers (applied to HP and ATK)
// ==========================================

export const GRADE_MULTIPLIER: Record<UnitGrade, number> = {
  [UnitGrade.BRONZE]: 1.0,
  [UnitGrade.SILVER]: 1.5,
  [UnitGrade.GOLD]: 2.2,
  [UnitGrade.CHAMPION]: 3.0,
};

// ==========================================
// Suit -> UnitClass mapping (suit value 0-3)
// ==========================================

// Suit enum: HEARTS=0, DIAMONDS=1, CLUBS=2, SPADES=3
export const SUIT_TO_CLASS: UnitClass[] = [
  UnitClass.CLERIC,  // Hearts -> Cleric
  UnitClass.ARCHER,  // Diamonds -> Archer
  UnitClass.MAGE,    // Clubs -> Mage
  UnitClass.KNIGHT,  // Spades -> Knight
];

// ==========================================
// Rank -> Grade mapping
// ==========================================

export function rankToGrade(rank: number): UnitGrade {
  if (rank <= 4) return UnitGrade.BRONZE;
  if (rank <= 9) return UnitGrade.SILVER;
  return UnitGrade.GOLD;
}

// ==========================================
// Combo Bonuses
// ==========================================

export interface ComboBonus {
  atkMul: number;
  hpMul: number;
}

export const COMBO_BONUSES: ComboBonus[] = [
  { atkMul: 1.0, hpMul: 1.0 },  // 0 or 1 consecutive (no bonus)
  { atkMul: 1.0, hpMul: 1.0 },  // 1 consecutive
  { atkMul: 1.1, hpMul: 1.0 },  // 2 consecutive: ATK +10%
  { atkMul: 1.2, hpMul: 1.1 },  // 3 consecutive: ATK +20%, HP +10%
  { atkMul: 1.3, hpMul: 1.2 },  // 4+ consecutive: ATK +30%, HP +20%
];

export function getComboBonus(count: number): ComboBonus {
  const idx = Math.min(count, COMBO_BONUSES.length - 1);
  return COMBO_BONUSES[idx];
}

// ==========================================
// Milestone Definitions
// ==========================================

export interface MilestoneDef {
  type: MilestoneType;
  label: string;
  description: string;
}

export const MILESTONES: MilestoneDef[] = [
  { type: MilestoneType.FIRST_BLOOD, label: 'First Blood', description: '+3 extra turns' },
  { type: MilestoneType.SQUAD_READY, label: 'Squad Ready', description: 'All units HP +10%' },
  { type: MilestoneType.SILVER_GATE, label: 'Silver Gate', description: 'Free Silver unit' },
  { type: MilestoneType.GOLD_GATE, label: 'Gold Gate', description: 'Free Gold unit' },
  { type: MilestoneType.FULL_SUIT, label: 'Full Suit', description: 'Champion unit summoned!' },
];

// ==========================================
// Wave Configuration
// ==========================================

export interface WaveEnemyEntry {
  type: EnemyType;
  count: number;
}

export interface WaveConfig {
  wave: number;
  enemies: WaveEnemyEntry[];
  hpMultiplier: number;
  turnLimit: number;
  spawnInterval: number;    // seconds between enemy spawns
  bossDelay: number;        // extra delay before boss spawn
  affinityCount: number;    // 0, 1, or 2 random suit resistances
}

export const WAVE_CONFIGS: WaveConfig[] = [
  { wave: 1, enemies: [{ type: EnemyType.GRUNT, count: 15 }], hpMultiplier: 1.0, turnLimit: 20, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 2, enemies: [{ type: EnemyType.GRUNT, count: 12 }, { type: EnemyType.RUNNER, count: 9 }, { type: EnemyType.RANGER, count: 3 }], hpMultiplier: 1.0, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 3, enemies: [{ type: EnemyType.GRUNT, count: 9 }, { type: EnemyType.RUNNER, count: 9 }, { type: EnemyType.SHIELD, count: 6 }, { type: EnemyType.RANGER, count: 6 }], hpMultiplier: 1.2, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 4, enemies: [{ type: EnemyType.GRUNT, count: 12 }, { type: EnemyType.RUNNER, count: 9 }, { type: EnemyType.SHIELD, count: 6 }, { type: EnemyType.RANGER, count: 6 }, { type: EnemyType.BRUTE, count: 1 }], hpMultiplier: 1.3, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 5, enemies: [{ type: EnemyType.GRUNT, count: 15 }, { type: EnemyType.RUNNER, count: 9 }, { type: EnemyType.SHIELD, count: 6 }, { type: EnemyType.HEALER, count: 6 }, { type: EnemyType.RANGER, count: 9 }], hpMultiplier: 1.5, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 1 },
  { wave: 6, enemies: [{ type: EnemyType.GRUNT, count: 12 }, { type: EnemyType.RUNNER, count: 9 }, { type: EnemyType.SHIELD, count: 6 }, { type: EnemyType.HEALER, count: 9 }, { type: EnemyType.RANGER, count: 9 }], hpMultiplier: 1.7, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 7, enemies: [{ type: EnemyType.GRUNT, count: 15 }, { type: EnemyType.RUNNER, count: 12 }, { type: EnemyType.SHIELD, count: 9 }, { type: EnemyType.HEALER, count: 6 }, { type: EnemyType.RANGER, count: 9 }, { type: EnemyType.SHADOW, count: 1 }], hpMultiplier: 2.0, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 8, enemies: [{ type: EnemyType.GRUNT, count: 12 }, { type: EnemyType.RUNNER, count: 9 }, { type: EnemyType.SHIELD, count: 9 }, { type: EnemyType.HEALER, count: 6 }, { type: EnemyType.SIEGE, count: 9 }, { type: EnemyType.RANGER, count: 12 }], hpMultiplier: 2.3, turnLimit: 15, spawnInterval: 0, bossDelay: 0, affinityCount: 2 },
  { wave: 9, enemies: [{ type: EnemyType.GRUNT, count: 15 }, { type: EnemyType.RUNNER, count: 12 }, { type: EnemyType.SHIELD, count: 9 }, { type: EnemyType.HEALER, count: 9 }, { type: EnemyType.SIEGE, count: 9 }, { type: EnemyType.RANGER, count: 12 }], hpMultiplier: 2.7, turnLimit: 12, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
  { wave: 10, enemies: [{ type: EnemyType.GRUNT, count: 18 }, { type: EnemyType.RUNNER, count: 12 }, { type: EnemyType.SHIELD, count: 9 }, { type: EnemyType.HEALER, count: 9 }, { type: EnemyType.SIEGE, count: 9 }, { type: EnemyType.RANGER, count: 12 }, { type: EnemyType.KING_OF_RUIN, count: 1 }], hpMultiplier: 3.0, turnLimit: 12, spawnInterval: 0, bossDelay: 0, affinityCount: 0 },
];

// ==========================================
// Enemy Base Stats
// ==========================================

export const ENEMY_BASE_STATS: Record<EnemyType, { hp: number; atk: number; spd: number; isBoss: boolean }> = {
  [EnemyType.GRUNT]:        { hp: 40,  atk: 8,  spd: 1.0, isBoss: false },
  [EnemyType.RUNNER]:       { hp: 25,  atk: 5,  spd: 2.0, isBoss: false },
  [EnemyType.SHIELD]:       { hp: 60,  atk: 6,  spd: 0.7, isBoss: false },
  [EnemyType.HEALER]:       { hp: 35,  atk: 3,  spd: 0.8, isBoss: false },
  [EnemyType.SIEGE]:        { hp: 80,  atk: 15, spd: 0.5, isBoss: false },
  [EnemyType.RANGER]:       { hp: 30,  atk: 12, spd: 0.6, isBoss: false },
  [EnemyType.BRUTE]:        { hp: 200, atk: 20, spd: 0.8, isBoss: true },
  [EnemyType.SHADOW]:       { hp: 150, atk: 25, spd: 1.2, isBoss: true },
  [EnemyType.KING_OF_RUIN]: { hp: 500, atk: 30, spd: 0.6, isBoss: true },
};

// ==========================================
// Suit Affinity
// ==========================================

// Weakness pairs: Spade(3) <-> Diamond(1), Heart(0) <-> Club(2)
export function getWeakSuit(suit: number): number {
  switch (suit) {
    case 0: return 2; // Heart weak to Club
    case 1: return 3; // Diamond weak to Spade
    case 2: return 0; // Club weak to Heart
    case 3: return 1; // Spade weak to Diamond
    default: return -1;
  }
}

export const AFFINITY_WEAK_MULTIPLIER = 1.5;
export const AFFINITY_RESIST_MULTIPLIER = 0.5;

// ==========================================
// Base
// ==========================================

export const BASE_MAX_HP = 200;
export const LANE_SLOTS = 5;

// ==========================================
// Scoring
// ==========================================

export const SCORE_WAVE_CLEAR = 100;          // per wave number (wave 1 = 100, wave 10 = 1000)
export const SCORE_ENEMY_KILL = 10;
export const SCORE_BOSS_KILL = 50;
export const SCORE_FOUNDATION_CARD = 20;
export const SCORE_BASE_HP_PER_POINT = 2;
export const SCORE_COMBO = 25;
export const SCORE_MILESTONE = 50;
export const SCORE_CHAMPION = 200;
export const SCORE_UNUSED_TURN = 5;
export const SCORE_PERFECT_WAVE = 500;

export const GRADE_THRESHOLDS = [
  { grade: 'S', min: 6000 },
  { grade: 'A', min: 4500 },
  { grade: 'B', min: 3000 },
  { grade: 'C', min: 1500 },
  { grade: 'D', min: 0 },
];

export function getScoreGrade(score: number): string {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return t.grade;
  }
  return 'D';
}

// ==========================================
// Champion abilities
// ==========================================

export const CHAMPION_NAMES: Record<UnitClass, string> = {
  [UnitClass.KNIGHT]: 'Black Knight',
  [UnitClass.CLERIC]: 'High Priestess',
  [UnitClass.ARCHER]: 'Golden Archer',
  [UnitClass.MAGE]: 'Archmage',
};

// Unit pool carry-over limit
export const MAX_UNIT_POOL_CARRYOVER = 5;
