import * as THREE from 'three'
import { canvasTexture } from './util'

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)

/** Teardrop punching on rack columns: two slots per face every 2" (50.8 mm). Applied as roughness + bump so the holes read in the light. */
function teardropMaps() {
  const draw = (ctx: CanvasRenderingContext2D, fg: string, bg: string) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = fg
    for (const cx of [20, 44]) {
      ctx.beginPath(); ctx.ellipse(cx, 20, 4, 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillRect(cx - 2, 20, 4, 14)
    }
  }
  const bump = canvasTexture(64, 64, ctx => draw(ctx, '#000', '#fff'), { srgb: false })
  return { bump }
}

export function makeMaterials() {
  const { bump } = teardropMaps()
  return {
    // RAL 5010 gentian blue uprights, RAL 2004 pure orange beams: the most common selective-rack colour scheme.
    upright: std({ color: 0x1f4e9c, roughness: 0.45, metalness: 0.6, bumpMap: bump, bumpScale: 0.6 }),
    beam: std({ color: 0xe8600a, roughness: 0.4, metalness: 0.6 }),
    galvanised: std({ color: 0xb4b8bb, roughness: 0.35, metalness: 0.85 }),
    steelPainted: std({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 }),
    steelDark: std({ color: 0x3a3d42, roughness: 0.55, metalness: 0.7 }),
    safetyYellow: std({ color: 0xf0b400, roughness: 0.5, metalness: 0.3 }),
    sprinklerRed: std({ color: 0xa8231c, roughness: 0.55, metalness: 0.4 }),
    wood: std({ color: 0xa88656, roughness: 0.9 }),
    particleboard: std({ color: 0xc9b48e, roughness: 0.85 }),
    binBlue: std({ color: 0x1e56a8, roughness: 0.55, metalness: 0.0 }),
    polybag: std({ color: 0xe6e3dc, roughness: 0.45 }),
    wallPanel: std({ color: 0xcfd2d4, roughness: 0.6, metalness: 0.2 }),
    roofDeck: std({ color: 0xe9ebec, roughness: 0.8, metalness: 0.1, side: THREE.BackSide }),
    fixtureHousing: std({ color: 0xd8dadc, roughness: 0.5, metalness: 0.6 }),
    fixtureLens: std({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 4, roughness: 0.3 }),
    rubber: std({ color: 0x141414, roughness: 0.95 }),
    trailerSide: std({ color: 0xdadcdf, roughness: 0.35, metalness: 0.7 }),
    trailerFrame: std({ color: 0x2b2d30, roughness: 0.6, metalness: 0.6 }),
    tyre: std({ color: 0x151515, roughness: 0.9 }),
    asphalt: std({ color: 0x2c2d2e, roughness: 0.95 }),
    concreteBare: std({ color: 0x8e8c88, roughness: 0.9 }),
    doorPanel: std({ color: 0xf1f2f3, roughness: 0.45, metalness: 0.3 }),
    dockSeal: std({ color: 0x1a1a1a, roughness: 0.9 }),
    film: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false }),
    paintYellow: std({ color: 0xf2c200, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }),
    paintWhite: std({ color: 0xe9e6dc, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }),
    paintGreen: std({ color: 0x2c7a3f, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -1 }),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  }
}
export type Mats = ReturnType<typeof makeMaterials>
