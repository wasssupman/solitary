import type { GamePhase, UnitData, DeployedUnit, EnemyData, MilestoneType } from './DefenseState';

export interface BattleEvent {
  type: 'damage' | 'heal' | 'death' | 'baseDamage' | 'spawn' | 'special';
  sourceId?: string;
  targetId?: string;
  value?: number;
  x?: number;
  y?: number;
  text?: string;
}

export interface DefenseEvents {
  defenseStateChanged: { phase: GamePhase };
  phaseChanged: { from: GamePhase; to: GamePhase };
  unitProduced: { unit: UnitData };
  comboTriggered: { suit: number; count: number };
  milestoneAchieved: { milestone: MilestoneType };
  unitDeployed: { unit: DeployedUnit; slotIdx: number };
  enemySpawned: { enemy: EnemyData };
  enemyDefeated: { enemy: EnemyData; isBoss: boolean };
  unitDestroyed: { unit: DeployedUnit };
  baseDamaged: { damage: number; remainingHp: number };
  waveCleared: { wave: number; perfect: boolean };
  defenseGameOver: { victory: boolean; score: number; grade: string; wave: number };
  battleTick: { events: BattleEvent[] };
}
