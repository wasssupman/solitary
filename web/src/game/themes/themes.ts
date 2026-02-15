import type { ThemeConfig } from './ThemeConfig';

export const CLASSIC_THEME: ThemeConfig = {
  id: 'classic',
  name: 'Classic',
  tableColor: 0x35654d,
  cardFaceColor: 0xffffff,
  cardBorderColor: 0xcccccc,
  redSuitColor: '#e74c3c',
  blackSuitColor: '#2c3e50',
  cardBackColor: 0x1a3a5c,
  cardBackPatternColor: 0x2a5a8c,
  cardBackBorderColor: 0x4a8abd,
  cardBackPattern: 'grid',
  pileOutlineColor: 0xffffff,
  pileOutlineAlpha: 0.15,
  particleColors: [
    'rgba(255, 220, 120, 1)',
    'rgba(255, 180, 60, 0.8)',
    'rgba(255, 120, 20, 0.3)',
    'rgba(255, 80, 0, 0)',
  ],
};

export const MEDIEVAL_THEME: ThemeConfig = {
  id: 'medieval',
  name: 'Medieval',
  tableColor: 0x3a2518,
  cardFaceColor: 0xf5e6c8,
  cardBorderColor: 0x8b7355,
  redSuitColor: '#8b1a1a',
  blackSuitColor: '#1a1a1a',
  cardBackColor: 0x6b1a1a,
  cardBackPatternColor: 0x8b3030,
  cardBackBorderColor: 0xc4956a,
  cardBackPattern: 'crosshatch',
  pileOutlineColor: 0xc4956a,
  pileOutlineAlpha: 0.2,
  particleColors: [
    'rgba(196, 149, 106, 1)',
    'rgba(180, 100, 60, 0.8)',
    'rgba(139, 26, 26, 0.3)',
    'rgba(107, 26, 26, 0)',
  ],
};

export const STEAMPUNK_THEME: ThemeConfig = {
  id: 'steampunk',
  name: 'Steampunk',
  tableColor: 0x1a1a2e,
  cardFaceColor: 0xe8ddd0,
  cardBorderColor: 0xb87333,
  redSuitColor: '#c85a3a',
  blackSuitColor: '#2a2a3a',
  cardBackColor: 0x2a1f14,
  cardBackPatternColor: 0x6b4a2a,
  cardBackBorderColor: 0xb87333,
  cardBackPattern: 'circles',
  pileOutlineColor: 0xb87333,
  pileOutlineAlpha: 0.2,
  particleColors: [
    'rgba(184, 115, 51, 1)',
    'rgba(160, 90, 40, 0.8)',
    'rgba(107, 74, 42, 0.3)',
    'rgba(42, 31, 20, 0)',
  ],
};

export const THEMES: Record<string, ThemeConfig> = {
  classic: CLASSIC_THEME,
  medieval: MEDIEVAL_THEME,
  steampunk: STEAMPUNK_THEME,
};

export const DEFAULT_THEME_ID = 'classic';
