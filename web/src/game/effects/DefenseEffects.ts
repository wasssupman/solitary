import Phaser from 'phaser';
import { GamePhase } from '../defense/DefenseState';

const SUIT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

export function showComboText(scene: Phaser.Scene, suit: number, count: number, x: number, y: number): void {
  const color = SUIT_COLORS[suit] ?? '#ffffff';
  const text = scene.add.text(x, y, `Combo x${count}!`, {
    fontSize: '18px',
    color,
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5, 0.5).setDepth(10001);

  scene.tweens.add({
    targets: text,
    y: y - 25,
    alpha: 0,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 1000,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}

export function showMilestonePopup(scene: Phaser.Scene, milestone: string, x: number, y: number): void {
  // Background banner
  const bg = scene.add.rectangle(x, y, 260, 40, 0x000000, 0.8)
    .setStrokeStyle(2, 0xffd700)
    .setDepth(10002);

  const text = scene.add.text(x, y, `\u2605 ${milestone} \u2605`, {
    fontSize: '16px',
    color: '#ffd700',
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0.5).setDepth(10003);

  scene.tweens.add({
    targets: [bg, text],
    alpha: 0,
    y: y - 40,
    duration: 2000,
    delay: 1500,
    ease: 'Power2',
    onComplete: () => {
      bg.destroy();
      text.destroy();
    },
  });
}

export function showWaveClear(scene: Phaser.Scene, x: number, y: number): void {
  const text = scene.add.text(x, y, 'WAVE CLEAR!', {
    fontSize: '28px',
    color: '#2ecc71',
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5, 0.5).setDepth(10004);

  scene.tweens.add({
    targets: text,
    scaleX: 1.5,
    scaleY: 1.5,
    alpha: 0,
    duration: 1500,
    ease: 'Power2',
    onComplete: () => text.destroy(),
  });
}

export function showPhaseTransition(scene: Phaser.Scene, phase: GamePhase, width: number, height: number): void {
  const labels: Record<string, string> = {
    [GamePhase.CARD]: 'Card Phase',
    [GamePhase.DEPLOY]: 'Deploy Phase',
    [GamePhase.BATTLE]: 'Battle!',
    [GamePhase.VICTORY]: 'Victory!',
    [GamePhase.GAME_OVER]: 'Game Over',
  };

  const label = labels[phase] ?? '';
  if (!label) return;

  const colors: Record<string, string> = {
    [GamePhase.CARD]: '#2ecc71',
    [GamePhase.DEPLOY]: '#3498db',
    [GamePhase.BATTLE]: '#e74c3c',
    [GamePhase.VICTORY]: '#ffd700',
    [GamePhase.GAME_OVER]: '#e74c3c',
  };

  const text = scene.add.text(width / 2, height / 2, label, {
    fontSize: '32px',
    color: colors[phase] ?? '#ffffff',
    fontFamily: 'sans-serif',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5, 0.5).setDepth(10005).setAlpha(0);

  scene.tweens.add({
    targets: text,
    alpha: 1,
    duration: 300,
    ease: 'Power2',
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        alpha: 0,
        y: height / 2 - 30,
        duration: 800,
        delay: 600,
        ease: 'Power2',
        onComplete: () => text.destroy(),
      });
    },
  });
}
