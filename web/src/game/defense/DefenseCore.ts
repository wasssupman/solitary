import { SolitaireCore } from '../core/SolitaireCore';
import {
  GamePhase, MilestoneType,
  type DefenseState, type DefenseDisplayState, type UnitData, type DeployedUnit,
} from './DefenseState';
import type { DefenseEvents } from './events';
import {
  BASE_MAX_HP, LANE_SLOTS, MAX_UNIT_POOL_CARRYOVER,
  SCORE_WAVE_CLEAR, SCORE_ENEMY_KILL, SCORE_BOSS_KILL,
  SCORE_FOUNDATION_CARD, SCORE_BASE_HP_PER_POINT, SCORE_COMBO,
  SCORE_MILESTONE, SCORE_CHAMPION, SCORE_UNUSED_TURN, SCORE_PERFECT_WAVE,
  getScoreGrade,
} from './constants';
import { createUnitFromCard, createChampion, createFreeSilverUnit, createFreeGoldUnit, applySquadReadyBonus, resetUnitIdCounter } from './UnitManager';
import { spawnEnemies, getTurnLimit, generateAffinity, resetEnemyIdCounter } from './WaveController';
import { tick as battleTick } from './BattleEngine';
import type { Card } from '../../solver/types';

type Listener<T> = (data: T) => void;

export class DefenseCore {
  private solitaireCore: SolitaireCore;
  private ds!: DefenseState;
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private gameSeed = 0;

  // Foundation state tracking (to detect new cards)
  private prevFoundationCounts: number[] = [0, 0, 0, 0];

  constructor() {
    this.solitaireCore = new SolitaireCore();
  }

  get core(): SolitaireCore { return this.solitaireCore; }
  get state(): DefenseState { return this.ds; }
  get phase(): GamePhase { return this.ds.phase; }

  // ── Event System ──

  on<K extends keyof DefenseEvents>(event: K, cb: Listener<DefenseEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as Listener<unknown>);
  }

  off<K extends keyof DefenseEvents>(event: K, cb: Listener<DefenseEvents[K]>): void {
    this.listeners.get(event)?.delete(cb as Listener<unknown>);
  }

  private emit<K extends keyof DefenseEvents>(event: K, data: DefenseEvents[K]): void {
    const fns = this.listeners.get(event);
    if (fns) for (const fn of fns) fn(data);
  }

  // ── Game Management ──

  newGame(seed?: number): void {
    this.gameSeed = seed ?? Math.floor(Math.random() * 1000000);
    resetUnitIdCounter();
    resetEnemyIdCounter();

    this.solitaireCore.newGame(this.gameSeed);
    this.prevFoundationCounts = [0, 0, 0, 0];

    const turnLimit = getTurnLimit(1);
    const affinity = generateAffinity(1, this.gameSeed);

    this.ds = {
      phase: GamePhase.CARD,
      wave: 1,
      turnsRemaining: turnLimit,
      turnLimit,
      score: 0,
      baseHp: BASE_MAX_HP,
      baseMaxHp: BASE_MAX_HP,
      unitPool: [],
      deployedUnits: [],
      enemies: [],
      battleSpeed: 1,
      lastFoundationSuit: null,
      comboCount: 0,
      totalCombos: 0,
      achievedMilestones: [],
      enemiesDefeated: 0,
      bossesDefeated: 0,
      perfectWaves: 0,
      unusedTurns: 0,
      championsProduced: 0,
      foundationCardsPlayed: 0,
      waveAffinity: affinity,
      waveDamageToBase: 0,
    };

    this.emit('defenseStateChanged', { phase: GamePhase.CARD });
  }

  // ── Card Phase ──
  // NOTE: Turn tracking and foundation detection are handled by DefenseScene's
  // event listeners on SolitaireCore events ('moveExecuted', 'stockDrawn').
  // InteractionController calls SolitaireCore directly, so the scene intercepts
  // those events and calls consumeTurn() / detectFoundationChanges() / undo().

  /** Called by the scene after each card move or stock draw to decrement turns. */
  consumeTurn(): void {
    if (this.ds.phase !== GamePhase.CARD) return;
    this.ds.turnsRemaining--;
    if (this.ds.turnsRemaining <= 0) {
      this.advanceToDeployPhase();
    }
  }

  /**
   * Called by the scene's 'undone' event handler AFTER SolitaireCore has
   * already performed the undo. Restores defense-specific state only.
   */
  onUndone(): void {
    if (this.ds.phase !== GamePhase.CARD) return;
    this.ds.turnsRemaining = Math.min(this.ds.turnsRemaining + 1, this.ds.turnLimit);
    // Recalculate foundation snapshot to match current state
    const solState = this.solitaireCore.state;
    for (let i = 0; i < 4; i++) {
      this.prevFoundationCounts[i] = solState.foundation[i].length;
    }
  }

  /** Check if any new cards were added to foundation since last snapshot. Called after moves. */
  detectFoundationChanges(): void {
    const solState = this.solitaireCore.state;
    for (let suit = 0; suit < 4; suit++) {
      const newCount = solState.foundation[suit].length;
      const oldCount = this.prevFoundationCounts[suit];
      if (newCount > oldCount) {
        // New card(s) added to foundation
        for (let i = oldCount; i < newCount; i++) {
          const card = solState.foundation[suit][i];
          this.onCardToFoundation(card, suit);
        }
      }
      this.prevFoundationCounts[suit] = newCount;
    }
  }

  private onCardToFoundation(card: Card, suit: number): void {
    this.ds.foundationCardsPlayed++;

    // Combo tracking
    if (this.ds.lastFoundationSuit === suit) {
      this.ds.comboCount++;
    } else {
      this.ds.comboCount = 1;
      this.ds.lastFoundationSuit = suit;
    }

    if (this.ds.comboCount >= 2) {
      this.ds.totalCombos++;
      this.emit('comboTriggered', { suit, count: this.ds.comboCount });
    }

    // Create unit
    const unit = createUnitFromCard(card.rank, suit, this.ds.comboCount);
    this.ds.unitPool.push(unit);
    this.emit('unitProduced', { unit });

    // Check milestones
    this.checkMilestones(suit);
  }

  private checkMilestones(triggerSuit: number): void {
    const solState = this.solitaireCore.state;
    const fCounts = solState.foundation.map(f => f.length);
    const achieved = this.ds.achievedMilestones;

    // First Blood: first A placed
    if (!achieved.includes(MilestoneType.FIRST_BLOOD) && fCounts.some(c => c >= 1)) {
      achieved.push(MilestoneType.FIRST_BLOOD);
      this.ds.turnsRemaining += 3;
      this.ds.turnLimit += 3;
      this.emit('milestoneAchieved', { milestone: MilestoneType.FIRST_BLOOD });
    }

    // Squad Ready: all 4 suits have at least A
    if (!achieved.includes(MilestoneType.SQUAD_READY) && fCounts.every(c => c >= 1)) {
      achieved.push(MilestoneType.SQUAD_READY);
      applySquadReadyBonus(this.ds.unitPool);
      applySquadReadyBonus(this.ds.deployedUnits);
      this.emit('milestoneAchieved', { milestone: MilestoneType.SQUAD_READY });
    }

    // Silver Gate: any foundation reaches 5
    if (!achieved.includes(MilestoneType.SILVER_GATE) && fCounts.some(c => c >= 5)) {
      achieved.push(MilestoneType.SILVER_GATE);
      const suitIdx = fCounts.findIndex(c => c >= 5);
      const freeUnit = createFreeSilverUnit(suitIdx);
      this.ds.unitPool.push(freeUnit);
      this.emit('milestoneAchieved', { milestone: MilestoneType.SILVER_GATE });
      this.emit('unitProduced', { unit: freeUnit });
    }

    // Gold Gate: any foundation reaches 10
    if (!achieved.includes(MilestoneType.GOLD_GATE) && fCounts.some(c => c >= 10)) {
      achieved.push(MilestoneType.GOLD_GATE);
      const suitIdx = fCounts.findIndex(c => c >= 10);
      const freeUnit = createFreeGoldUnit(suitIdx);
      this.ds.unitPool.push(freeUnit);
      this.emit('milestoneAchieved', { milestone: MilestoneType.GOLD_GATE });
      this.emit('unitProduced', { unit: freeUnit });
    }

    // Full Suit: any foundation reaches 13 (K)
    if (fCounts[triggerSuit] >= 13) {
      // Check if we already have a champion for this suit
      const alreadyHasChampion = this.ds.unitPool.some(u => u.isChampion && u.suit === triggerSuit) ||
        this.ds.deployedUnits.some(u => u.isChampion && u.suit === triggerSuit);
      if (!alreadyHasChampion) {
        if (!achieved.includes(MilestoneType.FULL_SUIT)) {
          achieved.push(MilestoneType.FULL_SUIT);
        }
        const champion = createChampion(triggerSuit);
        this.ds.unitPool.push(champion);
        this.ds.championsProduced++;
        this.emit('milestoneAchieved', { milestone: MilestoneType.FULL_SUIT });
        this.emit('unitProduced', { unit: champion });
      }
    }
  }

  // ── Phase Transitions ──

  endCardPhase(): void {
    if (this.ds.phase !== GamePhase.CARD) return;
    this.advanceToDeployPhase();
  }

  private advanceToDeployPhase(): void {
    this.ds.unusedTurns += this.ds.turnsRemaining;
    // Reset combo for next wave
    this.ds.lastFoundationSuit = null;
    this.ds.comboCount = 0;

    const from = this.ds.phase;
    this.ds.phase = GamePhase.DEPLOY;
    this.emit('phaseChanged', { from, to: GamePhase.DEPLOY });
    this.emit('defenseStateChanged', { phase: GamePhase.DEPLOY });
  }

  // ── Deploy Phase ──

  deployUnit(unitId: string, slotIdx: number): boolean {
    if (this.ds.phase !== GamePhase.DEPLOY) return false;
    if (slotIdx < 0 || slotIdx >= LANE_SLOTS) return false;

    const unitIdx = this.ds.unitPool.findIndex(u => u.id === unitId);
    if (unitIdx === -1) return false;

    const unit = this.ds.unitPool[unitIdx];

    // Check slot availability
    for (let s = slotIdx; s < slotIdx + unit.slotSize; s++) {
      if (s >= LANE_SLOTS) return false;
      if (this.ds.deployedUnits.some(u => u.alive && u.slotIdx === s)) return false;
    }

    // Move from pool to deployed — laneX set from slot position
    this.ds.unitPool.splice(unitIdx, 1);
    const deployed: DeployedUnit = {
      ...unit,
      slotIdx,
      laneX: (slotIdx + 0.5) / LANE_SLOTS,
      attackCooldown: 0,
      alive: true,
    };
    this.ds.deployedUnits.push(deployed);
    this.emit('unitDeployed', { unit: deployed, slotIdx });
    return true;
  }

  repositionUnit(unitId: string, newSlotIdx: number): boolean {
    if (this.ds.phase !== GamePhase.DEPLOY) return false;
    if (newSlotIdx < 0 || newSlotIdx >= LANE_SLOTS) return false;

    const unit = this.ds.deployedUnits.find(u => u.id === unitId && u.alive);
    if (!unit) return false;

    // Check target slot(s) available (excluding self)
    for (let s = newSlotIdx; s < newSlotIdx + unit.slotSize; s++) {
      if (s >= LANE_SLOTS) return false;
      if (this.ds.deployedUnits.some(u => u.alive && u.id !== unitId && u.slotIdx === s)) return false;
    }

    unit.slotIdx = newSlotIdx;
    unit.laneX = (newSlotIdx + 0.5) / LANE_SLOTS;
    return true;
  }

  // ── Battle Phase ──

  startBattle(): void {
    if (this.ds.phase !== GamePhase.DEPLOY) return;

    // Trim unit pool to carry-over limit
    while (this.ds.unitPool.length > MAX_UNIT_POOL_CARRYOVER) {
      this.ds.unitPool.shift(); // remove oldest
    }

    // Spawn enemies for current wave
    this.ds.enemies = spawnEnemies(this.ds.wave, this.ds.waveAffinity);
    this.ds.waveDamageToBase = 0;

    const from = this.ds.phase;
    this.ds.phase = GamePhase.BATTLE;
    this.emit('phaseChanged', { from, to: GamePhase.BATTLE });
    this.emit('defenseStateChanged', { phase: GamePhase.BATTLE });
  }

  tickBattle(deltaSec: number): void {
    if (this.ds.phase !== GamePhase.BATTLE) return;

    const result = battleTick(
      deltaSec * this.ds.battleSpeed,
      this.ds.deployedUnits,
      this.ds.enemies,
      this.ds.baseHp,
    );

    // Apply base damage
    this.ds.baseHp += result.baseHpDelta;
    this.ds.baseHp = Math.max(0, Math.min(this.ds.baseMaxHp, this.ds.baseHp));
    if (result.baseHpDelta < 0) {
      this.ds.waveDamageToBase += Math.abs(result.baseHpDelta);
      this.emit('baseDamaged', { damage: Math.abs(result.baseHpDelta), remainingHp: this.ds.baseHp });
    }

    // Track kills
    for (const eid of result.enemiesDefeated) {
      const enemy = this.ds.enemies.find(e => e.id === eid);
      if (enemy) {
        this.ds.enemiesDefeated++;
        if (enemy.isBoss) this.ds.bossesDefeated++;
        this.emit('enemyDefeated', { enemy, isBoss: enemy.isBoss });
      }
    }

    // Track unit deaths
    for (const uid of result.unitsDestroyed) {
      const unit = this.ds.deployedUnits.find(u => u.id === uid);
      if (unit) {
        this.emit('unitDestroyed', { unit });
      }
    }

    // Emit battle events
    if (result.events.length > 0) {
      this.emit('battleTick', { events: result.events });
    }

    // Check game over
    if (this.ds.baseHp <= 0) {
      this.endGame(false);
      return;
    }

    // Check wave clear
    if (result.allEnemiesDead) {
      this.onWaveCleared();
    }
  }

  setBattleSpeed(speed: number): void {
    this.ds.battleSpeed = speed;
  }

  private onWaveCleared(): void {
    const perfect = this.ds.waveDamageToBase === 0;
    if (perfect) this.ds.perfectWaves++;

    // Score for wave clear
    this.ds.score += this.ds.wave * SCORE_WAVE_CLEAR;

    this.emit('waveCleared', { wave: this.ds.wave, perfect });

    // Remove dead units from deployed
    this.ds.deployedUnits = this.ds.deployedUnits.filter(u => u.alive);
    // Reset attack cooldowns for surviving units
    for (const u of this.ds.deployedUnits) {
      u.attackCooldown = 0;
    }

    if (this.ds.wave >= 10) {
      this.endGame(true);
      return;
    }

    // Advance to next wave
    this.ds.wave++;
    const turnLimit = getTurnLimit(this.ds.wave);
    this.ds.turnLimit = turnLimit;
    this.ds.turnsRemaining = turnLimit;
    this.ds.waveAffinity = generateAffinity(this.ds.wave, this.gameSeed);
    this.ds.enemies = [];
    this.ds.waveDamageToBase = 0;

    const from = this.ds.phase;
    this.ds.phase = GamePhase.CARD;
    this.emit('phaseChanged', { from, to: GamePhase.CARD });
    this.emit('defenseStateChanged', { phase: GamePhase.CARD });
  }

  private endGame(victory: boolean): void {
    const score = this.calculateScore();
    this.ds.score = score;
    const grade = getScoreGrade(score);

    this.ds.phase = victory ? GamePhase.VICTORY : GamePhase.GAME_OVER;
    this.emit('defenseGameOver', { victory, score, grade, wave: this.ds.wave });
    this.emit('defenseStateChanged', { phase: this.ds.phase });
  }

  // ── Scoring ──

  calculateScore(): number {
    let score = 0;

    // Wave clears (already accumulated during play but recalculate for accuracy)
    score += this.ds.wave * SCORE_WAVE_CLEAR;

    // Enemy kills
    score += (this.ds.enemiesDefeated - this.ds.bossesDefeated) * SCORE_ENEMY_KILL;
    score += this.ds.bossesDefeated * SCORE_BOSS_KILL;

    // Foundation cards
    score += this.ds.foundationCardsPlayed * SCORE_FOUNDATION_CARD;

    // Base HP
    score += this.ds.baseHp * SCORE_BASE_HP_PER_POINT;

    // Combos
    score += this.ds.totalCombos * SCORE_COMBO;

    // Milestones
    score += this.ds.achievedMilestones.length * SCORE_MILESTONE;

    // Champions
    score += this.ds.championsProduced * SCORE_CHAMPION;

    // Unused turns
    score += this.ds.unusedTurns * SCORE_UNUSED_TURN;

    // Perfect waves
    score += this.ds.perfectWaves * SCORE_PERFECT_WAVE;

    return score;
  }

  // ── Display State ──

  getDisplayState(): DefenseDisplayState {
    return {
      phase: this.ds.phase,
      wave: this.ds.wave,
      turnsRemaining: this.ds.turnsRemaining,
      turnLimit: this.ds.turnLimit,
      score: this.ds.score,
      baseHp: this.ds.baseHp,
      baseMaxHp: this.ds.baseMaxHp,
      unitPoolCount: this.ds.unitPool.length,
      unitPool: this.ds.unitPool.map(u => ({
        id: u.id, unitClass: u.unitClass, grade: u.grade, rank: u.rank, suit: u.suit,
      })),
      deployedUnits: this.ds.deployedUnits.map(u => ({
        id: u.id, unitClass: u.unitClass, grade: u.grade,
        slotIdx: u.slotIdx, hp: u.hp, maxHp: u.maxHp, alive: u.alive,
      })),
      enemyCount: this.ds.enemies.length,
      enemiesAlive: this.ds.enemies.filter(e => e.alive).length,
      battleSpeed: this.ds.battleSpeed,
      comboCount: this.ds.comboCount,
      achievedMilestones: [...this.ds.achievedMilestones],
      waveAffinity: this.ds.waveAffinity,
      enemiesDefeated: this.ds.enemiesDefeated,
      foundationCardsPlayed: this.ds.foundationCardsPlayed,
      championsProduced: this.ds.championsProduced,
    };
  }
}
