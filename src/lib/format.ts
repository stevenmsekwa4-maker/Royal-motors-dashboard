import type { Car, CarStatus, CustomerSource, CustomerStatus } from './types'

const tzs = new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 })

export function formatPrice(price: number | null) {
  return price == null ? 'Ask for Price' : `TSh ${tzs.format(price)}`
}

export function formatCompactTzs(value: number) {
  if (value >= 1e9) return `TSh ${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `TSh ${(value / 1e6).toFixed(1)}M`
  return `TSh ${tzs.format(value)}`
}

export function formatKm(km: number | null) {
  return km == null ? '—' : `${tzs.format(km)} km`
}

export function carTitle(car: Pick<Car, 'year' | 'make' | 'model'>) {
  return `${car.year} ${car.make} ${car.model}`.trim()
}

export function relativeDay(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

const CUSTOMER_SITE_ORIGIN = 'https://royal-motor.netlify.app'
const SUPABASE_PUBLIC_PHOTO = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//

/**
 * Route photos through the Netlify Image CDN. Supports this site's own
 * `/img/…` assets and Supabase Storage public URLs (allowlisted in
 * netlify.toml). Relative paths saved by the customer website are resolved
 * against that site. Anything else (including `blob:` previews) passes through.
 */
export function photoSrc(src: string, width = 640) {
  const cdn = (url: string) => `/.netlify/images?url=${encodeURIComponent(url)}&w=${width}&fm=webp`
  if (src.startsWith('/img/')) return cdn(src)
  if (src.startsWith('/') && !src.startsWith('//')) return `${CUSTOMER_SITE_ORIGIN}${src}`
  if (SUPABASE_PUBLIC_PHOTO.test(src)) return cdn(src)
  return src
}

export const carStatusStyle: Record<CarStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  reserved: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  sold: 'bg-ink-900/5 text-ink-600 ring-ink-900/15',
  draft: 'bg-sky-50 text-sky-700 ring-sky-600/20',
}

export const customerStatusStyle: Record<CustomerStatus, string> = {
  new: 'bg-gold-50 text-gold-700 ring-gold-600/30',
  contacted: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  negotiating: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  won: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  lost: 'bg-ink-900/5 text-ink-600 ring-ink-900/15',
}

export const sourceLabel: Record<CustomerSource, string> = {
  whatsapp: 'WhatsApp',
  sourcing: 'Car sourcing',
  'walk-in': 'Walk-in',
  referral: 'Referral',
}

export function whatsappLink(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
