import Phaser from 'phaser';

/**
 * Minimal glitch post-processing pipeline stub.
 * A real implementation would distort pixels for a screen-glitch effect.
 */
export class GlitchFXPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({ game, name: 'GlitchFX', fragShader: GlitchFXPipeline.FRAG });
  }

  // Pass-through fragment shader (no-op glitch)
  static readonly FRAG = `
    precision mediump float;
    uniform sampler2D uMainSampler;
    varying vec2 outTexCoord;
    void main () {
      gl_FragColor = texture2D(uMainSampler, outTexCoord);
    }
  `;
}
