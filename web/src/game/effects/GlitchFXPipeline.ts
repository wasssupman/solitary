import Phaser from 'phaser';

const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uIntensity;
uniform vec2 uResolution;

varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;

    // Scanline distortion
    float scanline = sin(uv.y * uResolution.y * 0.5 + uTime * 8.0);
    uv.x += step(0.98, abs(scanline)) * uIntensity * 0.01;

    // RGB channel split
    float offset = uIntensity * 0.005 * sin(uTime * 5.0);
    float r = texture2D(uMainSampler, vec2(uv.x + offset, uv.y)).r;
    float g = texture2D(uMainSampler, uv).g;
    float b = texture2D(uMainSampler, vec2(uv.x - offset, uv.y)).b;
    float a = texture2D(uMainSampler, uv).a;

    gl_FragColor = vec4(r, g, b, a);
}
`;

export class GlitchFXPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _time = 0;

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader,
      name: 'GlitchFX',
    });
  }

  onPreRender(): void {
    this._time += this.game.loop.delta / 1000;
    this.set1f('uTime', this._time);
    this.set1f('uIntensity', 1.0);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }
}
