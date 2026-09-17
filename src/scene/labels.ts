import * as THREE from 'three'
import { code128B } from '../barcode'
import { setInstance } from './util'

/**
 * Tens of thousands of unique printed labels as one instanced plane, drawn procedurally in the fragment shader.
 * Each instance points at a 64-byte record in a data texture: the Code 128 module bits, the human-readable
 * text and an optional subtitle. Bars and glyphs are resolved per pixel, so a label stays crisp at any distance
 * and the whole hall's labels cost one draw call and a few megabytes, where a bitmap atlas would need gigabytes.
 */
const REC_TEXELS = 16                 // 64 bytes per label
const PER_ROW = 256                   // labels per texture row → texture width 4096 texels
const MAX_MODULES = 224               // 28 bytes of bits; a 16-character Code 128 B symbol is 189 modules
const MAX_CHARS = 16

let font: THREE.CanvasTexture | null = null
/** 16 × 6 grid of ASCII 32–126 glyphs, white on black, sampled by the shader. */
function glyphFont() {
  if (font) return font
  const c = document.createElement('canvas')
  c.width = 512; c.height = 288
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 288)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 38px "JetBrains Mono", Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  for (let i = 0; i < 95; i++) ctx.fillText(String.fromCharCode(32 + i), (i % 16) * 32 + 16, Math.floor(i / 16) * 48 + 25)
  font = new THREE.CanvasTexture(c)
  font.generateMipmaps = true; font.minFilter = THREE.LinearMipmapLinearFilter; font.anisotropy = 8
  return font
}

const GLSL_LABEL = /* glsl */`
uniform sampler2D uLabelData;
uniform sampler2D uFont;
uniform float uAspect;
varying float vSlot;
float labelByte(int slot, int b) {
  int texel = b / 4;
  vec4 t = texelFetch(uLabelData, ivec2((slot - (slot / ${PER_ROW}) * ${PER_ROW}) * ${REC_TEXELS} + texel, slot / ${PER_ROW}), 0);
  int ch = b - texel * 4;
  float v = ch == 0 ? t.r : ch == 1 ? t.g : ch == 2 ? t.b : t.a;
  return floor(v * 255.0 + 0.5);
}
float glyph(float code, vec2 f) {
  float c = code - 32.0;
  vec2 cell = vec2(mod(c, 16.0), floor(c / 16.0));
  vec2 uv = (cell + vec2(f.x, 1.0 - f.y)) / vec2(16.0, 6.0);
  return texture2D(uFont, vec2(uv.x, 1.0 - uv.y)).r;
}
vec3 labelColor(vec2 uv) {
  int slot = int(vSlot + 0.5);
  vec3 paper = vec3(0.96, 0.95, 0.92);
  vec3 ink = vec3(0.04);
  float modules = labelByte(slot, 28);
  float nText = labelByte(slot, 29);
  float nSub = labelByte(slot, 30);
  // Barcode band with 10-module quiet zones.
  if (uv.y > 0.05 && uv.y < 0.58 && uv.x > 0.03 && uv.x < 0.97) {
    float mi = floor((uv.x - 0.03) / 0.94 * (modules + 20.0)) - 10.0;
    if (mi >= 0.0 && mi < modules) {
      float byte = labelByte(slot, int(mi / 8.0));
      float bit = mod(floor(byte / exp2(mod(mi, 8.0))), 2.0);
      return mix(paper, ink, bit);
    }
    return paper;
  }
  // Human-readable line: monospace glyphs 2:3, 0.3 of the label height.
  float gh = 0.3, gw = gh * 0.6667 / uAspect;
  if (uv.y > 0.64 && uv.y < 0.64 + gh) {
    float col = floor((uv.x - 0.03) / gw);
    if (uv.x > 0.03 && col < nText) {
      float code = labelByte(slot, 32 + int(col));
      float cov = glyph(code, vec2(fract((uv.x - 0.03) / gw), (uv.y - 0.64) / gh));
      return mix(paper, ink, cov);
    }
  }
  // Subtitle, right-aligned, smaller, only where it clears the main text.
  float sh = 0.18, sw = sh * 0.6667 / uAspect;
  float sx0 = 0.97 - nSub * sw;
  if (nSub > 0.0 && sx0 > 0.03 + nText * gw + 0.02 && uv.y > 0.72 && uv.y < 0.72 + sh && uv.x > sx0 && uv.x < 0.97) {
    float col = floor((uv.x - sx0) / sw);
    float code = labelByte(slot, 48 + int(col));
    float cov = glyph(code, vec2(fract((uv.x - sx0) / sw), (uv.y - 0.72) / sh));
    return mix(paper, vec3(0.2), cov);
  }
  return paper;
}
`

export class LabelField {
  mesh: THREE.InstancedMesh
  private data: Uint8Array
  private tex: THREE.DataTexture
  private slot: THREE.InstancedBufferAttribute

  constructor(count: number, w: number, h: number) {
    const rows = Math.max(1, Math.ceil(count / PER_ROW))
    this.data = new Uint8Array(PER_ROW * REC_TEXELS * 4 * rows)
    this.tex = new THREE.DataTexture(this.data, PER_ROW * REC_TEXELS, rows, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter
    this.tex.generateMipmaps = false
    const geo = new THREE.PlaneGeometry(w, h)
    this.slot = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    geo.setAttribute('aSlot', this.slot)
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })
    mat.defines = { USE_UV: '' }
    mat.onBeforeCompile = shader => {
      shader.uniforms.uLabelData = { value: this.tex }
      shader.uniforms.uFont = { value: glyphFont() }
      shader.uniforms.uAspect = { value: w / h }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSlot;\nvarying float vSlot;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSlot = aSlot;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL_LABEL)
        .replace('#include <map_fragment>', 'diffuseColor.rgb *= labelColor(vUv);')
    }
    mat.customProgramCacheKey = () => `label-field-${w}-${h}`
    this.mesh = new THREE.InstancedMesh(geo, mat, count)
    this.mesh.frustumCulled = false
  }

  /** Encode label i and place its instance. `ry` is the facing direction. */
  set(i: number, id: string, x: number, y: number, z: number, ry: number, subtitle?: string) {
    const widths = code128B(id)
    const o = i * REC_TEXELS * 4
    const d = this.data
    let mi = 0
    for (let k = 0; k < widths.length; k++) {
      const bar = k % 2 === 0
      for (let w = 0; w < widths[k] && mi < MAX_MODULES; w++, mi++) if (bar) d[o + (mi >> 3)] |= 1 << (mi & 7)
    }
    d[o + 28] = mi
    const text = id.slice(0, MAX_CHARS), sub = (subtitle ?? '').slice(0, MAX_CHARS)
    d[o + 29] = text.length; d[o + 30] = sub.length
    for (let k = 0; k < text.length; k++) d[o + 32 + k] = text.charCodeAt(k)
    for (let k = 0; k < sub.length; k++) d[o + 48 + k] = sub.charCodeAt(k)
    this.slot.setX(i, i)
    setInstance(this.mesh, i, x, y, z, 1, 1, 1, 0, ry, 0)
  }

  place(i: number, x: number, y: number, z: number, ry: number) {
    setInstance(this.mesh, i, x, y, z, 1, 1, 1, 0, ry, 0)
  }

  commit() {
    this.tex.needsUpdate = true
    this.slot.needsUpdate = true
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
