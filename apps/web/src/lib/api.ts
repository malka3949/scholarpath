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
  imported: number;
  skipped: number;
  errors?: { index: number; message: string }[];
};

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
