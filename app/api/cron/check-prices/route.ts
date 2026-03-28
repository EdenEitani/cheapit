import { NextResponse } from 'next/server'
import { runPriceChecks, checkCancellationDeadlines } from '@/lib/price-checker'

export const maxDuration = 300 // 5 minutes

async function run() {
  // Both jobs run in parallel — price checks and deadline reminders are independent
  const [priceResult, deadlineResult] = await Promise.allSettled([
    runPriceChecks(),
    checkCancellationDeadlines(),
  ])

  return {
    prices: priceResult.status === 'fulfilled'
      ? priceResult.value
      : { error: priceResult.reason?.message },
    deadlines: deadlineResult.status === 'fulfilled'
      ? deadlineResult.value
      : { error: deadlineResult.reason?.message },
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await run())
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return GET(req)
}
