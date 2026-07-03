import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/decisions.db'
  : './decisions.db'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    initSchema(_db)
  }
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      session_id TEXT PRIMARY KEY,
      scenario_summary TEXT NOT NULL,
      context TEXT NOT NULL,
      recommended_option_title TEXT NOT NULL,
      recommendation_rationale TEXT NOT NULL,
      key_tradeoff TEXT NOT NULL,
      confidence_score INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      has_outcome INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS calibration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      scenario_summary TEXT NOT NULL,
      predicted_confidence INTEGER NOT NULL,
      actual_outcome_rating INTEGER NOT NULL,
      actual_outcome_notes TEXT DEFAULT '',
      logged_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at DESC);
  `)
}

export function insertDecision(d: {
  session_id: string, scenario_summary: string, context: string,
  recommended_option_title: string, recommendation_rationale: string,
  key_tradeoff: string, confidence_score: number
}): void {
  getDb().prepare(`INSERT OR IGNORE INTO decisions
    (session_id,scenario_summary,context,recommended_option_title,recommendation_rationale,key_tradeoff,confidence_score,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(d.session_id,d.scenario_summary,d.context,d.recommended_option_title,
         d.recommendation_rationale,d.key_tradeoff,d.confidence_score,new Date().toISOString())
}

export function getRecentDecisions(limit = 8): any[] {
  return getDb().prepare('SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?').all(limit)
}

export function insertCalibration(e: {
  session_id: string, scenario_summary: string,
  predicted_confidence: number, actual_outcome_rating: number, actual_outcome_notes: string
}): void {
  getDb().prepare(`INSERT INTO calibration
    (session_id,scenario_summary,predicted_confidence,actual_outcome_rating,actual_outcome_notes,logged_at)
    VALUES (?,?,?,?,?,?)`)
    .run(e.session_id,e.scenario_summary,e.predicted_confidence,e.actual_outcome_rating,e.actual_outcome_notes,new Date().toISOString())
  getDb().prepare('UPDATE decisions SET has_outcome=1 WHERE session_id=?').run(e.session_id)
}

export function getCalibrationStats(): {
  total: number, logged: number, avgPredicted: number, avgActual: number, gap: number
} {
  const total = (getDb().prepare('SELECT COUNT(*) as c FROM decisions').get() as any).c
  const rows = getDb().prepare('SELECT predicted_confidence, actual_outcome_rating FROM calibration').all() as any[]
  if (!rows.length) return {total, logged:0, avgPredicted:0, avgActual:0, gap:0}
  const avgPredicted = rows.reduce((s,r)=>s+r.predicted_confidence,0)/rows.length
  const avgActual = rows.reduce((s,r)=>s+r.actual_outcome_rating*20,0)/rows.length
  return {total, logged:rows.length, avgPredicted:Math.round(avgPredicted), avgActual:Math.round(avgActual), gap:Math.round(avgPredicted-avgActual)}
}
