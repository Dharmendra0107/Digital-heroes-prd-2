// Shared TypeScript types for the Digital Heroes platform

export type UserRole = 'customer' | 'admin'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  company?: string
  created_at: string
}

export type Division =
  | 'labels-stickers'
  | 'race-event-numbers'
  | 'mtb-boards'
  | 'stamps'
  | 'trophies'
  | 'laser-cut-work'

export interface DivisionInfo {
  slug: Division
  name: string
  description: string
  tagline: string
  color: string
}

export interface PricingTier {
  min_qty: number
  max_qty: number | null
  discount_percent: number
}

export interface ProductConfig {
  sizes: { label: string; width_mm: number; height_mm: number }[]
  materials: { label: string; multiplier: number }[]
  orientations?: { label: string; value: string }[]
  has_csv_upload?: boolean // for race numbers variable data
  print_area: { x: number; y: number; width: number; height: number }
  bleed_mm: number
  resolution_dpi: number
}

export interface Product {
  id: string
  division: Division
  name: string
  description: string
  base_price_per_unit: number
  pricing_tiers: PricingTier[]
  config: ProductConfig
  active: boolean
  created_at: string
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'artwork_pending'
  | 'proof_sent'
  | 'proof_approved'
  | 'in_production'
  | 'completed'
  | 'cancelled'

export interface Order {
  id: string
  customer_id: string
  product_id: string
  product?: Product
  status: OrderStatus
  quantity: number
  unit_price: number
  subtotal: number
  tax_amount: number
  total_price: number
  config_snapshot: Record<string, unknown>
  stripe_payment_id?: string
  stripe_session_id?: string
  created_at: string
  updated_at: string
}

export interface Design {
  id: string
  order_id: string
  customer_id: string
  canvas_json?: string // Fabric.js JSON
  upload_url?: string
  upload_type?: 'pdf' | 'png' | 'svg' | 'ai'
  thumbnail_url?: string
  is_saved: boolean
  created_at: string
  updated_at: string
}

export type ProofStatus = 'pending' | 'approved' | 'revision_requested'

export interface Proof {
  id: string
  order_id: string
  version: number
  file_url: string
  thumbnail_url?: string
  status: ProofStatus
  approved_by?: string
  approved_at?: string
  change_notes?: string
  created_at: string
}

export interface PrintFile {
  id: string
  order_id: string
  pdf_url?: string
  png_url?: string
  csv_output_url?: string
  generated_at: string
}

export interface PriceCalculation {
  quantity: number
  unit_price: number
  subtotal: number
  discount_percent: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  total: number
}
