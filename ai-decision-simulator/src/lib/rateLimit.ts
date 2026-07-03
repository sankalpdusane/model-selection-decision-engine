/** Duration of the sliding window in milliseconds (60 seconds). */
export const RATE_LIMIT_WINDOW_MS = 60_000

/** Maximum number of requests allowed per identifier within the window. */
const MAX_REQUESTS = 10

/**
 * In-memory store mapping each identifier (e.g. IP address) to an ordered
 * array of request timestamps (ms since epoch).
 */
const store = new Map<string, number[]>()

/**
 * Checks whether a given identifier is within the allowed rate limit.
 *
 * Uses a sliding-window algorithm:
 * - Timestamps older than RATE_LIMIT_WINDOW_MS are pruned on every call.
 * - If the remaining count is >= MAX_REQUESTS, the request is denied.
 * - Otherwise the current timestamp is recorded and the request is allowed.
 *
 * @param identifier - A unique key per client, typically the request IP address.
 * @returns `{ allowed: true }` when under the limit, or
 *          `{ allowed: false, retryAfter: number }` (seconds) when the limit is exceeded.
 */
export function checkRateLimit(
  identifier: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS

  // Retrieve or create the timestamp log for this identifier.
  const timestamps = store.get(identifier) ?? []

  // Prune timestamps that have fallen outside the current window.
  const recent = timestamps.filter((t) => t > windowStart)

  if (recent.length >= MAX_REQUESTS) {
    // The oldest timestamp in the window determines when a slot frees up.
    const oldestTimestamp = recent[0]
    const retryAfter = Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000)
    store.set(identifier, recent)
    return { allowed: false, retryAfter }
  }

  // Record the current request and persist the updated log.
  recent.push(now)
  store.set(identifier, recent)
  return { allowed: true }
}
