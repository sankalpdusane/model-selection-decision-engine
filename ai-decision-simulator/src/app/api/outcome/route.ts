import { NextRequest, NextResponse } from 'next/server'
import { insertCalibration, getCalibrationStats } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, actual_outcome_rating, actual_outcome_notes } = body
    if (!session_id || !actual_outcome_rating || actual_outcome_rating < 1 || actual_outcome_rating > 5) {
      return NextResponse.json(
        { error: 'session_id and actual_outcome_rating (1-5) are required' },
        { status: 400 }
      )
    }
    insertCalibration({
      session_id,
      scenario_summary: '',
      predicted_confidence: 0,
      actual_outcome_rating,
      actual_outcome_notes: actual_outcome_notes || '',
    })
    const stats = getCalibrationStats()
    return NextResponse.json({ success: true, stats })
  } catch (err) {
    console.error('Outcome route error:', err)
    return NextResponse.json({ error: 'Failed to log outcome' }, { status: 500 })
  }
}
