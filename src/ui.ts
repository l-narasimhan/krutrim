import type { Entity, Bay, Bin, PickFace, Dock, Zone, Station, PutWall, Slam, Lane, Facility } from './facility'
import { drawBarcode } from './barcode'
import { mulberry32 } from './rng'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const fmt = (n: number) => n.toLocaleString('en-US')

const FIT_NAME = { hand: 'Hand-stack, cut cases on wire deck', flow: 'Carton flow, 3 gravity roller lanes', bins: 'Bin shelving, 6 × 18 in hopper bins' }
const FIT_SPEC = {
  hand: 'Cut cases on the wire deck, closed reserve cases behind · picker takes eaches from the open case',
  flow: 'Three 32 in carton-flow lanes on skate-wheel track, 120 mm back-to-front drop · loaded from the flue side, cases roll to the pick front',
  bins: 'Six AkroBin 30-280 style hopper bins, 18 × 16½ × 11 in, on the wire deck · one SKU per face',
}

type Level = 'INFO' | 'WARN' | 'CRIT'
interface Ev { t: string; level: Level; src: string; msg: string }

export class Console {
  private kpi = { uph: 14180, queue: 1832, pick: 168, dock: 0.69, acc: 0.9962 }
  private events: Ev[] = []
  private filter: 'all' | 'warn' | 'crit' = 'all'
  private evRng = mulberry32(7)
  private evTimer = 0
  private kpiTimer = 0
  private hist = new Map<string, number[]>()
  selected: Entity | null = null
  onAction?: (a: 'pull' | 'door' | 'fly' | 'walk', e: Entity) => void

  constructor(private f: Facility) {
    const dl = $('ids')
    const ids = [...f.docks.map(d => d.id), ...f.stations.map(x => x.id), ...f.walls.map(x => x.id), ...f.slams.map(x => x.id), ...f.lanes.map(x => x.id), ...f.zones.map(z => z.id), ...f.bays.map(b => b.id), ...f.faces.map(x => x.id), ...f.bins.map(b => b.id)]
    dl.innerHTML = ids.map(i => `<option value="${i}">`).join('')
    document.querySelectorAll<HTMLButtonElement>('.f').forEach(b => b.onclick = () => {
      document.querySelectorAll('.f').forEach(x => x.classList.remove('on')); b.classList.add('on')
      this.filter = b.dataset.f as typeof this.filter
      this.renderEvents()
    })
    const busy = f.docks.filter(d => d.trailerId)
    this.kpi.dock = busy.length / f.docks.length
    $('k-dock-s').textContent = `${busy.length} of ${f.docks.length} doors occupied`
    const worst = busy.reduce((a, b) => (b.minutesAtDoor > a.minutesAtDoor ? b : a), busy[0])
    $('alert-s').textContent = `worst: ${worst.id} · trailer detention ${worst.minutesAtDoor} min`
    for (let i = 0; i < 26; i++) this.pushEvent(true)
    this.renderEvents()
    this.tickKpis(true)
  }

  update(dt: number, stats: { fps: number; calls: number; tris: number }) {
    $('clock').textContent = new Date().toISOString().slice(11, 19)
    this.evTimer -= dt
    if (this.evTimer <= 0) { this.pushEvent(); this.evTimer = 0.7 + this.evRng() * 2.2 }
    this.kpiTimer -= dt
    if (this.kpiTimer <= 0) { this.tickKpis(); this.kpiTimer = 1 }
    $('stats').textContent = `${stats.fps.toFixed(0)} fps · ${stats.calls} draw calls · ${(stats.tris / 1000).toFixed(0)}k tris`
  }

  private tickKpis(first = false) {
    const r = this.evRng
    const k = this.kpi
    if (!first) {
      k.uph += Math.round((r() - 0.5) * 120); k.queue += Math.round((r() - 0.52) * 30); k.pick += (r() - 0.5) * 3
      k.dock = Math.min(0.94, Math.max(0.3, k.dock + (r() - 0.5) * 0.004)); k.acc = Math.min(0.999, Math.max(0.99, k.acc + (r() - 0.5) * 0.0004))
    }
    $('k-uph').innerHTML = `${fmt(k.uph)}<span>${k.uph >= 14000 ? '▲' : '▼'} ${(100 * k.uph / 14000 - 100).toFixed(1)}%</span>`
    $('k-queue').innerHTML = `${fmt(k.queue)}<span>orders</span>`
    $('k-pick').innerHTML = `${k.pick.toFixed(0)}<span>UPH</span>`
    $('k-dock').innerHTML = `${(k.dock * 100).toFixed(0)}<span>%</span>`
    $('k-acc').innerHTML = `${(k.acc * 100).toFixed(2)}<span>%</span>`
  }

  private pushEvent(silent = false) {
    const r = this.evRng
    const p = (arr: string[]) => arr[Math.floor(r() * arr.length)]
    const bay = () => this.f.bays[Math.floor(r() * this.f.bays.length)].id
    const bin = () => this.f.bins[Math.floor(r() * this.f.bins.length)].id
    const face = () => this.f.faces[Math.floor(r() * this.f.faces.length)].id
    const n = (a: number, b: number) => Math.floor(a + r() * (b - a + 1))
    const busy = this.f.docks.filter(d => d.trailerId)
    const dock = () => busy[Math.floor(r() * busy.length)]
    const roll = r()
    let ev: Ev
    const t = new Date().toISOString().slice(11, 19)
    if (roll < 0.83) ev = { t, level: 'INFO', src: p(['WMS', 'WMS', 'WMS', 'DOCK', 'PACK', 'RF']), msg: p([
      `Pick confirmed · ${bin()} · ${n(1, 4)} ea · tote T${n(100000, 999999)}`,
      `Pick confirmed · ${face()} · ${n(1, 6)} ea · tote T${n(100000, 999999)}`,
      `Replenishment complete · ${face()} · pallet dropped from level ${p(['C', 'D', 'E'])}`,
      `Stow complete · ${bin()} · ${n(4, 24)} ea · ${p(['M. Okafor', 'J. Alvarez', 'R. Chen', 'T. Nguyen', 'S. Patel'])}`,
      `Putaway · ${bay()} · LPN${n(1000000, 9999999)} · reach truck RT-0${n(1, 6)}`,
      `Replenishment task created · ${bay()} → ${bin()}`,
      (() => { const d = dock(); return `${d.id} · ${d.carrier} ${d.trailerId} · ${(d.progress * 100).toFixed(0)}% ${d.state === 'LOADING' ? 'loaded' : 'unloaded'}` })(),
      (() => { const st = this.f.stations.filter(x => x.state === 'PACKING'); const p1 = st[Math.floor(r() * st.length)]; return `Order ${n(1000000, 9999999)} packed · ${p1.id} · ${p1.associate} · ${n(1, p1.type === 'single' ? 1 : 6)} items` })(),
      `Cycle count closed · ${bay()} · variance 0`,
      `RF scan · ${bin()} · location verified`,
      `Wave W-${n(200, 260)} released · ${n(120, 480)} orders · ${n(6, 14)} pickers`,
    ]) }
    else if (roll < 0.965) ev = { t, level: 'WARN', src: p(['WMS', 'DOCK', 'SAFETY', 'ICQA']), msg: p([
      `Cycle count variance · ${bay()} · expected ${n(100, 400)} found ${n(90, 400)}`,
      (() => { const d = dock(); return `${d.id} · trailer detention ${n(31, 44)} min · carrier ${d.carrier}` })(),
      `Pedestrian outside walkway · AISLE ${String(n(1, 26)).padStart(2, '0')} · forklift zone`,
      `Bin overfill · ${bin()} · ${n(19, 26)} ea vs cap 18`,
      `Short pick · ${bin()} · expected ${n(2, 6)} found ${n(0, 1)}`,
      `Pick path blocked · PICK ${String(n(1, 17)).padStart(2, '0')} · cart CT-${n(10, 60)} idle 4 min`,
    ]) }
    else ev = { t, level: 'CRIT', src: p(['SAFETY', 'DOCK', 'WMS']), msg: p([
      `${dock().id} · door open · vehicle restraint not engaged`,
      `Forklift proximity alarm · AISLE ${String(n(1, 26)).padStart(2, '0')} · RT-03 and pedestrian`,
      `Damaged beam reported · ${bay()} · level 2 · bay locked out`,
    ]) }
    this.events.unshift(ev)
    if (this.events.length > 120) this.events.pop()
    if (!silent) this.renderEvents(true)
  }

  private renderEvents(flash = false) {
    const list = $('ev-list')
    const vis = this.events.filter(e => this.filter === 'all' || (this.filter === 'warn' ? e.level !== 'INFO' : e.level === 'CRIT'))
    list.innerHTML = vis.slice(0, 60).map((e, i) => `<li class="${e.level}${flash && i === 0 ? ' new' : ''}"><span class="t">${e.t}</span><span class="l">${e.level}</span><span class="s">${e.src}</span><span>${e.msg}</span></li>`).join('')
    $('ev-count').textContent = `${vis.length} of ${this.events.length} events`
  }

  // ---- Tooltip -------------------------------------------------------------------------------
  tooltip(e: Entity | null, x: number, y: number) {
    const tt = $('tooltip')
    if (!e) { tt.hidden = true; return }
    tt.hidden = false
    const vw = tt.parentElement!.clientWidth, vh = tt.parentElement!.clientHeight
    tt.style.left = `${Math.min(x, vw - 240)}px`; tt.style.top = `${Math.min(y, vh - 140)}px`
    if (e.kind === 'bay') {
      const pal = e.slots.filter(s => s.lpn).length
      tt.innerHTML = `<h4>${e.id} <span class="${e.fill > 0.9 ? 'warn' : 'ok'}">● ${e.fill > 0.9 ? 'FULL' : 'NOMINAL'}</span></h4><dl><dt>Aisle</dt><dd>${e.aisle} · side ${e.side}</dd><dt>Pallets</dt><dd>${pal} / ${e.slots.length}</dd><dt>Units</dt><dd>${fmt(e.slots.reduce((a, s) => a + s.qty, 0))}</dd><dt>Last count</dt><dd>${e.lastCount}</dd></dl><div class="hint">CLICK · INSPECT BAY</div>`
    } else if (e.kind === 'bin') {
      tt.innerHTML = `<h4>${e.id} <span class="${e.sku ? 'ok' : ''}">● ${e.sku ? 'STOCKED' : 'EMPTY'}</span></h4><dl><dt>Aisle</dt><dd>${e.aisle}</dd><dt>Product</dt><dd>${e.product ?? '—'}</dd><dt>SKU</dt><dd>${e.sku ?? '—'}</dd><dt>Qty</dt><dd>${e.qty} ea</dd><dt>Velocity</dt><dd>${e.velocity}</dd></dl><div class="hint">CLICK · SCAN BIN</div>`
    } else if (e.kind === 'face') {
      tt.innerHTML = `<h4>${e.id} <span class="${e.sku ? 'ok' : ''}">● ${e.sku ? 'STOCKED' : 'EMPTY'}</span></h4><dl><dt>Pick face</dt><dd>${FIT_NAME[e.fit]}</dd><dt>Product</dt><dd>${e.product ?? '—'}</dd><dt>SKU</dt><dd>${e.sku ?? '—'}</dd><dt>Qty</dt><dd>${e.qty} / ${e.capacity} ea</dd><dt>Velocity</dt><dd>${e.velocity}</dd></dl><div class="hint">CLICK · SCAN FACE</div>`
    } else if (e.kind === 'station') {
      tt.innerHTML = `<h4>${e.id} <span class="${e.state === 'PACKING' ? 'ok' : e.state === 'IDLE' ? 'warn' : ''}">● ${e.state}</span></h4><dl><dt>Station</dt><dd>Pack ${e.type === 'single' ? 'singles' : 'multis'}</dd><dt>Associate</dt><dd>${e.associate ?? '—'}</dd><dt>Rate</dt><dd>${e.rate} UPH</dd><dt>Queue</dt><dd>${e.queue} totes</dd></dl><div class="hint">CLICK · INSPECT STATION</div>`
    } else if (e.kind === 'wall') {
      tt.innerHTML = `<h4>${e.id} <span class="ok">● ${e.filled} / ${e.slots} SLOTS</span></h4><dl><dt>Put wall</dt><dd>${e.slots} cubbies, put-to-light</dd><dt>Orders open</dt><dd>${e.ordersOpen}</dd><dt>Completed today</dt><dd>${e.ordersComplete}</dd></dl><div class="hint">CLICK · INSPECT WALL</div>`
    } else if (e.kind === 'slam') {
      tt.innerHTML = `<h4>${e.id} <span class="ok">● ${e.state}</span></h4><dl><dt>SLAM</dt><dd>scan · label · apply · manifest</dd><dt>Rate</dt><dd>${fmt(e.rate)} boxes/h</dd><dt>Rejects</dt><dd>${e.rejects} today</dd></dl><div class="hint">CLICK · INSPECT SLAM</div>`
    } else if (e.kind === 'lane') {
      tt.innerHTML = `<h4>${e.id} <span class="${e.state === 'OPEN' ? 'ok' : e.state === 'CLOSING' ? 'warn' : ''}">● ${e.state}</span></h4><dl><dt>${e.role === 'sort' ? 'Sort position' : 'Staging lane'}</dt><dd>${e.carrier} · ${e.door}</dd><dt>Cut-off</dt><dd>${e.cutoff}</dd><dt>Boxes</dt><dd>${fmt(e.units)}</dd>${e.role === 'stage' ? `<dt>Staged</dt><dd>${e.gaylords} gaylords · ${e.pallets} pallets</dd>` : ''}</dl><div class="hint">CLICK · INSPECT LANE</div>`
    } else if (e.kind === 'dock') {
      tt.innerHTML = `<h4>${e.id} <span class="${e.trailerId ? 'warn' : ''}">● ${e.state}</span></h4><dl><dt>Use</dt><dd>${e.use}</dd><dt>Carrier</dt><dd>${e.carrier}</dd><dt>Trailer</dt><dd>${e.trailerId ?? '—'}</dd><dt>Progress</dt><dd>${(e.progress * 100).toFixed(0)}%</dd><dt>Door</dt><dd>${e.doorTarget ? 'OPEN' : 'CLOSED'}</dd></dl><div class="hint">CLICK · INSPECT DOCK</div>`
    } else {
      tt.innerHTML = `<h4>${e.id} <span class="ok">● ${e.group.toUpperCase()}</span></h4><dl><dt>Area</dt><dd>${e.name}</dd><dt>Size</dt><dd>${e.size[0].toFixed(0)} × ${e.size[2].toFixed(0)} m</dd></dl><div class="hint">CLICK · INSPECT ZONE</div>`
    }
  }

  // ---- Inspector -----------------------------------------------------------------------------
  select(e: Entity | null) {
    this.selected = e
    const pull = $<HTMLButtonElement>('btn-pull')
    pull.disabled = !e || e.kind !== 'bay'
    if (e?.kind === 'bay') pull.textContent = e.extractTarget ? 'PUSH BACK' : 'PULL PALLETS'
    if (!e) { $('ins-kind').textContent = 'INSPECTOR'; $('ins-id').textContent = 'NOTHING SELECTED'; $('ins-status').className = 'chip'; $('ins-status').textContent = ''; $('ins-body').innerHTML = '<p class="muted">Hover any rack bay, bin, dock door or floor zone for a readout. Click to inspect.</p>'; return }
    if (e.kind === 'bay') this.renderBay(e)
    else if (e.kind === 'bin') this.renderBin(e)
    else if (e.kind === 'face') this.renderFace(e)
    else if (e.kind === 'station') this.renderStation(e)
    else if (e.kind === 'wall') this.renderWall(e)
    else if (e.kind === 'slam') this.renderSlam(e)
    else if (e.kind === 'lane') this.renderLane(e)
    else if (e.kind === 'dock') this.renderDock(e)
    else this.renderZone(e)
    document.querySelectorAll<HTMLButtonElement>('#ins-body [data-act]').forEach(b => b.onclick = () => this.onAction?.(b.dataset.act as 'pull', e))
  }

  private head(kind: string, id: string, status: string, cls: string) {
    $('ins-kind').textContent = kind; $('ins-id').textContent = id
    const s = $('ins-status'); s.textContent = status; s.className = `chip ${cls}`
  }

  private history(id: string, base: number, spread: number): number[] {
    let h = this.hist.get(id)
    if (!h) {
      const r = mulberry32(id.length * 7919 + id.charCodeAt(id.length - 1) * 31 + id.charCodeAt(0))
      let v = base
      h = Array.from({ length: 48 }, () => { v += (r() - 0.5) * spread; v = Math.max(0, v); return v })
      this.hist.set(id, h)
    }
    return h
  }

  private spark(c: HTMLCanvasElement, data: number[], color = '#38d6ff') {
    const dpr = devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    c.width = w * dpr; c.height = h * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1
    const px = (i: number) => 6 + (i / (data.length - 1)) * (w - 12)
    const py = (v: number) => h - 8 - ((v - min) / rng) * (h - 16)
    ctx.strokeStyle = '#1a222e'; ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (h / 4) * i); ctx.lineTo(w, (h / 4) * i); ctx.stroke() }
    ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)))
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.lineTo(px(data.length - 1), h); ctx.lineTo(px(0), h); ctx.closePath()
    ctx.fillStyle = color + '22'; ctx.fill()
  }

  private renderBay(e: Bay) {
    const pal = e.slots.filter(s => s.lpn).length, units = e.slots.reduce((a, s) => a + s.qty, 0)
    this.head('RACK BAY', e.id, e.fill > 0.9 ? 'FULL' : 'NOMINAL', e.fill > 0.9 ? 'warn' : 'ok')
    const hist = this.history(e.id, 6, 3)
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Row</label><span>ROW ${String(e.row + 1).padStart(2, '0')}</span></div><div><label>Aisle</label><span>${e.aisle}</span></div><div><label>Bay</label><span>${e.id.split('-')[2]} · SIDE ${e.side}</span></div></div>
      <div class="sec"><label>Rack spec</label><div class="spec">Selective pallet rack · teardrop · 42" (1.07 m) frames · 24' (7.3 m) uprights · 108" (2.74 m) step beams · 4 beam levels at 1.75 m · levels A–B pick faces, C–E reserve · 2 GMA 48 × 40 pallets per reserve level · wire decking</div></div>
      <div class="sec tiles"><div class="tile"><label>Pallets</label><b>${pal}<span>/ ${e.slots.length}</span></b></div><div class="tile"><label>Units on hand</label><b>${fmt(units)}</b></div><div class="tile"><label>Utilisation</label><b>${(e.fill * 100).toFixed(0)}<span>%</span></b></div><div class="tile"><label>Last cycle count</label><b style="font-size:12px">${e.lastCount}</b></div></div>
      <div class="sec"><label>Bay activity · moves per hour · 48 h</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="sec"><label>Capacity</label><div class="barrow"><span>Positions</span><b>${pal} / ${e.slots.length}</b></div><div class="bar${e.fill > 0.9 ? ' warn' : ''}"><i style="width:${e.fill * 100}%"></i></div><div class="barrow"><span>Beam load</span><b>${fmt(Math.round(units * 0.9))} / 4,900 kg per level</b></div><div class="bar"><i style="width:${Math.min(100, units * 0.9 / 49)}%"></i></div></div>
      <div class="sec"><label>Positions · levels C–E reserve pallets, A–B pick faces</label><div class="slots">${[4, 3, 2].map(l => `<div class="lvl">LEVEL ${'ABCDE'[l]} · ${(l * 1.75).toFixed(2)} m</div>` + [0, 1].map(p => { const s = e.slots.find(x => x.level === l && x.pos === p)!; return s.lpn ? `<div class="slot"><b>${s.lpn}</b>${s.sku}<br><small>${s.qty} ea · ${s.wrapped ? 'wrapped' : 'unwrapped'}</small></div>` : `<div class="slot empty"><b>EMPTY</b>position ${p + 1}</div>` }).join('')).join('')}${[1, 0].map(l => { const f = e.faces.find(x => x.level === l)!; return `<div class="lvl">LEVEL ${'ABCDE'[l]} · ${l === 0 ? 'FLOOR' : (l * 1.75).toFixed(2) + ' m'} · PICK FACE</div>` + (f.sku ? `<div class="slot wide"><b>${f.id}</b>${f.product} · ${f.sku}<br><small>${f.qty} ea · pick face, fit-out in task 3.7</small></div>` : `<div class="slot empty wide"><b>EMPTY</b>${f.id}</div>`) }).join('')}</div></div>
      <div class="actions"><button data-act="pull">${e.extractTarget ? 'PUSH BACK' : 'PULL PALLETS'}</button><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    this.spark($<HTMLCanvasElement>('spk'), hist)
  }

  private renderBin(e: Bin) {
    this.head('PICK BIN', e.id, e.sku ? 'STOCKED' : 'EMPTY', e.sku ? 'ok' : '')
    const hist = this.history(e.id, e.velocity === 'A' ? 30 : e.velocity === 'B' ? 12 : 4, 6)
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Aisle</label><span>${e.aisle}</span></div><div><label>Bay · level</label><span>${String(e.bay).padStart(3, '0')} · ${'ABCDE'[e.level]}</span></div><div><label>Position</label><span>${String(e.pos + 1).padStart(2, '0')} · SIDE ${e.side}</span></div></div>
      <div class="sec"><label>Location label · Code 128</label><canvas class="barcode" id="bc"></canvas></div>
      <div class="sec"><label>Bin spec</label><div class="spec">Hopper-front shelf bin · 10⅞ × 8¼ × 7 in (276 × 210 × 178 mm) · polypropylene · on 48 × 18 × 84 in rivet shelving · shelf ${'ABCDE'[e.level]} at ${(0.12 + e.level * 0.45).toFixed(2)} m</div></div>
      <div class="sec tiles"><div class="tile"><label>Product</label><b style="font-size:11px">${e.product ?? '—'}</b></div><div class="tile"><label>SKU</label><b style="font-size:11px">${e.sku ?? '—'}</b></div><div class="tile"><label>On hand</label><b>${e.qty}<span>ea</span></b></div><div class="tile"><label>Velocity</label><b>${e.velocity}<span>${e.velocity === 'A' ? 'fast' : e.velocity === 'B' ? 'medium' : 'slow'}</span></b></div><div class="tile"><label>Last stow</label><b style="font-size:11px">${e.lastStow}</b></div><div class="tile"><label>Last pick</label><b style="font-size:11px">${e.lastPick}</b></div></div>
      <div class="sec"><label>Picks per day · 48 d</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>today ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="sec"><label>Fill</label><div class="barrow"><span>Units vs bin capacity</span><b>${e.qty} / 18</b></div><div class="bar${e.qty > 18 ? ' warn' : ''}"><i style="width:${Math.min(100, e.qty / 18 * 100)}%"></i></div></div>
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    const c = $<HTMLCanvasElement>('bc')
    c.width = 640; c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#f7f5f0'; ctx.fillRect(0, 0, 640, 128)
    ctx.fillStyle = '#111'; ctx.font = 'bold 30px "JetBrains Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillText(e.id, 24, 12)
    drawBarcode(ctx, e.id, 16, 52, 608, 64)
    this.spark($<HTMLCanvasElement>('spk'), hist, '#3ee39a')
  }

  private renderDock(e: Dock) {
    this.head('DOCK DOOR', e.id, e.state, e.trailerId ? 'warn' : '')
    const hist = this.history(e.id, e.trailerId ? 320 : 40, 60)
    const busy = !!e.trailerId
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Direction</label><span>${e.wall === 'N' ? 'INBOUND' : 'OUTBOUND'} · ${e.use.toUpperCase()}</span></div><div><label>Carrier</label><span>${e.carrier}</span></div><div><label>Trailer</label><span>${e.trailerId ?? 'NO TRAILER'}</span></div></div>
      <div class="sec"><label>Dock spec</label><div class="spec">9 × 10 ft sectional door · 48" dock height · 6 × 8 ft pit leveler · laminated bumpers · foam dock seal · automatic vehicle restraint · 53 ft dry van at door</div></div>
      <div class="sec tiles"><div class="tile"><label>${e.state === 'LOADING' ? 'Load' : 'Unload'} progress</label><b>${(e.progress * 100).toFixed(0)}<span>%</span></b></div><div class="tile"><label>Units on trailer</label><b>${fmt(e.units)}</b></div><div class="tile"><label>Time at door</label><b>${e.minutesAtDoor}<span>min</span></b></div><div class="tile"><label>Door</label><b>${e.doorTarget ? 'OPEN' : 'CLOSED'}</b></div></div>
      <div class="sec"><label>Units per hour through door · 48 h</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      ${busy ? `<div class="sec"><label>${e.state === 'LOADING' ? 'Load' : 'Unload'}</label><div class="barrow"><span>Pallets ${e.state === 'LOADING' ? 'on' : 'off'}</span><b>${Math.round(e.progress * 26)} / 26</b></div><div class="bar"><i style="width:${e.progress * 100}%"></i></div><div class="barrow"><span>Detention</span><b class="${e.minutesAtDoor > 60 ? 'warn' : ''}">${e.minutesAtDoor} / 120 min free</b></div><div class="bar${e.minutesAtDoor > 60 ? ' warn' : ''}"><i style="width:${Math.min(100, e.minutesAtDoor / 120 * 100)}%"></i></div></div>` : ''}
      <div class="actions"><button data-act="door">${e.doorTarget ? 'CLOSE DOOR' : 'OPEN DOOR'}</button><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    this.spark($<HTMLCanvasElement>('spk'), hist, '#ffa62b')
  }

  private renderZone(e: Zone) {
    this.head(`ZONE · ${e.group.toUpperCase()}`, e.id, e.level ? 'LEVEL 1' : 'FLOOR', 'ok')
    const a = e.area
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Area</label><span>${e.name}</span></div><div><label>Size</label><span>${a.w.toFixed(1)} × ${a.d.toFixed(1)} m · ${fmt(Math.round(a.w * a.d))} m²</span></div><div><label>Origin</label><span>x ${a.x.toFixed(1)} · z ${a.z.toFixed(1)}</span></div></div>
      ${e.note ? `<div class="sec"><label>What stands here</label><div class="spec">${e.note}</div></div>` : ''}
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
  }

  private renderFace(e: PickFace) {
    this.head('PICK FACE', e.id, e.sku ? 'STOCKED' : 'EMPTY', e.sku ? 'ok' : '')
    const hist = this.history(e.id, e.velocity === 'A' ? 60 : e.velocity === 'B' ? 24 : 8, 10)
    const bay = this.f.byId.get(e.bayId) as Bay
    const reserve = bay.slots.filter(s => s.lpn).length
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Aisle</label><span>${e.aisle}</span></div><div><label>Bay · level</label><span>${e.bayId.split('-')[2]} · ${'ABCDE'[e.level]}</span></div><div><label>Fit-out</label><span>${e.fit.toUpperCase()}</span></div></div>
      <div class="sec"><label>Location label · Code 128</label><canvas class="barcode" id="bc"></canvas></div>
      <div class="sec"><label>Pick face spec</label><div class="spec">${FIT_SPEC[e.fit]} · level ${'ABCDE'[e.level]} at ${e.level === 0 ? '0.00' : '1.75'} m · reserve pallets on levels C–E above</div></div>
      <div class="sec tiles"><div class="tile"><label>Product</label><b style="font-size:11px">${e.product ?? '—'}</b></div><div class="tile"><label>SKU</label><b style="font-size:11px">${e.sku ?? '—'}</b></div><div class="tile"><label>On hand</label><b>${e.qty}<span>/ ${e.capacity} ea</span></b></div><div class="tile"><label>Velocity</label><b>${e.velocity}<span>${e.velocity === 'A' ? 'fast' : e.velocity === 'B' ? 'medium' : 'slow'}</span></b></div><div class="tile"><label>Last pick</label><b style="font-size:11px">${e.lastPick}</b></div><div class="tile"><label>Last replen</label><b style="font-size:11px">${e.lastReplen}</b></div></div>
      <div class="sec"><label>Picks per hour · 48 h</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="sec"><label>Fill</label><div class="barrow"><span>Units vs face capacity</span><b>${e.qty} / ${e.capacity}</b></div><div class="bar${e.qty / e.capacity < 0.2 ? ' warn' : ''}"><i style="width:${Math.min(100, e.qty / e.capacity * 100)}%"></i></div><div class="barrow"><span>Reserve above · ${e.bayId}</span><b>${reserve} pallets</b></div></div>
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    const c = $<HTMLCanvasElement>('bc')
    c.width = 640; c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#f7f5f0'; ctx.fillRect(0, 0, 640, 128)
    ctx.fillStyle = '#111'; ctx.font = 'bold 30px "JetBrains Mono", monospace'; ctx.textBaseline = 'top'; ctx.fillText(e.id, 24, 12)
    drawBarcode(ctx, e.id, 16, 52, 608, 64)
    this.spark($<HTMLCanvasElement>('spk'), hist, '#3ee39a')
  }

  private renderStation(e: Station) {
    this.head(`PACK STATION · ${e.type === 'single' ? 'SINGLES' : 'MULTIS'}`, e.id, e.state, e.state === 'PACKING' ? 'ok' : e.state === 'IDLE' ? 'warn' : '')
    const hist = this.history(e.id, e.rate || 20, 25)
    const target = e.type === 'single' ? 110 : 60
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Zone</label><span>${e.zone}</span></div><div><label>Associate</label><span>${e.associate ?? 'UNSTAFFED'}</span></div><div><label>Row</label><span>${e.face[2] > 0 ? 'NORTH' : 'SOUTH'} of box line</span></div></div>
      <div class="sec"><label>Station spec</label><div class="spec">72 × 36 in steel-frame pack bench, laminate top at 36 in · two-tier carton riser · monitor and keyboard · bench scale · thermal label printer · tape gun · paper dunnage dispenser · tote stand · packed boxes onto the ${e.zone === 'PACK-S' ? 'singles' : 'multis'} roller line to SLAM</div></div>
      <div class="sec tiles"><div class="tile"><label>Rate</label><b>${e.rate}<span>UPH</span></b></div><div class="tile"><label>Target</label><b>${target}<span>UPH</span></b></div><div class="tile"><label>Queue</label><b>${e.queue}<span>totes</span></b></div><div class="tile"><label>Packed today</label><b>${fmt(e.packedToday)}</b></div></div>
      <div class="sec"><label>Units per hour · shift</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="sec"><label>Rate vs target</label><div class="barrow"><span>${e.rate} of ${target} UPH</span><b>${Math.round(e.rate / target * 100)}%</b></div><div class="bar${e.rate < target * 0.8 ? ' warn' : ''}"><i style="width:${Math.min(100, e.rate / target * 100)}%"></i></div></div>
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    this.spark($<HTMLCanvasElement>('spk'), hist, '#3ee39a')
  }

  private renderWall(e: PutWall) {
    this.head('PUT WALL · REBIN', e.id, `${Math.round(e.filled / e.slots * 100)}% IN USE`, e.filled / e.slots > 0.85 ? 'warn' : 'ok')
    const hist = this.history(e.id, 30, 12)
    const grid = e.lit.map((on, i) => `<i class="cub${on ? ' on' : ''}" title="slot ${String(i + 1).padStart(2, '0')}"></i>`).join('')
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Zone</label><span>REBIN</span></div><div><label>Wall</label><span>${String(e.number).padStart(2, '0')} of 08</span></div><div><label>Induct side</label><span>${e.face[2] > 0 ? 'SOUTH' : 'NORTH'}</span></div></div>
      <div class="sec"><label>Wall spec</label><div class="spec">Put wall 3.0 × 2.2 m, 8 × 6 cubbies at 375 × 365 mm · put-to-light indicator per cubby · induct from the takeaway spur, pack multis pull completed orders from the far side</div></div>
      <div class="sec tiles"><div class="tile"><label>Orders open</label><b>${e.ordersOpen}</b></div><div class="tile"><label>Completed today</label><b>${e.ordersComplete}</b></div><div class="tile"><label>Slots in use</label><b>${e.filled}<span>/ ${e.slots}</span></b></div><div class="tile"><label>Avg items / order</label><b>3.4</b></div></div>
      <div class="sec"><label>Cubbies · lit = order in progress</label><div class="cubbies">${grid}</div></div>
      <div class="sec"><label>Orders completed per hour · shift</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    this.spark($<HTMLCanvasElement>('spk'), hist, '#3ee39a')
  }

  private renderSlam(e: Slam) {
    this.head('SLAM STATION', e.id, e.state, e.state === 'RUNNING' ? 'ok' : 'warn')
    const hist = this.history(e.id, e.rate / 60, 8)
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Line</label><span>SLAM LINE · z 41</span></div><div><label>Feeds from</label><span>${e.number === 1 ? 'PACK SINGLES' : 'PACK MULTIS'} box line</span></div><div><label>Delivers to</label><span>MANUAL CARRIER SORT</span></div></div>
      <div class="sec"><label>Station spec</label><div class="spec">In-line checkweigh scale · 5-sided camera scan tunnel · print-and-apply labeler with tamp arm, 4 × 6 in thermal labels · verify scanner and beacon · pneumatic divert to a gravity reject lane</div></div>
      <div class="sec tiles"><div class="tile"><label>Rate</label><b>${fmt(e.rate)}<span>boxes/h</span></b></div><div class="tile"><label>Labelled today</label><b>${fmt(e.labelled)}</b></div><div class="tile"><label>Rejects today</label><b>${e.rejects}</b></div><div class="tile"><label>Reject rate</label><b>${(e.rejects / e.labelled * 100).toFixed(2)}<span>%</span></b></div></div>
      <div class="sec"><label>Boxes per minute · 8 h</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    this.spark($<HTMLCanvasElement>('spk'), hist, '#ffa62b')
  }

  private renderLane(e: Lane) {
    const sort = e.role === 'sort'
    this.head(sort ? 'CARRIER SORT POSITION' : 'OUTBOUND STAGING LANE', e.id, e.state, e.state === 'OPEN' ? 'ok' : e.state === 'CLOSING' ? 'warn' : '')
    const hist = this.history(e.id, sort ? 40 : 120, 20)
    const dock = this.f.byId.get(e.door) as Dock
    $('ins-body').innerHTML = `
      <div class="sec meta"><div><label>Carrier</label><span>${e.carrier}</span></div><div><label>Door</label><span>${e.door} · ${dock.trailerId ? 'TRAILER AT DOOR' : 'NO TRAILER'}</span></div><div><label>Cut-off</label><span>${e.cutoff}</span></div></div>
      <div class="sec"><label>${sort ? 'Position' : 'Lane'} spec</label><div class="spec">${sort ? 'Manual scan-to-sort off the SLAM outfeed: sorter scans the label, the screen shows the lane, box goes into the 48 × 40 × 36 in gaylord on a pallet · lane sign overhead' : '12 ft lane striped on the floor from the sort area to the dock floor · gaylords and stretch-wrapped pallets staged in cut-off order · sign at the lane head · stretch wrapper at the west end'}</div></div>
      <div class="sec tiles"><div class="tile"><label>Boxes ${sort ? 'sorted' : 'staged'}</label><b>${fmt(e.units)}</b></div>${sort ? `<div class="tile"><label>Gaylord fill</label><b>${Math.round(e.fill * 100)}<span>%</span></b></div>` : `<div class="tile"><label>Gaylords · pallets</label><b>${e.gaylords}<span>· ${e.pallets}</span></b></div>`}<div class="tile"><label>Trailer fill</label><b>${dock.trailerId ? Math.round(dock.progress * 100) : 0}<span>%</span></b></div><div class="tile"><label>Time to cut-off</label><b>${e.state === 'CLOSED' ? '—' : `${Math.max(0, Number(e.cutoff.slice(0, 2)) * 60 + Number(e.cutoff.slice(3)) - 15 * 60)}<span>min · from 15:00</span>`}</b></div></div>
      <div class="sec"><label>Boxes per hour · shift</label><canvas class="spark" id="spk"></canvas><div class="spark-foot"><span>min ${Math.min(...hist).toFixed(0)}</span><span>now ${hist[hist.length - 1].toFixed(0)}</span><span>max ${Math.max(...hist).toFixed(0)}</span></div></div>
      <div class="sec"><label>${sort ? 'Gaylord' : 'Lane'} fill</label><div class="barrow"><span>${sort ? 'Current gaylord' : 'Lane floor in use'}</span><b>${Math.round(e.fill * 100)}%</b></div><div class="bar${e.fill > 0.85 ? ' warn' : ''}"><i style="width:${e.fill * 100}%"></i></div></div>
      <div class="actions"><button class="ghost" data-act="fly">FLY TO</button><button class="ghost" data-act="walk">WALK TO</button></div>`
    this.spark($<HTMLCanvasElement>('spk'), hist, '#ffa62b')
  }
}
