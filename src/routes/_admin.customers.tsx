import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { ConfirmDialog, Initials, PageHeader, Pill, Toast } from '../components/ui'
import { CustomerEditor } from '../components/CustomerEditor'
import { useInventory, type CustomerInput } from '../lib/store'
import { CUSTOMER_STATUSES, type Customer, type CustomerStatus } from '../lib/types'
import {
  carTitle,
  customerStatusStyle,
  formatCompactTzs,
  relativeDay,
  sourceLabel,
  whatsappLink,
} from '../lib/format'

type CustomersSearch = { new?: boolean; edit?: string }

export const Route = createFileRoute('/_admin/customers')({
  head: () => ({ meta: [{ title: 'Customers · Royal Motors Admin' }] }),
  validateSearch: (s: Record<string, unknown>): CustomersSearch => ({
    new: s.new === true || s.new === 'true' ? true : undefined,
    edit: typeof s.edit === 'string' ? s.edit : undefined,
  }),
  component: CustomersPage,
})

type Filter = 'all' | CustomerStatus

function CustomersPage() {
  const { customers, cars, saveCustomer, deleteCustomer } = useInventory()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/customers' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [toDelete, setToDelete] = useState<Customer | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const editing = search.edit ? (customers.find((c) => c.id === search.edit) ?? null) : null
  const closeEditor = useCallback(() => navigate({ search: {} }), [navigate])
  const clearToast = useCallback(() => setToast(null), [])
  const clearFailure = useCallback(() => setFailure(null), [])

  const carName = (id: string | null) => {
    const car = id ? cars.find((c) => c.id === id) : undefined
    return car ? carTitle(car) : null
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...customers]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter(
        (c) =>
          (filter === 'all' || c.status === filter) &&
          (!q || `${c.name} ${c.phone} ${c.email} ${c.request}`.toLowerCase().includes(q)),
      )
  }, [customers, query, filter])

  const counts = useMemo(() => {
    const m = { all: customers.length } as Record<Filter, number>
    for (const s of CUSTOMER_STATUSES) m[s] = 0
    for (const c of customers) m[c.status]++
    return m
  }, [customers])

  const onSave = async (input: CustomerInput, id?: string) => {
    const saved = await saveCustomer(input, id)
    closeEditor()
    setToast(id ? `${saved.name} updated` : `${saved.name} added`)
  }

  const interest = (c: Customer) => carName(c.interestedCarId) ?? (c.request || 'General enquiry')

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Customers"
        description="Every enquiry, sourcing request and buyer in one place. Reply on WhatsApp in one tap."
        action={
          <button type="button" className="btn-gold self-start sm:self-auto" onClick={() => navigate({ search: { new: true } })}>
            <Plus className="h-4 w-4" /> Add customer
          </button>
        }
      />

      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500/60" />
          <input
            type="search"
            className="field pl-9"
            placeholder="Search name, phone, request…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Status">
          {(['all', ...CUSTOMER_STATUSES] as Filter[]).map((f) => (
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
        <div className="card px-6 py-16 text-center">
          <p className="font-semibold text-ink-900">No customers found</p>
          <p className="mt-1 text-sm text-ink-500">Try another search or status.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-900/[0.06] bg-ink-900/[0.02] text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Interested in</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Budget</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/[0.06]">
                {visible.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-900/[0.015]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Initials name={c.name} />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink-900">{c.name}</p>
                          <p className="text-xs text-ink-500">
                            {c.phone} · {sourceLabel[c.source]} · {relativeDay(c.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[240px] px-3 py-3 text-ink-700">
                      <p className="truncate">{interest(c)}</p>
                      {c.notes && <p className="truncate text-xs text-ink-500">{c.notes}</p>}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-ink-700">
                      {c.budget ? formatCompactTzs(c.budget) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <Pill className={customerStatusStyle[c.status]}>{c.status}</Pill>
                    </td>
                    <td className="px-5 py-3">
                      <RowActions c={c} onEdit={() => navigate({ search: { edit: c.id } })} onDelete={() => setToDelete(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((c) => (
              <li key={c.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <Initials name={c.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink-900">{c.name}</p>
                      <Pill className={customerStatusStyle[c.status]}>{c.status}</Pill>
                    </div>
                    <p className="text-xs text-ink-500">
                      {sourceLabel[c.source]} · {relativeDay(c.createdAt)}
                    </p>
                    <p className="mt-2 text-sm text-ink-700">{interest(c)}</p>
                    {c.budget ? (
                      <p className="text-xs text-ink-500">Budget {formatCompactTzs(c.budget)}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 border-t border-ink-900/[0.06] pt-3">
                  <RowActions c={c} onEdit={() => navigate({ search: { edit: c.id } })} onDelete={() => setToDelete(c)} wide />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <CustomerEditor
        open={Boolean(search.new || editing)}
        customer={editing}
        cars={cars}
        onClose={closeEditor}
        onSave={onSave}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this customer?"
        body={<>{toDelete?.name} and their notes will be permanently removed.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const customer = toDelete
          setToDelete(null)
          if (!customer) return
          deleteCustomer(customer.id).then(
            () => setToast(`${customer.name} deleted`),
            (err: unknown) => setFailure(err instanceof Error ? err.message : String(err)),
          )
        }}
      />
      <Toast message={toast} onDone={clearToast} />
      <Toast message={failure} onDone={clearFailure} tone="error" />
    </>
  )
}

function RowActions({
  c,
  onEdit,
  onDelete,
  wide,
}: {
  c: Customer
  onEdit: () => void
  onDelete: () => void
  wide?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 ${wide ? '' : 'justify-end'}`}>
      <a
        href={whatsappLink(c.phone, `Habari ${c.name.split(' ')[0]}, this is ROYAL MOTORS.`)}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:brightness-95 ${wide ? 'flex-1' : ''}`}
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <button type="button" className="btn-ghost !px-2.5 !py-1.5" onClick={onEdit} aria-label={`Edit ${c.name}`}>
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="btn-ghost !px-2.5 !py-1.5 text-red-600 hover:!border-red-300 hover:!bg-red-50"
        onClick={onDelete}
        aria-label={`Delete ${c.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
