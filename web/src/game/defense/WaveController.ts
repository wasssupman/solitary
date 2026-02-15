import { EnemyType, type EnemyData } from './DefenseState';
import { WAVE_CONFIGS, ENEMY_BASE_STATS, getWeakSuit, type WaveConfig } from './constants';

let nextEnemyId = 1;

export function resetEnemyIdCounter(): void {
  nextEnemyId = 1;
}

export function getWaveConfig(waveNumber: number): WaveConfig {
  const idx = Math.min(waveNumber - 1, WAVE_CONFIGS.length - 1);
  return WAVE_CONFIGS[idx];
}

export function getTurnLimit(waveNumber: number): number {
  return getWaveConfig(waveNumber).turnLimit;
}

/**
 * Generate random suit resistances for affinity waves.
 * Uses a simple seeded random based on wave number and game seed.
 */
export function generateAffinity(
  waveNumber: number,
  seed: number,
): { resistSuits: number[] } | null {
  const config = getWaveConfig(waveNumber);
  if (config.affinityCount === 0) return null;

  // Simple deterministic selection based on seed + wave
  const hash = ((seed * 2654435761) ^ (waveNumber * 40503)) >>> 0;
  const suits: number[] = [];
  const available = [0, 1, 2, 3];

  for (let i = 0; i < config.affinityCount && available.length > 0; i++) {
    const idx = ((hash >>> (i * 8)) % available.length);
    suits.push(available[idx]);
    available.splice(idx, 1);
  }

  return { resistSuits: suits };
}

/**
 * Spawn enemies for a wave.
 */
export function spawnEnemies(
  waveNumber: number,
  affinity: { resistSuits: number[] } | null,
): EnemyData[] {
  const config = getWaveConfig(waveNumber);
  const enemies: EnemyData[] = [];

  // Determine resist/weak suits for all enemies in this wave
  const resistSuits = affinity?.resistSuits ?? [];
  const weakSuits = resistSuits.map(s => getWeakSuit(s));

  for (const entry of config.enemies) {
    const baseStat = ENEMY_BASE_STATS[entry.type];
    const isBoss = baseStat.isBoss;

    for (let i = 0; i < entry.count; i++) {
      const hp = Math.round(baseStat.hp * config.hpMultiplier);
      const enemy: EnemyData = {
        id: `enemy_${nextEnemyId++}`,
        type: entry.type,
        hp,
        maxHp: hp,
        atk: baseStat.atk,
        spd: baseStat.spd,
        x: 1.0, // start at right edge
        alive: true,
        isBoss,
        resistSuits,
        weakSuits,
        spawnDelay: 0,   // all enemies spawn simultaneously
        spawned: false,
        attackCooldown: 0,
      };

      if (isBoss) {
        enemy.bossPhase = 1;
        if (entry.type === EnemyType.SHADOW) {
          enemy.invisibleTurns = 0;
        }
      }

      enemies.push(enemy);
    }
  }

  return enemies;
}
