import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { Fuel, Gauge, Pencil, Plus, Search, Settings2, Star, Trash2 } from 'lucide-react'
import { ConfirmDialog, PageHeader, Pill, Toast } from '../components/ui'
import { CarEditor } from '../components/CarEditor'
import { useInventory, type CarInput } from '../lib/store'
import { CAR_STATUSES, type Car, type CarStatus } from '../lib/types'
import { carStatusStyle, carTitle, formatKm, formatPrice, photoSrc } from '../lib/format'

type CarsSearch = { new?: boolean; edit?: string }

export const Route = createFileRoute('/_admin/cars')({
  head: () => ({ meta: [{ title: 'Cars · Royal Motors Admin' }] }),
  validateSearch: (s: Record<string, unknown>): CarsSearch => ({
    new: s.new === true || s.new === 'true' ? true : undefined,
    edit: typeof s.edit === 'string' ? s.edit : undefined,
  }),
  component: CarsPage,
})

type Filter = 'all' | CarStatus

function CarsPage() {
  const { cars, saveCar, deleteCar } = useInventory()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/cars' })

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [condition, setCondition] = useState<'all' | 'new' | 'used'>('all')
  const [toDelete, setToDelete] = useState<Car | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const editing = search.edit ? (cars.find((c) => c.id === search.edit) ?? null) : null
  const editorOpen = Boolean(search.new || editing)
  const closeEditor = useCallback(() => navigate({ search: {} }), [navigate])
  const clearToast = useCallback(() => setToast(null), [])
  const clearFailure = useCallback(() => setFailure(null), [])
  const fail = (err: unknown) => setFailure(err instanceof Error ? err.message : String(err))

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cars.filter(
      (c) =>
        (filter === 'all' || c.status === filter) &&
        (condition === 'all' || c.condition === condition) &&
        (!q || `${carTitle(c)} ${c.colour} ${c.bodyType}`.toLowerCase().includes(q)),
    )
  }, [cars, query, filter, condition])

  const counts = useMemo(() => {
    const m: Record<Filter, number> = { all: cars.length, available: 0, reserved: 0, sold: 0, draft: 0 }
    for (const c of cars) m[c.status]++
    return m
  }, [cars])

  const onSave = async (input: CarInput, id?: string) => {
    const saved = await saveCar(input, id)
    closeEditor()
    setToast(id ? `${carTitle(saved)} updated` : `${carTitle(saved)} added`)
  }

  const quickStatus = async (car: Car, status: CarStatus) => {
    if (status !== 'draft' && car.photos.length === 0) {
      setFailure('Add at least one photo before publishing this car.')
      return
    }
    setBusyId(car.id)
    try {
      await saveCar({ ...car, status }, car.id)
      setToast(`Marked ${status}`)
    } catch (err) {
      fail(err)
    }
    setBusyId(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Cars"
        description="Add, edit and price your vehicles. Upload photos and choose what goes live."
        action={
          <button type="button" className="btn-gold self-start sm:self-auto" onClick={() => navigate({ search: { new: true } })}>
            <Plus className="h-4 w-4" /> Add a car
          </button>
        }
      />

      {/* Toolbar */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
            <input
              type="search"
              className="field pl-9"
              placeholder="Search make, model, colour…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search cars"
            />
          </div>
          <select
            className="field sm:w-44"
            value={condition}
            onChange={(e) => setCondition(e.target.value as typeof condition)}
            aria-label="Condition"
          >
            <option value="all">All conditions</option>
            <option value="new">Brand new</option>
            <option value="used">Quality used</option>
          </select>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Status">
          {(['all', ...CAR_STATUSES] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition ${filter === f ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:ring-ink-900/25'}`}
            >
              {f} <span className={filter === f ? 'text-gold-300' : 'text-ink-500'}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="font-semibold text-ink-900">No cars match these filters</p>
          <p className="mt-1 text-sm text-ink-500">Try a different search, or add a new car.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((car, i) => (
            <li key={car.id} className="card rise flex flex-col overflow-hidden" style={{ animationDelay: `${i * 40}ms` }}>
              <button
                type="button"
                onClick={() => navigate({ search: { edit: car.id } })}
                className="relative aspect-[4/3] overflow-hidden bg-ink-900/5 text-left"
                aria-label={`Edit ${carTitle(car)}`}
              >
                {car.photos[0] ? (
                  <img
                    src={photoSrc(car.photos[0], 640)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-sm text-ink-500">No photo yet</span>
                )}
                <span className="absolute left-3 top-3 flex gap-1.5">
                  <Pill className={`${carStatusStyle[car.status]} bg-white/95`}>{car.status}</Pill>
                  {car.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink-900/85 px-2 py-0.5 text-xs font-semibold text-gold-300">
                      <Star className="h-3 w-3 fill-current" /> Featured
                    </span>
                  )}
                </span>
                {car.photos.length > 1 && (
                  <span className="absolute bottom-3 right-3 rounded-md bg-ink-900/75 px-2 py-0.5 text-xs font-semibold text-white">
                    {car.photos.length} photos
                  </span>
                )}
              </button>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-600">
                  {car.condition === 'new' ? 'Brand new' : 'Quality used'} · {car.bodyType}
                </p>
                <h3 className="mt-1 font-bold leading-snug text-ink-900">{carTitle(car)}</h3>
                <p className="mt-1 text-lg font-extrabold tracking-tight text-ink-900">{formatPrice(car.price)}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" /> {formatKm(car.mileageKm)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Fuel className="h-3.5 w-3.5" /> {car.fuel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Settings2 className="h-3.5 w-3.5" /> {car.transmission}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-ink-900/[0.06] pt-3">
                  <select
                    className="field !py-1.5 flex-1 text-xs capitalize"
                    value={car.status}
                    disabled={busyId === car.id}
                    onChange={(e) => void quickStatus(car, e.target.value as CarStatus)}
                    aria-label={`Status for ${carTitle(car)}`}
                  >
                    {CAR_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5"
                    onClick={() => navigate({ search: { edit: car.id } })}
                    aria-label={`Edit ${carTitle(car)}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !px-2.5 !py-1.5 text-red-600 hover:!border-red-300 hover:!bg-red-50"
                    onClick={() => setToDelete(car)}
                    aria-label={`Delete ${carTitle(car)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CarEditor open={editorOpen} car={editing} onClose={closeEditor} onSave={onSave} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this car?"
        body={
          <>
            <strong>{toDelete && carTitle(toDelete)}</strong> and its photos will be removed from
            the dashboard and the customer website. This can’t be undone.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const car = toDelete
          setToDelete(null)
          if (!car) return
          deleteCar(car.id).then(
            () => setToast(`${carTitle(car)} deleted`),
            fail,
          )
        }}
      />
      <Toast message={toast} onDone={clearToast} />
      <Toast message={failure} onDone={clearFailure} tone="error" />
    </>
  )
}
