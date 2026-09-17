import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _e = new THREE.Euler()

export function setInstance(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _p.set(x, y, z); _s.set(sx, sy, sz); _q.setFromEuler(_e.set(rx, ry, rz))
  _m.compose(_p, _q, _s)
  mesh.setMatrixAt(i, _m)
}

/** BoxGeometry translated to (x,y,z) with optional Y rotation, for merging into static geometry. */
export function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  g.translate(x, y, z)
  return g
}

export function cylAt(r: number, len: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z', seg = 10): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  return g
}

/** Merge geometries that may mix indexed and non-indexed buffers. */
export function mergeAny(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const mixed = geos.some(g => !g.index) && geos.some(g => g.index)
  const parts = mixed ? geos.map(g => (g.index ? g.toNonIndexed() : g)) : geos
  return mergeGeometries(parts, false)!
}

export function merged(geos: THREE.BufferGeometry[], mat: THREE.Material, shadows = true): THREE.Mesh {
  const g = mergeAny(geos)
  geos.forEach(x => x.dispose())
  const m = new THREE.Mesh(g, mat)
  m.castShadow = shadows; m.receiveShadow = shadows
  return m
}

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, opts: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (opts.repeat) t.repeat.set(...opts.repeat)
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = opts.aniso ?? 8
  return t
}

/** Painted floor text: a plane lying flat, sized so the text is `height` metres tall. */
export function paintedText(text: string, height: number, color = '#e8e4d8', font = 'bold 120px "JetBrains Mono", Menlo, monospace'): THREE.Mesh {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = font
  const tw = Math.ceil(ctx.measureText(text).width) + 40
  c.width = tw; c.height = 150
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 20, 75)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  const w = height * (tw / 150)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, height), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  m.receiveShadow = true
  return m
}
