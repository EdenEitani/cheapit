'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Booking, PriceCheck, Alert } from '@/lib/supabase'
import BottomNav from '@/components/bottom-nav'

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', ILS: '₪' }

type ProviderRow = { source: string; pricePerNight: number; totalPrice: number; url: string; isWatched: boolean }

function extractProviders(raw: Record<string, unknown> | null, nights: number, watchPlatforms: string[]): ProviderRow[] {
  if (!raw) return []
  try {
    const data = raw as any
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
  } catch { return [] }
}

function PriceDropWave() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg viewBox="0 0 400 120" className="absolute bottom-0 w-full" preserveAspectRatio="none">
        <path d="M0,60 C80,90 160,30 240,60 C320,90 360,45 400,60 L400,120 L0,120 Z" fill="#006e25" opacity="0.06" />
        <path d="M0,75 C60,55 120,85 200,70 C280,55 340,80 400,70 L400,120 L0,120 Z" fill="#006e25" opacity="0.04" />
      </svg>
    </div>
  )
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
  const [activeMonitoring, setActiveMonitoring] = useState(true)

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
    const bk = await bookingRes.json()
    setBooking(bk)
    setActiveMonitoring(bk.active)
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
        if (data.alerted) {
          setCheckResult({ text: `Price drop! ${sym}${Math.round(data.priceFound)}/night — Telegram alert sent.`, type: 'success' })
        } else if (ppn - data.priceFound > 0) {
          setCheckResult({ text: `Price drop found (${sym}${Math.round(data.priceFound)}/nt) but alert already sent today.`, type: 'success' })
        } else {
          setCheckResult({ text: `No cheaper price. Current: ${sym}${Math.round(data.priceFound)}/night.`, type: 'info' })
        }
      }
      const r = await fetch(`/api/bookings/${id}/price-checks`)
      setChecks(await r.json())
    } catch {
      setCheckResult({ text: 'Check failed.', type: 'error' })
    }
    setChecking(false)
  }

  async function toggleMonitoring() {
    const next = !activeMonitoring
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: next }),
    })
    setActiveMonitoring(next)
  }

  if (loading || !booking) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#001e40] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const sym = CURRENCY_SYMBOLS[booking.currency] ?? booking.currency
  const nights = Math.max(1, Math.round(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000
  ))
  const ppn = booking.price_paid / nights
  const latestCheck = checks[0]
  const latestPrice = latestCheck?.price_found ?? null
  const isCheaper = latestPrice != null && latestPrice < ppn
  const saving = isCheaper && latestPrice != null ? Math.round(ppn - latestPrice) : 0
  const refId = id.slice(0, 8).toUpperCase()

  const chartData = [...checks]
    .reverse()
    .filter((c) => c.price_found != null)
    .map((c) => ({
      date: format(parseISO(c.checked_at), 'd MMM'),
      price: Math.round(c.price_found!),
    }))

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">🐷</span>
            <span className="font-heading font-bold text-[#001e40] text-lg">Cheapit</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerCheck}
              disabled={checking}
              className="text-xs font-bold text-[#001e40]/60 hover:text-[#001e40] transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                {checking ? 'sync' : 'search'}
              </span>
              {checking ? 'Checking…' : 'Check'}
            </button>
            <Link
              href={`/bookings/${id}/edit`}
              className="text-xs font-bold text-[#001e40]/60 hover:text-[#001e40] transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit</span>
              Edit
            </Link>
            <div className="w-9 h-9 rounded-full bg-[#001e40]/8 flex items-center justify-center ml-1">
              <span className="material-symbols-outlined text-[#001e40]/40" style={{ fontSize: '1.3rem' }}>person</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5">
        {/* Back */}
        <Link href="/" className="flex items-center gap-1 text-gray-400 text-xs font-body mb-4 hover:text-[#001e40] transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>arrow_back</span>
          All Bookings
        </Link>

        {/* Check result */}
        {checkResult && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-body ${
            checkResult.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200'
            : checkResult.type === 'success' ? 'bg-[#006e25]/8 text-[#006e25] border border-[#006e25]/20'
            : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
              {checkResult.type === 'error' ? 'error' : checkResult.type === 'success' ? 'check_circle' : 'info'}
            </span>
            {checkResult.text}
          </div>
        )}

        {/* Hotel name — large */}
        <h1 className="font-heading font-extrabold text-[2rem] leading-tight text-[#001e40] mb-2">
          {booking.hotel_url ? (
            <a href={booking.hotel_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#003366]">
              {booking.hotel_name}
            </a>
          ) : booking.hotel_name}
        </h1>

        {/* Metadata */}
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-400 font-body">
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: '#94a3b8' }}>location_on</span>
            {booking.hotel_city}
            {booking.platform && ` · via ${booking.platform}`}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400 font-body">
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: '#94a3b8' }}>calendar_month</span>
            {format(parseISO(booking.check_in), 'd MMM')} — {format(parseISO(booking.check_out), 'd MMM yyyy')} · {nights}n · {booking.guests} guest{booking.guests > 1 ? 's' : ''}
          </div>
        </div>

        {/* REF + Monitoring toggle */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs font-bold text-[#001e40]/50 bg-[#001e40]/6 px-3 py-1.5 rounded-full tracking-widest">
            REF. #{refId}
          </span>
          <button
            onClick={toggleMonitoring}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 ml-1"
          >
            Daily Monitoring
            <div
              className={`w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${activeMonitoring ? 'bg-[#006e25]' : 'bg-gray-300'}`}
              style={{ height: '22px' }}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${activeMonitoring ? 'translate-x-4.5' : 'translate-x-0'}`}
                style={{ transform: activeMonitoring ? 'translateX(18px)' : 'translateX(0)' }} />
            </div>
          </button>
        </div>

        {/* Price Drop Card */}
        {isCheaper && latestPrice != null && (
          <div className="relative bg-white rounded-2xl border border-[#006e25]/20 overflow-hidden mb-4 p-5">
            <PriceDropWave />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold text-[#006e25] uppercase tracking-widest">Price Drop Detected</span>
                <span className="material-symbols-outlined text-[#006e25]" style={{ fontSize: '0.9rem' }}>trending_down</span>
              </div>
              <h2 className="font-heading font-extrabold text-2xl text-[#001e40] mb-1">
                Save {sym}{saving} right now
              </h2>
              <p className="text-sm text-gray-500 font-body mb-4">
                The price for your exact room type just dropped. You can rebook at the lower rate.
              </p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-gray-400 text-sm line-through font-body">{sym}{Math.round(ppn)} /night</span>
                <span className="font-heading font-extrabold text-3xl text-[#006e25]">{sym}{Math.round(latestPrice)}</span>
                <span className="text-[#006e25] text-sm font-body">/night</span>
              </div>
              {latestCheck?.url ? (
                <a
                  href={latestCheck.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 bg-[#001e40] hover:bg-[#003366] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                  Rebook Now &amp; Save {sym}{saving}
                </a>
              ) : (
                <div className="w-full h-12 bg-[#001e40]/10 text-[#001e40]/40 font-bold rounded-xl flex items-center justify-center gap-2 text-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                  Rebook Now &amp; Save {sym}{saving}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No drop yet — price summary card */}
        {!isCheaper && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-body">Your rate</p>
              <p className="font-heading font-bold text-2xl text-[#001e40]">{sym}{Math.round(ppn)}<span className="text-sm font-normal text-gray-400">/nt</span></p>
            </div>
            {latestPrice != null && (
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-body">Current market</p>
                <p className={`font-heading font-bold text-2xl ${latestPrice > ppn ? 'text-red-500' : 'text-gray-400'}`}>
                  {sym}{Math.round(latestPrice)}<span className="text-sm font-normal text-gray-400">/nt</span>
                </p>
              </div>
            )}
            {latestPrice == null && (
              <span className="text-xs text-gray-300 font-body">Not checked yet</span>
            )}
          </div>
        )}

        {/* Price trend chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-heading font-bold text-sm text-[#001e40]">Price Trend</p>
                {checks[0] && (
                  <p className="text-xs text-gray-400 font-body">
                    Last updated {format(parseISO(checks[0].checked_at), 'd MMM HH:mm')}
                  </p>
                )}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                chartData.length >= 5 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-[#006e25]'
              }`}>
                VOLATILITY {chartData.length >= 5 ? 'HIGH' : 'LOW'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#006e25" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#006e25" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${sym}${v}`} />
                <Tooltip
                  formatter={(v) => [`${sym}${Number(v)}`, 'Price']}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <ReferenceLine y={Math.round(ppn)} stroke="#ef4444" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="price" stroke="#006e25" strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 3, fill: '#006e25' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Hotel image placeholder */}
        <div className="relative h-44 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-slate-700 to-slate-900">
          <div className="absolute inset-0 flex items-center justify-center select-none">
            <span className="font-heading font-black text-white/10 leading-none" style={{ fontSize: '7rem' }}>
              {booking.hotel_name.charAt(0)}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-white/60 text-[10px] uppercase tracking-widest font-body">Your Rate</p>
            <p className="text-white font-heading font-bold text-xl">{sym}{Math.round(ppn)}<span className="text-sm font-normal text-white/60">/nt</span></p>
          </div>
        </div>

        {/* Stay details */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <p className="font-heading font-bold text-sm text-[#001e40] px-4 pt-4 pb-3 border-b border-gray-50">Stay Details</p>
          {[
            { icon: 'bed', label: 'Room Type', value: booking.room_description },
            { icon: 'group', label: 'Guests', value: `${booking.guests} Adult${booking.guests > 1 ? 's' : ''}` },
            {
              icon: 'event_available',
              label: 'Cancellation',
              value: booking.cancellation_deadline
                ? `Free until ${format(parseISO(booking.cancellation_deadline), 'd MMM yyyy')}`
                : 'Check your booking'
            },
            ...(booking.breakfast_included ? [{ icon: 'restaurant', label: 'Meals', value: 'Breakfast included' }] : []),
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide font-body">{label}</span>
              </div>
              <span className="text-sm text-[#001e40] font-body text-right max-w-[60%] truncate">{value}</span>
            </div>
          ))}
        </div>

        {/* Price check log */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
            <p className="font-heading font-bold text-sm text-[#001e40]">Price Check Log</p>
            <span className="text-xs text-gray-400 font-body">{checks.length} check{checks.length !== 1 ? 's' : ''}</span>
          </div>

          {checks.length === 0 ? (
            <div className="text-center py-10 text-gray-300 text-sm font-body">
              No checks yet — press "Check" or wait for the daily cron
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {checks.map((c) => {
                const rdRaw = c.room_description_found ?? ''
                const isFuzzy = rdRaw.startsWith('fuzzy::')
                const isExpanded = expandedCheck === c.id
                const providers = isExpanded ? extractProviders(c.raw_response, nights, booking.watch_platforms) : []

                return (
                  <div key={c.id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedCheck(isExpanded ? null : c.id)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        c.price_found == null ? 'bg-gray-300'
                        : c.is_cheaper ? 'bg-[#006e25]'
                        : c.price_found > ppn ? 'bg-red-400'
                        : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 grid grid-cols-3 gap-2 text-sm min-w-0">
                        <span className="text-gray-400 font-body text-xs">{format(parseISO(c.checked_at), 'd MMM HH:mm')}</span>
                        <span className="font-heading font-bold text-[#001e40] text-xs">
                          {c.price_found != null ? `${sym}${Math.round(c.price_found)}/nt` : '—'}
                        </span>
                        <span className={`text-xs font-bold text-right ${
                          c.price_found == null ? 'text-gray-300'
                          : c.is_cheaper ? 'text-[#006e25]'
                          : c.price_found > ppn ? 'text-red-400'
                          : 'text-gray-400'
                        }`}>
                          {c.price_found == null ? 'No result'
                          : c.is_cheaper ? '↓ Cheaper'
                          : c.price_found > ppn ? '↑ Higher'
                          : '= Same'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.price_found != null && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            isFuzzy ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {isFuzzy ? 'Fuzzy' : '✓'}
                          </span>
                        )}
                        {c.raw_response && (
                          <span className="material-symbols-outlined text-gray-300" style={{ fontSize: '0.9rem' }}>
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-[#f0f2f5] border-t border-gray-100 px-4 py-3">
                        {providers.length === 0 ? (
                          <p className="text-xs text-gray-400 font-body">No provider data in this snapshot.</p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">All providers found</p>
                            {providers.map((p, i) => (
                              <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl ${
                                p.isWatched ? 'bg-white border border-gray-100' : 'bg-white/60 border border-gray-100/50 opacity-60'
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  {!p.isWatched && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">not watched</span>}
                                  {p.url ? (
                                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[#001e40] hover:underline font-body">{p.source}</a>
                                  ) : (
                                    <span className="text-[#001e40] font-body">{p.source}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-heading font-bold ${p.pricePerNight < ppn ? 'text-[#006e25]' : 'text-[#001e40]'}`}>
                                    {sym}{Math.round(p.pricePerNight)}/nt
                                  </span>
                                  <span className="text-gray-400 font-body">{sym}{p.totalPrice} total</span>
                                </div>
                              </div>
                            ))}
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
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
            <p className="font-heading font-bold text-sm text-[#001e40] px-4 py-3.5 border-b border-gray-50 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006e25]" style={{ fontSize: '1rem' }}>notifications</span>
              Alerts Sent
            </p>
            <div className="divide-y divide-gray-50">
              {alerts.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-xs text-gray-400 font-body mb-1">{format(parseISO(a.sent_at), 'd MMM yyyy HH:mm')}</p>
                  <pre className="whitespace-pre-wrap font-body text-sm text-[#001e40]/70">{a.telegram_message}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Full Receipt */}
        <button className="w-full text-sm font-bold text-[#001e40]/40 py-4 hover:text-[#001e40]/60 transition-colors font-body border border-dashed border-gray-200 rounded-2xl mb-2">
          View Full Receipt
        </button>

        {/* Support */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-[#001e40]/8 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#001e40]/40" style={{ fontSize: '1.2rem' }}>support_agent</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#001e40] font-body">Need assistance?</p>
            <p className="text-xs text-gray-400 font-body">Our concierge is available 24/7</p>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
