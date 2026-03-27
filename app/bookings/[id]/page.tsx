'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Booking, PriceCheck, Alert } from '@/lib/supabase'

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', ILS: '₪',
}

type ProviderRow = {
  source: string
  pricePerNight: number
  totalPrice: number
  url: string
  isWatched: boolean
}

function extractProviders(rawResponse: Record<string, unknown> | null, nights: number, watchPlatforms: string[]): ProviderRow[] {
  if (!rawResponse) return []
  try {
    const data = rawResponse as any
    let rawPrices: any[] = []
    if (data.type === 'hotel') {
      rawPrices = data.featured_prices ?? []
    } else if (Array.isArray(data.properties) && data.properties.length > 0) {
      const prop = data.properties[0]
      rawPrices = prop.prices ?? prop.featured_prices ?? []
    }
    const watchSet = watchPlatforms.map((p: string) => p.toLowerCase())
    return rawPrices
      .map((r: any) => {
        const ppn: number = r.rate_per_night?.extracted_lowest ?? (r.price ?? 0) / nights
        const total: number = r.total_rate?.extracted_lowest ?? ppn * nights
        const source: string = r.source ?? r.provider ?? 'Unknown'
        const isWatched = watchSet.some((p: string) => source.toLowerCase().includes(p))
        return { source, pricePerNight: Math.round(ppn * 100) / 100, totalPrice: Math.round(total), url: r.link ?? '', isWatched }
      })
      .filter((p: ProviderRow) => p.pricePerNight > 0)
      .sort((a: ProviderRow, b: ProviderRow) => a.pricePerNight - b.pricePerNight)
  } catch {
    return []
  }
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [checks, setChecks] = useState<PriceCheck[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [bookingRes, checksRes, alertsRes] = await Promise.all([
      fetch(`/api/bookings/${id}`),
      fetch(`/api/bookings/${id}/price-checks`),
      fetch(`/api/bookings/${id}/alerts`),
    ])
    if (!bookingRes.ok) { router.push('/'); return }
    setBooking(await bookingRes.json())
    setChecks(await checksRes.json())
    setAlerts(await alertsRes.json())
    setLoading(false)
  }

  async function triggerCheck() {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await fetch(`/api/bookings/${id}/check`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setCheckResult({ text: `Error: ${data.error}`, type: 'error' })
      } else if (data.priceFound == null) {
        setCheckResult({ text: 'No price found for this hotel/dates.', type: 'info' })
      } else {
        const sym = CURRENCY_SYMBOLS[booking!.currency] ?? booking!.currency
        const nights = Math.max(1, Math.round(
          (new Date(booking!.check_out).getTime() - new Date(booking!.check_in).getTime()) / 86400000
        ))
        const ppn = booking!.price_paid / nights
        const diff = ppn - data.priceFound
        if (data.alerted) {
          setCheckResult({ text: `Price drop found! ${sym}${Math.round(data.priceFound)}/night — Telegram alert sent.`, type: 'success' })
        } else if (diff > 0) {
          setCheckResult({ text: `Price drop found (${sym}${Math.round(data.priceFound)}/night) but alert already sent today.`, type: 'success' })
        } else {
          setCheckResult({ text: `No cheaper price found. Current: ${sym}${Math.round(data.priceFound)}/night.`, type: 'info' })
        }
      }
      const checksRes = await fetch(`/api/bookings/${id}/price-checks`)
      setChecks(await checksRes.json())
    } catch {
      setCheckResult({ text: 'Check failed — see console.', type: 'error' })
    }
    setChecking(false)
  }

  if (loading || !booking) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sym = CURRENCY_SYMBOLS[booking.currency] ?? booking.currency
  const nights = Math.max(1, Math.round(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
  ))
  const ppn = booking.price_paid / nights

  const chartData = [...checks]
    .reverse()
    .filter((c) => c.price_found != null)
    .map((c) => ({
      date: format(parseISO(c.checked_at), 'd MMM HH:mm'),
      price: Math.round(c.price_found!),
    }))

  const latestCheck = checks[0]
  const latestStatus = latestCheck?.price_found != null
    ? latestCheck.price_found < ppn ? 'cheaper'
      : latestCheck.price_found > ppn ? 'higher'
      : 'same'
    : 'unknown'

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-navy text-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>
            All bookings
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerCheck}
              disabled={checking}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {checking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>search</span>
                  Check now
                </>
              )}
            </button>
            <Link
              href={`/bookings/${id}/edit`}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
              Edit
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Check result banner */}
        {checkResult && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
            checkResult.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : checkResult.type === 'success'
              ? 'bg-forest/5 border-forest/30 text-forest'
              : 'bg-surface border-border text-muted-foreground'
          }`}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
              {checkResult.type === 'error' ? 'error' : checkResult.type === 'success' ? 'check_circle' : 'info'}
            </span>
            {checkResult.text}
          </div>
        )}

        {/* Hotel hero card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-2xl text-navy mb-0.5">
                {booking.hotel_url ? (
                  <a href={booking.hotel_url} target="_blank" rel="noopener noreferrer" className="hover:text-navy-light transition-colors inline-flex items-center gap-1">
                    {booking.hotel_name}
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
                  </a>
                ) : booking.hotel_name}
              </h1>
              <p className="text-muted-foreground mb-1">{booking.hotel_city}</p>
              <p className="text-sm text-navy/70 mb-4">{booking.room_description}</p>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted-foreground rounded-full px-3 py-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>calendar_month</span>
                  {format(parseISO(booking.check_in), 'd MMM yyyy')} → {format(parseISO(booking.check_out), 'd MMM yyyy')}
                  <span className="text-muted-foreground/60 ml-0.5">({nights}n)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted-foreground rounded-full px-3 py-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>group</span>
                  {booking.guests} guest{booking.guests > 1 ? 's' : ''}
                </span>
                {booking.breakfast_included && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 rounded-full px-3 py-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>restaurant</span>
                    Breakfast incl.
                  </span>
                )}
                {booking.platform && (
                  <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted-foreground rounded-full px-3 py-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>storefront</span>
                    {booking.platform}
                  </span>
                )}
                {booking.cancellation_deadline && (
                  <span className="inline-flex items-center gap-1 text-xs bg-surface text-muted-foreground rounded-full px-3 py-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>event_busy</span>
                    Cancel by {format(parseISO(booking.cancellation_deadline), 'd MMM yyyy HH:mm')}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground mb-0.5">You paid (total)</div>
              <div className="font-heading font-bold text-3xl text-navy">{sym}{Math.round(booking.price_paid)}</div>
              <div className="text-sm text-muted-foreground">{sym}{Math.round(ppn)} / night</div>
              {latestCheck?.price_found != null && (
                <div className={`mt-2 text-sm font-semibold ${latestStatus === 'cheaper' ? 'text-forest' : latestStatus === 'higher' ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {latestStatus === 'cheaper' ? '↓ ' : latestStatus === 'higher' ? '↑ ' : '= '}
                  {sym}{Math.round(latestCheck.price_found)} now
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price history chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-4">
            <h2 className="font-heading font-semibold text-navy text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-navy/60" style={{ fontSize: '1.1rem' }}>show_chart</span>
              Price history (per night)
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={55} tickFormatter={(v) => `${sym}${v}`} />
                <Tooltip
                  formatter={(v) => [`${sym}${Number(v)}`, 'Price found']}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <ReferenceLine
                  y={Math.round(ppn)}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `Paid ${sym}${Math.round(ppn)}`, position: 'right', fontSize: 11, fill: '#ef4444' }}
                />
                <Line type="monotone" dataKey="price" stroke="#001e40" dot={{ r: 3 }} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Price check log */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-semibold text-navy text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-navy/60" style={{ fontSize: '1.1rem' }}>history</span>
              Price check log
            </h2>
            <span className="text-xs text-muted-foreground">{checks.length} check{checks.length !== 1 ? 's' : ''}</span>
          </div>

          {checks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <span className="material-symbols-outlined block mb-2 text-navy/20" style={{ fontSize: '2.5rem' }}>search_off</span>
              No checks yet — press "Check now" or wait for the daily cron
            </div>
          ) : (
            <div className="divide-y divide-border">
              {checks.map((c) => {
                const rdRaw = c.room_description_found ?? ''
                const isFuzzy = rdRaw.startsWith('fuzzy::')
                const hotelFound = rdRaw.includes('::') ? rdRaw.split('::')[1] : rdRaw
                const isPriceFound = c.price_found != null
                const isCheaper = c.is_cheaper
                const isExpanded = expandedCheck === c.id

                const providers = isExpanded
                  ? extractProviders(c.raw_response, nights, booking.watch_platforms)
                  : []

                return (
                  <div key={c.id}>
                    <div
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface cursor-pointer transition-colors"
                      onClick={() => setExpandedCheck(isExpanded ? null : c.id)}
                    >
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        !isPriceFound ? 'bg-muted-foreground/30'
                        : isCheaper ? 'bg-forest'
                        : c.price_found! > ppn ? 'bg-red-400'
                        : 'bg-muted-foreground/50'
                      }`} />

                      <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                        <span className="text-sm text-muted-foreground font-body">
                          {format(parseISO(c.checked_at), 'd MMM yyyy HH:mm')}
                        </span>
                        <span className="text-sm font-semibold text-navy">
                          {isPriceFound ? `${sym}${Math.round(c.price_found!)}` : '—'}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          {c.platform_found ?? '—'}
                        </span>
                        <div className="flex items-center gap-2">
                          {isPriceFound && (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                              isFuzzy
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`} title={isFuzzy ? `Found: "${hotelFound}" — may not be the same hotel` : `Matched: ${hotelFound}`}>
                              {isFuzzy ? '⚠ Fuzzy' : '✓ Match'}
                            </span>
                          )}
                          {!isPriceFound ? (
                            <span className="text-xs text-muted-foreground">No result</span>
                          ) : isCheaper ? (
                            <span className="text-xs font-semibold text-forest">↓ Cheaper</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{c.price_found! > ppn ? '↑ Higher' : '= Same'}</span>
                          )}
                        </div>
                      </div>

                      {c.raw_response && (
                        <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: '1rem' }}>
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      )}
                    </div>

                    {/* Expanded providers */}
                    {isExpanded && (
                      <div className="bg-surface border-t border-border px-5 py-4">
                        {providers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No provider data in this snapshot.</p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-navy/60 uppercase tracking-wide mb-3">All providers found</p>
                            <div className="grid gap-2">
                              {providers.map((p, i) => (
                                <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded-xl border ${
                                  p.isWatched ? 'bg-white border-border' : 'bg-surface border-border/50 opacity-70'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    {!p.isWatched && (
                                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">not watched</span>
                                    )}
                                    {p.url ? (
                                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-navy hover:text-navy-light hover:underline transition-colors">
                                        {p.source}
                                      </a>
                                    ) : (
                                      <span className="text-navy">{p.source}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`font-semibold ${p.pricePerNight < ppn ? 'text-forest' : 'text-navy'}`}>
                                      {sym}{Math.round(p.pricePerNight)}/night
                                    </span>
                                    <span className="text-muted-foreground text-xs">{sym}{p.totalPrice} total</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-navy text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-forest" style={{ fontSize: '1.1rem' }}>notifications</span>
                Alerts sent
              </h2>
            </div>
            <div className="divide-y divide-border">
              {alerts.map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    {format(parseISO(a.sent_at), 'd MMM yyyy HH:mm')}
                  </div>
                  <pre className="whitespace-pre-wrap font-body text-sm text-navy/80">{a.telegram_message}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
