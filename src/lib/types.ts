export type CarCondition = 'new' | 'used'
export type CarStatus = 'available' | 'reserved' | 'sold' | 'draft'
export type BodyType =
  | 'SUV'
  | 'Sedan'
  | 'Coupe'
  | 'Pickup'
  | 'Hatchback'
  | 'Van'
  | 'Wagon'

export interface Car {
  id: string
  make: string
  model: string
  year: number
  /** Price in Tanzanian shillings. `null` shows "Ask for Price" on the website. */
  price: number | null
  condition: CarCondition
  bodyType: BodyType
  mileageKm: number | null
  engine: string
  fuel: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric'
  transmission: 'Automatic' | 'Manual'
  colour: string
  status: CarStatus
  featured: boolean
  /** First photo is the cover image. */
  photos: string[]
  description: string
  createdAt: string
  updatedAt: string
}

export type CustomerStatus =
  | 'new'
  | 'contacted'
  | 'negotiating'
  | 'won'
  | 'lost'
export type CustomerSource = 'whatsapp' | 'sourcing' | 'walk-in' | 'referral'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  source: CustomerSource
  status: CustomerStatus
  /** Car from inventory the customer asked about. */
  interestedCarId: string | null
  /** Free-text request for the "We find your car" sourcing service. */
  request: string
  budget: number | null
  notes: string
  createdAt: string
}

export const BODY_TYPES: BodyType[] = [
  'SUV',
  'Sedan',
  'Coupe',
  'Pickup',
  'Hatchback',
  'Van',
  'Wagon',
]
export const CAR_STATUSES: CarStatus[] = [
  'available',
  'reserved',
  'sold',
  'draft',
]
export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'new',
  'contacted',
  'negotiating',
  'won',
  'lost',
]
export const CUSTOMER_SOURCES: CustomerSource[] = [
  'whatsapp',
  'sourcing',
  'walk-in',
  'referral',
]
