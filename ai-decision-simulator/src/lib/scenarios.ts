import type { DecisionScenario } from './types'

/**
 * Extends DecisionScenario with UI-specific metadata.
 * `id` is a stable identifier used for keying; `label` is the short name
 * shown on scenario selector buttons in the UI.
 */
export interface ExampleScenario extends DecisionScenario {
  id: string
  label: string
}

/**
 * Five realistic, high-stakes PM decision scenarios used as quick-start
 * examples in the simulator UI. Each scenario is fully populated with
 * specific numbers, named stakeholders, and hard constraints so the AI
 * can generate meaningful, grounded strategic options.
 */
export const EXAMPLE_SCENARIOS: ExampleScenario[] = [
  {
    id: 'scenario_1',
    label: 'iOS Notification Crisis',
    urgency: 'critical',
    context:
      'Our DAU dropped 23% after the iOS 18.4 update broke our push notification permission flow. Engineering says a proper fix needs 3 weeks. Marketing wants an immediate workaround.',
    constraint:
      'We cannot afford another App Store review cycle which takes 5–7 days minimum, and the team has zero bandwidth for a full notification system rebuild this quarter.',
    stakeholders:
      'CEO wants daily visibility into recovery. Engineering lead is protective of the team\'s existing roadmap commitments. Growth team is panicking about investor metrics next week.',
  },
  {
    id: 'scenario_2',
    label: 'Competitor AI Launch',
    urgency: 'high',
    context:
      'A competitor just launched an AI-powered feature that directly overlaps with a feature we have been planning for next quarter. They have first-mover advantage in the market narrative now.',
    constraint:
      'Our AI infrastructure is not production-ready; our best guess is 6–8 weeks to ship something genuinely good, but the market window may close in 3–4 weeks.',
    stakeholders:
      'Board is asking pointed questions about competitive response. Sales team wants something to show prospects immediately. Engineering does not want to ship something embarrassingly worse than the competitor.',
  },
  {
    id: 'scenario_3',
    label: 'Enterprise vs. Breadth',
    urgency: 'medium',
    context:
      'Our B2B customers keep asking for a feature that only 8% of our total user base would use, but those 8% represent 34% of total revenue.',
    constraint:
      'Building this properly would consume the entire next quarter for 2 of our 5 engineers, delaying 3 other roadmap items that affect the broader user base.',
    stakeholders:
      'Enterprise sales is threatening to lose 2 major renewal deals without this. Product team worries about becoming an enterprise feature factory. Smaller customers feel increasingly deprioritized.',
  },
  {
    id: 'scenario_4',
    label: 'Onboarding Retention Drop',
    urgency: 'high',
    context:
      'User research just revealed that our core onboarding flow — redesigned 4 months ago — has decreased Day-7 retention by 6% compared to the old flow, though Day-1 activation improved by 12%.',
    constraint:
      'We publicly announced this redesign as a major product win on our last earnings call, and reverting feels politically difficult, but the data is unambiguous.',
    stakeholders:
      'CEO referenced this redesign as a key 2026 win publicly. The design team is emotionally invested having spent 3 months on it. The data team is confident in the retention numbers.',
  },
  {
    id: 'scenario_5',
    label: 'Headcount vs. AI Tooling',
    urgency: 'low',
    context:
      'We have budget approved for either hiring 2 additional engineers or purchasing an enterprise AI infrastructure tool that would save the existing team roughly 15 hours per week combined.',
    constraint:
      'The budget approval expires at the end of this fiscal quarter and cannot roll over, and switching infrastructure tools later would require significant migration effort.',
    stakeholders:
      'CFO wants the more cost-predictable option. Engineering manager wants more headcount for long-term team resilience. CTO is agnostic but wants a clear decision framework documented.',
  },
]

/**
 * Returns a single scenario chosen at random from EXAMPLE_SCENARIOS.
 * Useful for the "Surprise me" / random scenario button in the UI.
 */
export function getRandomScenario(): ExampleScenario {
  const index = Math.floor(Math.random() * EXAMPLE_SCENARIOS.length)
  return EXAMPLE_SCENARIOS[index]
}
