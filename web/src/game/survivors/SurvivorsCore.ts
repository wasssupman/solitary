import { SolitaireCore } from '../core/SolitaireCore';
import {
  SurvivorsGamePhase,
  type SurvivorsState, type SurvivorsDisplayState,
  type SurvivorsEnemyData, type SurvivorsProjectileData,
} from './SurvivorsState';
import type { SurvivorsEvents } from './events';
import {
  PLAYER_MAX_HP, PLAYER_INVINCIBILITY_DURATION, PLAYER_COLLISION_RADIUS,
  PROJECTILE_BASE_DAMAGE, PROJECTILE_SPEED, PROJECTILE_LIFETIME, PROJECTILE_RADIUS,
  AUTO_FIRE_INTERVAL, FOUNDATION_DAMAGE_PER_TIER,
  ENEMY_BASE_HP, ENEMY_BASE_ATK, ENEMY_BASE_SPEED, ENEMY_COLLISION_RADIUS,
  ENEMY_SPAWN_INTERVAL, ENEMY_SPAWN_RADIUS_MARGIN,
  WAVE_DURATION, TOTAL_WAVES, WAVE_HP_MULTIPLIER, WAVE_SPEED_MULTIPLIER, WAVE_SPAWN_RATE_MULTIPLIER,
  SCORE_ENEMY_KILL, SCORE_WAVE_CLEAR, SCORE_FOUNDATION_CARD,
} from './constants';

type Listener<T> = (data: T) => void;

let enemyIdCounter = 0;
let projectileIdCounter = 0;

export class SurvivorsCore {
  private solitaireCore: SolitaireCore;
  private ss!: SurvivorsState;
  private listeners = new Map<string, Set<Listener<unknown>>>();

  /** Arena dimensions (set by scene after layout is computed) */
  arenaWidth = 800;
  arenaHeight = 400;
  spawnRadius = 450;

  // Foundation tracking
  private prevFoundationCounts: number[] = [0, 0, 0, 0];

  constructor() {
    this.solitaireCore = new SolitaireCore();
  }

  get core(): SolitaireCore { return this.solitaireCore; }
  get state(): SurvivorsState { return this.ss; }
  get phase(): SurvivorsGamePhase { return this.ss.phase; }

  // ── Event System ──

  on<K extends keyof SurvivorsEvents>(event: K, cb: Listener<SurvivorsEvents[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as Listener<unknown>);
  }

  off<K extends keyof SurvivorsEvents>(event: K, cb: Listener<SurvivorsEvents[K]>): void {
    this.listeners.get(event)?.delete(cb as Listener<unknown>);
  }

  private emit<K extends keyof SurvivorsEvents>(event: K, data: SurvivorsEvents[K]): void {
    const fns = this.listeners.get(event);
    if (fns) for (const fn of fns) fn(data);
  }

  // ── Game Management ──

  newGame(seed?: number): void {
    enemyIdCounter = 0;
    projectileIdCounter = 0;

    this.solitaireCore.newGame(seed ?? Math.floor(Math.random() * 1000000));
    this.prevFoundationCounts = [0, 0, 0, 0];

    this.ss = {
      phase: SurvivorsGamePhase.PLAYING,
      playerHp: PLAYER_MAX_HP,
      playerMaxHp: PLAYER_MAX_HP,
      playerX: this.arenaWidth / 2,
      playerY: this.arenaHeight / 2,
      invincibilityTimer: 0,
      wave: 1,
      elapsedTime: 0,
      waveTime: 0,
      score: 0,
      foundationTiers: [0, 0, 0, 0],
      enemies: [],
      projectiles: [],
      fireCooldowns: [0, 0, 0, 0],
      spawnTimer: ENEMY_SPAWN_INTERVAL,
      enemiesKilled: 0,
      foundationCardsPlayed: 0,
    };

    this.emit('survivorsStateChanged', { phase: SurvivorsGamePhase.PLAYING });
  }

  // ── Foundation Detection ──

  detectFoundationChanges(): void {
    const solState = this.solitaireCore.state;
    for (let suit = 0; suit < 4; suit++) {
      const newCount = solState.foundation[suit].length;
      const oldCount = this.prevFoundationCounts[suit];
      if (newCount > oldCount) {
        for (let i = oldCount; i < newCount; i++) {
          this.onFoundationPlace(suit, newCount);
        }
      }
      this.prevFoundationCounts[suit] = newCount;
    }
  }

  /** Called after undo to resync foundation counts */
  onUndone(): void {
    const solState = this.solitaireCore.state;
    for (let i = 0; i < 4; i++) {
      this.ss.foundationTiers[i] = solState.foundation[i].length;
      this.prevFoundationCounts[i] = solState.foundation[i].length;
    }
  }

  private onFoundationPlace(suit: number, tier: number): void {
    this.ss.foundationTiers[suit] = tier;
    this.ss.foundationCardsPlayed++;
    this.ss.score += SCORE_FOUNDATION_CARD;

    const damage = this.getDamageForSuit(suit);

    this.emit('foundationPlaced', { suit, tier, damage });

    // Fire an instant bonus projectile toward nearest enemy
    this.fireProjectileAtNearest(suit, damage);
  }

  // ── Battle Tick ──

  tickBattle(deltaSec: number): void {
    if (this.ss.phase !== SurvivorsGamePhase.PLAYING) return;

    // Update timers
    this.ss.elapsedTime += deltaSec;
    this.ss.waveTime += deltaSec;
    this.ss.invincibilityTimer = Math.max(0, this.ss.invincibilityTimer - deltaSec);

    // Spawn enemies
    this.ss.spawnTimer -= deltaSec;
    if (this.ss.spawnTimer <= 0) {
      this.spawnEnemy();
      const waveScale = 1 - (this.ss.wave - 1) * WAVE_SPAWN_RATE_MULTIPLIER;
      this.ss.spawnTimer = ENEMY_SPAWN_INTERVAL * Math.max(0.3, waveScale);
    }

    // Auto-fire projectiles (one per suit that has foundation cards)
    for (let suit = 0; suit < 4; suit++) {
      if (this.ss.foundationTiers[suit] > 0) {
        this.ss.fireCooldowns[suit] -= deltaSec;
        if (this.ss.fireCooldowns[suit] <= 0) {
          const damage = this.getDamageForSuit(suit);
          this.fireProjectileAtNearest(suit, damage);
          this.ss.fireCooldowns[suit] = AUTO_FIRE_INTERVAL;
        }
      }
    }

    // Move enemies toward player
    this.moveEnemies(deltaSec);

    // Move projectiles
    this.moveProjectiles(deltaSec);

    // Check projectile-enemy collisions
    this.checkProjectileCollisions();

    // Check enemy-player collisions
    this.checkPlayerCollisions();

    // Check wave transition
    if (this.ss.waveTime >= WAVE_DURATION) {
      this.onWaveCleared();
    }

    // Check game over
    if (this.ss.playerHp <= 0) {
      this.endGame(false);
    }
  }

  // ── Enemy Spawning ──

  private spawnEnemy(): void {
    const angle = Math.random() * Math.PI * 2;
    const cx = this.ss.playerX;
    const cy = this.ss.playerY;
    const spawnDist = this.spawnRadius;
    const x = cx + Math.cos(angle) * spawnDist;
    const y = cy + Math.sin(angle) * spawnDist;

    // Direction toward player
    const dx = cx - x;
    const dy = cy - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const waveMul = 1 + (this.ss.wave - 1) * WAVE_HP_MULTIPLIER;
    const spdMul = 1 + (this.ss.wave - 1) * WAVE_SPEED_MULTIPLIER;

    const enemy: SurvivorsEnemyData = {
      id: `e${++enemyIdCounter}`,
      hp: Math.round(ENEMY_BASE_HP * waveMul),
      maxHp: Math.round(ENEMY_BASE_HP * waveMul),
      atk: ENEMY_BASE_ATK,
      spd: ENEMY_BASE_SPEED * spdMul,
      x,
      y,
      dirX: dist > 0 ? dx / dist : 0,
      dirY: dist > 0 ? dy / dist : 0,
      alive: true,
    };

    this.ss.enemies.push(enemy);
  }

  // ── Movement ──

  private moveEnemies(deltaSec: number): void {
    const px = this.ss.playerX;
    const py = this.ss.playerY;

    for (const enemy of this.ss.enemies) {
      if (!enemy.alive) continue;

      // Recalculate direction toward player each frame
      const dx = px - enemy.x;
      const dy = py - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        enemy.dirX = dx / dist;
        enemy.dirY = dy / dist;
      }

      enemy.x += enemy.dirX * enemy.spd * deltaSec;
      enemy.y += enemy.dirY * enemy.spd * deltaSec;
    }
  }

  private moveProjectiles(deltaSec: number): void {
    for (const proj of this.ss.projectiles) {
      if (!proj.alive) continue;
      proj.x += proj.vx * deltaSec;
      proj.y += proj.vy * deltaSec;
      proj.lifetime -= deltaSec;
      if (proj.lifetime <= 0) {
        proj.alive = false;
      }
    }
  }

  // ── Collisions ──

  private checkProjectileCollisions(): void {
    for (const proj of this.ss.projectiles) {
      if (!proj.alive) continue;
      for (const enemy of this.ss.enemies) {
        if (!enemy.alive) continue;
        const dx = proj.x - enemy.x;
        const dy = proj.y - enemy.y;
        const dist = dx * dx + dy * dy;
        const hitDist = PROJECTILE_RADIUS + ENEMY_COLLISION_RADIUS;
        if (dist < hitDist * hitDist) {
          // Hit!
          enemy.hp -= proj.damage;
          proj.alive = false;
          if (enemy.hp <= 0) {
            enemy.alive = false;
            this.ss.enemiesKilled++;
            this.ss.score += SCORE_ENEMY_KILL;
            this.emit('enemyKilled', { enemy, score: SCORE_ENEMY_KILL });
          }
          break; // projectile can only hit one enemy
        }
      }
    }

    // Clean up dead projectiles and enemies
    this.ss.projectiles = this.ss.projectiles.filter(p => p.alive);
    this.ss.enemies = this.ss.enemies.filter(e => e.alive);
  }

  private checkPlayerCollisions(): void {
    if (this.ss.invincibilityTimer > 0) return;

    const px = this.ss.playerX;
    const py = this.ss.playerY;

    for (const enemy of this.ss.enemies) {
      if (!enemy.alive) continue;
      const dx = px - enemy.x;
      const dy = py - enemy.y;
      const dist = dx * dx + dy * dy;
      const hitDist = PLAYER_COLLISION_RADIUS + ENEMY_COLLISION_RADIUS;
      if (dist < hitDist * hitDist) {
        // Player hit
        this.ss.playerHp -= enemy.atk;
        this.ss.invincibilityTimer = PLAYER_INVINCIBILITY_DURATION;

        // Knockback enemy slightly
        const d = Math.sqrt(dist) || 1;
        enemy.x -= (dx / d) * 20;
        enemy.y -= (dy / d) * 20;

        this.emit('playerHit', { damage: enemy.atk, remainingHp: this.ss.playerHp });
        break; // only one hit per frame
      }
    }
  }

  // ── Projectile Firing ──

  private getDamageForSuit(suit: number): number {
    return PROJECTILE_BASE_DAMAGE + this.ss.foundationTiers[suit] * FOUNDATION_DAMAGE_PER_TIER;
  }

  private fireProjectileAtNearest(suit: number, damage: number): void {
    const aliveEnemies = this.ss.enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) return;

    const px = this.ss.playerX;
    const py = this.ss.playerY;

    // Find nearest enemy
    let nearest = aliveEnemies[0];
    let nearestDist = Infinity;
    for (const e of aliveEnemies) {
      const dx = e.x - px;
      const dy = e.y - py;
      const d = dx * dx + dy * dy;
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    // Direction to nearest enemy
    const dx = nearest.x - px;
    const dy = nearest.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const vx = (dx / dist) * PROJECTILE_SPEED;
    const vy = (dy / dist) * PROJECTILE_SPEED;

    const proj: SurvivorsProjectileData = {
      id: `p${++projectileIdCounter}`,
      suit,
      damage,
      x: px,
      y: py,
      vx,
      vy,
      alive: true,
      lifetime: PROJECTILE_LIFETIME,
    };

    this.ss.projectiles.push(proj);
    this.emit('projectileFired', { suit, x: px, y: py, vx, vy });
  }

  // ── Wave Transitions ──

  private onWaveCleared(): void {
    this.ss.score += this.ss.wave * SCORE_WAVE_CLEAR;
    this.emit('waveCleared', { wave: this.ss.wave });

    if (this.ss.wave >= TOTAL_WAVES) {
      this.endGame(true);
      return;
    }

    // Advance wave
    this.ss.wave++;
    this.ss.waveTime = 0;
  }

  private endGame(victory: boolean): void {
    this.ss.phase = victory ? SurvivorsGamePhase.VICTORY : SurvivorsGamePhase.GAME_OVER;
    this.emit('survivorsGameOver', { victory, score: this.ss.score, wave: this.ss.wave });
    this.emit('survivorsStateChanged', { phase: this.ss.phase });
  }

  // ── Display State ──

  getDisplayState(): SurvivorsDisplayState {
    return {
      phase: this.ss.phase,
      playerHp: this.ss.playerHp,
      playerMaxHp: this.ss.playerMaxHp,
      wave: this.ss.wave,
      elapsedTime: this.ss.elapsedTime,
      waveTime: this.ss.waveTime,
      score: this.ss.score,
      foundationTiers: [...this.ss.foundationTiers],
      enemiesAlive: this.ss.enemies.filter(e => e.alive).length,
      enemiesKilled: this.ss.enemiesKilled,
      foundationCardsPlayed: this.ss.foundationCardsPlayed,
    };
  }
}
