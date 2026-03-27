import { NextResponse } from 'next/server'
import { runPriceCheckForBooking } from '@/lib/price-checker'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const result = await runPriceCheckForBooking(params.id)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
