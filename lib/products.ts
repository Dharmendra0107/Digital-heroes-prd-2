import type { Division, DivisionInfo, Product } from '@/types'

export const DIVISIONS: DivisionInfo[] = [
  {
    slug: 'labels-stickers',
    name: 'Labels & Stickers',
    description: 'Custom die-cut and sheet labels for products, packaging, branding and events.',
    tagline: 'From rolls to sheets — any shape, any size.',
    color: 'amber',
  },
  {
    slug: 'race-event-numbers',
    name: 'Race & Event Numbers',
    description: 'Durable race numbers with variable data printing — names, numbers and barcodes per row.',
    tagline: 'Every competitor, uniquely identified.',
    color: 'orange',
  },
  {
    slug: 'mtb-boards',
    name: 'MTB Boards',
    description: 'Corflute and aluminium mounting boards for trail signage, event markers and course direction.',
    tagline: 'Built for the trail.',
    color: 'green',
  },
  {
    slug: 'stamps',
    name: 'Stamps',
    description: 'Self-inking rubber stamps in custom sizes for business, logistics and personal use.',
    tagline: 'Leave your mark.',
    color: 'blue',
  },
  {
    slug: 'trophies',
    name: 'Trophies',
    description: 'Laser-engraved acrylic and wood trophies, plaques and awards for any occasion.',
    tagline: 'Celebrate every win.',
    color: 'purple',
  },
  {
    slug: 'laser-cut-work',
    name: 'Laser-Cut Work',
    description: 'Precision laser cutting and engraving on acrylic, wood, leather and more.',
    tagline: 'Precision-cut. Custom-made.',
    color: 'red',
  },
]

// Sample product data — real pricing would come from the database
// These are documented defaults used for demonstration
export const SAMPLE_PRODUCTS: Omit<Product, 'id' | 'created_at'>[] = [
  {
    division: 'labels-stickers',
    name: 'Custom Die-Cut Stickers',
    description: 'Full-colour die-cut stickers on gloss or matte vinyl. Waterproof and UV-resistant.',
    base_price_per_unit: 1.20,
    pricing_tiers: [
      { min_qty: 1, max_qty: 49, discount_percent: 0 },
      { min_qty: 50, max_qty: 99, discount_percent: 10 },
      { min_qty: 100, max_qty: 499, discount_percent: 20 },
      { min_qty: 500, max_qty: null, discount_percent: 30 },
    ],
    config: {
      sizes: [
        { label: '50×50mm', width_mm: 50, height_mm: 50 },
        { label: '100×100mm', width_mm: 100, height_mm: 100 },
        { label: '100×50mm', width_mm: 100, height_mm: 50 },
        { label: '150×100mm', width_mm: 150, height_mm: 100 },
      ],
      materials: [
        { label: 'Gloss Vinyl', multiplier: 1.0 },
        { label: 'Matte Vinyl', multiplier: 1.1 },
        { label: 'Clear Vinyl', multiplier: 1.2 },
      ],
      print_area: { x: 3, y: 3, width: 94, height: 44 },
      bleed_mm: 3,
      resolution_dpi: 300,
    },
    active: true,
  },
  {
    division: 'race-event-numbers',
    name: 'Race Numbers',
    description: 'Durable Tyvek or card race numbers with variable data — unique number, name and barcode per athlete.',
    base_price_per_unit: 0.85,
    pricing_tiers: [
      { min_qty: 1, max_qty: 49, discount_percent: 0 },
      { min_qty: 50, max_qty: 199, discount_percent: 15 },
      { min_qty: 200, max_qty: 499, discount_percent: 25 },
      { min_qty: 500, max_qty: null, discount_percent: 35 },
    ],
    config: {
      sizes: [
        { label: 'Standard 200×150mm', width_mm: 200, height_mm: 150 },
        { label: 'Large 250×200mm', width_mm: 250, height_mm: 200 },
        { label: 'Small 150×100mm', width_mm: 150, height_mm: 100 },
      ],
      materials: [
        { label: 'Tyvek (Tear-Resistant)', multiplier: 1.0 },
        { label: 'Gloss Card', multiplier: 0.85 },
      ],
      has_csv_upload: true,
      print_area: { x: 5, y: 5, width: 190, height: 140 },
      bleed_mm: 3,
      resolution_dpi: 300,
    },
    active: true,
  },
  {
    division: 'mtb-boards',
    name: 'Trail Sign Board',
    description: 'Corflute and aluminium composite boards for MTB trail signage. UV-printed, weather-resistant.',
    base_price_per_unit: 18.00,
    pricing_tiers: [
      { min_qty: 1, max_qty: 4, discount_percent: 0 },
      { min_qty: 5, max_qty: 19, discount_percent: 10 },
      { min_qty: 20, max_qty: null, discount_percent: 20 },
    ],
    config: {
      sizes: [
        { label: '300×200mm', width_mm: 300, height_mm: 200 },
        { label: '450×300mm', width_mm: 450, height_mm: 300 },
        { label: '600×400mm', width_mm: 600, height_mm: 400 },
      ],
      materials: [
        { label: 'Corflute 4mm', multiplier: 1.0 },
        { label: 'Aluminium Composite', multiplier: 2.5 },
      ],
      orientations: [
        { label: 'Landscape', value: 'landscape' },
        { label: 'Portrait', value: 'portrait' },
      ],
      print_area: { x: 5, y: 5, width: 290, height: 190 },
      bleed_mm: 3,
      resolution_dpi: 300,
    },
    active: true,
  },
  {
    division: 'stamps',
    name: 'Self-Inking Rubber Stamp',
    description: 'Custom self-inking stamps in standard sizes. Quick turnaround, long ink life.',
    base_price_per_unit: 22.00,
    pricing_tiers: [
      { min_qty: 1, max_qty: 4, discount_percent: 0 },
      { min_qty: 5, max_qty: 9, discount_percent: 10 },
      { min_qty: 10, max_qty: null, discount_percent: 18 },
    ],
    config: {
      sizes: [
        { label: '38×14mm', width_mm: 38, height_mm: 14 },
        { label: '47×18mm', width_mm: 47, height_mm: 18 },
        { label: '58×22mm', width_mm: 58, height_mm: 22 },
        { label: '69×30mm', width_mm: 69, height_mm: 30 },
      ],
      materials: [
        { label: 'Blue Ink', multiplier: 1.0 },
        { label: 'Black Ink', multiplier: 1.0 },
        { label: 'Red Ink', multiplier: 1.0 },
      ],
      print_area: { x: 2, y: 2, width: 34, height: 10 },
      bleed_mm: 0,
      resolution_dpi: 600,
    },
    active: true,
  },
  {
    division: 'trophies',
    name: 'Acrylic Award Trophy',
    description: 'Laser-engraved clear acrylic trophies and awards. Custom text, logos and shapes.',
    base_price_per_unit: 35.00,
    pricing_tiers: [
      { min_qty: 1, max_qty: 4, discount_percent: 0 },
      { min_qty: 5, max_qty: 19, discount_percent: 12 },
      { min_qty: 20, max_qty: null, discount_percent: 22 },
    ],
    config: {
      sizes: [
        { label: 'Small 100×150mm', width_mm: 100, height_mm: 150 },
        { label: 'Medium 150×200mm', width_mm: 150, height_mm: 200 },
        { label: 'Large 200×250mm', width_mm: 200, height_mm: 250 },
      ],
      materials: [
        { label: 'Clear Acrylic', multiplier: 1.0 },
        { label: 'Frosted Acrylic', multiplier: 1.15 },
        { label: 'Bamboo', multiplier: 1.2 },
      ],
      print_area: { x: 10, y: 10, width: 80, height: 130 },
      bleed_mm: 0,
      resolution_dpi: 600,
    },
    active: true,
  },
  {
    division: 'laser-cut-work',
    name: 'Custom Laser Cut & Engrave',
    description: 'Precision laser cutting and engraving on acrylic, wood, leather and fabric. Upload your vector artwork.',
    base_price_per_unit: 25.00,
    pricing_tiers: [
      { min_qty: 1, max_qty: 4, discount_percent: 0 },
      { min_qty: 5, max_qty: 19, discount_percent: 10 },
      { min_qty: 20, max_qty: null, discount_percent: 20 },
    ],
    config: {
      sizes: [
        { label: 'A5 148×210mm', width_mm: 148, height_mm: 210 },
        { label: 'A4 210×297mm', width_mm: 210, height_mm: 297 },
        { label: 'A3 297×420mm', width_mm: 297, height_mm: 420 },
        { label: 'Custom', width_mm: 200, height_mm: 200 },
      ],
      materials: [
        { label: '3mm Clear Acrylic', multiplier: 1.0 },
        { label: '3mm MDF', multiplier: 0.8 },
        { label: '3mm Plywood', multiplier: 0.9 },
        { label: 'Leather', multiplier: 1.5 },
      ],
      print_area: { x: 5, y: 5, width: 138, height: 200 },
      bleed_mm: 0,
      resolution_dpi: 600,
    },
    active: true,
  },
]
