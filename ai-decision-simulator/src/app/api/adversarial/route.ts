import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const ADVERSARIAL_PROMPT = `You are a skeptical senior board member who has seen 200 product decisions fail in ways the PM did not predict. You have just read a product recommendation.

Find the ONE hardest challenge a smart skeptic would raise — not generic criticism but specifically devastating given this option's stated approach and the tradeoffs acknowledged.

Return ONLY valid JSON with no markdown:
{"challenge_question": "the single hardest question", "vulnerability": "what weakness this exposes", "defense": "how a strong PM would respond to this challenge", "challenge_severity": "mild" | "significant" | "fundamental"}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recommended_option, scenario_summary, recommendation_rationale } = body
    if (!recommended_option || !scenario_summary) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const userMsg = `Scenario: ${scenario_summary}\n\nRecommended option: ${recommended_option.title}\nApproach: ${recommended_option.approach}\nRationale: ${recommendation_rationale}\nConfidence score: ${recommended_option.confidence_score}%\nKey cons: ${recommended_option.cons?.join(', ')}\nKey risks: ${recommended_option.risks?.join(', ')}`
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: ADVERSARIAL_PROMPT }, { role: 'user', content: userMsg }],
      temperature: 0.6,
      max_tokens: 500
    })
    const raw = response.choices[0].message.content?.trim() || ''
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}') + 1
    const parsed = JSON.parse(raw.slice(start, end))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Adversarial route error:', err)
    return NextResponse.json({
      challenge_question: 'What happens if the core assumption underlying this recommendation is wrong?',
      vulnerability: 'The recommendation may rest on an unvalidated assumption.',
      defense: 'Validate the key assumption with a small fast experiment before full commitment.',
      challenge_severity: 'significant'
    })
  }
}
