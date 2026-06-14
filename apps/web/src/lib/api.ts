const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parseError(res: Response) {
  try {
    const data = await res.json();
    if (Array.isArray(data.message)) return data.message.join(', ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    // ignore
  }
  return 'שגיאה בלתי צפויה';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'STUDENT' | 'ADMIN';
  profile: StudentProfile | null;
};

export type StudentProfile = {
  id: string;
  userId: string;
  fieldOfStudy: string | null;
  year: number | null;
  gpa: number | null;
  preferences: Record<string, unknown> | null;
  emailNotificationsEnabled?: boolean;
};

export type ScholarshipSource = 'SEED' | 'ADMIN' | 'IMPORTED';

export type Scholarship = {
  id: string;
  title: string;
  description: string;
  eligibilityRules: Record<string, unknown> | null;
  deadline: string | null;
  sourceUrl: string | null;
  tags: string[];
  source?: ScholarshipSource;
};

export type ScholarshipEventType = 'VIEW' | 'APPLY_START';

export type ImportScholarshipsResult = {
  jobId: string;
  imported: number;
  updated: number;
  skipped: number;
  errors?: { index: number; message: string }[];
};

export type IngestionJobItem = {
  id: string;
  sourceType: string;
  sourceRef: string;
  status: string;
  imported: number;
  updated: number;
  skipped: number;
  startedAt: string;
  completedAt?: string | null;
  errorLog?: unknown;
};

export type IngestionJobListResponse = {
  items: IngestionJobItem[];
  total: number;
  limit: number;
  offset: number;
};

export type IngestionResult = ImportScholarshipsResult;

export type CommunityPostItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorName: string;
  commentCount?: number;
};

export type CommunityCommentItem = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  parentId?: string | null;
};

export type CommunityPostDetail = CommunityPostItem & {
  comments: CommunityCommentItem[];
};

export type Application = {
  id: string;
  userId: string;
  scholarshipId: string;
  status: ApplicationStatus;
  motivationLetter: string | null;
  scholarship: Scholarship;
  createdAt: string;
  updatedAt: string;
};

export type GenerateLetterResponse = {
  application: Application;
  source: 'ai' | 'template';
};

export type ApplicationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED';

export type RecommendationItem = {
  id: string;
  score: number;
  matchReason: string | null;
  scholarship: Scholarship;
};

export type RecommendationsResponse = {
  source: 'ai' | 'rules';
  computedAt: string;
  items: RecommendationItem[];
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  NOT_STARTED: 'לא התחיל',
  IN_PROGRESS: 'בתהליך',
  SUBMITTED: 'הוגש',
  ACCEPTED: 'התקבל',
  REJECTED: 'נדחה',
};

export const NEXT_STATUS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED', 'NOT_STARTED'],
  SUBMITTED: ['ACCEPTED', 'REJECTED', 'IN_PROGRESS'],
  REJECTED: ['IN_PROGRESS'],
};

export function getAvailableNextStatuses(
  status: ApplicationStatus,
  deadline: string | null | undefined,
): ApplicationStatus[] {
  const next = NEXT_STATUS[status] ?? [];
  if (!isScholarshipDeadlineOpen(deadline)) {
    return next.filter((s) => s !== 'SUBMITTED');
  }
  return next;
}

export async function loginRequest(email: string, password: string) {
  return apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerRequest(
  email: string,
  password: string,
  name: string,
) {
  return apiFetch<{ accessToken: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export async function googleAuthRequest(data: {
  googleId: string;
  email: string;
  name?: string;
}) {
  return apiFetch<{ accessToken: string; user: AuthUser }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRecommendations(token: string) {
  return apiFetch<RecommendationsResponse>('/recommendations', { token });
}

export async function refreshRecommendations(token: string) {
  return apiFetch<RecommendationsResponse>('/recommendations/refresh', {
    method: 'POST',
    token,
  });
}

export async function getApplications(token: string) {
  return apiFetch<Application[]>('/applications', { token });
}

export async function getApplication(token: string, id: string) {
  return apiFetch<Application>(`/applications/${id}`, { token });
}

export async function startApplicationWorkflow(token: string, scholarshipId: string) {
  return apiFetch<Application>(`/applications/start/${scholarshipId}`, {
    method: 'POST',
    token,
  });
}

export async function saveMotivationLetter(
  token: string,
  applicationId: string,
  motivationLetter: string,
) {
  return apiFetch<Application>(`/applications/${applicationId}/letter`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ motivationLetter }),
  });
}

export async function generateMotivationLetter(
  token: string,
  applicationId: string,
  notes?: string,
) {
  return apiFetch<GenerateLetterResponse>(
    `/applications/${applicationId}/generate-letter`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(notes ? { notes } : {}),
    },
  );
}

export type NotificationType =
  | 'DEADLINE_APPROACHING'
  | 'APPLICATION_STATUS'
  | 'SYSTEM';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  scholarshipId: string | null;
  applicationId: string | null;
  applicationStatus?: ApplicationStatus | null;
  createdAt: string;
  scholarship?: { id: string; title: string; deadline: string | null };
};

export type UnreadCountResponse = { count: number };

export async function getNotifications(token: string) {
  return apiFetch<NotificationItem[]>('/notifications', { token });
}

export async function getUnreadCount(token: string) {
  return apiFetch<UnreadCountResponse>('/notifications/unread-count', {
    token,
  });
}

export async function markNotificationRead(token: string, id: string) {
  return apiFetch<NotificationItem>(`/notifications/${id}/read`, {
    method: 'PATCH',
    token,
  });
}

export async function markAllNotificationsRead(token: string) {
  return apiFetch<{ updated: number }>('/notifications/read-all', {
    method: 'PATCH',
    token,
  });
}

export async function syncDeadlineNotifications(token: string) {
  return apiFetch<{ created: number }>('/notifications/sync-deadlines', {
    method: 'POST',
    token,
  });
}

export type ImportScholarshipItem = {
  title: string;
  description: string;
  deadline?: string;
  sourceUrl?: string;
  tags?: string[];
  eligibilityRules?: Record<string, unknown>;
};

export async function importScholarships(
  token: string,
  items: ImportScholarshipItem[],
) {
  return apiFetch<ImportScholarshipsResult>('/admin/scholarships/import', {
    method: 'POST',
    token,
    body: JSON.stringify({ items }),
  });
}

export async function fetchExternalScholarships(token: string, sourceKey: string) {
  return apiFetch<IngestionResult>('/admin/ingestion/fetch', {
    method: 'POST',
    token,
    body: JSON.stringify({ sourceKey }),
  });
}

export async function fetchIngestionJobs(
  token: string,
  params?: { status?: string; limit?: number; offset?: number },
) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.limit !== undefined) search.set('limit', String(params.limit));
  if (params?.offset !== undefined) search.set('offset', String(params.offset));
  const qs = search.toString();
  return apiFetch<IngestionJobListResponse>(
    `/admin/ingestion/jobs${qs ? `?${qs}` : ''}`,
    { token },
  );
}

export async function fetchIngestionJob(token: string, id: string) {
  return apiFetch<IngestionJobItem>(`/admin/ingestion/jobs/${id}`, { token });
}

export async function recordScholarshipEvent(
  token: string,
  scholarshipId: string,
  eventType: ScholarshipEventType,
) {
  return apiFetch<{ ok: boolean }>(`/scholarships/${scholarshipId}/events`, {
    method: 'POST',
    token,
    body: JSON.stringify({ eventType }),
  });
}

export async function getCommunityPosts() {
  return apiFetch<CommunityPostItem[]>('/community/posts');
}

export async function getCommunityPost(id: string) {
  return apiFetch<CommunityPostDetail>(`/community/posts/${id}`);
}

export async function createCommunityPost(
  token: string,
  title: string,
  body: string,
) {
  return apiFetch<CommunityPostItem>('/community/posts', {
    method: 'POST',
    token,
    body: JSON.stringify({ title, body }),
  });
}

export async function addCommunityComment(
  token: string,
  postId: string,
  body: string,
  parentId?: string,
) {
  return apiFetch<CommunityCommentItem>(
    `/community/posts/${postId}/comments`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(parentId ? { body, parentId } : { body }),
    },
  );
}

export type UserActionType =
  | 'DEADLINE_ACTION'
  | 'COMPLETION_ACTION'
  | 'OPTIMIZATION_ACTION'
  | 'OPPORTUNITY_ACTION'
  | 'ENGAGEMENT_ACTION';

export type UserActionStatus = 'OPEN' | 'DONE' | 'DISMISSED' | 'EXPIRED';

export type UserActionItem = {
  id: string;
  type: UserActionType;
  title: string;
  description: string;
  priorityScore: number;
  status: UserActionStatus;
  relatedEntityType: 'APPLICATION' | 'SCHOLARSHIP' | 'PROFILE' | 'RECOMMENDATION' | null;
  relatedEntityId: string | null;
  ctaPath: string | null;
  sourceEventId?: string | null;
  priorityVersion?: string;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserActionListResponse = {
  items: UserActionItem[];
  total: number;
  limit: number;
  offset: number;
};

export type FetchActionsParams = {
  status?: UserActionStatus;
  type?: UserActionType;
  limit?: number;
  offset?: number;
  sort?: 'priority_score' | 'createdAt';
};

export async function fetchActions(
  token: string,
  params: FetchActionsParams = {},
) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.type) search.set('type', params.type);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  if (params.sort) search.set('sort', params.sort);
  const qs = search.toString();
  return apiFetch<UserActionListResponse>(`/actions${qs ? `?${qs}` : ''}`, {
    token,
  });
}

export async function regenerateActions(token: string) {
  return apiFetch<UserActionListResponse>('/actions/regenerate', {
    method: 'POST',
    token,
  });
}

export async function updateActionStatus(
  token: string,
  id: string,
  status: 'DONE' | 'DISMISSED',
) {
  return apiFetch<UserActionItem>(`/actions/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}

export function scholarshipSourceLabel(
  source?: ScholarshipSource,
): string | null {
  if (source === 'IMPORTED') return 'מיובא';
  if (source === 'SEED') return 'דמו';
  return null;
}

export function isDeadlineWithinDays(
  deadline: string | null | undefined,
  days = 7,
): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return d > now && d <= end;
}

/** Deadline unset or still in the future. */
export function isScholarshipDeadlineOpen(
  deadline: string | null | undefined,
): boolean {
  if (!deadline) return true;
  return new Date(deadline) > new Date();
}

const OPPORTUNITY_EXCLUDED_STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
];

/**
 * Recommendations suitable for dashboard "open opportunities":
 * open deadline and no application in a terminal (post-submit) state.
 */
export function filterOpenOpportunities(
  items: RecommendationItem[],
  applications: Application[],
): RecommendationItem[] {
  const appByScholarship = new Map(
    applications.map((a) => [a.scholarshipId, a]),
  );

  return items.filter((rec) => {
    if (!isScholarshipDeadlineOpen(rec.scholarship.deadline)) return false;
    const app = appByScholarship.get(rec.scholarship.id);
    if (app && OPPORTUNITY_EXCLUDED_STATUSES.includes(app.status)) return false;
    return true;
  });
}
