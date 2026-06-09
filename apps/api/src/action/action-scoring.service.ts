import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  UserActionType,
} from '@scholarpath/database';
import {
  CRITICAL_DEADLINE_DAYS,
  CRITICAL_DEADLINE_URGENCY_BONUS,
  getScoringWeights,
  HIGH_OPPORTUNITY_IMPACT_BONUS,
  HIGH_OPPORTUNITY_SCORE_THRESHOLD,
  TIE_BREAKER_EPSILON,
} from './action-scoring.constants';
import { ActionCandidate, ActionScoreInput } from './action.types';

@Injectable()
export class ActionScoringService {
  computePriorityScore(input: ActionScoreInput): number {
    const weights = getScoringWeights();
    let urgency = this.computeUrgency(input);
    let impact = this.computeImpact(input);
    const completionGap = this.computeCompletionGap(input);
    const engagement = this.computeEngagement(input);

    if (
      input.type === UserActionType.DEADLINE_ACTION &&
      input.daysLeft !== undefined &&
      input.daysLeft <= CRITICAL_DEADLINE_DAYS
    ) {
      urgency = Math.min(100, urgency + CRITICAL_DEADLINE_URGENCY_BONUS);
    }

    if (
      input.type === UserActionType.OPPORTUNITY_ACTION &&
      (input.recommendationScore ?? 0) >= HIGH_OPPORTUNITY_SCORE_THRESHOLD
    ) {
      impact = Math.min(100, impact + HIGH_OPPORTUNITY_IMPACT_BONUS);
    }

    const raw =
      urgency * weights.urgency +
      impact * weights.impact +
      completionGap * weights.completionGap +
      engagement * weights.engagement;

    return Math.min(100, Math.round(raw));
  }

  sortCandidates(candidates: ActionCandidate[]): ActionCandidate[] {
    return [...candidates].sort((a, b) => {
      const scoreDiff = b.priorityScore - a.priorityScore;
      if (Math.abs(scoreDiff) > TIE_BREAKER_EPSILON) {
        return scoreDiff;
      }
      return this.getTieBreakerRank(a) - this.getTieBreakerRank(b);
    });
  }

  getTieBreakerRank(candidate: ActionCandidate): number {
    if (candidate.type === UserActionType.DEADLINE_ACTION) {
      const noLetter = !candidate.scoreInput.hasLetter;
      const inProgress =
        candidate.scoreInput.applicationStatus === ApplicationStatus.IN_PROGRESS;
      if (inProgress && noLetter) return 2;
      return 1;
    }
    if (candidate.type === UserActionType.OPPORTUNITY_ACTION) return 3;
    if (candidate.type === UserActionType.OPTIMIZATION_ACTION) return 4;
    if (candidate.type === UserActionType.COMPLETION_ACTION) return 5;
    if (candidate.type === UserActionType.ENGAGEMENT_ACTION) return 6;
    return 99;
  }

  private computeUrgency(input: ActionScoreInput): number {
    if (input.type !== UserActionType.DEADLINE_ACTION) return 0;
    if (input.daysLeft === undefined || input.daysLeft > 7) return 0;
    return Math.round(100 - (input.daysLeft * 100) / 7);
  }

  private computeImpact(input: ActionScoreInput): number {
    switch (input.type) {
      case UserActionType.DEADLINE_ACTION:
        return 80;
      case UserActionType.COMPLETION_ACTION:
        return 60;
      case UserActionType.OPTIMIZATION_ACTION:
      case UserActionType.OPPORTUNITY_ACTION:
        return Math.round(input.recommendationScore ?? 0);
      case UserActionType.ENGAGEMENT_ACTION:
        return 50;
      default:
        return 0;
    }
  }

  private computeCompletionGap(input: ActionScoreInput): number {
    switch (input.type) {
      case UserActionType.DEADLINE_ACTION: {
        if (!input.hasLetter) return 100;
        if (input.applicationStatus === ApplicationStatus.NOT_STARTED) return 50;
        return 0;
      }
      case UserActionType.COMPLETION_ACTION: {
        const missing = input.missingProfileFields ?? 0;
        return Math.round((missing / 3) * 100);
      }
      case UserActionType.OPTIMIZATION_ACTION:
      case UserActionType.OPPORTUNITY_ACTION:
      case UserActionType.ENGAGEMENT_ACTION:
        return 30;
      default:
        return 0;
    }
  }

  private computeEngagement(input: ActionScoreInput): number {
    if (input.type === UserActionType.ENGAGEMENT_ACTION) {
      return input.hasRecentView && !input.hasApplyStart ? 100 : 0;
    }
    if (
      input.type === UserActionType.OPTIMIZATION_ACTION ||
      input.type === UserActionType.OPPORTUNITY_ACTION
    ) {
      return input.hasRecentView ? 20 : 0;
    }
    return 0;
  }
}
