import { NextResponse } from 'next/server'
import { runPriceCheckForBooking } from '@/lib/price-checker'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    // Accept ?baseline=true from the booking-form to mark the initial snapshot
    const url = new URL(req.url)
    const isBaseline = url.searchParams.get('baseline') === 'true'
    const result = await runPriceCheckForBooking(params.id, { isBaseline })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
