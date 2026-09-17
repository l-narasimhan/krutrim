import * as THREE from 'three'
import { setInstance } from './util'

/**
 * Painted floor text and wall signs as one instanced plane. Every string gets a 512 × 64 cell in a shared
 * atlas (up to 512 strings); instances are scaled to the requested letter height and tinted per instance.
 */
export class TextLabels {
  mesh: THREE.InstancedMesh
  private canvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private tex: THREE.CanvasTexture
  private rect: THREE.InstancedBufferAttribute
  private n = 0
  private color = new THREE.Color()
  static readonly COLS = 8
  static readonly ROWS = 64

  constructor(private capacity: number) {
    this.canvas.width = this.canvas.height = 4096
    this.ctx = this.canvas.getContext('2d')!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.tex.anisotropy = 16
    const geo = new THREE.PlaneGeometry(8, 1)
    this.rect = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
    geo.setAttribute('aUvRect', this.rect)
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, transparent: true, alphaTest: 0.25, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, side: THREE.DoubleSide })
    mat.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aUvRect;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = uv * aUvRect.zw + aUvRect.xy;\n#endif')
    }
    mat.customProgramCacheKey = () => 'text-labels'
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true
  }

  /**
   * Add a string `height` metres tall at (x, y, z). `flat` lays it on the floor (rotated `yaw` about the vertical);
   * otherwise it stands upright facing `yaw`. Returns the instance index.
   */
  add(text: string, height: number, x: number, y: number, z: number, opts: { flat?: boolean; yaw?: number; color?: number; align?: 'center' | 'left' } = {}): number {
    if (this.n >= this.capacity) throw new Error('text atlas full')
    const i = this.n++
    const cw = 512, ch = 64
    const cx = (i % TextLabels.COLS) * cw, cy = Math.floor(i / TextLabels.COLS) * ch
    const ctx = this.ctx
    ctx.clearRect(cx, cy, cw, ch)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    let size = 52
    ctx.font = `bold ${size}px "JetBrains Mono", Menlo, monospace`
    const w0 = ctx.measureText(text).width
    if (w0 > cw - 16) { size = Math.floor(size * (cw - 16) / w0); ctx.font = `bold ${size}px "JetBrains Mono", Menlo, monospace` }
    const tw = ctx.measureText(text).width
    ctx.textAlign = 'center'
    ctx.fillText(text, cx + cw / 2, cy + ch / 2)
    // The cell is 8:1; shrink the drawn quad's UV to the text so the plane is not mostly empty.
    const used = Math.min(1, (tw + 24) / cw)
    const u0 = (cx + (cw - used * cw) / 2) / 4096
    this.rect.setXYZW(i, u0, 1 - (cy + ch) / 4096, used * cw / 4096, ch / 4096)
    const scale = height * (size / 52)
    const wPlane = 8 * used * scale
    const dx = opts.align === 'left' ? wPlane / 2 : 0
    const yaw = opts.yaw ?? 0
    if (opts.flat) setInstance(this.mesh, i, x + dx * Math.cos(yaw), y, z - dx * Math.sin(yaw), used * scale, scale, 1, -Math.PI / 2, 0, yaw)
    else setInstance(this.mesh, i, x, y, z, used * scale, scale, 1, 0, yaw, 0)
    this.mesh.setColorAt(i, this.color.setHex(opts.color ?? 0xe8e4d8))
    this.mesh.count = this.n
    return i
  }

  commit() {
    this.tex.needsUpdate = true
    this.rect.needsUpdate = true
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}
