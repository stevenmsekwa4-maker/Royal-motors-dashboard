/**
 * Inventory store backed by Supabase (public.cars and public.customers).
 * Every call runs as the signed-in admin with the anon key, and Row Level
 * Security in the database decides what is allowed. There is no sample-data
 * fallback: if loading fails, `status` is 'error' and `error` explains why.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { carToRow, customerToRow, rowToCar, rowToCustomer } from './db'
import { removeCarPhotos } from './photos'
import { describeError, getSupabase } from './supabase'
import type { Car, Customer } from './types'

export type CarInput = Omit<Car, 'id' | 'createdAt' | 'updatedAt'>
export type CustomerInput = Omit<Customer, 'id' | 'createdAt'>

export type LoadStatus = 'loading' | 'ready' | 'error'

interface InventoryContextValue {
  cars: Car[]
  customers: Customer[]
  status: LoadStatus
  error: string | null
  reload: () => Promise<void>
  saveCar: (input: CarInput, id?: string) => Promise<Car>
  deleteCar: (id: string) => Promise<void>
  saveCustomer: (input: CustomerInput, id?: string) => Promise<Customer>
  deleteCustomer: (id: string) => Promise<void>
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

/** Throw a readable Error for any Supabase error. */
function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw new Error(describeError(res.error))
  return res.data
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [cars, setCars] = useState<Car[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const sb = getSupabase()
      const [carRes, customerRes] = await Promise.all([
        sb.from('cars').select('*').order('created_at', { ascending: false }),
        sb.from('customers').select('*').order('created_at', { ascending: false }),
      ])
      if (carRes.error) throw new Error(`Cars: ${describeError(carRes.error)}`)
      if (customerRes.error) throw new Error(`Customers: ${describeError(customerRes.error)}`)
      setCars((carRes.data ?? []).map(rowToCar))
      setCustomers((customerRes.data ?? []).map(rowToCustomer))
      setStatus('ready')
    } catch (err) {
      setCars([])
      setCustomers([])
      setError(err instanceof Error ? err.message : describeError(err))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveCar = useCallback(
    async (input: CarInput, id?: string) => {
      const sb = getSupabase()
      const row = carToRow(input)
      const previous = id ? cars.find((c) => c.id === id) : undefined
      const data = check(
        id
          ? await sb.from('cars').update(row).eq('id', id).select('*').maybeSingle()
          : await sb.from('cars').insert(row).select('*').single(),
      )
      if (!data) {
        throw new Error('This car was not saved. It may have been deleted, or your account isn’t allowed to edit it.')
      }
      // Read the row back from Supabase before reporting success. This
      // prevents the admin UI from treating an in-memory update as a saved car.
      const verifiedRow = check(
        await sb.from('cars').select('*').eq('id', str(data.id)).single(),
      )
      const saved = rowToCar(verifiedRow)
      setCars((prev) =>
        id ? prev.map((c) => (c.id === id ? saved : c)) : [saved, ...prev],
      )
      if (previous) {
        const removed = previous.photos.filter((p) => !saved.photos.includes(p))
        if (removed.length) void removeCarPhotos(removed)
      }
      return saved
    },
    [cars],
  )

  const deleteCar = useCallback(
    async (id: string) => {
      const car = cars.find((c) => c.id === id)
      const deleted = check(
        await getSupabase().from('cars').delete().eq('id', id).select('id'),
      )
      if (!deleted?.length) {
        throw new Error('This car was not deleted. Your account may not have permission.')
      }
      setCars((prev) => prev.filter((c) => c.id !== id))
      setCustomers((prev) =>
        prev.map((c) => (c.interestedCarId === id ? { ...c, interestedCarId: null } : c)),
      )
      if (car?.photos.length) void removeCarPhotos(car.photos)
    },
    [cars],
  )

  const saveCustomer = useCallback(async (input: CustomerInput, id?: string) => {
    const sb = getSupabase()
    const row = customerToRow(input)
    const data = check(
      id
        ? await sb.from('customers').update(row).eq('id', id).select('*').maybeSingle()
        : await sb.from('customers').insert(row).select('*').single(),
    )
    if (!data) {
      throw new Error('This customer was not saved. They may have been deleted, or your account isn’t allowed to edit them.')
    }
    const saved = rowToCustomer(data)
    setCustomers((prev) =>
      id ? prev.map((c) => (c.id === id ? saved : c)) : [saved, ...prev],
    )
    return saved
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    const deleted = check(
      await getSupabase().from('customers').delete().eq('id', id).select('id'),
    )
    if (!deleted?.length) {
      throw new Error('This customer was not deleted. Your account may not have permission.')
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      cars,
      customers,
      status,
      error,
      reload,
      saveCar,
      deleteCar,
      saveCustomer,
      deleteCustomer,
    }),
    [cars, customers, status, error, reload, saveCar, deleteCar, saveCustomer, deleteCustomer],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used inside InventoryProvider')
  return ctx
}
