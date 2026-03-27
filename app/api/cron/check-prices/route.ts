import { NextResponse } from 'next/server'
import { runPriceChecks } from '@/lib/price-checker'

export const maxDuration = 300 // 5 minutes

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runPriceChecks()
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Also allow POST for manual triggers
export async function POST(req: Request) {
  return GET(req)
}
