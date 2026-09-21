// The product catalogue: what an FC actually holds, and what shape each thing is.
//
// Realism rule (PLAN.md): every item here is a real product category in its real shipping case, at its real
// case-pack dimensions in metres. `w` x `h` x `d` is the CASE as it sits on the pallet — `h` is always the
// vertical dimension. For the cylindrical forms (tub, roll, drum, tray) `w` and `d` are the diameter.
//
// No grocery: no food, beverage or consumable categories. Pet supplies are their own category.

export type Form = 'rsc' | 'shoebox' | 'polybag' | 'paperbag' | 'tub'
  | 'roll' | 'tray' | 'flat' | 'mailer' | 'drum'

/** How the load is built, and why — from Fibre Box Association strength testing against single-box
 *  compression: columnar (corners aligned) retains 0.84 but is least stable; interlocked retains 0.49
 *  but is the most stable; pinwheel sits ~20% below column; hybrid (column low, interlock high) is
 *  recommended practice. So: heavy and non-crushable column-stack, light and crushable interlock. */
export type Pattern = 'column' | 'interlock' | 'pinwheel' | 'hybrid'

/** Corrugated board grade, by flute. B = 3 mm, C = 4 mm (most common), E = 1.5 mm, BC double wall = 7 mm. */
export type Board = 'kraft' | 'bleached' | 'printed'

export interface Product {
  name: string
  category: string
  form: Form
  /** Case pack, metres. `h` is vertical. Cylindrical forms: w and d are the diameter. */
  w: number
  h: number
  d: number
  /** Units per case. */
  units: number
  /** Gross case weight, kg — used to pick a stack height the rack can actually hold. */
  kg: number
  pattern: Pattern
  board: Board
}

// ---- The catalogue -------------------------------------------------------------------------------------------
// Grouped by category for reading; order is irrelevant to anything but the SKU hash.

export const CATALOG: Product[] = [
  // ---- Household ---------------------------------------------------------------------------------------------
  { name: 'Paper Towels 12 Rolls', category: 'Household', form: 'rsc', w: 0.60, h: 0.30, d: 0.45, units: 12, kg: 3.2, pattern: 'interlock', board: 'kraft' },
  { name: 'Bath Tissue 24 Rolls', category: 'Household', form: 'rsc', w: 0.62, h: 0.36, d: 0.42, units: 24, kg: 4.1, pattern: 'interlock', board: 'kraft' },
  { name: 'Laundry Pods 81 ct', category: 'Household', form: 'tub', w: 0.30, h: 0.28, d: 0.30, units: 1, kg: 2.4, pattern: 'column', board: 'printed' },
  { name: 'Dish Soap 6 pk', category: 'Household', form: 'rsc', w: 0.36, h: 0.26, d: 0.25, units: 6, kg: 4.6, pattern: 'column', board: 'printed' },
  { name: 'Trash Bags 200 ct', category: 'Household', form: 'rsc', w: 0.30, h: 0.15, d: 0.22, units: 1, kg: 1.9, pattern: 'interlock', board: 'bleached' },
  { name: 'Storage Tote 6 pk', category: 'Household', form: 'rsc', w: 0.62, h: 0.38, d: 0.42, units: 6, kg: 5.2, pattern: 'column', board: 'kraft' },
  { name: 'Microfiber Cloths 24 pk', category: 'Household', form: 'polybag', w: 0.32, h: 0.22, d: 0.18, units: 24, kg: 0.9, pattern: 'interlock', board: 'kraft' },
  { name: 'LED Bulbs 8 pk', category: 'Household', form: 'rsc', w: 0.26, h: 0.13, d: 0.19, units: 8, kg: 0.7, pattern: 'interlock', board: 'printed' },
  { name: 'Extension Cord 25 ft', category: 'Household', form: 'flat', w: 0.32, h: 0.09, d: 0.24, units: 1, kg: 1.3, pattern: 'column', board: 'printed' },
  { name: 'Glass Cleaner 6 pk', category: 'Household', form: 'rsc', w: 0.36, h: 0.28, d: 0.25, units: 6, kg: 5.0, pattern: 'column', board: 'printed' },
  { name: 'Broom & Dustpan Set', category: 'Household', form: 'rsc', w: 1.10, h: 0.12, d: 0.30, units: 1, kg: 1.6, pattern: 'column', board: 'kraft' },
  { name: 'Air Freshener 12 pk', category: 'Household', form: 'rsc', w: 0.40, h: 0.22, d: 0.30, units: 12, kg: 3.4, pattern: 'column', board: 'printed' },

  // ---- Drinkware ---------------------------------------------------------------------------------------------
  // Reusable drinkware, not beverages: insulated bottles, tumblers and flasks are hard goods that ship as
  // eaches in a retail carton, which is why they are a real e-commerce category and bottled water is not.
  { name: 'Insulated Bottle 32 oz', category: 'Drinkware', form: 'rsc', w: 0.30, h: 0.30, d: 0.21, units: 6, kg: 2.9, pattern: 'column', board: 'printed' },
  { name: 'Insulated Bottle 24 oz', category: 'Drinkware', form: 'rsc', w: 0.26, h: 0.27, d: 0.18, units: 6, kg: 2.3, pattern: 'column', board: 'printed' },
  { name: 'Tumbler 20 oz', category: 'Drinkware', form: 'rsc', w: 0.38, h: 0.20, d: 0.28, units: 12, kg: 3.4, pattern: 'column', board: 'printed' },
  { name: 'Travel Mug 16 oz', category: 'Drinkware', form: 'rsc', w: 0.32, h: 0.21, d: 0.24, units: 8, kg: 2.6, pattern: 'column', board: 'printed' },
  { name: 'Vacuum Flask 40 oz', category: 'Drinkware', form: 'rsc', w: 0.26, h: 0.34, d: 0.26, units: 4, kg: 2.8, pattern: 'column', board: 'printed' },
  { name: 'Kids Bottle 16 oz 4 pk', category: 'Drinkware', form: 'rsc', w: 0.28, h: 0.24, d: 0.20, units: 4, kg: 1.4, pattern: 'interlock', board: 'printed' },
  { name: 'Glass Water Bottle 6 pk', category: 'Drinkware', form: 'rsc', w: 0.30, h: 0.28, d: 0.22, units: 6, kg: 4.2, pattern: 'column', board: 'kraft' },
  { name: 'Bottle Brush Set', category: 'Drinkware', form: 'polybag', w: 0.30, h: 0.08, d: 0.14, units: 3, kg: 0.4, pattern: 'interlock', board: 'kraft' },

  // ---- Electronics -------------------------------------------------------------------------------------------
  { name: 'Cordless Drill 20V', category: 'Electronics', form: 'rsc', w: 0.38, h: 0.12, d: 0.28, units: 1, kg: 2.1, pattern: 'column', board: 'printed' },
  { name: 'Bluetooth Speaker', category: 'Electronics', form: 'rsc', w: 0.30, h: 0.18, d: 0.22, units: 1, kg: 1.4, pattern: 'interlock', board: 'printed' },
  { name: 'Monitor 27 in', category: 'Electronics', form: 'flat', w: 0.70, h: 0.15, d: 0.45, units: 1, kg: 5.4, pattern: 'interlock', board: 'printed' },
  { name: 'Mechanical Keyboard', category: 'Electronics', form: 'flat', w: 0.48, h: 0.08, d: 0.20, units: 1, kg: 1.3, pattern: 'interlock', board: 'printed' },
  { name: 'HDMI Cable 6 ft', category: 'Electronics', form: 'polybag', w: 0.22, h: 0.05, d: 0.16, units: 1, kg: 0.2, pattern: 'interlock', board: 'kraft' },
  { name: 'Wireless Mouse', category: 'Electronics', form: 'rsc', w: 0.14, h: 0.08, d: 0.10, units: 1, kg: 0.2, pattern: 'interlock', board: 'printed' },
  { name: 'Webcam 1080p', category: 'Electronics', form: 'rsc', w: 0.12, h: 0.09, d: 0.10, units: 1, kg: 0.3, pattern: 'interlock', board: 'printed' },
  { name: 'USB-C Hub 7-Port', category: 'Electronics', form: 'rsc', w: 0.16, h: 0.05, d: 0.12, units: 1, kg: 0.3, pattern: 'interlock', board: 'printed' },
  { name: 'Smart Plug 4 pk', category: 'Electronics', form: 'rsc', w: 0.18, h: 0.10, d: 0.14, units: 4, kg: 0.5, pattern: 'interlock', board: 'printed' },
  { name: 'Headphones Over-Ear', category: 'Electronics', form: 'rsc', w: 0.24, h: 0.12, d: 0.22, units: 1, kg: 0.5, pattern: 'interlock', board: 'printed' },
  { name: 'Tablet 10 in', category: 'Electronics', form: 'flat', w: 0.28, h: 0.05, d: 0.22, units: 1, kg: 0.8, pattern: 'interlock', board: 'printed' },
  { name: 'Desk Lamp LED', category: 'Electronics', form: 'rsc', w: 0.45, h: 0.18, d: 0.25, units: 1, kg: 1.7, pattern: 'column', board: 'printed' },
  { name: 'Power Bank 20000 mAh', category: 'Electronics', form: 'rsc', w: 0.16, h: 0.06, d: 0.12, units: 1, kg: 0.5, pattern: 'interlock', board: 'printed' },
  { name: 'WiFi Router 6', category: 'Electronics', form: 'rsc', w: 0.32, h: 0.12, d: 0.26, units: 1, kg: 1.1, pattern: 'interlock', board: 'printed' },

  // ---- Apparel -----------------------------------------------------------------------------------------------
  { name: 'Running Shoes M10', category: 'Apparel', form: 'shoebox', w: 0.35, h: 0.13, d: 0.23, units: 1, kg: 0.9, pattern: 'interlock', board: 'printed' },
  { name: 'Yoga Mat 6 mm', category: 'Apparel', form: 'roll', w: 0.15, h: 0.68, d: 0.15, units: 1, kg: 1.4, pattern: 'column', board: 'kraft' },
  { name: 'Weighted Blanket 15 lb', category: 'Apparel', form: 'polybag', w: 0.50, h: 0.18, d: 0.40, units: 1, kg: 7.2, pattern: 'interlock', board: 'kraft' },
  { name: 'Hoodie L', category: 'Apparel', form: 'polybag', w: 0.38, h: 0.08, d: 0.30, units: 1, kg: 0.7, pattern: 'interlock', board: 'kraft' },
  { name: 'Jeans 32x32', category: 'Apparel', form: 'polybag', w: 0.36, h: 0.06, d: 0.28, units: 1, kg: 0.7, pattern: 'interlock', board: 'kraft' },
  { name: 'T-Shirt 3 pk', category: 'Apparel', form: 'polybag', w: 0.30, h: 0.05, d: 0.24, units: 3, kg: 0.5, pattern: 'interlock', board: 'kraft' },
  { name: 'Socks 12 pk', category: 'Apparel', form: 'polybag', w: 0.26, h: 0.08, d: 0.18, units: 12, kg: 0.5, pattern: 'interlock', board: 'kraft' },
  { name: 'Winter Coat XL', category: 'Apparel', form: 'polybag', w: 0.45, h: 0.14, d: 0.38, units: 1, kg: 1.8, pattern: 'interlock', board: 'kraft' },
  { name: 'Backpack 28 L', category: 'Apparel', form: 'polybag', w: 0.50, h: 0.12, d: 0.36, units: 1, kg: 1.1, pattern: 'interlock', board: 'kraft' },
  { name: 'Rain Jacket M', category: 'Apparel', form: 'polybag', w: 0.38, h: 0.08, d: 0.30, units: 1, kg: 0.8, pattern: 'interlock', board: 'kraft' },
  { name: 'Baseball Cap', category: 'Apparel', form: 'mailer', w: 0.24, h: 0.04, d: 0.20, units: 1, kg: 0.2, pattern: 'interlock', board: 'kraft' },
  { name: 'Leather Belt 36', category: 'Apparel', form: 'mailer', w: 0.20, h: 0.05, d: 0.16, units: 1, kg: 0.3, pattern: 'interlock', board: 'kraft' },

  // ---- Health & Beauty ---------------------------------------------------------------------------------------
  { name: 'Baby Wipes 720 ct', category: 'Health & Beauty', form: 'rsc', w: 0.40, h: 0.28, d: 0.30, units: 1, kg: 4.2, pattern: 'column', board: 'printed' },
  { name: 'Vitamin D3 400 ct', category: 'Health & Beauty', form: 'rsc', w: 0.15, h: 0.10, d: 0.10, units: 1, kg: 0.4, pattern: 'interlock', board: 'printed' },
  { name: 'Shampoo 6 pk', category: 'Health & Beauty', form: 'rsc', w: 0.32, h: 0.24, d: 0.24, units: 6, kg: 3.6, pattern: 'column', board: 'printed' },
  { name: 'Toothpaste 6 pk', category: 'Health & Beauty', form: 'rsc', w: 0.24, h: 0.14, d: 0.18, units: 6, kg: 1.2, pattern: 'interlock', board: 'printed' },
  { name: 'Razor Blades 12 pk', category: 'Health & Beauty', form: 'rsc', w: 0.16, h: 0.08, d: 0.12, units: 12, kg: 0.3, pattern: 'interlock', board: 'printed' },
  { name: 'Electric Toothbrush', category: 'Health & Beauty', form: 'rsc', w: 0.24, h: 0.10, d: 0.14, units: 1, kg: 0.5, pattern: 'interlock', board: 'printed' },
  { name: 'Hair Dryer 1875 W', category: 'Health & Beauty', form: 'rsc', w: 0.28, h: 0.12, d: 0.22, units: 1, kg: 1.0, pattern: 'interlock', board: 'printed' },
  { name: 'Sunscreen 6 pk', category: 'Health & Beauty', form: 'rsc', w: 0.26, h: 0.16, d: 0.20, units: 6, kg: 1.8, pattern: 'interlock', board: 'printed' },
  { name: 'First Aid Kit 299 pc', category: 'Health & Beauty', form: 'rsc', w: 0.30, h: 0.14, d: 0.24, units: 1, kg: 1.4, pattern: 'interlock', board: 'printed' },
  { name: 'Hand Soap 8 pk', category: 'Health & Beauty', form: 'rsc', w: 0.32, h: 0.22, d: 0.24, units: 8, kg: 4.0, pattern: 'column', board: 'printed' },
  { name: 'Face Masks 100 ct', category: 'Health & Beauty', form: 'rsc', w: 0.26, h: 0.14, d: 0.20, units: 1, kg: 0.6, pattern: 'interlock', board: 'bleached' },

  // ---- Baby --------------------------------------------------------------------------------------------------
  { name: 'Diapers Size 4 152 ct', category: 'Baby', form: 'rsc', w: 0.55, h: 0.35, d: 0.40, units: 1, kg: 6.8, pattern: 'column', board: 'printed' },
  { name: 'Baby Monitor', category: 'Baby', form: 'rsc', w: 0.24, h: 0.14, d: 0.18, units: 1, kg: 0.8, pattern: 'interlock', board: 'printed' },
  { name: 'Stroller', category: 'Baby', form: 'rsc', w: 0.95, h: 0.28, d: 0.55, units: 1, kg: 11.0, pattern: 'column', board: 'kraft' },
  { name: 'Baby Carrier', category: 'Baby', form: 'rsc', w: 0.34, h: 0.14, d: 0.26, units: 1, kg: 1.2, pattern: 'interlock', board: 'printed' },
  { name: 'Crib Sheets 3 pk', category: 'Baby', form: 'polybag', w: 0.32, h: 0.10, d: 0.26, units: 3, kg: 0.9, pattern: 'interlock', board: 'kraft' },
  { name: 'Baby Bottles 6 pk', category: 'Baby', form: 'rsc', w: 0.28, h: 0.18, d: 0.20, units: 6, kg: 1.1, pattern: 'interlock', board: 'printed' },
  { name: 'Diaper Bag', category: 'Baby', form: 'polybag', w: 0.44, h: 0.16, d: 0.32, units: 1, kg: 1.3, pattern: 'interlock', board: 'kraft' },

  // ---- Pet (supplies, not food) ------------------------------------------------------------------------------
  { name: 'Cat Litter 40 lb', category: 'Pet', form: 'paperbag', w: 0.60, h: 0.15, d: 0.40, units: 1, kg: 18.5, pattern: 'column', board: 'kraft' },
  { name: 'Dog Crate 36 in', category: 'Pet', form: 'flat', w: 0.95, h: 0.15, d: 0.65, units: 1, kg: 12.0, pattern: 'column', board: 'kraft' },
  { name: 'Pet Bed Large', category: 'Pet', form: 'polybag', w: 0.70, h: 0.20, d: 0.55, units: 1, kg: 3.2, pattern: 'interlock', board: 'kraft' },
  { name: 'Collar & Leash Set', category: 'Pet', form: 'mailer', w: 0.24, h: 0.06, d: 0.18, units: 1, kg: 0.4, pattern: 'interlock', board: 'kraft' },
  { name: 'Cat Tree 52 in', category: 'Pet', form: 'rsc', w: 1.10, h: 0.25, d: 0.45, units: 1, kg: 14.0, pattern: 'column', board: 'kraft' },
  { name: 'Dog Toys 6 pk', category: 'Pet', form: 'polybag', w: 0.34, h: 0.16, d: 0.28, units: 6, kg: 0.9, pattern: 'interlock', board: 'kraft' },
  { name: 'Litter Box XL', category: 'Pet', form: 'rsc', w: 0.62, h: 0.20, d: 0.48, units: 1, kg: 2.6, pattern: 'column', board: 'kraft' },
  { name: 'Aquarium Filter', category: 'Pet', form: 'rsc', w: 0.26, h: 0.18, d: 0.20, units: 1, kg: 1.0, pattern: 'interlock', board: 'printed' },

  // ---- Toys --------------------------------------------------------------------------------------------------
  { name: 'Building Bricks 1000 pc', category: 'Toys', form: 'rsc', w: 0.48, h: 0.28, d: 0.36, units: 1, kg: 4.4, pattern: 'column', board: 'printed' },
  { name: 'Plush Bear 18 in', category: 'Toys', form: 'polybag', w: 0.50, h: 0.30, d: 0.40, units: 1, kg: 0.9, pattern: 'interlock', board: 'kraft' },
  { name: 'Board Game', category: 'Toys', form: 'rsc', w: 0.40, h: 0.08, d: 0.28, units: 1, kg: 1.6, pattern: 'interlock', board: 'printed' },
  { name: 'Jigsaw Puzzle 1000 pc', category: 'Toys', form: 'rsc', w: 0.32, h: 0.06, d: 0.26, units: 1, kg: 0.8, pattern: 'interlock', board: 'printed' },
  { name: 'Remote Control Car', category: 'Toys', form: 'rsc', w: 0.42, h: 0.16, d: 0.30, units: 1, kg: 1.7, pattern: 'interlock', board: 'printed' },
  { name: 'Dollhouse', category: 'Toys', form: 'rsc', w: 0.75, h: 0.20, d: 0.50, units: 1, kg: 6.2, pattern: 'column', board: 'printed' },
  { name: 'Art Set 150 pc', category: 'Toys', form: 'rsc', w: 0.42, h: 0.08, d: 0.32, units: 1, kg: 1.5, pattern: 'interlock', board: 'printed' },
  { name: 'Ride-On Trike', category: 'Toys', form: 'rsc', w: 0.70, h: 0.32, d: 0.50, units: 1, kg: 7.4, pattern: 'column', board: 'kraft' },
  { name: 'Action Figure 6 pk', category: 'Toys', form: 'rsc', w: 0.30, h: 0.20, d: 0.22, units: 6, kg: 1.1, pattern: 'interlock', board: 'printed' },

  // ---- Sporting ----------------------------------------------------------------------------------------------
  { name: 'Dumbbell Set 40 lb', category: 'Sporting', form: 'rsc', w: 0.45, h: 0.30, d: 0.30, units: 1, kg: 19.0, pattern: 'column', board: 'kraft' },
  { name: 'Resistance Bands Set', category: 'Sporting', form: 'rsc', w: 0.28, h: 0.12, d: 0.22, units: 1, kg: 1.2, pattern: 'interlock', board: 'printed' },
  { name: 'Bike Helmet M', category: 'Sporting', form: 'rsc', w: 0.34, h: 0.20, d: 0.28, units: 1, kg: 1.1, pattern: 'interlock', board: 'printed' },
  { name: 'Water Bottle 32 oz', category: 'Sporting', form: 'rsc', w: 0.30, h: 0.28, d: 0.22, units: 1, kg: 0.6, pattern: 'column', board: 'printed' },
  { name: 'Camping Tent 4P', category: 'Sporting', form: 'rsc', w: 0.70, h: 0.25, d: 0.25, units: 1, kg: 5.8, pattern: 'column', board: 'kraft' },
  { name: 'Sleeping Bag', category: 'Sporting', form: 'polybag', w: 0.45, h: 0.30, d: 0.32, units: 1, kg: 2.4, pattern: 'interlock', board: 'kraft' },
  { name: 'Golf Balls 24 pk', category: 'Sporting', form: 'rsc', w: 0.28, h: 0.14, d: 0.22, units: 24, kg: 1.5, pattern: 'interlock', board: 'printed' },
  { name: 'Tennis Balls 24 pk', category: 'Sporting', form: 'tray', w: 0.30, h: 0.22, d: 0.30, units: 24, kg: 1.4, pattern: 'column', board: 'printed' },
  { name: 'Pickleball Paddle Set', category: 'Sporting', form: 'rsc', w: 0.44, h: 0.10, d: 0.30, units: 2, kg: 1.0, pattern: 'interlock', board: 'printed' },
  { name: 'Basketball', category: 'Sporting', form: 'rsc', w: 0.30, h: 0.25, d: 0.30, units: 1, kg: 0.7, pattern: 'column', board: 'kraft' },

  // ---- Luggage -----------------------------------------------------------------------------------------------
  // Every case here is a one-each shipper: a suitcase is its own carton. Dimensions are the case as it sits on
  // the pallet, so the height is the case lying flat, not the suitcase standing. Sizes follow the airline
  // carry-on limit (22 x 14 x 9 in) and the common checked sizes (26 in and 29 in).
  { name: 'Carry-On Spinner 22 in', category: 'Luggage', form: 'rsc', w: 0.58, h: 0.25, d: 0.38, units: 1, kg: 3.6, pattern: 'column', board: 'printed' },
  { name: 'Carry-On Hardside 20 in', category: 'Luggage', form: 'rsc', w: 0.54, h: 0.24, d: 0.36, units: 1, kg: 3.2, pattern: 'column', board: 'printed' },
  { name: 'Checked Spinner 26 in', category: 'Luggage', form: 'rsc', w: 0.68, h: 0.29, d: 0.46, units: 1, kg: 5.4, pattern: 'column', board: 'kraft' },
  { name: 'Checked Spinner 29 in', category: 'Luggage', form: 'rsc', w: 0.76, h: 0.32, d: 0.52, units: 1, kg: 6.4, pattern: 'column', board: 'kraft' },
  { name: 'Luggage Set 2 pc', category: 'Luggage', form: 'rsc', w: 0.70, h: 0.42, d: 0.34, units: 2, kg: 8.8, pattern: 'column', board: 'kraft' },
  { name: 'Softside Duffel 45 L', category: 'Luggage', form: 'polybag', w: 0.62, h: 0.30, d: 0.32, units: 1, kg: 1.9, pattern: 'interlock', board: 'kraft' },
  { name: 'Garment Bag', category: 'Luggage', form: 'polybag', w: 0.58, h: 0.11, d: 0.42, units: 1, kg: 1.4, pattern: 'interlock', board: 'kraft' },
  { name: 'Underseat Tote', category: 'Luggage', form: 'polybag', w: 0.44, h: 0.20, d: 0.30, units: 1, kg: 1.2, pattern: 'interlock', board: 'kraft' },
  { name: 'Kids Ride-On Suitcase', category: 'Luggage', form: 'rsc', w: 0.48, h: 0.24, d: 0.32, units: 1, kg: 2.6, pattern: 'column', board: 'printed' },
  { name: 'Packing Cubes 6 pk', category: 'Luggage', form: 'polybag', w: 0.32, h: 0.09, d: 0.24, units: 6, kg: 0.6, pattern: 'interlock', board: 'kraft' },

  // ---- Tools & Home Improvement ------------------------------------------------------------------------------
  { name: 'Tool Set 230 pc', category: 'Tools', form: 'rsc', w: 0.48, h: 0.14, d: 0.36, units: 1, kg: 6.4, pattern: 'column', board: 'printed' },
  { name: 'Paint Roller Kit', category: 'Tools', form: 'rsc', w: 0.40, h: 0.16, d: 0.28, units: 1, kg: 1.5, pattern: 'interlock', board: 'printed' },
  { name: 'Latex Paint 1 gal 4 pk', category: 'Tools', form: 'drum', w: 0.32, h: 0.30, d: 0.32, units: 4, kg: 18.0, pattern: 'column', board: 'printed' },
  { name: 'LED Shop Light 4 ft', category: 'Tools', form: 'flat', w: 1.15, h: 0.14, d: 0.20, units: 1, kg: 2.2, pattern: 'column', board: 'printed' },
  { name: 'Door Lock Set', category: 'Tools', form: 'rsc', w: 0.24, h: 0.12, d: 0.20, units: 1, kg: 1.4, pattern: 'interlock', board: 'printed' },
  { name: 'Caulking Gun', category: 'Tools', form: 'rsc', w: 0.32, h: 0.12, d: 0.18, units: 1, kg: 0.9, pattern: 'interlock', board: 'printed' },
  { name: 'Work Gloves 3 pk', category: 'Tools', form: 'polybag', w: 0.28, h: 0.10, d: 0.20, units: 3, kg: 0.5, pattern: 'interlock', board: 'kraft' },
  { name: 'Tape Measure 25 ft', category: 'Tools', form: 'rsc', w: 0.14, h: 0.08, d: 0.14, units: 1, kg: 0.4, pattern: 'interlock', board: 'printed' },
  { name: 'Shop Vac Filter', category: 'Tools', form: 'rsc', w: 0.30, h: 0.22, d: 0.30, units: 1, kg: 0.8, pattern: 'interlock', board: 'printed' },
  { name: 'Step Stool 2-Step', category: 'Tools', form: 'rsc', w: 0.50, h: 0.15, d: 0.42, units: 1, kg: 3.4, pattern: 'column', board: 'kraft' },
  { name: 'Solar Path Lights 6 pk', category: 'Tools', form: 'rsc', w: 0.34, h: 0.16, d: 0.26, units: 6, kg: 1.6, pattern: 'interlock', board: 'printed' },

  // ---- Office ------------------------------------------------------------------------------------------------
  { name: 'Printer Paper 10 rm', category: 'Office', form: 'rsc', w: 0.45, h: 0.28, d: 0.30, units: 10, kg: 22.0, pattern: 'column', board: 'kraft' },
  { name: 'File Box 6 pk', category: 'Office', form: 'rsc', w: 0.60, h: 0.30, d: 0.40, units: 6, kg: 4.8, pattern: 'column', board: 'kraft' },
  { name: 'Desk Organizer', category: 'Office', form: 'rsc', w: 0.28, h: 0.18, d: 0.22, units: 1, kg: 1.2, pattern: 'interlock', board: 'printed' },
  { name: 'Sticky Notes 24 pk', category: 'Office', form: 'rsc', w: 0.22, h: 0.10, d: 0.18, units: 24, kg: 0.9, pattern: 'interlock', board: 'printed' },
  { name: 'Toner Cartridge', category: 'Office', form: 'rsc', w: 0.36, h: 0.12, d: 0.14, units: 1, kg: 1.1, pattern: 'interlock', board: 'printed' },
  { name: 'Office Chair', category: 'Office', form: 'rsc', w: 0.85, h: 0.40, d: 0.65, units: 1, kg: 13.5, pattern: 'column', board: 'kraft' },
  { name: 'Whiteboard 24x36', category: 'Office', form: 'flat', w: 0.95, h: 0.06, d: 0.65, units: 1, kg: 3.1, pattern: 'column', board: 'printed' },
  { name: 'Label Maker', category: 'Office', form: 'rsc', w: 0.22, h: 0.10, d: 0.18, units: 1, kg: 0.6, pattern: 'interlock', board: 'printed' },
]

/** Products that lie flat or stand tall need their long axis respected — used when fitting a case to the deck. */
export const FORM_IS_ROUND: Record<Form, boolean> = {
  rsc: false, shoebox: false, polybag: false, paperbag: false, tub: true,
  roll: true, tray: true, flat: false, mailer: false, drum: true,
}

// ---- The each ------------------------------------------------------------------------------------------------
//
// Reserve pallets hold sealed cases, so that is all you see at levels C-E. The individual product is only
// visible at a PICK FACE, where the case is cut open and the units are loose on the shelf. That is what these
// describe: the each inside the case, and what it actually looks like.

export type UnitForm = 'box' | 'bottle' | 'roll' | 'pouch' | 'tub' | 'can' | 'pack'
  | 'suitcase' | 'ball'

export interface Unit {
  form: UnitForm
  w: number; h: number; d: number
}

/**
 * What the each looks like, for the products where it is not simply a smaller box. Anything absent here is
 * packed as boxed eaches, which is the correct default — most e-commerce SKUs are.
 */
const UNIT_FORM: Record<string, UnitForm> = {
  'Paper Towels 12 Rolls': 'roll',
  'Bath Tissue 24 Rolls': 'roll',
  'Dish Soap 6 pk': 'bottle',
  'Glass Cleaner 6 pk': 'bottle',
  'Hand Soap 8 pk': 'bottle',
  'Shampoo 6 pk': 'bottle',
  'Sunscreen 6 pk': 'bottle',
  'Baby Bottles 6 pk': 'bottle',
  'Air Freshener 12 pk': 'can',
  'Latex Paint 1 gal 4 pk': 'can',
  'Tennis Balls 24 pk': 'can',
  'Microfiber Cloths 24 pk': 'pouch',
  'Socks 12 pk': 'pouch',
  'T-Shirt 3 pk': 'pouch',
  'Crib Sheets 3 pk': 'pouch',
  'Dog Toys 6 pk': 'pouch',
  'Work Gloves 3 pk': 'pouch',
  'Printer Paper 10 rm': 'pack',
  'Golf Balls 24 pk': 'pack',
  'Sticky Notes 24 pk': 'pack',
  // A yoga mat's case is the rolled mat itself, and a broom set is a long sleeved pack — neither is a box.
  'Yoga Mat 6 mm': 'roll',
  'Broom & Dustpan Set': 'pack',
  'Basketball': 'ball',
  'Water Bottle 32 oz': 'bottle',

  // ---- Drinkware: the each is the vessel, which is the whole point of the category --------------------------
  'Insulated Bottle 32 oz': 'bottle',
  'Insulated Bottle 24 oz': 'bottle',
  'Tumbler 20 oz': 'bottle',
  'Travel Mug 16 oz': 'bottle',
  'Vacuum Flask 40 oz': 'bottle',
  'Kids Bottle 16 oz 4 pk': 'bottle',
  'Glass Water Bottle 6 pk': 'bottle',

  // ---- Luggage ----------------------------------------------------------------------------------------------
  'Carry-On Spinner 22 in': 'suitcase',
  'Carry-On Hardside 20 in': 'suitcase',
  'Checked Spinner 26 in': 'suitcase',
  'Checked Spinner 29 in': 'suitcase',
  'Luggage Set 2 pc': 'suitcase',
  'Kids Ride-On Suitcase': 'suitcase',
  'Softside Duffel 45 L': 'pouch',
  'Garment Bag': 'pouch',
  'Underseat Tote': 'pouch',
  'Packing Cubes 6 pk': 'pouch',
}

/**
 * The each: the case divided by its pack arrangement, with the form taken from the product.
 *
 * The arrangement is found by trying every grid whose product is at least `units` and keeping the one whose
 * cells come out closest to cube-like — which is how a real pack is specified, so a unit is never a
 * paper-thin sliver of its case.
 */
export function unitOf(p: Product): Unit {
  if (p.units <= 1) return { form: unitFormFor(p), w: p.w, h: p.h, d: p.d }
  let best = { a: 1, b: p.units, c: 1 }, bestAspect = Infinity
  for (let a = 1; a <= p.units; a++) {
    if (p.units % a) continue
    for (let b = 1; b * a <= p.units; b++) {
      if ((p.units / a) % b) continue
      const c = p.units / (a * b)
      const uw = p.w / a, uh = p.h / b, ud = p.d / c
      const aspect = Math.max(uw, uh, ud) / Math.max(1e-6, Math.min(uw, uh, ud))
      if (aspect < bestAspect) { bestAspect = aspect; best = { a, b, c } }
    }
  }
  return { form: unitFormFor(p), w: p.w / best.a, h: p.h / best.b, d: p.d / best.c }
}

function unitFormFor(p: Product): UnitForm {
  const named = UNIT_FORM[p.name]
  if (named) return named
  // A bagged or shrink-wrapped case is loose goods inside; a rigid case holds boxed eaches.
  if (p.form === 'polybag' || p.form === 'mailer') return 'pouch'
  if (p.form === 'tub' || p.form === 'drum') return p.form === 'tub' ? 'tub' : 'can'
  return 'box'
}

/**
 * SKU -> product, deterministically. FNV-1a over the SKU string.
 *
 * This is a pure function on purpose. The facility's inventory is generated from one shared seeded RNG
 * stream (src/rng.ts) that every dock, trailer, station and associate in the twin also draws from, so
 * adding a random draw here would re-roll the entire rest of the scene. Hashing instead costs nothing
 * and gives a bonus the model was missing: a reserve pallet, its pick faces and its bins finally agree
 * on what they hold.
 */
export function productForSku(sku: string): Product {
  let h = 2166136261 >>> 0
  for (let i = 0; i < sku.length; i++) {
    h ^= sku.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return CATALOG[h % CATALOG.length]
}

/** The name list, for anywhere that only needs the label (pick faces, bins, picker task text). */
export const PRODUCT_NAMES: string[] = CATALOG.map(p => p.name)

/** Distinct categories, in catalogue order. */
export const CATEGORIES: string[] = [...new Set(CATALOG.map(p => p.category))]
