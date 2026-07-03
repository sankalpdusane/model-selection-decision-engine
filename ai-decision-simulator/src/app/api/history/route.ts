import { NextResponse } from 'next/server'
import { getRecentDecisions, getCalibrationStats } from '@/lib/db'

export async function GET() {
  try {
    const decisions = getRecentDecisions(8)
    const stats = getCalibrationStats()
    return NextResponse.json({ decisions, stats })
  } catch (err) {
    console.error('History route error:', err)
    return NextResponse.json({ decisions: [], stats: null })
  }
}
