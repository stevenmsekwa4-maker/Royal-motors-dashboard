import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ImagePlus, Star, Trash2, UploadCloud } from 'lucide-react'
import { ErrorNote, Sheet } from './ui'
import type { CarInput } from '../lib/store'
import { BODY_TYPES, CAR_STATUSES, type Car } from '../lib/types'
import { carTitle, photoSrc } from '../lib/format'
import { removeCarPhotos, uploadCarPhoto } from '../lib/photos'

const EMPTY: CarInput = {
  make: '',
  model: '',
  year: 2026,
  price: null,
  condition: 'used',
  bodyType: 'SUV',
  mileageKm: null,
  engine: '',
  fuel: 'Petrol',
  transmission: 'Automatic',
  colour: '',
  status: 'draft',
  featured: false,
  photos: [],
  description: '',
}

const MAX_PHOTOS = 12
const MAX_MB = 5

export function CarEditor({
  open,
  car,
  onClose,
  onSave,
}: {
  open: boolean
  car: Car | null
  onClose: () => void
  onSave: (input: CarInput, id?: string) => Promise<void>
}) {
  const [form, setForm] = useState<CarInput>(EMPTY)
  const [askPrice, setAskPrice] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // New photos stay local (blob: previews) until the car is saved.
  const pending = useRef(new Map<string, File>())
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const clearPending = () => {
    for (const url of pending.current.keys()) URL.revokeObjectURL(url)
    pending.current.clear()
  }

  useEffect(() => clearPending, [])

  useEffect(() => {
    if (!open) return
    clearPending()
    setSaving(null)
    setSaveError(null)
    const base = car ? { ...car } : EMPTY
    setForm({ ...EMPTY, ...base, photos: [...(base.photos ?? [])] })
    setAskPrice(car ? car.price == null : false)
    setErrors({})
  }, [open, car])

  const set = <K extends keyof CarInput>(key: K, value: CarInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const accepted: string[] = []
    let rejected = 0
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') || file.size > MAX_MB * 1024 * 1024) {
        rejected++
        continue
      }
      const url = URL.createObjectURL(file)
      pending.current.set(url, file)
      accepted.push(url)
    }
    setForm((f) => ({ ...f, photos: [...f.photos, ...accepted].slice(0, MAX_PHOTOS) }))
    setErrors((e) => ({
      ...e,
      photos: rejected ? `${rejected} file(s) skipped — use JPG, PNG or WebP under ${MAX_MB} MB.` : '',
    }))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const makeCover = (i: number) =>
    setForm((f) => {
      const photos = [...f.photos]
      const [p] = photos.splice(i, 1)
      return { ...f, photos: [p, ...photos] }
    })

  const removePhoto = (i: number) =>
    setForm((f) => {
      const url = f.photos[i]
      if (pending.current.has(url)) {
        URL.revokeObjectURL(url)
        pending.current.delete(url)
      }
      return { ...f, photos: f.photos.filter((_, j) => j !== i) }
    })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const next: Record<string, string> = {}
    if (!form.make.trim()) next.make = 'Make is required'
    if (!form.model.trim()) next.model = 'Model is required'
    if (!form.year || form.year < 1980 || form.year > 2027) next.year = 'Enter a year between 1980 and 2027'
    if (!askPrice && (form.price == null || form.price <= 0)) next.price = 'Enter a price or choose “Ask for Price”'
    if (form.status !== 'draft' && form.photos.length === 0) next.photos = 'Add at least one photo before publishing'
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaveError(null)
    const uploaded: string[] = []
    try {
      const toUpload = form.photos.filter((p) => pending.current.has(p))
      const photos: string[] = []
      for (const p of form.photos) {
        const file = pending.current.get(p)
        if (!file) {
          photos.push(p)
          continue
        }
        setSaving(`Uploading photo ${uploaded.length + 1} of ${toUpload.length}…`)
        const url = await uploadCarPhoto(file)
        uploaded.push(url)
        photos.push(url)
      }
      setSaving('Saving…')
      await onSave(
        {
          ...form,
          make: form.make.trim(),
          model: form.model.trim(),
          price: askPrice ? null : form.price,
          photos,
        },
        car?.id,
      )
    } catch (err) {
      if (uploaded.length) void removeCarPhotos(uploaded)
      setSaveError(err instanceof Error ? err.message : String(err))
      setSaving(null)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={car ? 'Edit car' : 'Add a car'}
      subtitle={car ? carTitle(car) : 'New listing for your showroom'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="car-form" className="btn-gold" disabled={Boolean(saving)}>
            {saving ?? (car ? 'Save changes' : 'Add car')}
          </button>
        </>
      }
    >
      <form id="car-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-7">
        {saveError && <ErrorNote>{saveError}</ErrorNote>}
        {/* Photos */}
        <fieldset>
          <legend className="label">Photos</legend>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed p-4 transition ${dragging ? 'border-gold-500 bg-gold-50' : 'border-ink-900/15 bg-white'}`}
          >
            {form.photos.length > 0 && (
              <ul className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {form.photos.map((src, i) => (
                  <li key={src + i} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-ink-900/5">
                    <img src={photoSrc(src, 320)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-ink-900/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-300">
                        Cover
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-ink-950/70 to-transparent p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => makeCover(i)}
                          className="rounded-md bg-white/90 p-1 text-ink-900 hover:bg-white"
                          aria-label={`Make photo ${i + 1} the cover`}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="rounded-md bg-white/90 p-1 text-red-600 hover:bg-white"
                        aria-label={`Remove photo ${i + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
                {form.photos.length < MAX_PHOTOS && (
                  <li>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-ink-900/10 text-ink-500 hover:border-gold-500 hover:text-gold-700"
                      aria-label="Add more photos"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </button>
                  </li>
                )}
              </ul>
            )}
            {form.photos.length === 0 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 py-6 text-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-50 text-gold-600">
                  <UploadCloud className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold text-ink-900">
                  Tap to upload or drag photos here
                </span>
                <span className="text-xs text-ink-500">
                  JPG, PNG or WebP · up to {MAX_PHOTOS} photos · {MAX_MB} MB each
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          {errors.photos && <p className="mt-1.5 text-xs text-red-600">{errors.photos}</p>}
        </fieldset>

        {/* Basics */}
        <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-6">
          <legend className="sr-only">Vehicle details</legend>
          <Field label="Make" error={errors.make} className="col-span-1 sm:col-span-2">
            <input className="field" value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="Toyota" />
          </Field>
          <Field label="Model" error={errors.model} className="col-span-1 sm:col-span-3">
            <input className="field" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Land Cruiser 300 VX" />
          </Field>
          <Field label="Year" error={errors.year} className="col-span-1 sm:col-span-1">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              value={form.year || ''}
              onChange={(e) => set('year', Number(e.target.value))}
            />
          </Field>
          <Field label="Condition" className="col-span-1 sm:col-span-2">
            <select className="field" value={form.condition} onChange={(e) => set('condition', e.target.value as CarInput['condition'])}>
              <option value="new">Brand new</option>
              <option value="used">Quality used</option>
            </select>
          </Field>
          <Field label="Body type" className="col-span-1 sm:col-span-2">
            <select className="field" value={form.bodyType} onChange={(e) => set('bodyType', e.target.value as CarInput['bodyType'])}>
              {BODY_TYPES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Colour" className="col-span-1 sm:col-span-2">
            <input className="field" value={form.colour} onChange={(e) => set('colour', e.target.value)} placeholder="Pearl White" />
          </Field>
        </fieldset>

        {/* Price */}
        <fieldset>
          <legend className="label">Price (TSh)</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="field sm:max-w-xs"
              type="number"
              inputMode="numeric"
              disabled={askPrice}
              placeholder={askPrice ? 'Ask for Price' : '145000000'}
              value={askPrice || form.price == null ? '' : form.price}
              onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))}
              aria-label="Price in Tanzanian shillings"
            />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-ink-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-gold-500"
                checked={askPrice}
                onChange={(e) => setAskPrice(e.target.checked)}
              />
              Show “Ask for Price / Ulizia Bei”
            </label>
          </div>
          {errors.price && <p className="mt-1.5 text-xs text-red-600">{errors.price}</p>}
        </fieldset>

        {/* Specs */}
        <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <legend className="label col-span-full">Specifications</legend>
          <Field label="Mileage (km)">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              value={form.mileageKm ?? ''}
              onChange={(e) => set('mileageKm', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="Engine">
            <input className="field" value={form.engine} onChange={(e) => set('engine', e.target.value)} placeholder="2.8L Diesel" />
          </Field>
          <Field label="Fuel">
            <select className="field" value={form.fuel} onChange={(e) => set('fuel', e.target.value as CarInput['fuel'])}>
              {['Petrol', 'Diesel', 'Hybrid', 'Electric'].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Transmission">
            <select
              className="field"
              value={form.transmission}
              onChange={(e) => set('transmission', e.target.value as CarInput['transmission'])}
            >
              <option>Automatic</option>
              <option>Manual</option>
            </select>
          </Field>
        </fieldset>

        <Field label="Description">
          <textarea
            className="field min-h-24"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Highlights, service history, extras…"
          />
        </Field>

        {/* Publishing */}
        <fieldset className="rounded-2xl border border-ink-900/10 bg-white p-4">
          <legend className="label px-1">Publishing</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Listing status">
            {CAR_STATUSES.map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold capitalize transition ${form.status === s ? 'border-gold-500 bg-gold-50 text-gold-700' : 'border-ink-900/10 text-ink-600 hover:border-ink-900/25'}`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={form.status === s}
                  onChange={() => set('status', s)}
                  className="sr-only"
                />
                {s}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Drafts stay private. Available and Reserved cars are prepared for the customer website.
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-gold-500"
              checked={form.featured}
              onChange={(e) => set('featured', e.target.checked)}
            />
            Feature this car at the top of the website
          </label>
        </fieldset>
      </form>
    </Sheet>
  )
}

function Field({
  label,
  error,
  className = '',
  children,
}: {
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}
