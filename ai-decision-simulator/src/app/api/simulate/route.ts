import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { randomUUID } from 'crypto'
import { insertDecision, getRecentDecisions } from '@/lib/db'

import { DECISION_SYSTEM_PROMPT } from '@/lib/prompts'
import { checkRateLimit } from '@/lib/rateLimit'
import {
  generateCacheKey,
  getCached,
  setCached,
  SIMULATION_TTL_MS,
} from '@/lib/cache'
import type { SimulationRequest, SimulationResult, StrategicOption } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_URGENCY = ['low', 'medium', 'high', 'critical'] as const
type Urgency = (typeof VALID_URGENCY)[number]

function isValidUrgency(value: unknown): value is Urgency {
  return VALID_URGENCY.includes(value as Urgency)
}

/** Pause execution for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Validates the raw parsed JSON from the Groq response.
 * Returns the corrected SimulationResult or null if unrecoverable.
 */
function validateAndCorrect(raw: unknown): Omit<SimulationResult, 'evaluated_at' | 'cached'> | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>

  // Required top-level string fields
  if (
    typeof obj.scenario_summary !== 'string' ||
    typeof obj.recommended_option_id !== 'string' ||
    typeof obj.recommendation_rationale !== 'string' ||
    typeof obj.key_tradeoff !== 'string'
  ) {
    return null
  }

  // options must be an array of exactly 3
  if (!Array.isArray(obj.options) || obj.options.length !== 3) return null

  const options = obj.options as Record<string, unknown>[]

  // Validate each option has the required fields
  for (const opt of options) {
    if (
      typeof opt.id !== 'string' ||
      typeof opt.title !== 'string' ||
      typeof opt.approach !== 'string' ||
      !Array.isArray(opt.pros) ||
      !Array.isArray(opt.cons) ||
      !Array.isArray(opt.risks) ||
      typeof opt.estimated_timeline !== 'string' ||
      typeof opt.confidence_score !== 'number'
    ) {
      return null
    }
  }

  // Verify / auto-correct the recommended flag
  const targetId = obj.recommended_option_id as string
  const matchingOption = options.find((o) => o.id === targetId)
  if (!matchingOption) return null

  // Ensure exactly one option has recommended = true and it matches recommended_option_id
  for (const opt of options) {
    opt.recommended = opt.id === targetId
  }

  return {
    scenario_summary: obj.scenario_summary as string,
    options: options as unknown as StrategicOption[],
    recommended_option_id: targetId,
    recommendation_rationale: obj.recommendation_rationale as string,
    key_tradeoff: obj.key_tradeoff as string,
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step A: Parse and validate ──────────────────────────────────────────

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { context, constraint, stakeholders } = body as Record<string, unknown>
  let { urgency } = body as Record<string, unknown>

  if (typeof context !== 'string' || context.trim().length < 20) {
    return NextResponse.json(
      { error: 'Context too short, describe the situation in more detail.' },
      { status: 400 }
    )
  }

  if (typeof constraint !== 'string' || constraint.trim().length < 10) {
    return NextResponse.json(
      { error: 'Please specify the hard constraint you are working within.' },
      { status: 400 }
    )
  }

  const stakeholdersStr = typeof stakeholders === 'string' ? stakeholders : ''
  const totalLength =
    context.length + constraint.length + stakeholdersStr.length

  if (totalLength > 4000) {
    return NextResponse.json(
      { error: 'Scenario too long, keep it under 4000 characters total.' },
      { status: 400 }
    )
  }

  if (!isValidUrgency(urgency)) {
    urgency = 'medium'
  }

  const scenario: SimulationRequest = {
    context: context.trim(),
    constraint: constraint.trim(),
    stakeholders: stakeholdersStr.trim(),
    urgency: urgency as Urgency,
  }

  // ── Step B: Rate limiting ────────────────────────────────────────────────

  const rawIp = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const ip = rawIp.split(',')[0].trim()

  const rateResult = checkRateLimit(ip)
  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Please wait ${rateResult.retryAfter} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateResult.retryAfter),
        },
      }
    )
  }

  // ── Step C: Cache check ──────────────────────────────────────────────────

  const cacheKey = generateCacheKey(scenario)
  const cached = getCached<SimulationResult>(cacheKey)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true }, { status: 200 })
  }

  // ── Step D: Groq call with retry ─────────────────────────────────────────

  const recentDecisions = getRecentDecisions(5)
  let memoryContext = ''
  if (recentDecisions.length > 0) {
    memoryContext = 'CONTEXT FROM SIMILAR PAST DECISIONS:\n' +
      recentDecisions.map((d: any) =>
        `- "${d.scenario_summary}" → Recommended: ${d.recommended_option_title} (confidence: ${d.confidence_score}%)${d.has_outcome ? ' [outcome logged]' : ''}`
      ).join('\n') + '\n\nIf any past decision above is relevant to the current scenario, reference it explicitly in your recommendation rationale.'
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const userMessage = `
SCENARIO CONTEXT:
${scenario.context}

HARD CONSTRAINT:
${scenario.constraint}

KEY STAKEHOLDERS:
${scenario.stakeholders || 'Not specified'}

URGENCY LEVEL:
${scenario.urgency}
${memoryContext ? `
${memoryContext}` : ''}
`.trim()

  const MAX_ATTEMPTS = 3
  let validResult: Omit<SimulationResult, 'evaluated_at' | 'cached'> | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: DECISION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      })

      const rawContent = completion.choices[0]?.message?.content ?? ''

      // ── Step E: Parse and validate response ────────────────────────────

      let parsed: unknown
      try {
        parsed = JSON.parse(rawContent)
      } catch (parseErr) {
        console.error(`[simulate] Attempt ${attempt}: JSON parse failed`, parseErr)
        if (attempt < MAX_ATTEMPTS) {
          await sleep(1000)
          continue
        }
        break
      }

      validResult = validateAndCorrect(parsed)
      if (validResult) {
        const session_id = randomUUID()
        try {
          insertDecision({
            session_id,
            scenario_summary: (parsed as any).scenario_summary,
            context: scenario.context,
            recommended_option_title: (parsed as any).options?.find((o: any) => o.recommended)?.title || 'Unknown',
            recommendation_rationale: (parsed as any).recommendation_rationale,
            key_tradeoff: (parsed as any).key_tradeoff,
            confidence_score: (parsed as any).options?.find((o: any) => o.recommended)?.confidence_score || 0,
          })
          ;(validResult as any)._session_id = session_id
        } catch (dbErr) {
          console.error('[simulate] DB insert failed (non-fatal):', dbErr)
        }
        break
      }

      console.error(`[simulate] Attempt ${attempt}: Response failed validation`, parsed)
    } catch (groqErr) {
      console.error(`[simulate] Attempt ${attempt}: Groq API error`, groqErr)
    }

    if (attempt < MAX_ATTEMPTS) await sleep(1000)
  }

  if (!validResult) {
    return NextResponse.json(
      { error: 'The AI had trouble generating distinct options, please try again.' },
      { status: 500 }
    )
  }

  // ── Step F: Cache and return ─────────────────────────────────────────────

  const session_id = (validResult as any)._session_id as string | undefined
  delete (validResult as any)._session_id

  const finalResult: SimulationResult = {
    ...validResult,
    evaluated_at: new Date().toISOString(),
    cached: false,
  }

  setCached<SimulationResult>(cacheKey, finalResult, SIMULATION_TTL_MS)

  return NextResponse.json({ ...finalResult, session_id }, { status: 200 })
}
