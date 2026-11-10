import { describe, expect, it } from 'vitest'
import { carToRow, customerToRow, rowToCar, rowToCustomer } from './db'

describe('cars mapping', () => {
  it('reads the existing column names and falls back to image_url for photos', () => {
    const car = rowToCar({
      id: 7,
      make: 'Toyota',
      model: 'Hilux',
      year: '2021',
      price: null,
      mileage: '45000',
      fuel_type: 'diesel',
      transmission: 'Manual',
      status: 'Available',
      image_url: 'https://x.supabase.co/a.jpg',
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(car).toMatchObject({
      id: '7',
      year: 2021,
      price: null,
      mileageKm: 45000,
      fuel: 'Diesel',
      status: 'available',
      photos: ['https://x.supabase.co/a.jpg'],
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('writes the cover photo to image_url', () => {
    const row = carToRow({ ...rowToCar({ status: 'draft' }), photos: ['a', 'b'] })
    expect(row.image_url).toBe('a')
    expect(row.photos).toEqual(['a', 'b'])
    expect(row).not.toHaveProperty('id')
  })
})

describe('customers mapping', () => {
  it('maps full_name to name and back', () => {
    const c = rowToCustomer({ id: 'u1', full_name: 'Asha', phone: '+255', interested_car_id: 3 })
    expect(c.name).toBe('Asha')
    expect(c.interestedCarId).toBe('3')
    expect(customerToRow(c).full_name).toBe('Asha')
  })
})
