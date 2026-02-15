import Phaser from 'phaser';
import { CardRenderer } from '../rendering/CardRenderer';

export class CardSprite extends Phaser.GameObjects.Container {
  rank: number;
  suit: number;
  faceUp: boolean;

  private frontImage: Phaser.GameObjects.Image;
  private backImage: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rank: number,
    suit: number,
    faceUp: boolean,
    cardW: number,
    cardH: number,
  ) {
    super(scene, x, y);

    this.rank = rank;
    this.suit = suit;
    this.faceUp = faceUp;

    const frontKey = CardRenderer.textureKey(rank, suit);
    this.frontImage = scene.add.image(0, 0, frontKey).setDisplaySize(cardW, cardH);
    this.backImage = scene.add.image(0, 0, 'card_back').setDisplaySize(cardW, cardH);

    this.add([this.backImage, this.frontImage]);
    this.setSize(cardW, cardH);

    this.frontImage.setVisible(faceUp);
    this.backImage.setVisible(!faceUp);

    scene.add.existing(this);
  }

  flip(faceUp: boolean, animated: boolean = true): void {
    if (this.faceUp === faceUp) return;
    this.faceUp = faceUp;

    if (!animated) {
      this.frontImage.setVisible(faceUp);
      this.backImage.setVisible(!faceUp);
      return;
    }

    // Flip animation: scale X to 0, swap, scale back
    const showing = faceUp ? this.backImage : this.frontImage;
    const hidden = faceUp ? this.frontImage : this.backImage;

    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      duration: 100,
      ease: 'Linear',
      onComplete: () => {
        showing.setVisible(false);
        hidden.setVisible(true);
        this.scene.tweens.add({
          targets: this,
          scaleX: 1,
          duration: 100,
          ease: 'Linear',
        });
      },
    });
  }

  resizeCard(cardW: number, cardH: number): void {
    this.frontImage.setDisplaySize(cardW, cardH);
    this.backImage.setDisplaySize(cardW, cardH);
    this.setSize(cardW, cardH);
  }

  setCard(rank: number, suit: number, faceUp: boolean): void {
    this.rank = rank;
    this.suit = suit;
    this.faceUp = faceUp;

    const frontKey = CardRenderer.textureKey(rank, suit);
    this.frontImage.setTexture(frontKey);
    this.frontImage.setVisible(faceUp);
    this.backImage.setVisible(!faceUp);
  }
}
