import Phaser from 'phaser';
import type { ThemeConfig } from '../themes/ThemeConfig';

const SUIT_SYMBOLS = ['\u2665', '\u2666', '\u2663', '\u2660']; // hearts, diamonds, clubs, spades
const RANK_LABELS = [
  '', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

export class CardRenderer {
  static generateTextures(scene: Phaser.Scene, cardW: number, cardH: number, theme: ThemeConfig): void {
    const cornerR = Math.round(cardW * 0.08);
    const fontSize = Math.round(cardW * 0.22);
    const centerFontSize = Math.round(cardW * 0.38);
    const smallFontSize = Math.round(cardW * 0.16);

    // Generate each of the 52 cards
    for (let suit = 0; suit < 4; suit++) {
      const color = suit < 2 ? theme.redSuitColor : theme.blackSuitColor;
      const symbol = SUIT_SYMBOLS[suit];

      for (let rank = 1; rank <= 13; rank++) {
        const key = `card_${rank}_${suit}`;
        const label = RANK_LABELS[rank];

        const g = scene.add.graphics();

        // Card body
        g.fillStyle(theme.cardFaceColor, 1);
        g.fillRoundedRect(0, 0, cardW, cardH, cornerR);

        // Thin border
        g.lineStyle(1, theme.cardBorderColor, 1);
        g.strokeRoundedRect(0, 0, cardW, cardH, cornerR);

        if (scene.textures.exists(key)) scene.textures.remove(key);
        g.generateTexture(key, cardW, cardH);
        g.destroy();

        // Now add text via a render texture
        const fullKey = key + '_full';
        if (scene.textures.exists(fullKey)) scene.textures.remove(fullKey);
        const rt = scene.textures.createCanvas(fullKey, cardW, cardH);
        if (!rt) continue;
        const ctx = rt.getContext();

        // Draw base card
        const baseImg = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        ctx.drawImage(baseImg, 0, 0);

        // Top-left rank
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, cornerR, cornerR - 2);

        // Top-left suit symbol (below rank)
        ctx.font = `${smallFontSize}px Arial`;
        ctx.fillText(symbol, cornerR, cornerR + fontSize - 2);

        // Center suit symbol
        ctx.font = `${centerFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, cardW / 2, cardH / 2);

        // Bottom-right rank (rotated)
        ctx.save();
        ctx.translate(cardW - cornerR, cardH - cornerR + 2);
        ctx.rotate(Math.PI);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, 0, 0);

        // Bottom-right suit symbol
        ctx.font = `${smallFontSize}px Arial`;
        ctx.fillText(symbol, 0, fontSize - 2);
        ctx.restore();

        rt.refresh();

        // Clean up the intermediate plain card texture
        scene.textures.remove(key);
      }
    }

    // Card back
    const bg = scene.add.graphics();
    bg.fillStyle(theme.cardBackColor, 1);
    bg.fillRoundedRect(0, 0, cardW, cardH, cornerR);

    // Back pattern
    bg.lineStyle(1, theme.cardBackPatternColor, 0.5);
    const step = Math.round(cardW * 0.18);

    if (theme.cardBackPattern === 'grid') {
      for (let x = step; x < cardW; x += step) {
        bg.lineBetween(x, 0, x, cardH);
      }
      for (let y = step; y < cardH; y += step) {
        bg.lineBetween(0, y, cardW, y);
      }
    } else if (theme.cardBackPattern === 'crosshatch') {
      // Diagonal lines at 45 degrees
      for (let d = step; d < cardW + cardH; d += step) {
        bg.lineBetween(Math.max(0, d - cardH), Math.min(cardH, d), Math.min(cardW, d), Math.max(0, d - cardW));
      }
      // Diagonal lines at 135 degrees
      for (let d = step; d < cardW + cardH; d += step) {
        bg.lineBetween(Math.max(0, d - cardH), cardH - Math.min(cardH, d), Math.min(cardW, d), cardH - Math.max(0, d - cardW));
      }
    } else if (theme.cardBackPattern === 'circles') {
      const cx = cardW / 2;
      const cy = cardH / 2;
      const maxR = Math.max(cardW, cardH) * 0.45;
      for (let r = step; r <= maxR; r += step) {
        bg.strokeCircle(cx, cy, r);
      }
    }

    // Inner border
    const inset = Math.round(cardW * 0.08);
    bg.lineStyle(2, theme.cardBackBorderColor, 0.8);
    bg.strokeRoundedRect(inset, inset, cardW - inset * 2, cardH - inset * 2, cornerR);

    if (scene.textures.exists('card_back')) scene.textures.remove('card_back');
    bg.generateTexture('card_back', cardW, cardH);
    bg.destroy();

    // Particle glow texture for card movement trails
    const pSize = 24;
    if (scene.textures.exists('particle_glow')) {
      scene.textures.remove('particle_glow');
    }
    const pCanvas = scene.textures.createCanvas('particle_glow', pSize, pSize);
    if (pCanvas) {
      const pCtx = pCanvas.getContext();
      const grad = pCtx.createRadialGradient(pSize / 2, pSize / 2, 0, pSize / 2, pSize / 2, pSize / 2);
      grad.addColorStop(0, theme.particleColors[0]);
      grad.addColorStop(0.3, theme.particleColors[1]);
      grad.addColorStop(0.7, theme.particleColors[2]);
      grad.addColorStop(1, theme.particleColors[3]);
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, pSize, pSize);
      pCanvas.refresh();
    }
  }

  /** Get the texture key for a card face. */
  static textureKey(rank: number, suit: number): string {
    return `card_${rank}_${suit}_full`;
  }
}
