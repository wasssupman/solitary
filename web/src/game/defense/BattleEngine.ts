import { EnemyType, UnitClass, type DeployedUnit, type EnemyData } from './DefenseState';
import { AFFINITY_WEAK_MULTIPLIER, AFFINITY_RESIST_MULTIPLIER } from './constants';
import type { BattleEvent } from './events';

export interface BattleTickResult {
  events: BattleEvent[];
  baseHpDelta: number;
  enemiesDefeated: string[];
  unitsDestroyed: string[];
  allEnemiesDead: boolean;
}

/** Unit move speed in lane-coords per second */
const UNIT_MOVE_SPEED = 0.08;
/** Enemy base move speed multiplier (applied to enemy.spd) */
const ENEMY_MOVE_SPEED = 0.1;
/** How close (lane-coords) a melee unit needs to be to an enemy to engage */
const MELEE_ENGAGE_DIST = 0.06;
/** Range conversion: 1 unit range ≈ this much lane-coords */
const RANGE_UNIT = 0.08;

function rangeToLane(range: number): number {
  return range * RANGE_UNIT;
}

function getAffinityMultiplier(unitSuit: number, enemy: EnemyData): number {
  if (enemy.weakSuits.includes(unitSuit)) return AFFINITY_WEAK_MULTIPLIER;
  if (enemy.resistSuits.includes(unitSuit)) return AFFINITY_RESIST_MULTIPLIER;
  return 1.0;
}

/** Find closest alive & spawned enemy ahead of or within range of the unit */
function findTarget(unit: DeployedUnit, enemies: EnemyData[]): EnemyData | null {
  const unitRange = rangeToLane(unit.range);
  let closest: EnemyData | null = null;
  let closestDist = Infinity;

  for (const e of enemies) {
    if (!e.alive || !e.spawned) continue;
    if (e.type === EnemyType.SHADOW && e.invisibleTurns && e.invisibleTurns > 0) continue;

    const dist = Math.abs(unit.laneX - e.x);
    if (dist <= unitRange && dist < closestDist) {
      closest = e;
      closestDist = dist;
    }
  }
  return closest;
}

/** Find closest alive enemy ahead (for movement blocking / march decision) */
function findClosestEnemyAhead(unit: DeployedUnit, enemies: EnemyData[]): { enemy: EnemyData; dist: number } | null {
  let closest: { enemy: EnemyData; dist: number } | null = null;
  for (const e of enemies) {
    if (!e.alive || !e.spawned) continue;
    // "ahead" = enemy is to the right of unit (higher laneX)
    const dist = e.x - unit.laneX;
    if (dist > -MELEE_ENGAGE_DIST && (!closest || dist < closest.dist)) {
      closest = { enemy: e, dist };
    }
  }
  return closest;
}

/** Paladog-style battle tick: units march forward, enemies march toward base */
export function tick(
  delta: number,
  units: DeployedUnit[],
  enemies: EnemyData[],
  baseHp: number,
): BattleTickResult {
  const events: BattleEvent[] = [];
  let baseHpDelta = 0;
  const enemiesDefeated: string[] = [];
  const unitsDestroyed: string[] = [];

  // 1. Spawn enemies whose delay has elapsed
  for (const e of enemies) {
    if (!e.spawned && e.spawnDelay <= 0) {
      e.spawned = true;
      events.push({ type: 'spawn', targetId: e.id });
    } else if (!e.spawned) {
      e.spawnDelay -= delta;
    }
  }

  // 2. Unit movement — march forward (laneX increases toward 1.0)
  for (const u of units) {
    if (!u.alive) continue;

    // Check if there's an enemy in attack range
    const target = findTarget(u, enemies);
    if (target) {
      // In range → stop and fight (don't move)
      continue;
    }

    // Cleric: stay near allies instead of marching ahead alone
    if (u.unitClass === UnitClass.CLERIC) {
      const allies = units.filter(a => a.alive && a.id !== u.id);
      if (allies.length > 0) {
        const avgX = allies.reduce((sum, a) => sum + a.laneX, 0) / allies.length;
        // Stay slightly behind the group average
        if (u.laneX > avgX - 0.02) continue;
      }
    }

    // March forward
    u.laneX = Math.min(1.0, u.laneX + UNIT_MOVE_SPEED * u.spd * delta);
  }

  // 3. Enemy movement (march toward base: x decreases)
  for (const e of enemies) {
    if (!e.alive || !e.spawned) continue;

    // Siege: ignores units, moves straight to base
    if (e.type === EnemyType.SIEGE) {
      e.x -= e.spd * ENEMY_MOVE_SPEED * delta;
      if (e.x <= 0) {
        baseHpDelta -= e.atk;
        events.push({ type: 'baseDamage', sourceId: e.id, value: e.atk });
        e.hp = 0;
        e.alive = false;
        enemiesDefeated.push(e.id);
        events.push({ type: 'death', targetId: e.id });
      }
      continue;
    }

    // Ranger: stop at range and shoot (doesn't need to get close)
    if (e.type === EnemyType.RANGER) {
      const rangerRange = RANGE_UNIT * 3; // attack range in lane-coords
      const hasTarget = units.some(u => u.alive && e.x - u.laneX > 0 && e.x - u.laneX <= rangerRange);
      if (!hasTarget) {
        e.x -= e.spd * ENEMY_MOVE_SPEED * delta;
        if (e.x <= 0) {
          baseHpDelta -= e.atk;
          events.push({ type: 'baseDamage', sourceId: e.id, value: e.atk });
          e.hp = 0;
          e.alive = false;
          enemiesDefeated.push(e.id);
          events.push({ type: 'death', targetId: e.id });
        }
      }
      continue;
    }

    // Check if blocked by a unit in front
    const blocked = units.some(u => {
      if (!u.alive) return false;
      return e.x - u.laneX > 0 && e.x - u.laneX < MELEE_ENGAGE_DIST * 2;
    });

    if (!blocked) {
      e.x -= e.spd * ENEMY_MOVE_SPEED * delta;
      if (e.x <= 0) {
        baseHpDelta -= e.atk;
        events.push({ type: 'baseDamage', sourceId: e.id, value: e.atk });
        e.hp = 0;
        e.alive = false;
        enemiesDefeated.push(e.id);
        events.push({ type: 'death', targetId: e.id });
      }
    }
  }

  // 4. Unit attacks
  for (const u of units) {
    if (!u.alive) continue;

    u.attackCooldown -= delta;
    if (u.attackCooldown > 0) continue;

    // Cleric: heal nearby allies
    if (u.unitClass === UnitClass.CLERIC) {
      u.attackCooldown = 1.0 / u.spd;
      const healAmount = 15;
      const healRange = rangeToLane(u.range);
      for (const ally of units) {
        if (!ally.alive || ally.id === u.id) continue;
        if (Math.abs(ally.laneX - u.laneX) <= healRange) {
          const healed = Math.min(healAmount, ally.maxHp - ally.hp);
          if (healed > 0) {
            ally.hp += healed;
            events.push({ type: 'heal', sourceId: u.id, targetId: ally.id, value: healed });
          }
        }
      }
      // Near base: also heal base
      if (u.laneX < 0.1 && baseHp + baseHpDelta < 200) {
        const baseHeal = Math.round(healAmount * 0.5);
        baseHpDelta += baseHeal;
        events.push({ type: 'heal', sourceId: u.id, targetId: 'base', value: baseHeal });
      }
      continue;
    }

    const target = findTarget(u, enemies);
    if (!target) continue;

    u.attackCooldown = 1.0 / u.spd;
    const affinityMul = getAffinityMultiplier(u.suit, target);
    let damage = Math.round(u.atk * affinityMul);

    // Archer: 20% crit
    let critText: string | undefined;
    if (u.unitClass === UnitClass.ARCHER && Math.random() < 0.2) {
      damage *= 2;
      critText = 'CRIT!';
    }

    // Shield enemy: frontal damage reduced 50%
    if (target.type === EnemyType.SHIELD && u.laneX < target.x) {
      damage = Math.round(damage * 0.5);
    }

    // Mage: AoE
    if (u.unitClass === UnitClass.MAGE) {
      const aoeRange = rangeToLane(2);
      for (const e of enemies) {
        if (!e.alive || !e.spawned) continue;
        if (Math.abs(e.x - target.x) <= aoeRange) {
          const aoeDmg = Math.round(u.atk * getAffinityMultiplier(u.suit, e));
          e.hp -= aoeDmg;
          events.push({
            type: 'damage', sourceId: u.id, targetId: e.id, value: aoeDmg,
            text: getAffinityMultiplier(u.suit, e) > 1 ? 'WEAK!' : getAffinityMultiplier(u.suit, e) < 1 ? 'RESIST' : undefined,
          });
          if (e.hp <= 0) {
            e.alive = false;
            enemiesDefeated.push(e.id);
            events.push({ type: 'death', targetId: e.id });
          }
        }
      }
    } else {
      // Single target
      target.hp -= damage;
      events.push({
        type: 'damage', sourceId: u.id, targetId: target.id, value: damage,
        text: critText ?? (affinityMul > 1 ? 'WEAK!' : affinityMul < 1 ? 'RESIST' : undefined),
      });
      if (target.hp <= 0) {
        target.alive = false;
        enemiesDefeated.push(target.id);
        events.push({ type: 'death', targetId: target.id });
      }
    }

    // Knight: 50% cleave
    if (u.unitClass === UnitClass.KNIGHT && Math.random() < 0.5) {
      const cleaveRange = rangeToLane(1);
      for (const e of enemies) {
        if (!e.alive || !e.spawned || e.id === target.id) continue;
        if (Math.abs(e.x - target.x) <= cleaveRange) {
          const cleaveDmg = Math.round(u.atk * 0.5 * getAffinityMultiplier(u.suit, e));
          e.hp -= cleaveDmg;
          events.push({ type: 'damage', sourceId: u.id, targetId: e.id, value: cleaveDmg, text: 'CLEAVE' });
          if (e.hp <= 0) {
            e.alive = false;
            enemiesDefeated.push(e.id);
            events.push({ type: 'death', targetId: e.id });
          }
          break;
        }
      }
    }

    // Champion: Archer pierce
    if (u.isChampion && u.unitClass === UnitClass.ARCHER) {
      for (const e of enemies) {
        if (!e.alive || !e.spawned || e.id === target.id) continue;
        if (e.x > u.laneX) {
          const pierceDmg = Math.round(u.atk * 0.5 * getAffinityMultiplier(u.suit, e));
          e.hp -= pierceDmg;
          events.push({ type: 'damage', sourceId: u.id, targetId: e.id, value: pierceDmg, text: 'PIERCE' });
          if (e.hp <= 0) {
            e.alive = false;
            enemiesDefeated.push(e.id);
            events.push({ type: 'death', targetId: e.id });
          }
        }
      }
    }
  }

  // 5. Enemy attacks on units (cooldown-based, like unit attacks)
  for (const e of enemies) {
    if (!e.alive || !e.spawned) continue;
    if (e.type === EnemyType.SIEGE) continue;

    e.attackCooldown -= delta;
    if (e.attackCooldown > 0) continue;

    // Ranger: ranged attack on closest unit within range
    const attackRange = e.type === EnemyType.RANGER ? RANGE_UNIT * 3 : MELEE_ENGAGE_DIST * 2;

    let closestUnit: DeployedUnit | null = null;
    let closestDist = Infinity;
    for (const u of units) {
      if (!u.alive) continue;
      const dist = e.x - u.laneX; // positive = enemy is ahead of unit
      if (dist > 0 && dist <= attackRange && dist < closestDist) {
        closestUnit = u;
        closestDist = dist;
      }
    }

    if (closestUnit) {
      e.attackCooldown = 1.0 / e.spd;
      const dmg = e.atk;
      closestUnit.hp -= dmg;
      events.push({ type: 'damage', sourceId: e.id, targetId: closestUnit.id, value: dmg });
      if (closestUnit.hp <= 0) {
        closestUnit.alive = false;
        unitsDestroyed.push(closestUnit.id);
        events.push({ type: 'death', targetId: closestUnit.id });
      }

      // Brute: push unit back
      if (e.type === EnemyType.BRUTE && closestUnit.alive) {
        closestUnit.laneX = Math.max(0, closestUnit.laneX - 0.05);
        events.push({ type: 'special', sourceId: e.id, targetId: closestUnit.id, text: 'PUSHED' });
      }
    }
  }

  // 6. Healer enemies (uses attackCooldown for heal timing)
  for (const e of enemies) {
    if (!e.alive || !e.spawned || e.type !== EnemyType.HEALER) continue;
    // Healer cooldown is already decremented in step 5, but healers skip attack there
    // so we check separately: if cooldown <= 0, heal nearby allies
    if (e.attackCooldown > 0) continue;
    e.attackCooldown = 1.0 / e.spd;
    for (const other of enemies) {
      if (!other.alive || !other.spawned || other.id === e.id) continue;
      if (Math.abs(other.x - e.x) < 0.15 && other.hp < other.maxHp) {
        const heal = Math.min(10, other.maxHp - other.hp);
        if (heal > 0) {
          other.hp += heal;
          events.push({ type: 'heal', sourceId: e.id, targetId: other.id, value: heal });
        }
      }
    }
  }

  // 7. King of Ruin phases
  for (const e of enemies) {
    if (!e.alive || e.type !== EnemyType.KING_OF_RUIN) continue;
    const hpPercent = e.hp / e.maxHp;
    if (hpPercent <= 0.33 && e.bossPhase === 2) {
      e.bossPhase = 3;
      events.push({ type: 'special', sourceId: e.id, text: 'Phase 3 — Desperation!' });
      for (const u of units) {
        if (!u.alive) continue;
        const dot = 5;
        u.hp -= dot;
        events.push({ type: 'damage', sourceId: e.id, targetId: u.id, value: dot, text: 'DOT' });
        if (u.hp <= 0) {
          u.alive = false;
          unitsDestroyed.push(u.id);
          events.push({ type: 'death', targetId: u.id });
        }
      }
    } else if (hpPercent <= 0.66 && e.bossPhase === 1) {
      e.bossPhase = 2;
      e.spd *= 2;
      events.push({ type: 'special', sourceId: e.id, text: 'Phase 2 — Enraged!' });
    }
  }

  // 8. Shadow boss invisibility toggle
  for (const e of enemies) {
    if (!e.alive || e.type !== EnemyType.SHADOW) continue;
    if (e.invisibleTurns !== undefined) {
      e.invisibleTurns = (e.invisibleTurns + 1) % 4;
    }
  }

  const allEnemiesDead = enemies.every(e => !e.alive);
  return { events, baseHpDelta, enemiesDefeated, unitsDestroyed, allEnemiesDead };
}
