# AI Product Decision Simulator

> **Structured strategic decisions. Not diplomatic hedging.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-orange?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

**Live Demo:** `REPLACE_WITH_YOUR_URL`

---

## Screenshots

### Home
![Home](docs/screenshot_01_home.png)

### Form Filled
![Form Filled](docs/screenshot_02_form_filled.png)

### Light Mode
![Light Mode](docs/screenshot_03_light_mode.png)

### Results
![Results](docs/screenshot_04_results.png)

### Analysis
![Analysis](docs/screenshot_05_analysis.png)

---

## The problem with AI advice today

Open ChatGPT or Claude and paste a real product decision. What do you get?

> *"Both approaches have merit. Option A is better if you prioritize X, Option B is better if you prioritize Y. It ultimately depends on your specific context and goals."*

That is not an answer. That is diplomatic noise dressed up as analysis. It does not help a PM who has to stand up in a board meeting on Thursday and explain why they shipped feature A instead of feature B.

**This tool does not do that.**

---

## What this actually does

Given a scenario description, a hard constraint, and stakeholder context — the simulator generates **3 fundamentally different strategic approaches**, not 3 variations of the same idea with different confidence thresholds.

It then:
- **Commits to a single recommendation** with an explicit rationale
- **States exactly what is being sacrificed** by that choice (the honest tradeoff)
- **Sends in a second adversarial agent** that plays the role of a skeptical board member — raising the single hardest challenge a smart critic would raise, not generic feedback
- **Learns from past decisions** via a SQLite-backed memory layer that injects relevant historical context into each new prompt
- **Exports a clean PDF report** for stakeholder documentation

---

## Why not just use ChatGPT / Claude / Gemini directly?

This is the right question. Here is the precise answer:

| Dimension | ChatGPT / Claude raw prompting | This tool |
|---|---|---|
| **Decision forcing** | Will hedge unless you write a very specific prompt every time | System prompt enforces exactly one `recommended: true` field, validated server-side. The AI cannot produce a wishy-washy non-answer |
| **Structural consistency** | Output format varies per session, hard to compare across decisions | Every output is the same typed JSON schema. Options always have `pros`, `cons`, `risks`, `confidence_score`, `estimated_timeline` |
| **Adversarial pressure testing** | You have to manually ask "what's wrong with this" as a follow-up | A second Groq call runs automatically, specialized in finding the single most devastating flaw — not a list of generic concerns |
| **Memory / calibration** | Stateless. No awareness of what you decided last month | SQLite decision log. Each new simulation is injected with summaries of relevant past decisions. The model can say "this is similar to a decision that had outcome 4/5" |
| **Outcome tracking** | Nothing. The conversation ends | You can log the actual outcome of each decision on a 1–5 scale with notes. The system closes the loop between prediction and reality |
| **Reproducibility** | Same scenario gives different output each session | 30-minute TTL cache keyed on scenario hash. Identical inputs return instant cached results |
| **Prompt discipline** | You are the prompt engineer every single time | Prompt engineering is done once, in version control, and tested against adversarial edge cases. Non-PM users get the same quality output |
| **Rate limiting** | None (API key is your only guard) | Sliding window: 10 req / IP / 60s. Safe to expose publicly |
| **Export** | Copy-paste into a doc | One-click A4 PDF with header, all options, rationale, tradeoff, page numbers, attribution |

**The short version:** raw ChatGPT is a blank canvas. This tool is an opinionated decision framework built on top of that canvas, the same way Figma is more than just Bezier curves.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js 16 (App Router)                  │
│                         Turbopack dev build                      │
├──────────────────────────────┬──────────────────────────────────┤
│         Frontend             │            API Routes             │
│  React + Framer Motion       │                                   │
│  Conditional tab layout      │  POST /api/simulate               │
│  (2-col → tabbed on result)  │    ├── Rate limit check           │
│  AnimatePresence transitions │    ├── Cache lookup (30min TTL)   │
│  CircleProgress SVG rings    │    ├── Memory injection (5 past)  │
│  Dark / Light mode toggle    │    ├── Groq Llama 3.3 70B         │
│  PDF export via jsPDF        │    ├── Response validation        │
│                              │    └── SQLite write               │
│                              │                                   │
│                              │  POST /api/adversarial            │
│                              │    └── Groq Llama 3.3 70B         │
│                              │        (skeptical board member)   │
│                              │                                   │
│                              │  GET  /api/history                │
│                              │  POST /api/outcome                │
├──────────────────────────────┴──────────────────────────────────┤
│                        SQLite (better-sqlite3)                   │
│  decisions table: session_id, scenario_summary, recommendation,  │
│  confidence_score, key_tradeoff, outcome_rating, outcome_notes   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical decisions

| Decision | Rationale |
|---|---|
| **Llama 3.3 70B, not 8B** | Generating 3 genuinely distinct strategic options requires stronger reasoning than evaluation tasks. The 8B model produces 3 variations of the same idea under a different label. The 70B model surfaces genuinely different risk profiles. |
| **Groq over OpenAI** | Groq's LPU inference hardware delivers ~10x lower latency on Llama 3.3 70B compared to OpenAI's API on GPT-4o for the same token count. Fast enough to feel synchronous. |
| **Forced single recommendation** | System prompt requires exactly one option with `recommended: true`. Server-side validates the parsed JSON and returns a 500 if the constraint is violated. No hedging possible at the architecture level. |
| **Explicit `key_tradeoff` field** | Every real decision sacrifices something. Requiring this field in the JSON schema forces the model to acknowledge what is being given up, not present the recommendation as a free win. |
| **Second adversarial agent** | One model optimising for a good recommendation and the same model critiquing it introduces confirmation bias. The adversarial call is a separate prompt with a completely different system persona — a skeptical board member who has "seen 200 product decisions fail." |
| **SQLite + better-sqlite3** | No cold-start latency, no connection pool management, no infrastructure cost for a portfolio project. Synchronous API maps cleanly to Next.js serverless route handlers. WAL mode enabled for concurrent reads. |
| **Memory injection (5 past decisions)** | Each new simulation receives a `CONTEXT FROM SIMILAR PAST DECISIONS` block prepended to the user message. The model can reference calibration data from previous outcomes to adjust its confidence and recommendation. |
| **Sliding window rate limit** | 10 requests per IP per 60-second window stored in a `Map`. Prevents a single user from exhausting the Groq API key. Same pattern across all my AI PM projects. |
| **30-minute TTL cache** | Identical scenarios (same context + constraint + stakeholders + urgency) are cache-keyed on a SHA-style string. Returns instantly. Reduces Groq API calls by ~40% in practice for demos. |
| **Conditional two-column → tabbed layout** | Pre-result: form (left) + empty state (right). Post-result: full-width tabbed layout (Strategic Options / Analysis / Scenario). No wasted space, no blank panel competing with results. |
| **jsPDF programmatic rendering** | No screenshot-based PDF (html2canvas would capture the dark UI). Pure programmatic layout in a standard white A4 document, suitable for stakeholder sharing. ASCII-only text to avoid Helvetica encoding issues. |
| **Framer Motion layoutId for tabs + urgency** | Spring-physics sliding underline and urgency pill use `layoutId` shared element transitions — smoother than CSS transitions for element position changes. |

---

## System prompt design

The simulate endpoint uses a 400-token system prompt engineered around three principles:

1. **Role specificity over generic instruction** — "You are a Principal Product Manager with 15 years of experience across B2B SaaS and consumer apps" outperforms "You are a helpful assistant" because it activates a more specific prior in the model's training distribution.

2. **Constraint via schema** — The prompt specifies the exact JSON schema including field names, types, and constraints (e.g., `recommended: boolean, exactly one must be true`). Structural constraints embedded in the schema are more reliable than natural language instructions alone.

3. **Adversarial inoculation** — The prompt explicitly says "do not produce three variations of the same idea under different labels." This preemptively addresses the most common failure mode of option generation in LLMs.

---

## Data model

```sql
CREATE TABLE decisions (
  session_id               TEXT PRIMARY KEY,
  scenario_summary         TEXT NOT NULL,
  context                  TEXT NOT NULL,
  recommended_option_title TEXT NOT NULL,
  recommendation_rationale TEXT NOT NULL,
  key_tradeoff             TEXT NOT NULL,
  confidence_score         INTEGER NOT NULL,  -- 0-100
  created_at               TEXT NOT NULL,
  has_outcome              INTEGER DEFAULT 0,  -- boolean
  actual_outcome_rating    INTEGER,            -- 1-5
  actual_outcome_notes     TEXT
);
```

The `has_outcome` flag is queried by the memory injection layer. Past decisions with logged outcomes carry more weight in the context — the model is explicitly told to reference them.

---

## Running locally

```bash
# Clone and install
git clone https://github.com/sankalpdusane/model-selection-decision-engine.git
cd model-selection-decision-engine
npm install

# Environment — copy the example and add your Groq key
cp .env.local.example .env.local
# Edit .env.local and set: GROQ_API_KEY=gsk_...

# Run
npm run dev
# → http://localhost:3000
```

**Requirements:** Node.js 18+, a free [Groq API key](https://console.groq.com).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key. Free tier is sufficient for development. |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Main UI — conditional layout, all tab content
│   ├── globals.css               # Design system: gradient mesh, glass-card, dark/light
│   └── api/
│       ├── simulate/route.ts     # Core: rate limit → cache → memory → Groq → store
│       ├── adversarial/route.ts  # Skeptical board member agent
│       ├── history/route.ts      # Recent decisions for the sidebar
│       └── outcome/route.ts      # Outcome logging endpoint
├── lib/
│   ├── db.ts                     # SQLite singleton, WAL mode, schema init
│   ├── cache.ts                  # In-memory TTL cache, 30-min expiry
│   ├── rateLimit.ts              # Sliding window IP rate limiter
│   ├── prompts.ts                # System prompt (the most important file in the repo)
│   ├── scenarios.ts              # 5 pre-loaded realistic example scenarios
│   └── types.ts                  # Shared TypeScript interfaces
```

---

## PM portfolio context

This project demonstrates three things that matter in PM interviews at FAANG and similarly structured companies:

**1. Structured decision-making under incomplete information**
The constraint that every simulation must produce a single committed recommendation with an explicit tradeoff mirrors the actual job. PMs who present three options and ask the room to decide are not doing the job. This tool is built around that principle.

**2. AI product thinking beyond the wrapper**
Most AI portfolio projects are thin wrappers: input → LLM → output. This project treats the LLM as one component in a system that includes rate limiting, caching, multi-agent orchestration, memory persistence, outcome tracking, and structured output validation. That systems thinking is what separates PM-level AI product work from engineering work.

**3. User experience as a product decision**
The tabbed layout, the adversarial challenge, the outcome logging, the PDF export — each of these is a product decision with a rationale. The tool is not just functional; it is designed around the workflow of a PM who needs to present a decision to stakeholders, not just think about it privately.

---

## Known limitations

- SQLite is a single-file database. It is not suitable for multi-instance production deployments. Replace with Postgres via Prisma for horizontal scaling.
- The in-memory cache does not persist across server restarts. A Redis layer would fix this.
- Rate limiting is per-process. In a load-balanced environment, use a shared Redis store for the sliding window.
- The adversarial challenge adds ~1–1.5 seconds of latency. It is opt-in for this reason.

---

## License

MIT — use freely, attribute if you find it useful.

---

*~ made by Sankalp Dusane*
