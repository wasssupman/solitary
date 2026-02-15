import Phaser from 'phaser';
import { CardRenderer } from './CardRenderer';
import { LayoutManager } from './LayoutManager';
import type { SpriteManager } from '../sprites/SpriteManager';
import type { ThemeConfig } from '../themes/ThemeConfig';
import { THEMES, CLASSIC_THEME } from '../themes/themes';
import type { SolitaireState } from '../../solver/SolitaireState';

export class ThemeManager {
  private _currentTheme: ThemeConfig;

  constructor(
    private scene: Phaser.Scene,
    private layout: LayoutManager,
    private sprites: SpriteManager,
    initialTheme?: ThemeConfig,
  ) {
    this._currentTheme = initialTheme ?? CLASSIC_THEME;
  }

  get theme(): ThemeConfig { return this._currentTheme; }

  loadSaved(): void {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('solitaire-theme');
      if (savedId && THEMES[savedId]) this._currentTheme = THEMES[savedId];
    }
  }

  apply(themeId: string, state: SolitaireState): void {
    const theme = THEMES[themeId];
    if (!theme) return;
    this._currentTheme = theme;

    // Update background
    this.scene.cameras.main.setBackgroundColor(theme.tableColor);

    // Remove existing card textures
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) {
        const key = `card_${rank}_${suit}_full`;
        if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      }
    }
    if (this.scene.textures.exists('card_back')) this.scene.textures.remove('card_back');
    if (this.scene.textures.exists('particle_glow')) this.scene.textures.remove('particle_glow');

    // Regenerate textures
    const cw = this.layout.cardWidth;
    const ch = this.layout.cardHeight;
    CardRenderer.generateTextures(this.scene, cw, ch, theme);

    // Rebuild visuals
    this.sprites.updateTheme(theme);
    this.sprites.clearAll();
    if (this.sprites.stockClickZone) {
      this.sprites.stockClickZone.destroy();
      this.sprites.stockClickZone = null;
    }
    this.sprites.createPileZones();
    this.sprites.rebuild(state);
  }

  updateLayout(layout: LayoutManager): void {
    this.layout = layout;
  }
}
