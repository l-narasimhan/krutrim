import * as THREE from 'three'
import { CONVEYORS, type ConveyorLine } from '../layout'
import { boxAt, cylAt, merged, setInstance, canvasTexture } from './util'
import { Tex } from '../assets'
import type { Mats } from './mats'
import { rng } from '../rng'

/** 24" belt-over-slider-bed tote conveyor in 10 ft sections on H-stands, with guard rails, drives and photo eyes. */
const CV = {
  beltW: 0.61, bedH: 0.05, frameH: 0.12, frameT: 0.04, section: 3.048, railH: 0.05, railUp: 0.11,
  legW: 0.05, driveEvery: 30, eyeEvery: 6.1, speed: 0.6,
}
/** 24 × 16 × 11 in attached-lid tote, the standard pick tote. */
const TOTE = { L: 0.6, W: 0.4, H: 0.28 }

interface Path { pts: THREE.Vector2[]; len: number; cum: number[] }
function makePath(points: [number, number][]): Path {
  const pts = points.map(p => new THREE.Vector2(p[0], p[1]))
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
  return { pts, len: cum[cum.length - 1], cum }
}
function along(p: Path, s: number, out: THREE.Vector2): number {
  s = ((s % p.len) + p.len) % p.len
  let i = 1
  while (i < p.cum.length - 1 && p.cum[i] < s) i++
  const a = p.pts[i - 1], b = p.pts[i]
  const t = (s - p.cum[i - 1]) / (p.cum[i] - p.cum[i - 1])
  out.lerpVectors(a, b, t)
  return Math.atan2(b.x - a.x, b.y - a.y) // heading, 0 = +z
}

export class Conveyor {
  group = new THREE.Group()
  colliders: THREE.Box3[] = []
  private totes: THREE.InstancedMesh
  private boxes: THREE.InstancedMesh
  private boxSize: Float32Array
  private lines: { path: Path; h: number; s: Float32Array; first: number; count: number; carries: 'tote' | 'box' }[] = []
  private tmp = new THREE.Vector2()

  constructor(M: Mats) {
    const frame: THREE.BufferGeometry[] = [], belt: THREE.BufferGeometry[] = [], rollers: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], drives: THREE.BufferGeometry[] = []
    const eyes: [number, number, number, number][] = []
    let toteTotal = 0, boxTotal = 0
    for (const line of CONVEYORS) {
      const runs: [Path, number][] = [[makePath(line.points), line.h]]
      for (const sp of line.spurs) {
        const p = makePath(line.points)
        const at = this.tmp.clone(); along(p, Math.abs(sp.at - line.points[0][0]), at)
        runs.push([makePath([[at.x, at.y], sp.to]), line.h])
      }
      runs.forEach(([path, h], ri) => {
        this.buildRun(path, h, frame, line.kind === 'belt' ? belt : rollers, dark, drives, eyes, ri === 0)
        if (ri === 0) {
          const n = Math.floor(path.len / (line.carries === 'tote' ? 2.4 : 2.0))
          const first = line.carries === 'tote' ? toteTotal : boxTotal
          this.lines.push({ path, h, s: new Float32Array(n).map((_, i) => i * (path.len / n) + rng() * 0.8), first, count: n, carries: line.carries })
          if (line.carries === 'tote') toteTotal += n; else boxTotal += n
        }
      })
    }
    // Roller beds: 1.9" galvanised rollers on 3" centres, drawn as a stripe texture on the bed top.
    const rollerTex = canvasTexture(32, 64, ctx => {
      ctx.fillStyle = '#9a9ea1'; ctx.fillRect(0, 0, 32, 64)
      ctx.fillStyle = '#5d6165'; ctx.fillRect(0, 0, 32, 10); ctx.fillRect(0, 32, 32, 10)
      ctx.fillStyle = '#c9cdd0'; ctx.fillRect(0, 14, 32, 4); ctx.fillRect(0, 46, 32, 4)
    }, { repeat: [1, 1] })
    const rollerMat = new THREE.MeshStandardMaterial({ map: rollerTex, roughness: 0.4, metalness: 0.8 })
    this.group.add(merged(frame, M.galvanised), merged(belt, M.rubber, false), merged(rollers, rollerMat, false), merged(dark, M.steelDark), merged(drives, M.upright))
    // Photo eyes: a small sensor body on the rail post with a red LED, one instanced mesh each.
    const eyeBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.05, 0.02), M.steelDark, eyes.length)
    const eyeLed = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.008, 0.004), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 3 }), eyes.length)
    eyes.forEach(([x, y, z, ry], i) => { setInstance(eyeBody, i, x, y, z, 1, 1, 1, 0, ry, 0); setInstance(eyeLed, i, x, y + 0.01, z, 1, 1, 1, 0, ry, 0) })
    this.group.add(eyeBody, eyeLed)
    // Totes riding the belt: attached-lid totes in the two colours on the floor, grey and yellow.
    this.totes = new THREE.InstancedMesh(makeToteGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), Math.max(1, toteTotal))
    this.totes.count = toteTotal
    const c = new THREE.Color()
    for (let i = 0; i < toteTotal; i++) this.totes.setColorAt(i, c.setHex(rng() < 0.5 ? 0x9a9d9f : 0xe0b400))
    this.totes.castShadow = true
    // Packed boxes on the roller lines: a spread of common shipper sizes.
    this.boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ ...Tex.cardboard(), roughness: 1 }), Math.max(1, boxTotal))
    this.boxes.count = boxTotal
    this.boxSize = new Float32Array(boxTotal * 3)
    for (let i = 0; i < boxTotal; i++) {
      const [w, h, d] = [[0.3, 0.2, 0.4], [0.4, 0.3, 0.5], [0.25, 0.15, 0.3], [0.45, 0.35, 0.45], [0.2, 0.1, 0.3]][Math.floor(rng() * 5)]
      this.boxSize.set([w, h, d], i * 3)
      this.boxes.setColorAt(i, c.setHSL(0.08, 0.35, 0.45 + rng() * 0.12))
    }
    this.boxes.castShadow = true
    this.group.add(this.totes, this.boxes)
    this.update(0)
  }

  /** One run of conveyor: bed, side frames, rails, H-stands at every section joint, drives and photo eyes along it. */
  private buildRun(path: Path, h: number, frame: THREE.BufferGeometry[], belt: THREE.BufferGeometry[], dark: THREE.BufferGeometry[], drives: THREE.BufferGeometry[], eyes: [number, number, number, number][], spine: boolean) {
    const { beltW, bedH, frameH, frameT, section, railH, railUp, legW } = CV
    for (let i = 1; i < path.pts.length; i++) {
      const a = path.pts[i - 1], b = path.pts[i]
      const len = a.distanceTo(b), ry = Math.atan2(b.x - a.x, b.y - a.y)
      const cx = (a.x + b.x) / 2, cz = (a.y + b.y) / 2
      // Bed and belt surface, one piece per straight run; frames and rails the same.
      const top = boxAt(beltW, 0.012, len, cx, h - 0.006, cz, ry)
      // Stretch the roller stripe texture along the run (one roller per 3 in) by scaling the top face's UVs.
      const uv = top.getAttribute('uv') as THREE.BufferAttribute
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (len / 0.152))
      belt.push(top)
      dark.push(boxAt(beltW, bedH, len, cx, h - bedH / 2 - 0.012, cz, ry))
      for (const s of [-1, 1]) {
        frame.push(boxAt(frameT, frameH, len, 0, h - frameH / 2, 0, 0).translate(s * (beltW / 2 + frameT / 2), 0, 0).applyMatrix4(rot(ry)).translate(cx, 0, cz))
        frame.push(boxAt(0.03, railH, len, 0, h + railUp + railH / 2, 0, 0).translate(s * (beltW / 2 + 0.03), 0, 0).applyMatrix4(rot(ry)).translate(cx, 0, cz))
      }
      // H-stands at every section joint: two legs, a cross member, floor plates; rail posts on each stand.
      const n = Math.max(1, Math.round(len / section))
      for (let k = 0; k <= n; k++) {
        const t = Math.min(1, (k * section + 0.1) / len)
        const px = a.x + (b.x - a.x) * t, pz = a.y + (b.y - a.y) * t
        for (const s of [-1, 1]) {
          frame.push(boxAt(legW, h - frameH, legW, 0, (h - frameH) / 2, 0).translate(s * (beltW / 2 + legW / 2), 0, 0).applyMatrix4(rot(ry)).translate(px, 0, pz))
          frame.push(boxAt(0.12, 0.006, 0.12, 0, 0.003, 0).translate(s * (beltW / 2 + legW / 2), 0, 0).applyMatrix4(rot(ry)).translate(px, 0, pz))
          frame.push(boxAt(0.02, railUp + railH, 0.02, 0, h + (railUp + railH) / 2, 0).translate(s * (beltW / 2 + 0.03), 0, 0).applyMatrix4(rot(ry)).translate(px, 0, pz))
        }
        frame.push(boxAt(beltW + legW * 2, 0.04, 0.04, 0, 0.3, 0).applyMatrix4(rot(ry)).translate(px, 0, pz))
        if (k % Math.round(CV.eyeEvery / section) === 0) eyes.push([px + Math.cos(ry) * (beltW / 2 + 0.05), h + 0.06, pz - Math.sin(ry) * (beltW / 2 + 0.05), ry])
      }
      // Gearmotor drives under the bed every 30 m with conduit up to a control box on the nearest leg.
      const drivesN = spine ? Math.max(1, Math.floor(len / CV.driveEvery)) : 1
      for (let k = 0; k < drivesN; k++) {
        const t = spine ? (k + 0.5) / drivesN : 0.5
        const px = a.x + (b.x - a.x) * t, pz = a.y + (b.y - a.y) * t
        drives.push(boxAt(0.32, 0.26, 0.4, 0, h - frameH - 0.2, 0).translate(beltW / 2 + 0.2, 0, 0).applyMatrix4(rot(ry)).translate(px, 0, pz))
        drives.push(cylAt(0.09, beltW + 0.1, 0, h - bedH - 0.1, 0, 'x', 12).applyMatrix4(rot(ry)).translate(px, 0, pz))
        dark.push(cylAt(0.012, h + 0.5, 0, (h + 0.5) / 2, 0, 'y', 6).translate(beltW / 2 + 0.36, 0, 0.3).applyMatrix4(rot(ry)).translate(px, 0, pz))
        dark.push(boxAt(0.2, 0.3, 0.12, 0, h + 0.55, 0).translate(beltW / 2 + 0.36, 0, 0.3).applyMatrix4(rot(ry)).translate(px, 0, pz))
      }
      // Walking collider for the run.
      const minX = Math.min(a.x, b.x) - beltW / 2 - 0.2, maxX = Math.max(a.x, b.x) + beltW / 2 + 0.2
      const minZ = Math.min(a.y, b.y) - beltW / 2 - 0.2, maxZ = Math.max(a.y, b.y) + beltW / 2 + 0.2
      this.colliders.push(new THREE.Box3(new THREE.Vector3(minX, 0, minZ), new THREE.Vector3(maxX, h + 0.3, maxZ)))
    }
  }

  update(dt: number) {
    for (const l of this.lines) {
      for (let i = 0; i < l.count; i++) {
        l.s[i] += CV.speed * dt
        const ry = along(l.path, l.s[i], this.tmp)
        if (l.carries === 'tote') setInstance(this.totes, l.first + i, this.tmp.x, l.h + 0.002, this.tmp.y, 1, 1, 1, 0, ry, 0)
        else {
          const k = (l.first + i) * 3, bs = this.boxSize
          setInstance(this.boxes, l.first + i, this.tmp.x, l.h + bs[k + 1] / 2 + 0.002, this.tmp.y, bs[k], bs[k + 1], bs[k + 2], 0, ry, 0)
        }
      }
    }
    this.totes.instanceMatrix.needsUpdate = true
    this.boxes.instanceMatrix.needsUpdate = true
  }
}

export { makeToteGeometry }
const _r = new THREE.Matrix4()
const rot = (ry: number) => _r.makeRotationY(ry)

/** Attached-lid tote: hollow box with 6 mm walls and a rim, origin at the bottom centre, long axis along z. */
function makeToteGeometry(): THREE.BufferGeometry {
  const { L, W, H } = TOTE
  const t = 0.006
  const parts = [
    boxAt(W, t, L, 0, t / 2, 0),
    boxAt(t, H, L, -W / 2 + t / 2, H / 2, 0), boxAt(t, H, L, W / 2 - t / 2, H / 2, 0),
    boxAt(W, H, t, 0, H / 2, -L / 2 + t / 2), boxAt(W, H, t, 0, H / 2, L / 2 - t / 2),
    boxAt(W + 0.02, 0.012, L + 0.02, 0, H - 0.006, 0),
  ]
  const g = merged(parts, new THREE.MeshStandardMaterial()).geometry
  return g
}
