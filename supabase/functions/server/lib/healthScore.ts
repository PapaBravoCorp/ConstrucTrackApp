export interface HealthScoreFactors {
  delayedMilestonesCount: number;
  criticalBlockersCount: number;
  overdueReviewSlaCount: number;
  staleMilestoneCount: number;
  unresolvedRejectedCount: number;
}

export interface HealthScoreResult {
  score: number;
  tier: 'Healthy' | 'Warning' | 'At Risk' | 'Critical';
}

/**
 * Deterministic formula to compute the Project Health Score.
 * Base score = 100
 * Penalties:
 * - delayed milestone = -10 each
 * - critical blocker = -20 each
 * - overdue review SLA = -15 each
 * - stale milestone update = -5 each
 * - rejected milestone unresolved > 3 days = -8 each
 *
 * Tiers:
 * 85-100 = Healthy
 * 70-84 = Warning
 * 50-69 = At Risk
 * <50 = Critical
 */
export function computeHealthScore(factors: HealthScoreFactors): HealthScoreResult {
  let score = 100;

  score -= factors.delayedMilestonesCount * 10;
  score -= factors.criticalBlockersCount * 20;
  score -= factors.overdueReviewSlaCount * 15;
  score -= factors.staleMilestoneCount * 5;
  score -= factors.unresolvedRejectedCount * 8;

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  let tier: HealthScoreResult['tier'] = 'Healthy';
  if (score < 50) {
    tier = 'Critical';
  } else if (score < 70) {
    tier = 'At Risk';
  } else if (score < 85) {
    tier = 'Warning';
  }

  return { score, tier };
}
