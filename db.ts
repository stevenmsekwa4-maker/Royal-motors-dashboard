/**
 * Mapping between the dashboard domain model (types.ts) and the existing
 * Supabase tables. Column names follow the live database, so the customer
 * website can read the same fields:
 *   cars.mileage, cars.fuel_type, cars.image_url (cover photo),
 *   customers.full_name.
 */
import type {
  BodyType,
  Car,
  CarCondition,
  CarStatus,
  Customer,
  CustomerSource,
  CustomerStatus,
} from './types'
import { BODY_TYPES, CAR_STATUSES, CUSTOMER_SOURCES, CUSTOMER_STATUSES } from './types'
import type { CarInput, CustomerInput } from './store'

type Row = Record<string, unknown>

const str = (v: unknown) => (v == null ? '' : String(v))
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = str(v).toLowerCase()
  return allowed.find((a) => a.toLowerCase() === s) ?? fallback
}

export function rowToCar(r: Row): Car {
  const photos = Array.isArray(r.photos) ? (r.photos as unknown[]).map(str).filter(Boolean) : []
  if (photos.length === 0 && r.image_url) photos.push(str(r.image_url))
  const created = str(r.created_at) || new Date(0).toISOString()
  return {
    id: str(r.id),
    make: str(r.make),
    model: str(r.model),
    year: num(r.year) ?? 0,
    price: num(r.price),
    condition: pick<CarCondition>(r.condition, ['new', 'used'], 'used'),
    bodyType: pick<BodyType>(r.body_type, BODY_TYPES, 'SUV'),
    mileageKm: num(r.mileage),
    engine: str(r.engine),
    fuel: pick(r.fuel_type, ['Petrol', 'Diesel', 'Hybrid', 'Electric'] as const, 'Petrol'),
    transmission: pick(r.transmission, ['Automatic', 'Manual'] as const, 'Automatic'),
    colour: str(r.colour),
    status: pick<CarStatus>(r.status, CAR_STATUSES, 'draft'),
    featured: Boolean(r.featured),
    photos,
    description: str(r.description),
    createdAt: created,
    updatedAt: str(r.updated_at) || created,
  }
}

export function carToRow(c: CarInput): Row {
  return {
    make: c.make,
    model: c.model,
    year: c.year,
    price: c.price,
    condition: c.condition,
    body_type: c.bodyType,
    mileage: c.mileageKm,
    engine: c.engine || null,
    fuel_type: c.fuel,
    transmission: c.transmission,
    colour: c.colour || null,
    status: c.status,
    featured: c.featured,
    photos: c.photos,
    image_url: c.photos[0] ?? null,
    description: c.description || null,
  }
}

export function rowToCustomer(r: Row): Customer {
  return {
    id: str(r.id),
    name: str(r.full_name),
    phone: str(r.phone),
    email: str(r.email),
    source: pick<CustomerSource>(r.source, CUSTOMER_SOURCES, 'whatsapp'),
    status: pick<CustomerStatus>(r.status, CUSTOMER_STATUSES, 'new'),
    interestedCarId: r.interested_car_id == null ? null : str(r.interested_car_id),
    request: str(r.request),
    budget: num(r.budget),
    notes: str(r.notes),
    createdAt: str(r.created_at) || new Date(0).toISOString(),
  }
}

export function customerToRow(c: CustomerInput): Row {
  return {
    full_name: c.name,
    phone: c.phone,
    email: c.email || null,
    source: c.source,
    status: c.status,
    interested_car_id: c.interestedCarId,
    request: c.request || null,
    budget: c.budget,
    notes: c.notes || null,
  }
}
