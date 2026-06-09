import { ActionScoringService } from './action-scoring.service';
import {
  ApplicationStatus,
  UserActionType,
} from '@scholarpath/database';

describe('ActionScoringService', () => {
  let service: ActionScoringService;

  beforeEach(() => {
    service = new ActionScoringService();
  });

  it('computes DEADLINE_ACTION score deterministically', () => {
    const score = service.computePriorityScore({
      type: UserActionType.DEADLINE_ACTION,
      daysLeft: 3,
      hasLetter: false,
      applicationStatus: ApplicationStatus.IN_PROGRESS,
    });
    // urgency=57+15=72, impact=80, completion_gap=100, engagement=0
    // round(72*0.4 + 80*0.3 + 100*0.2) = round(28.8+24+20) = 73
    expect(score).toBe(73);
  });

  it('computes COMPLETION_ACTION score deterministically', () => {
    const score = service.computePriorityScore({
      type: UserActionType.COMPLETION_ACTION,
      missingProfileFields: 2,
    });
    // impact=60, completion_gap=67 -> round(18+13.4) = 31
    expect(score).toBe(31);
  });

  it('computes OPTIMIZATION_ACTION score deterministically', () => {
    const score = service.computePriorityScore({
      type: UserActionType.OPTIMIZATION_ACTION,
      recommendationScore: 75,
      hasRecentView: true,
    });
    // impact=75, completion_gap=30, engagement=20
    // round(22.5+6+2) = 31
    expect(score).toBe(31);
  });

  it('computes ENGAGEMENT_ACTION score deterministically', () => {
    const score = service.computePriorityScore({
      type: UserActionType.ENGAGEMENT_ACTION,
      hasRecentView: true,
      hasApplyStart: false,
    });
    // impact=50, completion_gap=30, engagement=100
    // round(15+6+10) = 31
    expect(score).toBe(31);
  });

  it('caps score at 100', () => {
    const score = service.computePriorityScore({
      type: UserActionType.DEADLINE_ACTION,
      daysLeft: 0,
      hasLetter: false,
      applicationStatus: ApplicationStatus.NOT_STARTED,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBe(84);
  });

  it('applies high opportunity bonus', () => {
    const score = service.computePriorityScore({
      type: UserActionType.OPPORTUNITY_ACTION,
      recommendationScore: 90,
      hasRecentView: false,
    });
    // impact=100 (90+10), completion_gap=30 → round(30+6)=36
    expect(score).toBe(36);
  });

  it('sorts by tie-breaker when scores within epsilon', () => {
    const deadlineCandidate = {
      type: UserActionType.DEADLINE_ACTION,
      title: 'd',
      description: 'd',
      priorityScore: 50,
      relatedEntityType: 'APPLICATION' as const,
      relatedEntityId: 'a1',
      ctaPath: '/applications/a1',
      signalHash: 'x',
      scoreInput: {
        type: UserActionType.DEADLINE_ACTION,
        daysLeft: 5,
        hasLetter: false,
        applicationStatus: ApplicationStatus.IN_PROGRESS,
      },
    };
    const completionCandidate = {
      type: UserActionType.COMPLETION_ACTION,
      title: 'c',
      description: 'c',
      priorityScore: 51,
      relatedEntityType: 'PROFILE' as const,
      relatedEntityId: 'u1',
      ctaPath: '/profile',
      signalHash: 'y',
      scoreInput: {
        type: UserActionType.COMPLETION_ACTION,
        missingProfileFields: 2,
      },
    };

    const sorted = service.sortCandidates([completionCandidate, deadlineCandidate]);
    expect(sorted[0].type).toBe(UserActionType.DEADLINE_ACTION);
  });
});
