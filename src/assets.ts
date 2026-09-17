import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

const loader = new THREE.TextureLoader()

export function tex(url: string, opts: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}): THREE.Texture {
  const t = loader.load(url)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (opts.repeat) t.repeat.set(...opts.repeat)
  if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = opts.aniso ?? 8
  return t
}

export async function loadEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  const hdr = await new HDRLoader().loadAsync('/assets/hdri/empty_warehouse_01_1k.hdr')
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const env = pmrem.fromEquirectangular(hdr).texture
  hdr.dispose(); pmrem.dispose()
  return env
}

/** PBR sets. Texture scale is metres per tile. */
export const Tex = {
  concrete: (repeat: [number, number]) => ({
    map: tex('/assets/tex/concrete/concrete_floor_02_diff_1k.jpg', { srgb: true, repeat, aniso: 16 }),
    normalMap: tex('/assets/tex/concrete/concrete_floor_02_nor_gl_1k.jpg', { repeat, aniso: 16 }),
    roughnessMap: tex('/assets/tex/concrete/concrete_floor_02_rough_1k.jpg', { repeat, aniso: 16 }),
  }),
  cardboard: () => ({
    map: tex('/assets/tex/cardboard/Cardboard004_1K-JPG_Color.jpg', { srgb: true, repeat: [1, 1] }),
    normalMap: tex('/assets/tex/cardboard/Cardboard004_1K-JPG_NormalGL.jpg'),
    roughnessMap: tex('/assets/tex/cardboard/Cardboard004_1K-JPG_Roughness.jpg'),
  }),
}
