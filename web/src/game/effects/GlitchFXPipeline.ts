import Phaser from 'phaser';

/**
 * Cyberpunk-style glitch post-processing pipeline for dragged cards.
 * - Multi-directional RGB channel separation
 * - Horizontal block slice displacement
 * - Random glitch bursts
 */
export class GlitchFXPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _time = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: 'GlitchFX', fragShader: GlitchFXPipeline.FRAG });
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget): void {
    this._time += this.game.loop.delta / 1000;
    this.set1f('uTime', this._time);
    this.set1f('uIntensity', 1.0);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.bindAndDraw(renderTarget);
  }

  static readonly FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform sampler2D uMainSampler;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec2 uResolution;
    varying vec2 outTexCoord;

    // Mobile-safe integer hash (no sin/large multiplier precision issues)
    float hash(float n) {
      vec2 p = fract(vec2(n, n + 1.0) * vec2(0.1031, 0.1030));
      p += dot(p, p.yx + 33.33);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 uv = outTexCoord;
      float t = uTime;
      float intensity = uIntensity;

      // --- Glitch burst: periodic strong glitch windows ---
      float glitchCycle = hash(floor(t * 8.0));
      float glitchStrength = step(0.55, glitchCycle) * intensity;

      // --- Horizontal block slice displacement ---
      float blockSize = 0.03 + hash(floor(t * 10.0)) * 0.07;
      float blockY = floor(uv.y / blockSize);
      // Keep hash input small with fract to avoid mobile precision blowup
      float blockSeed = fract(blockY * 0.17) + fract(floor(t * 15.0) * 0.31);
      float blockRand = hash(blockSeed);
      float sliceMask = step(0.7, blockRand);
      float sliceDir = sign(hash(fract(blockY * 0.37) + fract(t * 0.13)) - 0.5);
      float sliceOffset = sliceMask * (blockRand - 0.7) * 0.1 * glitchStrength * sliceDir;
      uv.x += sliceOffset;

      // --- RGB channel split (each channel offset in different direction) ---
      float chromaBase = 0.004 * intensity;
      float chromaGlitch = 0.008 * glitchStrength;
      float chromaAmt = chromaBase + chromaGlitch;

      // R: upper-left, B: lower-right, G: center
      float rPhase = hash(fract(t * 0.12)) * 0.5 + 0.5;
      float bPhase = hash(fract(t * 0.12 + 0.5)) * 0.5 + 0.5;
      vec2 rOffset = vec2(-chromaAmt * rPhase, -chromaAmt * 0.4 * rPhase);
      vec2 bOffset = vec2( chromaAmt * bPhase,  chromaAmt * 0.4 * bPhase);

      float r = texture2D(uMainSampler, uv + rOffset).r;
      float g = texture2D(uMainSampler, uv).g;
      float b = texture2D(uMainSampler, uv + bOffset).b;
      float a = texture2D(uMainSampler, uv).a;

      // Also sample alpha from offset channels to avoid hard edges
      a = max(a, max(
        texture2D(uMainSampler, uv + rOffset).a,
        texture2D(uMainSampler, uv + bOffset).a
      ));

      // --- Scanlines (subtle CRT feel) ---
      float scanline = sin(uv.y * uResolution.y * 1.5) * 0.04 * intensity;
      vec3 color = vec3(r, g, b) - scanline;

      gl_FragColor = vec4(color, a);
    }
  `;
}
