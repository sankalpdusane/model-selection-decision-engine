'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Zap, Brain, Clock, TrendingUp } from 'lucide-react'
import { EXAMPLE_SCENARIOS } from '@/lib/scenarios'
import type { SimulationResult } from '@/lib/types'

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Urgency = 'low' | 'medium' | 'high' | 'critical'

interface HistoryEntry {
  result: SimulationResult
  scenario: { context: string; constraint: string; stakeholders: string; urgency: Urgency }
  outcome?: { rating: number; notes: string }
}

interface AdversarialChallenge {
  challenge_question: string
  vulnerability: string
  defense: string
  challenge_severity: 'mild' | 'significant' | 'fundamental'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function totalLength(ctx: string, con: string, st: string) {
  return ctx.length + con.length + st.length
}

function CircleProgress({ value, color }: { value: number; color: string }) {
  const r = 20
  const circ = 2 * Math.PI * r
  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (value / 100) * circ }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        />
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>{value}%</span>
    </div>
  )
}

function confidenceColor(score: number): string {
  if (score >= 70) return '#34D399'
  if (score >= 45) return '#FBBF24'
  return '#F87171'
}

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'options' as const, label: '⚡ Strategic Options' },
  { id: 'analysis' as const, label: '🔍 Analysis' },
  { id: 'scenario' as const, label: '📋 Scenario' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [context, setContext] = useState('')
  const [constraint, setConstraint] = useState('')
  const [stakeholders, setStakeholders] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('medium')

  // ── Simulation state ───────────────────────────────────────────────────────
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Optional layers ────────────────────────────────────────────────────────
  const [includeAdversarial, setIncludeAdversarial] = useState(false)
  const [adversarialChallenge, setAdversarialChallenge] = useState<AdversarialChallenge | null>(null)

  // ── History ────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // ── Outcome modal ──────────────────────────────────────────────────────────
  const [outcomeModal, setOutcomeModal] = useState<{ open: boolean; sessionId: string; confidence: number } | null>(null)
  const [outcomeRating, setOutcomeRating] = useState(0)
  const [outcomeNotes, setOutcomeNotes] = useState('')

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'options' | 'analysis' | 'scenario'>('options')

  const charCount = totalLength(context, constraint, stakeholders)

  // Load history from DB on mount
  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((d) => setHistory(d.decisions || []))
      .catch(() => {})
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function loadScenario(idx: number) {
    const s = EXAMPLE_SCENARIOS[idx]
    setContext(s.context)
    setConstraint(s.constraint)
    setStakeholders(s.stakeholders)
    setUrgency(s.urgency)
    setResult(null)
    setError(null)
    setAdversarialChallenge(null)
  }

  async function handleSubmit() {
    setIsLoading(true)
    setError(null)
    setResult(null)
    setAdversarialChallenge(null)

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, constraint, stakeholders, urgency }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setResult(data as SimulationResult)
      setActiveTab('options') // auto-switch to results
      setHistory((prev) => [
        { result: data, scenario: { context, constraint, stakeholders, urgency } },
        ...prev.slice(0, 9),
      ])

      if (includeAdversarial && data.options) {
        const recOption = data.options.find((o: any) => o.recommended)
        if (recOption) {
          const advRes = await fetch('/api/adversarial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recommended_option: recOption,
              scenario_summary: data.scenario_summary,
              recommendation_rationale: data.recommendation_rationale,
            }),
          })
          const advData = await advRes.json()
          setAdversarialChallenge(advData)
        }
      }
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function saveOutcome() {
    if (!outcomeModal) return
    await fetch('/api/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: outcomeModal.sessionId,
        actual_outcome_rating: outcomeRating,
        actual_outcome_notes: outcomeNotes,
      }),
    })
    setOutcomeModal(null)
    setOutcomeRating(3)
    setOutcomeNotes('')
    fetch('/api/history')
      .then((r) => r.json())
      .then((d) => setHistory(d.decisions || []))
      .catch(() => {})
  }

  // ── PDF Export ─────────────────────────────────────────────────────────────

  const exportToPDF = async () => {
    if (!result) return
    setIsExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 18
      let y = 22

      // ── Header ──────────────────────────────────────────────────────────────
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text('AI Product Decision Simulator', margin, y)
      y += 10
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Generated strategic analysis report', margin, y)
      y += 14

      // ── Blue divider ─────────────────────────────────────────────────────────
      doc.setDrawColor(59, 130, 246)
      doc.setLineWidth(0.6)
      doc.line(margin, y, pageWidth - margin, y)
      y += 8

      // ── Scenario summary ─────────────────────────────────────────────────────
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(59, 130, 246)
      doc.text('DECISION BEING MADE', margin, y)
      y += 6
      doc.setFontSize(11)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(50, 50, 50)
      const summaryLines = doc.splitTextToSize(result.scenario_summary, pageWidth - margin * 2)
      doc.text(summaryLines, margin, y)
      y += summaryLines.length * 6 + 10

      // ── Options ──────────────────────────────────────────────────────────────
      result.options.forEach((option: any, i: number) => {
        if (y > 235) { doc.addPage(); y = 22 }

        // Coloured background strip
        if (option.recommended) {
          doc.setFillColor(235, 245, 255)
        } else {
          doc.setFillColor(246, 248, 252)
        }
        doc.roundedRect(margin, y, pageWidth - margin * 2, 10, 2, 2, 'F')
        y += 7

        // Option title — ASCII only, no ★
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        if (option.recommended) {
          doc.setTextColor(29, 78, 216)
        } else {
          doc.setTextColor(30, 41, 59)
        }
        const prefix = option.recommended ? '[RECOMMENDED] ' : `Option ${i + 1} — `
        doc.text(prefix + option.title, margin + 3, y)
        y += 8

        // Approach body text
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        const approachLines = doc.splitTextToSize(option.approach, pageWidth - margin * 2 - 6)
        doc.text(approachLines, margin + 3, y)
        y += approachLines.length * 5 + 4

        // Confidence + timeline
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(90, 90, 90)
        doc.text(
          `Confidence: ${option.confidence_score}%   |   Timeline: ${option.estimated_timeline}`,
          margin + 3, y
        )
        y += 12
      })

      // ── Rationale ────────────────────────────────────────────────────────────
      if (y > 215) { doc.addPage(); y = 22 }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(59, 130, 246)
      doc.text('WHY THIS RECOMMENDATION', margin, y)
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(45, 45, 45)
      const rationaleLines = doc.splitTextToSize(result.recommendation_rationale, pageWidth - margin * 2)
      doc.text(rationaleLines, margin, y)
      y += rationaleLines.length * 5 + 8

      // ── Tradeoff ─────────────────────────────────────────────────────────────
      if (y > 230) { doc.addPage(); y = 22 }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(161, 98, 7)
      doc.text('THE HONEST TRADEOFF', margin, y)
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(90, 90, 90)
      const tradeoffLines = doc.splitTextToSize(result.key_tradeoff, pageWidth - margin * 2)
      doc.text(tradeoffLines, margin, y)

      // ── Footer on every page ─────────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(160, 160, 160)
        doc.text(
          `AI Product Decision Simulator  |  Page ${i} of ${pageCount}  |  ~ made by Sankalp Dusane`,
          margin,
          doc.internal.pageSize.getHeight() - 8
        )
        doc.text(
          new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
          pageWidth - margin,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'right' }
        )
      }

      doc.save('decision-simulation.pdf')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`${isDark ? 'dark' : 'light bg-slate-100'} min-h-screen ${isDark ? 'text-white' : 'text-slate-900'} relative overflow-x-hidden`}>

      {/* ── Noise texture overlay (dark mode only) ── */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-[1]" style={{ opacity: 0.025 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" />
          </svg>
        </div>
      )}

      {/* ── Background blobs (dark mode only) ── */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-[0]">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/6 rounded-full blur-3xl"
            style={{ animation: 'pulse 5s ease-in-out infinite 2.5s' }}
          />
          <div
            className="absolute top-3/4 left-1/2 w-64 h-64 bg-pink-600/4 rounded-full blur-3xl"
            style={{ animation: 'pulse 7s ease-in-out infinite 1s' }}
          />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        {/* ── Header ── */}
        <div className="relative mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-bold tracking-tight"
          >
            AI Product{' '}
            <span className="gradient-text-animated">Decision</span>{' '}
            Simulator
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className={`text-sm mt-2 max-w-2xl leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            Describe a product scenario. Get 3 genuinely different strategic options with a committed
            recommendation — challenged by an adversarial agent.
          </motion.p>

          {/* ── Dark / Light toggle — top-right with throb ── */}
          <div className="absolute top-0 right-0">
            <motion.button
              onClick={() => setIsDark(!isDark)}
              animate={{
                boxShadow: [
                  '0 0 0px rgba(59,130,246,0)',
                  '0 0 18px rgba(59,130,246,0.45)',
                  '0 0 0px rgba(59,130,246,0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{
                scale: 1.12,
                boxShadow: '0 0 28px rgba(59,130,246,0.8)',
                borderColor: 'rgba(59,130,246,0.7)',
              }}
              whileTap={{ scale: 0.88 }}
              className="w-10 h-10 rounded-full border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm flex items-center justify-center hover:border-slate-600 transition-all duration-200 cursor-pointer"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="text-base">{isDark ? '☀️' : '🌙'}</span>
            </motion.button>
          </div>
        </div>

        {/* ── Memory indicator ── */}
        <AnimatePresence>
          {history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div className="glass-card rounded-full px-4 py-2 inline-flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                  Memory active — {history.length} past decision{history.length > 1 ? 's' : ''} informing this simulation
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quick load scenario buttons ── */}
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mb-8"
          >
            <p className={`text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Load example scenario
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_SCENARIOS.map((s, i) => (
                <motion.button
                  key={s.id}
                  onClick={() => loadScenario(i)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`glass-card rounded-xl px-3 py-1.5 text-xs transition-colors duration-200 cursor-pointer ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {s.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            CONDITIONAL LAYOUT:
            • No result → two-column (form | empty/loading)
            • Has result → single column with tab bar
            ═══════════════════════════════════════════════════════════════ */}

        {!result ? (
          /* ── TWO-COLUMN LAYOUT ── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

            {/* ══ LEFT: Form ══ */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="glass-card rounded-2xl p-6"
            >
              <motion.div variants={itemVariants} className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-blue-400" />
                </div>
                <span className="font-semibold text-sm">Build your scenario</span>
              </motion.div>

              {/* Context */}
              <motion.div variants={itemVariants}>
                <label className={`block text-xs font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Situation context
                </label>
                <textarea
                  rows={4}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Describe what's happening — include numbers where you have them…"
                  className={`w-full rounded-xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 resize-none transition-all duration-200 ${isDark ? 'bg-black/30 border border-white/8 text-slate-100 focus:border-blue-500/50' : 'bg-white border border-slate-200 text-slate-800 focus:border-blue-400'}`}
                />
              </motion.div>

              {/* Constraint */}
              <motion.div variants={itemVariants} className="mt-4">
                <label className={`block text-xs font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Hard constraint
                </label>
                <textarea
                  rows={3}
                  value={constraint}
                  onChange={(e) => setConstraint(e.target.value)}
                  placeholder="What cannot be changed, violated, or ignored in your solution…"
                  className={`w-full rounded-xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 resize-none transition-all duration-200 ${isDark ? 'bg-black/30 border border-white/8 text-slate-100 focus:border-blue-500/50' : 'bg-white border border-slate-200 text-slate-800 focus:border-blue-400'}`}
                />
              </motion.div>

              {/* Stakeholders */}
              <motion.div variants={itemVariants} className="mt-4">
                <label className={`block text-xs font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Key stakeholders
                </label>
                <textarea
                  rows={2}
                  value={stakeholders}
                  onChange={(e) => setStakeholders(e.target.value)}
                  placeholder="Who is affected and what do they each want…"
                  className={`w-full rounded-xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 resize-none transition-all duration-200 ${isDark ? 'bg-black/30 border border-white/8 text-slate-100 focus:border-blue-500/50' : 'bg-white border border-slate-200 text-slate-800 focus:border-blue-400'}`}
                />
                <p className={`text-right text-xs mt-1 transition-colors ${charCount > 3000 ? 'text-amber-400' : isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {charCount.toLocaleString()} / 4,000 chars
                </p>
              </motion.div>

              {/* Urgency */}
              <motion.div variants={itemVariants} className="mt-4">
                <label className={`block text-xs font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Urgency level
                </label>
                <div className={`flex p-1 border rounded-full ${isDark ? 'bg-black/30 border-white/8' : 'bg-slate-100 border-slate-200'}`}>
                  {(['low', 'medium', 'high', 'critical'] as Urgency[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => setUrgency(u)}
                      className="relative flex-1 px-3 py-1.5 rounded-full text-xs font-medium capitalize z-10 transition-colors duration-200 cursor-pointer"
                      style={{ color: urgency === u ? '#fff' : 'rgba(148,163,184,0.8)' }}
                    >
                      {urgency === u && (
                        <motion.div
                          layoutId="urgency-indicator"
                          className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-blue-500"
                          style={{ boxShadow: '0 0 20px rgba(59,130,246,0.5)' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{u}</span>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Adversarial toggle */}
              <motion.div variants={itemVariants} className="mt-5">
                <p className={`text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Optional AI layers</p>
                <div className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Adversarial challenge</p>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>A skeptical board member pressure-tests the recommendation</p>
                  </div>
                  <motion.button
                    onClick={() => setIncludeAdversarial(!includeAdversarial)}
                    className="relative w-11 h-6 rounded-full focus:outline-none flex-shrink-0 ml-4 cursor-pointer"
                    style={{
                      background: includeAdversarial ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    whileTap={{ scale: 0.92 }}
                  >
                    <motion.div
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full"
                      animate={{ x: includeAdversarial ? 20 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                    />
                  </motion.button>
                </div>
              </motion.div>

              {/* Model routing */}
              <motion.div variants={itemVariants} className="mt-4">
                <div className={`rounded-xl p-3 border ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-xs uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Model routing</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Strategic analysis</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300">Llama 3.3 70B · Groq</span>
                    </div>
                    <AnimatePresence>
                      {includeAdversarial && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex justify-between items-center overflow-hidden"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Adversarial agent</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300">Llama 3.3 70B · Groq</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Cache TTL</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300">30 min</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-sm text-red-300"
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.div variants={itemVariants} className="mt-5">
                <motion.button
                  onClick={handleSubmit}
                  disabled={isLoading || context.trim().length < 20 || constraint.trim().length < 10}
                  whileHover="hover"
                  whileTap={{ scale: 0.97 }}
                  variants={{ hover: { scale: 1.015, boxShadow: '0 8px 30px rgba(59,130,246,0.4)' } }}
                  className="w-full relative overflow-hidden rounded-xl py-3 font-medium text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #3b82f6, #7c3aed)' }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.15) 50%, transparent 65%)' }}
                    variants={{ hover: { x: '200%' } }}
                    initial={{ x: '-100%' }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating 3 strategic options…
                      </>
                    ) : (
                      <>
                        <motion.span variants={{ hover: { rotate: 12 } }} style={{ display: 'flex' }}>
                          <Zap className="w-4 h-4" />
                        </motion.span>
                        Run Decision Simulation
                      </>
                    )}
                  </span>
                </motion.button>
              </motion.div>
            </motion.div>

            {/* ══ RIGHT: Loading / Empty state ══ */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-card rounded-2xl min-h-96 flex flex-col items-center justify-center gap-4"
                >
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 border-2 border-blue-800/40 rounded-full" />
                    <div className="absolute inset-0 border-2 border-t-blue-400 rounded-full animate-spin" />
                    <div
                      className="absolute inset-2 border-2 border-t-violet-400 rounded-full animate-spin"
                      style={{ animationDirection: 'reverse', animationDuration: '0.7s' }}
                    />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Consulting 15 years of PM experience…</p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Generating 3 distinct strategic options</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="glass-card rounded-2xl min-h-96 flex flex-col items-center justify-center gap-4 text-center p-8"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div
                      className="w-16 h-16 rounded-full glass-card flex items-center justify-center"
                      style={{ boxShadow: 'inset 0 0 20px rgba(59,130,246,0.1), 0 0 40px rgba(59,130,246,0.05)' }}
                    >
                      <TrendingUp className={`w-7 h-7 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </div>
                  </motion.div>
                  <div>
                    <p className={`text-sm font-medium animate-pulse-slow ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Your strategic options will appear here
                    </p>
                    <p className={`text-xs max-w-xs mt-1 animate-pulse-slow ${isDark ? 'text-slate-600' : 'text-slate-400'}`} style={{ animationDelay: '1.5s' }}>
                      Fill in the scenario fields or load an example to get started
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        ) : (

          /* ── SINGLE COLUMN + TABS LAYOUT ── */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Scenario summary bar */}
            <div className={`mb-5 px-5 py-3 rounded-xl border flex items-center justify-between gap-4 ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex-1 min-w-0">
                <p className={`text-xs uppercase tracking-wider mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Decision being made</p>
                <p className={`text-sm italic leading-relaxed truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>"{result.scenario_summary}"</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {result.cached && (
                  <Badge className="bg-blue-950 text-blue-300 border-blue-800/40 text-xs rounded-full">
                    Cached · 30min
                  </Badge>
                )}
                <Badge className="bg-white/5 text-slate-400 border-white/10 text-xs rounded-full">
                  Llama 3.3 70B
                </Badge>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setResult(null)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-200 cursor-pointer ${isDark ? 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500' : 'border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400'}`}
                >
                  ← New
                </motion.button>
              </div>
            </div>

            {/* Tab bar */}
            <div className={`flex border-b mb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                    activeTab === tab.id
                      ? 'text-white'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="tab-line"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <AnimatePresence mode="wait">

              {/* ══ STRATEGIC OPTIONS TAB ══ */}
              {activeTab === 'options' && (
                <motion.div
                  key="options"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* CHANGE 5 — 3-column grid, all options visible simultaneously */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {result.options.map((option, index) =>
                      option.recommended ? (
                        /* RECOMMENDED card — dominant */
                        <motion.div
                          key={option.id}
                          initial={{ opacity: 0, y: 20, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1.03 }}
                          transition={{ delay: 0, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="relative rounded-2xl p-5 border border-blue-500/50 bg-gradient-to-b from-blue-950/60 to-slate-900/80 overflow-hidden z-10"
                          style={{ boxShadow: '0 0 40px rgba(59,130,246,0.2)' }}
                        >
                          {/* Glowing top edge */}
                          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent" />

                          <span
                            className="absolute top-3 right-3 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full"
                            style={{ boxShadow: '0 0 12px rgba(59,130,246,0.6)' }}
                          >
                            RECOMMENDED
                          </span>

                          <div className="flex items-start gap-2 mb-3 pr-24">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-white mb-1">{option.title}</h3>
                              <p className="text-xs text-slate-400 leading-relaxed">{option.approach}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="border-white/10 text-slate-400 text-xs rounded-full">
                              <Clock className="w-3 h-3 mr-1" />
                              {option.estimated_timeline}
                            </Badge>
                            <CircleProgress value={option.confidence_score} color={confidenceColor(option.confidence_score)} />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-xs font-medium text-green-400 uppercase tracking-wider mb-1">Pros</p>
                              {option.pros.map((pro, i) => (
                                <div key={i} className="flex items-start gap-1 mb-1">
                                  <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                                  <span className="text-xs text-slate-400 leading-relaxed">{pro}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-1">Cons</p>
                              {option.cons.map((con, i) => (
                                <div key={i} className="flex items-start gap-1 mb-1">
                                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                                  <span className="text-xs text-slate-400 leading-relaxed">{con}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-1">Risks</p>
                              {option.risks.map((risk, i) => (
                                <div key={i} className="flex items-start gap-1 mb-1">
                                  <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                  <span className="text-xs text-slate-400 leading-relaxed">{risk}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        /* NON-RECOMMENDED cards — recede */
                        <motion.div
                          key={option.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 0.8, y: 0 }}
                          whileHover={{ opacity: 1 }}
                          transition={{ delay: index * 0.1 + 0.1, duration: 0.4 }}
                          className={`relative rounded-2xl p-5 border transition-opacity duration-300 ${isDark ? 'border-slate-700/40 bg-slate-900/40' : 'bg-white border-slate-200'}`}
                        >
                          <div className="flex items-start gap-2 mb-3">
                            <div className="flex-1">
                              <h3 className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{option.title}</h3>
                              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{option.approach}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className="border-white/10 text-slate-400 text-xs rounded-full">
                              <Clock className="w-3 h-3 mr-1" />
                              {option.estimated_timeline}
                            </Badge>
                            <CircleProgress value={option.confidence_score} color={confidenceColor(option.confidence_score)} />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-xs font-medium text-green-400 uppercase tracking-wider mb-1">Pros</p>
                              {option.pros.map((pro, i) => (
                                <div key={i} className="flex items-start gap-1 mb-1">
                                  <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                                  <span className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{pro}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-1">Cons</p>
                              {option.cons.map((con, i) => (
                                <div key={i} className="flex items-start gap-1 mb-1">
                                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                                  <span className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{con}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-1">Risks</p>
                              {option.risks.map((risk, i) => (
                                <div key={i} className="flex items-start gap-1 mb-1">
                                  <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                                  <span className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{risk}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )
                    )}
                  </div>
                </motion.div>
              )}

              {/* ══ ANALYSIS TAB ══ */}
              {activeTab === 'analysis' && (
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-3xl mx-auto space-y-4"
                >
                  {/* Recommendation rationale */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl p-5 border border-blue-500/20"
                    style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(255,255,255,0.01))' }}
                  >
                    <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">Why this recommendation</p>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{result.recommendation_rationale}</p>
                  </motion.div>

                  {/* Key tradeoff */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl p-4 border border-amber-800/30"
                    style={{ background: 'linear-gradient(135deg, rgba(120,53,15,0.18), rgba(255,255,255,0.01))' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <p className="text-xs text-amber-400 uppercase tracking-wider">The honest tradeoff</p>
                    </div>
                    <p className="text-sm text-amber-200/80 italic leading-relaxed">{result.key_tradeoff}</p>
                  </motion.div>

                  {/* Adversarial challenge */}
                  <AnimatePresence>
                    {adversarialChallenge && (
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="rounded-2xl border border-red-500/50 bg-gradient-to-b from-red-950/40 to-slate-900/60 overflow-hidden"
                      >
                        <div className="px-5 pt-4 pb-3 border-b border-red-900/40 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="w-2 h-2 rounded-full bg-red-500"
                            />
                            <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">Adversarial Challenge</span>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            adversarialChallenge.challenge_severity === 'fundamental' ? 'bg-red-500/20 text-red-300' :
                            adversarialChallenge.challenge_severity === 'significant' ? 'bg-orange-500/20 text-orange-300' :
                            'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {adversarialChallenge.challenge_severity}
                          </span>
                        </div>
                        <div className="px-5 py-4">
                          <p className="text-sm font-medium text-red-200 italic leading-relaxed mb-4">
                            "{adversarialChallenge.challenge_question}"
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Vulnerability</p>
                              <p className="text-sm text-slate-300 leading-relaxed">{adversarialChallenge.vulnerability}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Defense</p>
                              <p className="text-sm text-slate-300 leading-relaxed">{adversarialChallenge.defense}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CHANGE 3 — PDF Export button with throb animation */}
                  <motion.button
                    onClick={exportToPDF}
                    disabled={isExporting}
                    animate={!isExporting ? {
                      boxShadow: [
                        '0 0 0px rgba(59,130,246,0)',
                        '0 0 20px rgba(59,130,246,0.4)',
                        '0 0 0px rgba(59,130,246,0)',
                      ],
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3 rounded-xl border border-blue-500/40 bg-blue-950/30 text-blue-300 text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-950/50 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {isExporting ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{ display: 'inline-block' }}
                        >
                          ⏳
                        </motion.span>
                        Generating PDF…
                      </>
                    ) : (
                      <>
                        <span>📄</span>
                        Export analysis as PDF
                      </>
                    )}
                  </motion.button>

                  {/* Outcome log button */}
                  {(result as any)?.session_id && (
                    <motion.button
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() =>
                        setOutcomeModal({
                          open: true,
                          sessionId: (result as any).session_id,
                          confidence: result.options?.find((o) => o.recommended)?.confidence_score ?? 0,
                        })
                      }
                      className={`w-full py-4 rounded-xl border text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer ${isDark ? 'border-slate-700/50 bg-transparent text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-500 hover:text-slate-800'}`}
                    >
                      <span>📊</span>
                      <span>How did this play out? Log the outcome for calibration tracking</span>
                      <span className="text-slate-600 text-xs ml-1">→</span>
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* ══ SCENARIO TAB — read-only view of inputs ══ */}
              {activeTab === 'scenario' && (
                <motion.div
                  key="scenario"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-2xl mx-auto space-y-4"
                >
                  <div className={`rounded-xl p-5 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <p className={`text-xs uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Situation Context</p>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{context}</p>
                  </div>
                  <div className={`rounded-xl p-5 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <p className={`text-xs uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hard Constraint</p>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{constraint}</p>
                  </div>
                  {stakeholders && (
                    <div className={`rounded-xl p-5 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <p className={`text-xs uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Key Stakeholders</p>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{stakeholders}</p>
                    </div>
                  )}
                  <div className={`rounded-xl p-5 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <p className={`text-xs uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Urgency Level</p>
                    <span className="text-sm font-medium text-blue-400 capitalize">{urgency}</span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setResult(null)}
                    className={`w-full py-3 rounded-xl border text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer ${isDark ? 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500' : 'border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400'}`}
                  >
                    ← Run a new simulation
                  </motion.button>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        )}

        {/* CHANGE 4 — Footer credit */}
        <div className="mt-16 pb-8 text-center">
          <span className={`text-xs tracking-widest ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>~ made by Sankalp Dusane</span>
        </div>
      </div>

      {/* CHANGE 4 — Fixed credit bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <span className={`text-[10px] tracking-widest ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>~ made by Sankalp Dusane</span>
      </div>

      {/* ══ Outcome modal ══ */}
      <AnimatePresence>
        {outcomeModal?.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setOutcomeModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.25 }}
              className="glass-card rounded-2xl p-6 max-w-sm w-full"
            >
              <h2 className="text-base font-semibold text-white mb-1">Log decision outcome</h2>
              <p className="text-xs text-slate-500 mb-5">
                AI predicted {outcomeModal.confidence}% confidence. How did it actually go?
              </p>

              <div className="mb-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Outcome rating</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <motion.button
                      key={r}
                      onClick={() => setOutcomeRating(r)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 cursor-pointer ${
                        outcomeRating === r
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {r}
                    </motion.button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-600 mt-1 px-0.5">
                  <span>Backfired</span>
                  <span>Perfect call</span>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Notes (optional)</p>
                <textarea
                  rows={3}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="What actually happened? What would you do differently?"
                  className="w-full bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 focus:ring-offset-0 resize-none transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-2">
                <motion.button
                  onClick={saveOutcome}
                  disabled={outcomeRating === 0}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 rounded-xl font-medium text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)' }}
                >
                  Save outcome
                </motion.button>
                <button
                  onClick={() => setOutcomeModal(null)}
                  className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors duration-150 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
