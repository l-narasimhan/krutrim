import type { Entity, Facility } from './facility'

/** One stop on the guided tour: the entity to frame and select, and what to say about it. */
export interface Stop { id: string; title: string; say: string }

/**
 * The route a unit takes through the building, then the side flows and every support area, so the tour
 * visits each corner of the program. Stops name entities from the facility so the inspector fills in as you go.
 */
export const STOPS: Stop[] = [
  { id: 'IB-*', title: 'Inbound docks', say: 'Trailers back onto 26 inbound doors on the north wall. Restraint on, door up, forklifts and pallet jacks unload onto the dock floor.' },
  { id: 'IB-STG', title: 'Inbound dock staging', say: 'Floor lanes behind the doors where unloaded pallets wait to be received.' },
  { id: 'RCV', title: 'Receive and decant', say: '16 receive stations check the ASN, scan cases, and break cartons down into totes.' },
  { id: 'QC', title: 'QA/QC inspection', say: 'Sampled inbound product is inspected here. Pass goes on to putaway staging, fail goes to the hold cage next door.' },
  { id: 'QC-HOLD', title: 'QC reject, damage and hold cage', say: 'Fenced quarantine for failed inspections, damaged receipts and vendor returns, tagged red until dispositioned.' },
  { id: 'NC', title: 'Non-conveyable receive', say: 'Oversize and heavy items come in through IB-25 and IB-26 and go straight to floor positions and NC racking.' },
  { id: 'PA-STG', title: 'Putaway staging', say: 'Received pallets and totes staged by destination: reach trucks take pallets to reserve racking, the buffer conveyor feeds the fast-mover module.' },
  { id: 'RA-02-001-A', title: 'Stow and pick in the racks', say: 'Hybrid racking: levels A and B are pick faces, levels C to E hold reserve pallets. Replenishment drops a pallet down when a face runs low.' },
  { id: 'RA-14-024', title: 'Reserve racking A', say: '25 double rows of selective pallet rack, 24 bays long, with a cross aisle mid-block. Forklift aisles are 3.5 m.' },
  { id: 'RES-B', title: 'Reserve racking B', say: 'The second reserve block east of the centre aisle, 9 rows by 15 bays.' },
  { id: 'REPL', title: 'Replenishment staging', say: 'Reserve-to-pick pallets staged by aisle before they are dropped into pick faces.' },
  { id: 'FM-05-018-C05', title: 'Fast-mover module FM-1', say: 'Rivet shelving on 1.4 m cart aisles with 10,400 barcoded bins for the fastest-moving small items.' },
  { id: 'TAKE', title: 'Takeaway conveyor', say: 'Picked totes leave every aisle onto the takeaway belt along the south edge of storage, bound for rebin and pack.' },
  { id: 'REBIN', title: 'Rebin and sort walls', say: 'Multi-item orders are consolidated into put-wall slots with lit indicators before packing.' },
  { id: 'PACK-S', title: 'Pack singles', say: '24 stations packing single-item orders straight from the tote.' },
  { id: 'PACK-M', title: 'Pack multis', say: '24 stations packing consolidated multi-item orders from the sort walls.' },
  { id: 'GIFT', title: 'Gift wrap and special handling', say: 'Gift wrap, fragile and oversize special handling.' },
  { id: 'TOTE-R', title: 'Empty tote return', say: 'Empty totes and carts return here for the next wave.' },
  { id: 'SLAM', title: 'SLAM line', say: 'Scan, label, apply, manifest: every packed box is weighed, gets its carrier label, and is manifested here.' },
  { id: 'SORT', title: 'Manual carrier sort', say: 'Boxes are hand-sorted by scanning into gaylords and pallets, one lane per carrier.' },
  { id: 'OB-STG', title: 'Outbound staging lanes', say: '30 staging lanes, one per outbound door, with a stretch wrapper for pallet loads.' },
  { id: 'OB-*', title: 'Outbound docks', say: '30 outbound doors on the south wall: UPS on 1 to 10, FedEx 11 to 18, USPS 19 to 24, regional and LTL 25 to 30. Fluid loading into open trailers.' },
  { id: 'RT-*', title: 'Returns docks', say: 'Four returns doors on the north wall, east of inbound.' },
  { id: 'RT-RCV', title: 'Returns receive', say: 'Customer returns are unloaded and scanned into totes here.' },
  { id: 'GRADE', title: 'Grading benches', say: '12 benches grade each return: restock, refurbish, liquidate or dispose.' },
  { id: 'REFURB', title: 'Refurbish bench', say: 'Light rework and repackaging for items that can go back to stock.' },
  { id: 'LIQ', title: 'Liquidation staging', say: 'Pallets of liquidation stock waiting to ship out through outbound.' },
  { id: 'DISP', title: 'Disposal and recycling', say: 'What cannot be sold or returned to the vendor is broken down for recycling here.' },
  { id: 'ICQA', title: 'ICQA', say: 'Inventory control and quality assurance: cycle counts and inventory adjustments.' },
  { id: 'PS', title: 'Problem solve', say: 'Where exceptions from any process land: mismatched scans, missing items, damaged labels.' },
  { id: 'DMG', title: 'Damageland cage', say: 'Hold shelving for product damaged in process, tracked by count and age.' },
  { id: 'BALER', title: 'Cardboard baler and recycling', say: 'Baler at WC-02 and the waste compactor at WC-01 in the north-east corner.' },
  { id: 'BATT', title: 'Battery charging room', say: 'Forklift and reach-truck batteries charge here, with eyewash and ventilation.' },
  { id: 'RME', title: 'Maintenance shop and RME', say: 'Reliability and maintenance engineering: parts, benches and the conveyor spares.' },
  { id: 'HAZ', title: 'Hazmat cage', say: 'Fenced, ventilated storage for flammables and hazardous goods, between inbound and returns.' },
  { id: 'HV', title: 'High-value cage', say: 'Badge-access cage with its own shelving for high-value items.' },
  { id: 'PKG', title: 'Packaging supplies', say: 'Boxes, mailers, dunnage and tape racked next to the pack stations.' },
  { id: 'PAL', title: 'Empty pallet and gaylord storage', say: 'Empties for outbound staging and returns.' },
  { id: 'DO-S', title: 'Outbound dock office', say: 'Shipping office and driver waiting room by the outbound doors.' },
  { id: 'ELEC', title: 'Electrical and fire pump rooms', say: 'Switchgear and the sprinkler fire pump in the south-east corner.' },
  { id: 'TRAIN', title: 'Training rooms', say: 'New-hire and safety training on the ground floor of the west end.' },
  { id: 'CAFE', title: 'Cafeteria', say: 'Cafeteria and break rooms for a 60-person shift, with the offices mezzanine above.' },
  { id: 'SEC', title: 'Security entrance', say: 'Turnstiles, guard desk and badge readers where associates come in from the car park at the south-west corner.' },
  { id: 'MEZZ', title: 'Offices mezzanine', say: 'Level 1 over the cafeteria and training rooms: offices, HR and conference rooms.' },
]

export class Tour {
  active = false
  index = 0
  private timer = 0
  private el = document.getElementById('tour')!
  private onStop: (e: Entity) => void

  constructor(private f: Facility, private dwell: number, onStop: (e: Entity) => void, private onEnd: () => void) {
    this.onStop = onStop
    this.el.querySelector<HTMLButtonElement>('[data-tour="prev"]')!.onclick = () => this.go(this.index - 1)
    this.el.querySelector<HTMLButtonElement>('[data-tour="next"]')!.onclick = () => this.go(this.index + 1)
    this.el.querySelector<HTMLButtonElement>('[data-tour="end"]')!.onclick = () => this.end()
  }

  start() { this.active = true; this.el.hidden = false; this.go(0) }

  end() { this.active = false; this.el.hidden = true; this.onEnd() }

  go(i: number) {
    if (i < 0 || i >= STOPS.length) { this.end(); return }
    this.index = i
    this.timer = this.dwell
    const s = STOPS[i]
    // A door stop such as 'IB-*' picks a door of that kind with a trailer at it, so the caption matches the view.
    const e = s.id.endsWith('*') ? this.f.docks.find(d => d.prefix === s.id.slice(0, -2) && d.trailerId) ?? this.f.docks.find(d => d.prefix === s.id.slice(0, -2)) : this.f.byId.get(s.id)
    this.el.querySelector('.tour-n')!.textContent = `${i + 1} / ${STOPS.length}`
    this.el.querySelector('.tour-title')!.textContent = s.title
    this.el.querySelector('.tour-say')!.textContent = s.say
    if (e) this.onStop(e)
  }

  update(dt: number) {
    if (!this.active) return
    this.timer -= dt
    if (this.timer <= 0) this.go(this.index + 1)
  }
}
