// Renders the labelled plan diagram for task 0.2 from src/layout.ts.
//   npm run plan   →  docs/plan/layout.svg (standalone) and docs/plan/index.html (review page)
// Run with Node 22+: node --experimental-strip-types scripts/plan-svg.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { AREAS, MODULES, YARD, CARRIERS, HALL, HALL_X0, HALL_Z0, DOOR, DOOR_RUNS, RACK, RACK_ROW_PITCH, SHELF, SHELF_ROW_PITCH, doors, summary, type Area, type Group } from '../src/layout.ts'

const S = 4 // px per metre
const EXT = { x0: -205, z0: -186, x1: 168, z1: 186 }
const W = (EXT.x1 - EXT.x0) * S, H = (EXT.z1 - EXT.z0) * S
const px = (x: number) => ((x - EXT.x0) * S).toFixed(1)
const pz = (z: number) => ((z - EXT.z0) * S).toFixed(1)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmt = (n: number) => (Math.round(n * 10) / 10).toString()

/** One hue per group. Fills are translucent so they read on light and dark grounds; strokes and text inherit currentColor. */
const HUE: Record<Group, string> = {
  yard: '#8f7a3a', inbound: '#2f7fd6', storage: '#e08a1e', outbound: '#2e9e5b', returns: '#a64ad1', support: '#7c8794', circulation: '#7c8794',
}
const GROUP_LABEL: Record<Group, string> = {
  yard: 'Yard', inbound: 'Inbound', storage: 'Storage', outbound: 'Outbound', returns: 'Returns', support: 'Support', circulation: 'Circulation',
}

/** The process flow, as the numbered sequence drawn on the plan. Order carries meaning: it is the route a unit takes. */
const FLOW: [string, string, number?][] = [
  ['IB-STG', 'Unload'], ['RCV', 'Receive, decant'], ['QC', 'QC'], ['PA-STG', 'Putaway staging'], ['RES-A', 'Stow, pick', -39],
  ['TAKE', 'Takeaway', -39], ['REBIN', 'Rebin'], ['PACK-M', 'Pack'], ['SLAM', 'SLAM'], ['SORT', 'Carrier sort'], ['OB-STG', 'Stage'], ['OB-DOCK', 'Load'],
]
/** Marker positions: the area centre, or a pinned x so the route runs down a rack aisle rather than across the block. */
const flowPoint = ([id, , x]: [string, string, number?]): [number, number] => { const c = centre(area(id)); return [x ?? c[0], c[1]] }
const RETURNS_FLOW = ['RT-RCV', 'GRADE', 'LIQ']

const area = (id: string) => AREAS.find(a => a.id === id)!
const centre = (a: Area): [number, number] => [a.x + a.w / 2, a.z + a.d / 2]

function areaRect(a: Area): string {
  const x = +px(a.x), z = +pz(a.z), w = a.w * S, d = a.d * S
  const hue = HUE[a.group]
  const mezz = a.level === 1
  const nameFits = a.name.length * 6.2 < w - 8 && d > 18
  const label = nameFits ? a.name : a.id
  const dims = `${fmt(a.w)} × ${fmt(a.d)} m`
  const showDims = !mezz && a.group !== 'circulation' && d > 30 && dims.length * 5.6 < w - 8
  const showNote = a.note && d > 44 && a.note.length * 5.2 < w - 8
  const fill = a.group === 'circulation' ? 'none' : mezz ? 'url(#hatch)' : hue
  const rect = `<rect x="${x}" y="${z}" width="${w.toFixed(1)}" height="${d.toFixed(1)}" fill="${fill}" fill-opacity="${a.group === 'circulation' ? 0 : mezz ? 1 : 0.28}" stroke="${mezz ? hue : 'currentColor'}" stroke-width="${mezz ? 1.5 : 0.8}" stroke-dasharray="${a.group === 'circulation' ? '3 3' : mezz ? '6 3' : 'none'}"/>`
  const t = a.group === 'circulation' ? '' : mezz
    ? `<text x="${(x + w - 4).toFixed(1)}" y="${(z + d - 6).toFixed(1)}" font-size="11" font-weight="600" text-anchor="end" fill="${hue}">${esc(a.name)}</text>`
    : `<text x="${(x + 4).toFixed(1)}" y="${(z + 12).toFixed(1)}" font-size="${nameFits ? 11 : 9}" font-weight="600">${esc(label)}</text>`
  const t2 = showDims ? `<text x="${(x + 4).toFixed(1)}" y="${(z + 24).toFixed(1)}" font-size="9" opacity="0.75">${esc(dims)}</text>` : ''
  const t3 = showNote ? `<text x="${(x + 4).toFixed(1)}" y="${(z + 36).toFixed(1)}" font-size="8.5" opacity="0.7">${esc(a.note!)}</text>` : ''
  return `<g data-area="${a.id}"><title>${esc(a.id)} · ${esc(a.name)} · ${dims}${a.note ? ' · ' + esc(a.note) : ''}</title>${rect}${t}${t2}${t3}</g>`
}

function modules(): string {
  // Rows and aisles as fine lines so the module's structure shows without drawing every bay.
  const out: string[] = []
  for (const m of MODULES) {
    const pitch = m.kind === 'rack' ? RACK_ROW_PITCH : SHELF_ROW_PITCH
    const aisle = m.kind === 'rack' ? RACK.aisle : SHELF.aisle
    const depth = m.kind === 'rack' ? RACK.frameDepth * 2 + RACK.flue : SHELF.unitD * 2
    const x0 = m.x + aisle / 2
    for (let r = 0; r < m.rows; r++) {
      const rx = x0 + r * pitch
      out.push(`<rect x="${px(rx)}" y="${pz(m.z)}" width="${(depth * S).toFixed(2)}" height="${(m.d * S).toFixed(1)}" fill="${HUE.storage}" fill-opacity="0.35" stroke="none"/>`)
    }
    const cross = m.kind === 'rack' ? RACK.crossAisle : SHELF.crossAisle
    const zc = m.z + m.d / 2 - cross / 2
    out.push(`<rect x="${px(m.x)}" y="${pz(zc)}" width="${(m.w * S).toFixed(1)}" height="${(cross * S).toFixed(1)}" fill="#fff" fill-opacity="0.55" stroke="none"/>`)
  }
  return out.join('')
}

function columns(): string {
  const out: string[] = []
  for (let i = 0; i <= 16; i++) for (let j = 0; j <= 12; j++)
    out.push(`<circle cx="${px(HALL_X0 + i * HALL.grid)}" cy="${pz(HALL_Z0 + j * HALL.grid)}" r="1.6" fill="currentColor" opacity="0.55"/>`)
  return out.join('')
}

function doorMarks(): string {
  const out: string[] = []
  const last: Record<string, number> = {}
  for (const r of DOOR_RUNS) last[r.prefix] = Math.max(last[r.prefix] ?? 0, r.from + r.count - 1)
  for (const d of doors()) {
    const w = DOOR.w * S
    const y = d.wall === 'N' ? +pz(d.z) - 5 : +pz(d.z)
    out.push(`<rect x="${(+px(d.x) - w / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="5" fill="currentColor"><title>${d.id} · ${esc(d.use)}</title></rect>`)
    if (d.number === 1 || d.number % 5 === 0 || (d.number === last[d.prefix] && d.number % 5 >= 3)) {
      const ty = d.wall === 'N' ? +pz(d.z) - 9 : +pz(d.z) + 15
      out.push(`<text x="${px(d.x)}" y="${ty.toFixed(1)}" font-size="7.5" text-anchor="middle" opacity="0.85">${d.id}</text>`)
    }
  }
  return out.join('')
}

function flow(): string {
  const pts = FLOW.map(flowPoint)
  pts.splice(4, 0, [-39, area('XA-2').z + area('XA-2').d / 2]) // turn into the aisle at the inbound cross aisle
  const poly = pts.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')
  const line = `<polyline points="${poly}" fill="none" stroke="#d3382b" stroke-width="2.2" stroke-opacity="0.9" marker-end="url(#arrow)"/>`
  const marks = FLOW.map((f, i) => {
    const [x, z] = flowPoint(f)
    const label = f[1]
    return `<g><circle cx="${px(x)}" cy="${pz(z)}" r="9" fill="#d3382b"/><text x="${px(x)}" y="${(+pz(z) + 3.5).toFixed(1)}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text><title>${i + 1}. ${esc(label)}</title></g>`
  }).join('')
  const rp = RETURNS_FLOW.map(id => centre(area(id))).map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')
  const ret = `<polyline points="${rp}" fill="none" stroke="#d3382b" stroke-width="1.6" stroke-dasharray="5 4" stroke-opacity="0.8" marker-end="url(#arrow)"/>`
  return line + ret + marks
}

function yard(): string {
  const f = YARD.fence
  const out = [`<rect x="${px(f.x)}" y="${pz(f.z)}" width="${(f.w * S).toFixed(1)}" height="${(f.d * S).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="8 4" opacity="0.7"/>`]
  out.push(`<text x="${px(f.x + 2)}" y="${(+pz(f.z) - 6).toFixed(1)}" font-size="9" opacity="0.7">Perimeter fence</text>`)
  for (const a of YARD.areas) out.push(areaRect(a))
  // Trailer parking stalls at 12 ft pitch, two rows, drawn as ticks.
  for (const id of ['TP-N', 'TP-S']) {
    const a = YARD.areas.find(y => y.id === id)!
    for (let i = 0; i < 56; i++) {
      const x = a.x + 8 + i * DOOR.pitch
      out.push(`<line x1="${px(x)}" y1="${pz(a.z + 1)}" x2="${px(x)}" y2="${pz(a.z + a.d - 1)}" stroke="currentColor" stroke-width="0.4" opacity="0.5"/>`)
    }
    out.push(`<line x1="${px(a.x + 4)}" y1="${pz(a.z + a.d / 2)}" x2="${px(a.x + a.w - 4)}" y2="${pz(a.z + a.d / 2)}" stroke="currentColor" stroke-width="0.4" opacity="0.5"/>`)
  }
  return out.join('')
}

function scaleBar(): string {
  const x = +px(EXT.x0 + 8), y = +pz(EXT.z1 - 8)
  const parts: string[] = []
  for (let i = 0; i < 5; i++) parts.push(`<rect x="${x + i * 20 * S}" y="${y - 4}" width="${20 * S}" height="4" fill="${i % 2 ? 'none' : 'currentColor'}" stroke="currentColor" stroke-width="0.6"/>`)
  for (let i = 0; i <= 5; i++) parts.push(`<text x="${x + i * 20 * S}" y="${y + 10}" font-size="8" text-anchor="middle">${i * 20}</text>`)
  parts.push(`<text x="${x + 100 * S + 14}" y="${y}" font-size="8">metres</text>`)
  parts.push(`<g transform="translate(${x + 130 * S},${y - 22})"><line x1="0" y1="20" x2="0" y2="0" stroke="currentColor" stroke-width="1.2" marker-end="url(#arrow)"/><text x="6" y="6" font-size="9" font-weight="600">N</text></g>`)
  return parts.join('')
}

function svg(): string {
  const s = summary()
  const inside = AREAS.filter(a => a.level !== 1)
  const mezz = AREAS.filter(a => a.level === 1)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Plan of the Krutrim hall: ${fmt(HALL.w)} by ${fmt(HALL.d)} metres, inbound docks on the north wall, outbound docks on the south wall, reserve racking in the middle, pack and sort south of it, returns north-east, offices and cafeteria on the south-west mezzanine, trailer yards north and south." font-family="'IBM Plex Sans', system-ui, sans-serif" style="color:#1c1f24">
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#d3382b"/></marker>
  <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${HUE.support}" stroke-width="1.2" opacity="0.6"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="#fbfaf6"/>
<text x="${px(EXT.x0 + 8)}" y="${pz(EXT.z0 + 10)}" font-size="16" font-weight="700">Krutrim, hall plan for approval, task 0.2</text>
<text x="${px(EXT.x0 + 8)}" y="${pz(EXT.z0 + 15)}" font-size="10" opacity="0.8">800 × 600 ft (${fmt(HALL.w)} × ${fmt(HALL.d)} m, ${s.hall.sqft.toLocaleString('en-US')} sq ft) on a 50 ft column grid · ${s.doors.total} dock doors · flow-through, inbound north to outbound south · 1 px = 0.25 m</text>
<g id="yard">${yard()}</g>
<rect id="hall-bg" x="${px(HALL_X0)}" y="${pz(HALL_Z0)}" width="${(HALL.w * S).toFixed(1)}" height="${(HALL.d * S).toFixed(1)}" fill="#ffffff" stroke="currentColor" stroke-width="2.5"/>
<g id="columns">${columns()}</g>
<g id="areas">${inside.map(areaRect).join('')}</g>
<g id="modules">${modules()}</g>
<g id="mezzanine">${mezz.map(areaRect).join('')}</g>
<g id="doors">${doorMarks()}</g>
<g id="flow">${flow()}</g>
<g id="scale">${scaleBar()}</g>
</svg>`
}

// ---- Review page -----------------------------------------------------------------------------------------------

function page(svgText: string): string {
  const s = summary()
  const groups: Group[] = ['inbound', 'storage', 'outbound', 'returns', 'support', 'circulation', 'yard']
  const all = [...AREAS, ...YARD.areas]
  const rows = (g: Group) => all.filter(a => a.group === g).map(a =>
    `<tr><td><code>${a.id}</code></td><td>${esc(a.name)}${a.level ? ' <span class="tag">level 1</span>' : ''}</td><td class="num">${fmt(a.w)} × ${fmt(a.d)}</td><td class="num">${Math.round(a.w * a.d).toLocaleString('en-US')}</td><td>${esc(a.note ?? '')}</td></tr>`).join('')
  const doorRows = DOOR_RUNS.map(r => `<tr><td><code>${r.prefix}-${String(r.from).padStart(2, '0')}</code> to <code>${r.prefix}-${String(r.from + r.count - 1).padStart(2, '0')}</code></td><td>${r.wall === 'N' ? 'North' : 'South'}</td><td class="num">${r.count}</td><td>${esc(r.use)}</td></tr>`).join('')
  const modRows = s.modules.map(m => {
    const mod = MODULES.find(x => x.id === m.id)!
    return `<tr><td><code>${m.id}</code></td><td>${esc(mod.name)}</td><td class="num">${m.rows} double rows</td><td class="num">${m.baysPerRow} per side</td><td class="num">${m.bays.toLocaleString('en-US')}</td></tr>`
  }).join('')
  // Inline the diagram, dropping its standalone background so it takes the page's tokens.
  const inline = svgText.replace(/<rect width="\d+" height="\d+" fill="#fbfaf6"\/>/, '').replace(' style="color:#1c1f24"', ' class="plan"')
  return `<title>Krutrim Hall Plan</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
:root{--bg:#fbfaf6;--panel:#ffffff;--ink:#1c1f24;--muted:#5d646d;--line:#d9d6cc;--accent:#d3382b;--plan-bg:#ffffff;--hall:#ffffff}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15171b;--panel:#1d2026;--ink:#e8e6df;--muted:#a1a7b0;--line:#33383f;--plan-bg:#1d2026;--hall:#262a31}}
:root[data-theme="dark"]{--bg:#15171b;--panel:#1d2026;--ink:#e8e6df;--muted:#a1a7b0;--line:#33383f;--plan-bg:#1d2026;--hall:#262a31}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 'IBM Plex Sans',system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding-block:28px 48px;padding-inline:16px}
h1{font-size:26px;line-height:1.2;margin:0 0 6px;text-wrap:balance}
h2{font-size:18px;margin:36px 0 10px}
p{max-width:68ch;margin:0 0 12px}
.lede{color:var(--muted)}
.plan-box{overflow-x:auto;background:var(--plan-bg);border:1px solid var(--line);border-radius:6px;margin:18px 0 8px}
.plan-box svg{display:block;min-width:900px;width:100%;height:auto;color:var(--ink)}
.plan-box svg #hall-bg{fill:var(--hall)}
figcaption{font-size:13px;color:var(--muted);margin:0 0 6px}
.legend{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;margin:10px 0 0}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:14px;height:14px;border:1px solid var(--ink);border-radius:2px;display:inline-block}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
.fact{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px}
.fact b{display:block;font-size:20px;font-variant-numeric:tabular-nums}
.fact span{font-size:12px;color:var(--muted);letter-spacing:.02em;text-transform:uppercase}
table{border-collapse:collapse;width:100%;font-size:13.5px;margin:6px 0 4px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
code{font:500 12.5px 'IBM Plex Mono',ui-monospace,monospace}
.tag{font-size:11px;border:1px solid var(--line);border-radius:3px;padding:0 5px;color:var(--muted)}
.tbl{overflow-x:auto}
ol.q li{margin:0 0 8px}
details{margin:8px 0}
summary{cursor:pointer;font-weight:600}
</style>
<div class="wrap">
<h1>Krutrim hall plan</h1>
<p class="lede">Task 0.2, first deliverable. Every area in the agreed program placed at real dimensions inside an 800 × 600 ft flow-through building. Nothing in 3D changes until you approve this plan; the geometry will be generated from the same numbers.</p>

<div class="facts">
<div class="fact"><b>${fmt(HALL.w)} × ${fmt(HALL.d)} m</b><span>hall, ${s.hall.sqft.toLocaleString('en-US')} sq ft</span></div>
<div class="fact"><b>${s.doors.total}</b><span>dock doors</span></div>
<div class="fact"><b>${s.rackBays.toLocaleString('en-US')}</b><span>rack bays</span></div>
<div class="fact"><b>${s.palletPositions.toLocaleString('en-US')}</b><span>reserve pallet positions</span></div>
<div class="fact"><b>${s.pickFaces.toLocaleString('en-US')}</b><span>rack pick faces</span></div>
<div class="fact"><b>${s.bins.toLocaleString('en-US')}</b><span>shelf bins in FM-1</span></div>
</div>

<figure style="margin:0">
<div class="plan-box">${inline}</div>
<figcaption>Plan view, north up. Red numbers are the order flow, 1 unload to 12 load; the dashed red line is the returns side flow. Hover any area or door for its ID and size. Fine orange bands are storage rows; the light band across each module is its cross aisle. The hatched outline is the offices mezzanine over the cafeteria and training rooms.</figcaption>
</figure>
<div class="legend">
${groups.map(g => `<span><i class="sw" style="background:${HUE[g]};opacity:.7"></i>${GROUP_LABEL[g]}</span>`).join('')}
<span><i class="sw" style="background:repeating-linear-gradient(45deg,transparent 0 3px,${HUE.support} 3px 4px)"></i>Mezzanine, level 1</span>
</div>

<h2>What the layout decides</h2>
<ol class="q">
<li><b>Flow-through, not U-shape.</b> Inbound docks on the north wall, outbound on the south. Product moves one way across the building, which keeps forklifts and pick carts out of each other's way and makes the plan legible.</li>
<li><b>Rack rows run north to south.</b> Putaway enters every aisle from the inbound band; picks leave every aisle onto the takeaway conveyor at the south end. Two cross aisles (one mid-block, one along the inbound band) keep walking distances honest.</li>
<li><b>Hybrid picking scale.</b> RES-A and RES-B give ${s.rackBays.toLocaleString('en-US')} bays: levels 1 and 2 are pick faces (${s.pickFaces.toLocaleString('en-US')}), levels 3 to 5 hold ${s.palletPositions.toLocaleString('en-US')} reserve pallets. The fast-mover module FM-1 is 40 × 20 m with 1.4 m cart aisles and ${s.bins.toLocaleString('en-US')} bins, close to task 4.2's budget.</li>
<li><b>Mezzanine footprint kept twice.</b> FM-1 is single level, sized so a pick mezzanine can go over it later (task 4.7). The offices mezzanine over the south-west corner is in the plan now because the cafeteria and training rooms below it are ground-floor areas.</li>
<li><b>Returns in the north-east</b>, behind their own four doors, with liquidation pallets flowing to outbound and restock flowing to the racks.</li>
<li><b>Support along the east wall</b>: battery charging, maintenance and RME, restrooms and first aid, tote storage, packaging supplies next to pack, empty pallet storage next to outbound, electrical and fire pump rooms in the south-east corner. Baler and compactor sit behind the two WC doors in the north-east corner.</li>
<li><b>Yard</b>: 130 ft aprons north and south, two trailer parking rows on each side, gate house at the west truck entrance, associate parking on the west feeding the security entrance at the south-west corner.</li>
</ol>

<h2>Questions settled on 2026-09-17</h2>
<ol class="q">
<li><b>Settled:</b> flow-through with 30 outbound and 26 inbound doors, agreed 2026-09-17.</li>
<li><b>Settled:</b> outbound lanes west to east ${CARRIERS.map(c => `${c.name} ${c.lanes}`).join(', ')}, agreed 2026-09-17.</li>
<li><b>Settled:</b> FM-1 halved to 40 × 20 m (${s.bins.toLocaleString('en-US')} bins), agreed 2026-09-17; RES-B extended into the freed floor.</li>
<li><b>Settled:</b> 60 associates on the floor per shift, agreed 2026-09-17.</li>
<li><b>Settled:</b> hazmat and high-value cages stay on the north wall between inbound and returns, agreed 2026-09-17.</li>
</ol>

<h2>Dock doors</h2>
<div class="tbl"><table><thead><tr><th>Doors</th><th>Wall</th><th class="num">Count</th><th>Use</th></tr></thead><tbody>${doorRows}</tbody></table></div>

<h2>Storage modules</h2>
<div class="tbl"><table><thead><tr><th>ID</th><th>Module</th><th class="num">Rows</th><th class="num">Bays per row</th><th class="num">Bays</th></tr></thead><tbody>${modRows}</tbody></table></div>
<p style="font-size:13px;color:var(--muted)">Rack rows are back-to-back 42 in frames on ${fmt(RACK_ROW_PITCH)} m pitch with ${RACK.aisle} m aisles; shelving rows are back-to-back 18 in units on ${fmt(SHELF_ROW_PITCH)} m pitch with ${SHELF.aisle} m aisles.</p>

<h2>Area schedule</h2>
${groups.map(g => `<details ${g === 'inbound' || g === 'outbound' ? 'open' : ''}><summary>${GROUP_LABEL[g]} (${all.filter(a => a.group === g).length})</summary><div class="tbl"><table><thead><tr><th>ID</th><th>Area</th><th class="num">W × D m</th><th class="num">m²</th><th>What stands here</th></tr></thead><tbody>${rows(g)}</tbody></table></div></details>`).join('')}

<p style="margin-top:28px;font-size:13px;color:var(--muted)">Source: <code>src/layout.ts</code>, rendered by <code>npm run plan</code>. Origin at the hall centre, x east, z south, metres.</p>
</div>`
}

mkdirSync('docs/plan', { recursive: true })
const svgText = svg()
writeFileSync('docs/plan/layout.svg', svgText)
writeFileSync('docs/plan/index.html', page(svgText))
const s = summary()
console.log(JSON.stringify(s, null, 1))
