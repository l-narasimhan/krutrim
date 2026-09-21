// Commodity zoning: putting like with like in an aisle.
//
// Real fulfillment centers do not scatter a commodity across the building. Bottled liquids sit together
// behind secondary containment, because a burst bottle is a cleanup problem wherever it happens; bagged and
// soft goods sit together because they are the same shape and the same handling; and pickers travel less
// when everything they need for a zone is in one place. An aisle that is all bottles, rolls, bags and tins
// is what a zone actually looks like.
//
// Mechanism: a pick face's product comes from `productForSku(face.sku)`, so re-pointing an aisle's SKUs at
// a set of products re-points everything built from them — the cut cases and eaches on the pick faces, and
// the reserve loads above them. This is a pure string write: it takes NO draws from the shared RNG stream,
// which is why it cannot disturb the rest of the twin.

import { CATALOG, productForSku, unitOf } from './catalog'
import type { Facility } from './facility'

/** Every product whose individual unit is not a box — bottles, rolls, bags, tins, tubs and flats. */
export const NON_CARTON: string[] = CATALOG.filter(p => unitOf(p).form !== 'box').map(p => p.name)

// ---- SKU synthesis -------------------------------------------------------------------------------------------
//
// SKUs have to be manufactured rather than looked up, because `productForSku` is a hash: there is no such
// thing as a SKU *range* that means "bottles". The generator's own format is
//   B0 <aa: 10-99> <L: K|X|M|R> <bbbb: 1000-9999> <S: A|B|C|D>
// so this walks that space in order and returns the first SKU that hashes onto the product asked for. About
// one SKU in 102 resolves to any given product, so the search is short and it is deterministic.

const LETTERS = ['K', 'X', 'M', 'R']
const SUFFIX = ['A', 'B', 'C', 'D']
const SPAN = 90 * LETTERS.length * 9000 * SUFFIX.length

function skuAt(n: number): string {
  const s = SUFFIX[n % SUFFIX.length]
  const b = 1000 + Math.floor(n / SUFFIX.length) % 9000
  const l = LETTERS[Math.floor(n / (SUFFIX.length * 9000)) % LETTERS.length]
  const a = 10 + Math.floor(n / (SUFFIX.length * 9000 * LETTERS.length)) % 90
  return `B0${a}${l}${b}${s}`
}

/** A SKU that resolves to `name`, starting the search at `from`. */
function skuFor(name: string, from: number): string {
  for (let i = 0; i < 6000; i++) {
    const sku = skuAt((from + i) % SPAN)
    if (productForSku(sku).name === name) return sku
  }
  return skuAt(from)   // no match in range; better a wrong label than a crash
}

/**
 * Re-point every entity whose id begins with `prefix` at the given products, cycling through them.
 *
 * Ids are `<module code>-<aisle>-<bay>`, so a prefix like `RB-04-` selects one aisle of RES-B. Reserve
 * slots are re-pointed too, so the pallets above a face carry the same commodity the face does.
 */
export function zoneAisle(f: Facility, prefix: string, productNames: string[], seed = 0): number {
  if (!productNames.length) return 0
  // One SKU per product, spread across the SKU space so neighbouring faces never share a code.
  const step = Math.floor(SPAN / (productNames.length + 1))
  const pool = productNames.map((n, i) => skuFor(n, (seed + i * step * 7) % SPAN))

  let n = 0, k = 0
  const next = () => pool[k++ % pool.length]
  for (const bay of f.bays) {
    if (!bay.id.startsWith(prefix)) continue
    for (const s of bay.slots) if (s.lpn) { s.sku = next(); n++ }
    for (const face of bay.faces) if (face.sku) { face.sku = next(); face.product = productForSku(face.sku).name; n++ }
  }
  for (const bin of f.bins) {
    if (!bin.id.startsWith(prefix)) continue
    if (bin.sku) { bin.sku = next(); bin.product = productForSku(bin.sku).name; n++ }
  }
  return n
}
