export class LayoutManager {
  cardWidth: number;
  cardHeight: number;

  private canvasW: number;
  private canvasH: number;

  // Spacing
  private colGap: number;
  private topMargin: number;
  private leftMargin: number;

  readonly faceDownOverlap: number;
  readonly faceUpOverlap: number;

  constructor(width: number, height: number) {
    this.canvasW = width;
    this.canvasH = height;

    // Card size: fit 7 columns with gaps into canvas width
    // Tight margins to maximize card size (~20% larger on mobile)
    const maxCardW = Math.floor((width - 16) / 7.15);
    this.cardWidth = Math.min(maxCardW, 120);
    this.cardHeight = Math.round(this.cardWidth * 1.4); // 2.5:3.5 ratio

    this.colGap = this.cardWidth + Math.floor(this.cardWidth * 0.08);
    this.topMargin = 12;

    // Center the 7 columns horizontally
    const totalW = this.colGap * 6 + this.cardWidth;
    this.leftMargin = Math.floor((width - totalW) / 2);

    this.faceDownOverlap = Math.round(this.cardHeight * 0.18);
    this.faceUpOverlap = Math.round(this.cardHeight * 0.25);
  }

  getStockPosition(): { x: number; y: number } {
    return {
      x: this.leftMargin + this.cardWidth / 2,
      y: this.topMargin + this.cardHeight / 2,
    };
  }

  getWastePosition(): { x: number; y: number } {
    return {
      x: this.leftMargin + this.colGap + this.cardWidth / 2,
      y: this.topMargin + this.cardHeight / 2,
    };
  }

  getFoundationPosition(index: number): { x: number; y: number } {
    // 4 foundation piles on the right side (columns 3-6)
    return {
      x: this.leftMargin + (3 + index) * this.colGap + this.cardWidth / 2,
      y: this.topMargin + this.cardHeight / 2,
    };
  }

  getTableauPosition(
    col: number,
    row: number,
    faceUp: boolean,
  ): { x: number; y: number } {
    const tableauTop = this.topMargin + this.cardHeight + 30;
    let yOffset = 0;
    // row represents the card index in the column
    // We need to calculate y based on preceding cards; for simplicity
    // the caller should accumulate offsets. This method gives position for
    // a card at a given row index assuming all cards below it are face-down
    // except possibly some face-up at the end.
    // Simple version: caller provides row index, we use uniform overlap.
    yOffset =
      row * (faceUp ? this.faceUpOverlap : this.faceDownOverlap);

    return {
      x: this.leftMargin + col * this.colGap + this.cardWidth / 2,
      y: tableauTop + yOffset + this.cardHeight / 2,
    };
  }

  /** Get Y offset for a specific card position in a tableau column,
   *  given the number of face-down cards before it. */
  getTableauY(col: number, faceDownCount: number, faceUpIndex: number): number {
    const tableauTop = this.topMargin + this.cardHeight + 30;
    const yOffset =
      faceDownCount * this.faceDownOverlap +
      faceUpIndex * this.faceUpOverlap;
    return tableauTop + yOffset + this.cardHeight / 2;
  }

  getTableauX(col: number): number {
    return this.leftMargin + col * this.colGap + this.cardWidth / 2;
  }
}
