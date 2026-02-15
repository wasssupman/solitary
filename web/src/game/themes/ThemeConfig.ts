export interface ThemeConfig {
  id: string;
  name: string;
  tableColor: number;
  cardFaceColor: number;
  cardBorderColor: number;
  redSuitColor: string;
  blackSuitColor: string;
  cardBackColor: number;
  cardBackPatternColor: number;
  cardBackBorderColor: number;
  cardBackPattern: 'grid' | 'crosshatch' | 'circles';
  pileOutlineColor: number;
  pileOutlineAlpha: number;
  particleColors: [string, string, string, string];
}
