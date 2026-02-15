import { UnitClass, UnitGrade, type UnitData } from './DefenseState';
import {
  UNIT_BASE_STATS, GRADE_MULTIPLIER, SUIT_TO_CLASS, rankToGrade,
  getComboBonus, CHAMPION_NAMES, type ComboBonus,
} from './constants';

let nextUnitId = 1;

export function resetUnitIdCounter(): void {
  nextUnitId = 1;
}

export function createUnitFromCard(
  rank: number,
  suit: number,
  comboCount: number,
): UnitData {
  const unitClass = SUIT_TO_CLASS[suit];
  const grade = rankToGrade(rank);
  const base = UNIT_BASE_STATS[unitClass];
  const mul = GRADE_MULTIPLIER[grade];
  const combo = getComboBonus(comboCount);

  const hp = Math.round(base.hp * mul * combo.hpMul);
  const atk = Math.round(base.atk * mul * combo.atkMul);

  return {
    id: `unit_${nextUnitId++}`,
    unitClass,
    grade,
    rank,
    suit,
    hp,
    maxHp: hp,
    atk,
    spd: base.spd,
    range: base.range,
    slotSize: 1,
    comboBonus: combo,
    isChampion: false,
  };
}

export function createChampion(suit: number): UnitData {
  const unitClass = SUIT_TO_CLASS[suit];
  const base = UNIT_BASE_STATS[unitClass];
  const mul = GRADE_MULTIPLIER[UnitGrade.CHAMPION];

  const hp = Math.round(base.hp * mul);
  const atk = Math.round(base.atk * mul);

  return {
    id: `unit_${nextUnitId++}`,
    unitClass,
    grade: UnitGrade.CHAMPION,
    rank: 13,
    suit,
    hp,
    maxHp: hp,
    atk,
    spd: base.spd,
    range: base.range,
    slotSize: 2,
    comboBonus: { atkMul: 1.0, hpMul: 1.0 },
    isChampion: true,
  };
}

/** Create a free Silver unit for Silver Gate milestone */
export function createFreeSilverUnit(suit: number): UnitData {
  return createUnitFromCard(5, suit, 0); // rank 5 = Silver minimum
}

/** Create a free Gold unit for Gold Gate milestone */
export function createFreeGoldUnit(suit: number): UnitData {
  return createUnitFromCard(10, suit, 0); // rank 10 = Gold minimum
}

/** Apply Squad Ready milestone: +10% HP to all units */
export function applySquadReadyBonus(units: UnitData[]): void {
  for (const u of units) {
    const bonus = Math.round(u.maxHp * 0.1);
    u.maxHp += bonus;
    u.hp += bonus;
  }
}

void CHAMPION_NAMES; // referenced for display elsewhere
