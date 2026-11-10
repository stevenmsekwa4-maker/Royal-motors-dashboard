import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  ArrowUpRight,
  CarFront,
  CircleDollarSign,
  Globe,
  MessageCircle,
  Plus,
  Tag,
} from 'lucide-react'
import { Initials, PageHeader, Pill } from '../components/ui'
import { CUSTOMER_SITE_URL } from '../components/AdminShell'
import { useInventory } from '../lib/store'
import {
  carStatusStyle,
  carTitle,
  customerStatusStyle,
  formatCompactTzs,
  formatPrice,
  photoSrc,
  relativeDay,
  sourceLabel,
} from '../lib/format'
import { CAR_STATUSES } from '../lib/types'

export const Route = createFileRoute('/_admin/dashboard')({
  head: () => ({ meta: [{ title: 'Overview · Royal Motors Admin' }] }),
  component: Overview,
})

function Overview() {
  const { cars, customers } = useInventory()
  const { admin } = Route.useRouteContext()

  const stats = useMemo(() => {
    const live = cars.filter((c) => c.status === 'available')
    return {
      live: live.length,
      reserved: cars.filter((c) => c.status === 'reserved').length,
      value: live.reduce((sum, c) => sum + (c.price ?? 0), 0),
      unpriced: live.filter((c) => c.price == null).length,
      newLeads: customers.filter((c) => c.status === 'new').length,
      open: customers.filter((c) => ['new', 'contacted', 'negotiating'].includes(c.status))
        .length,
    }
  }, [cars, customers])

  const byStatus = CAR_STATUSES.map((s) => ({
    status: s,
    count: cars.filter((c) => c.status === s).length,
  }))
  const maxStatus = Math.max(1, ...byStatus.map((s) => s.count))

  const recentCars = [...cars]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4)
  const recentLeads = [...customers]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return (
    <>
      <PageHeader
        eyebrow={`Habari, ${admin.name.split(/\s+/)[0]}`}
        title="Showroom overview"
        description="A snapshot of your inventory and customer pipeline."
        action={
          <Link to="/cars" search={{ new: true }} className="btn-gold self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Add a car
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={CarFront} label="Live listings" value={String(stats.live)} note="Visible on website" />
        <Stat icon={Tag} label="Reserved" value={String(stats.reserved)} note="Awaiting deposit" />
        <Stat
          icon={CircleDollarSign}
          label="Stock value"
          value={formatCompactTzs(stats.value)}
          note={stats.unpriced ? `${stats.unpriced} on “Ask for Price”` : 'All live cars priced'}
        />
        <Stat
          icon={MessageCircle}
          label="New leads"
          value={String(stats.newLeads)}
          note={`${stats.open} open conversations`}
          highlight
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-bold text-ink-900">Recently updated cars</h2>
            <Link to="/cars" className="text-sm font-semibold text-gold-700 hover:underline">
              All cars
            </Link>
          </div>
          {recentCars.length === 0 && (
            <p className="px-5 pb-6 pt-4 text-sm text-ink-500">No cars in the database yet.</p>
          )}
          <ul className="mt-3 divide-y divide-ink-900/[0.06]">
            {recentCars.map((car) => (
              <li key={car.id}>
                <Link
                  to="/cars"
                  search={{ edit: car.id }}
                  className="flex items-center gap-4 px-5 py-3 transition hover:bg-ink-900/[0.02]"
                >
                  {car.photos[0] ? (
                    <img
                      src={photoSrc(car.photos[0], 200)}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-lg bg-ink-900/5 object-cover"
                    />
                  ) : (
                    <span className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-ink-900/5 text-[10px] font-semibold text-ink-500">
                      No photo
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">{carTitle(car)}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{formatPrice(car.price)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill className={carStatusStyle[car.status]}>{car.status}</Pill>
                    <span className="text-xs text-ink-500">{relativeDay(car.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-bold text-ink-900">Inventory by status</h2>
            <ul className="mt-4 space-y-3">
              {byStatus.map(({ status, count }) => (
                <li key={status} className="grid grid-cols-[84px_1fr_24px] items-center gap-3 text-sm">
                  <span className="capitalize text-ink-600">{status}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-ink-900/[0.06]">
                    <span
                      className="block h-full rounded-full bg-gold-500"
                      style={{ width: `${(count / maxStatus) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-ink-900">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-ink-900 p-5 text-white">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/15 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-gold-300">
                <Globe className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Customer website</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Cars marked <strong className="text-white">Available</strong> or{' '}
                <strong className="text-white">Reserved</strong> are prepared for your
                public site. They are saved in Supabase, so once the website reads from
                the same tables, prices and photos you change here appear there.
              </p>
              <a
                href={CUSTOMER_SITE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300 hover:text-gold-100"
              >
                royal-motor.netlify.app <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </section>
        </div>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-bold text-ink-900">Latest customer leads</h2>
          <Link to="/customers" className="text-sm font-semibold text-gold-700 hover:underline">
            All customers
          </Link>
        </div>
        {recentLeads.length === 0 && (
          <p className="px-5 pb-6 pt-4 text-sm text-ink-500">No customers in the database yet.</p>
        )}
        <ul className="mt-3 divide-y divide-ink-900/[0.06]">
          {recentLeads.map((c) => {
            const car = cars.find((x) => x.id === c.interestedCarId)
            return (
              <li key={c.id}>
                <Link
                  to="/customers"
                  search={{ edit: c.id }}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-ink-900/[0.02]"
                >
                  <Initials name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">{c.name}</p>
                    <p className="truncate text-sm text-ink-500">
                      {car ? carTitle(car) : c.request || 'General enquiry'}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-ink-500 sm:block">
                    {sourceLabel[c.source]}
                    <br />
                    {relativeDay(c.createdAt)}
                  </div>
                  <Pill className={customerStatusStyle[c.status]}>{c.status}</Pill>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  highlight,
}: {
  icon: typeof CarFront
  label: string
  value: string
  note: string
  highlight?: boolean
}) {
  return (
    <div className={`card p-4 sm:p-5 ${highlight ? 'ring-1 ring-gold-500/40' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
        <Icon className="h-4 w-4 text-gold-600" />
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 tabular-nums sm:text-[28px]">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-500">{note}</p>
    </div>
  )
}
