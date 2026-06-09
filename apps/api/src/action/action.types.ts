import {
  ApplicationStatus,
  RelatedEntityType,
  UserActionStatus,
  UserActionType,
} from '@scholarpath/database';

export const DEADLINE_WINDOW_DAYS = 7;
export const ENGAGEMENT_LOOKBACK_DAYS = 14;
export const OPTIMIZATION_SCORE_THRESHOLD = 70;
export const OPPORTUNITY_SCORE_THRESHOLD = 80;
export const RECOMMENDATION_FETCH_LIMIT = 10;

export const OPPORTUNITY_TTL_DAYS = 30;
export const ENGAGEMENT_TTL_DAYS = 14;
export const OPTIMIZATION_TTL_DAYS = 30;

export const PRIORITY_VERSION_V2 = 'priority-v2';

export type ActionScoreInput = {
  type: UserActionType;
  daysLeft?: number;
  recommendationScore?: number;
  missingProfileFields?: number;
  hasLetter?: boolean;
  applicationStatus?: ApplicationStatus;
  hasRecentView?: boolean;
  hasApplyStart?: boolean;
};

export type ActionCandidate = {
  type: UserActionType;
  title: string;
  description: string;
  priorityScore: number;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  ctaPath: string;
  signalHash: string;
  scoreInput: ActionScoreInput;
};

export type UserActionDto = {
  id: string;
  type: UserActionType;
  title: string;
  description: string;
  priorityScore: number;
  status: UserActionStatus;
  relatedEntityType: RelatedEntityType | null;
  relatedEntityId: string | null;
  ctaPath: string | null;
  sourceEventId: string | null;
  priorityVersion: string;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserActionListResponse = {
  items: UserActionDto[];
  total: number;
  limit: number;
  offset: number;
};

export type ActionListQuery = {
  status?: UserActionStatus;
  type?: UserActionType;
  limit?: number;
  offset?: number;
  sort?: 'priority_score' | 'createdAt';
};

export function buildSourceEventId(candidate: ActionCandidate): string {
  return `regenerate:${candidate.relatedEntityType}:${candidate.relatedEntityId}:${candidate.signalHash}`;
}
