import { useEffect, useState, type FormEvent } from 'react'
import { ErrorNote, Sheet } from './ui'
import type { CustomerInput } from '../lib/store'
import { CUSTOMER_SOURCES, CUSTOMER_STATUSES, type Car, type Customer } from '../lib/types'
import { carTitle, sourceLabel } from '../lib/format'

const EMPTY: CustomerInput = {
  name: '',
  phone: '+255 ',
  email: '',
  source: 'whatsapp',
  status: 'new',
  interestedCarId: null,
  request: '',
  budget: null,
  notes: '',
}

export function CustomerEditor({
  open,
  customer,
  cars,
  onClose,
  onSave,
}: {
  open: boolean
  customer: Customer | null
  cars: Car[]
  onClose: () => void
  onSave: (input: CustomerInput, id?: string) => Promise<void>
}) {
  const [form, setForm] = useState<CustomerInput>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(customer ? { ...EMPTY, ...customer } : EMPTY)
    setErrors({})
    setSaving(false)
    setSaveError(null)
  }, [open, customer])

  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Name is required'
    if (form.phone.replace(/\D/g, '').length < 9) next.phone = 'Enter a valid phone number'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(
        { ...form, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
        customer?.id,
      )
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'Add customer'}
      subtitle={customer ? customer.name : 'Record a new lead or buyer'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="customer-form" className="btn-gold" disabled={saving}>
            {saving ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={(e) => void submit(e)} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {saveError && (
          <div className="sm:col-span-2">
            <ErrorNote>{saveError}</ErrorNote>
          </div>
        )}
        <Field label="Full name" error={errors.name} className="sm:col-span-2">
          <input className="field" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Phone / WhatsApp" error={errors.phone}>
          <input className="field" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email (optional)" error={errors.email}>
          <input className="field" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Source">
          <select className="field" value={form.source} onChange={(e) => set('source', e.target.value as CustomerInput['source'])}>
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className="field capitalize" value={form.status} onChange={(e) => set('status', e.target.value as CustomerInput['status'])}>
            {CUSTOMER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Interested in" className="sm:col-span-2">
          <select
            className="field"
            value={form.interestedCarId ?? ''}
            onChange={(e) => set('interestedCarId', e.target.value || null)}
          >
            <option value="">— No specific car —</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {carTitle(c)} ({c.status})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Car sourcing request" className="sm:col-span-2">
          <input
            className="field"
            value={form.request}
            onChange={(e) => set('request', e.target.value)}
            placeholder="Make, model, year, colour they want us to find"
          />
        </Field>
        <Field label="Budget (TSh)">
          <input
            className="field"
            type="number"
            inputMode="numeric"
            value={form.budget ?? ''}
            onChange={(e) => set('budget', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="field min-h-24" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
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
