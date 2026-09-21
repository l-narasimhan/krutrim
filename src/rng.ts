// Deterministic PRNG so the facility looks identical on every load.
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const stream = mulberry32(20260916)

/**
 * Shared-stream draw counter.
 *
 * The whole twin is generated from this one seeded stream in a fixed order, so the NUMBER of draws taken
 * before each scene module is built is load-bearing: change it and everything downstream re-rolls.
 * `rngDraws()` is exposed so that can be checked rather than assumed. Reset it with `rngReset()` only in
 * tooling — never at runtime.
 */
let draws = 0
export const rng = () => { draws++; return stream() }
export const rngDraws = () => draws
export const rngReset = () => { draws = 0 }
export const rand = (a: number, b: number) => a + rng() * (b - a)
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1))
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]
export const chance = (p: number) => rng() < p
