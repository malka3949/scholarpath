export const PRIORITY_VERSION_V1 = 'priority-v1';
export const PRIORITY_VERSION_V2 = 'priority-v2';

export const TIE_BREAKER_EPSILON = 2;

export const CRITICAL_DEADLINE_DAYS = 3;
export const CRITICAL_DEADLINE_URGENCY_BONUS = 15;

export const HIGH_OPPORTUNITY_SCORE_THRESHOLD = 85;
export const HIGH_OPPORTUNITY_IMPACT_BONUS = 10;

export function getScoringWeights() {
  return {
    urgency: parseWeight(process.env.ACTION_WEIGHT_URGENCY, 0.4),
    impact: parseWeight(process.env.ACTION_WEIGHT_IMPACT, 0.3),
    completionGap: parseWeight(process.env.ACTION_WEIGHT_COMPLETION_GAP, 0.2),
    engagement: parseWeight(process.env.ACTION_WEIGHT_ENGAGEMENT, 0.1),
  };
}

function parseWeight(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
