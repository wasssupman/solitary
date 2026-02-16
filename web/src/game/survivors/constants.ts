// ==========================================
// Survivors Mode — Balance Constants
// ==========================================

// Player
export const PLAYER_MAX_HP = 100;
export const PLAYER_INVINCIBILITY_DURATION = 0.5;  // seconds of i-frames after hit
export const PLAYER_COLLISION_RADIUS = 16;          // pixels

// Projectile
export const PROJECTILE_BASE_DAMAGE = 10;
export const PROJECTILE_SPEED = 300;                // pixels/sec
export const PROJECTILE_LIFETIME = 2.0;             // seconds
export const PROJECTILE_RADIUS = 4;                 // pixels

// Auto-fire
export const AUTO_FIRE_INTERVAL = 1.0;              // seconds between auto-fires per suit

// Foundation damage scaling: each tier adds bonus damage
export const FOUNDATION_DAMAGE_PER_TIER = 2;        // +2 per foundation card in that suit

// Enemy — Grunt (only type in Phase 1)
export const ENEMY_BASE_HP = 30;
export const ENEMY_BASE_ATK = 10;
export const ENEMY_BASE_SPEED = 60;                 // pixels/sec
export const ENEMY_COLLISION_RADIUS = 12;           // pixels

// Spawning
export const ENEMY_SPAWN_INTERVAL = 2.0;            // seconds between spawns
export const ENEMY_SPAWN_RADIUS_MARGIN = 50;        // pixels beyond arena edge for spawn ring

// Wave scaling
export const WAVE_DURATION = 60;                    // seconds per wave
export const TOTAL_WAVES = 10;
export const WAVE_HP_MULTIPLIER = 0.15;             // +15% HP per wave
export const WAVE_SPEED_MULTIPLIER = 0.05;          // +5% speed per wave
export const WAVE_SPAWN_RATE_MULTIPLIER = 0.1;      // spawn interval decreases 10% per wave

// Scoring
export const SCORE_ENEMY_KILL = 10;
export const SCORE_WAVE_CLEAR = 100;
export const SCORE_FOUNDATION_CARD = 25;

// Arena
export const ARENA_HEIGHT_RATIO = 0.20;              // upper 20% — minimal arena for mobile
export const SOLITAIRE_HEIGHT_RATIO = 0.80;          // lower 80% — solitaire needs most space

// Suit colors for projectiles/effects
export const SUIT_COLORS: Record<number, number> = {
  0: 0xe74c3c,  // Hearts — red
  1: 0x3498db,  // Diamonds — blue
  2: 0x2ecc71,  // Clubs — green
  3: 0x9b59b6,  // Spades — purple
};

export const SUIT_COLOR_STRINGS: Record<number, string> = {
  0: '#e74c3c',
  1: '#3498db',
  2: '#2ecc71',
  3: '#9b59b6',
};
