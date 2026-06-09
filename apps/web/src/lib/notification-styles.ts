import {
  isScholarshipDeadlineOpen,
  type ApplicationStatus,
  type NotificationItem,
  type NotificationType,
} from './api';

export type NotificationVisualKind =
  | 'deadline_expired'
  | 'deadline_not_started'
  | 'deadline_in_progress'
  | 'application_submitted'
  | 'system';

export type NotificationStyle = {
  kind: NotificationVisualKind;
  label: string;
  cardClass: string;
  unreadRingClass: string;
  badgeClass: string;
  titleClass: string;
};

const STYLES: Record<NotificationVisualKind, Omit<NotificationStyle, 'kind'>> = {
  deadline_expired: {
    label: 'פג תוקף',
    cardClass: 'border-red-200 bg-red-50/50',
    unreadRingClass: 'ring-red-300',
    badgeClass: 'bg-red-100 text-red-800',
    titleClass: 'text-red-950',
  },
  deadline_not_started: {
    label: 'טרם התחיל',
    cardClass: 'border-amber-200 bg-amber-50/50',
    unreadRingClass: 'ring-amber-300',
    badgeClass: 'bg-amber-100 text-amber-900',
    titleClass: 'text-amber-950',
  },
  deadline_in_progress: {
    label: 'בתהליך',
    cardClass: 'border-orange-200 bg-orange-50/50',
    unreadRingClass: 'ring-orange-300',
    badgeClass: 'bg-orange-100 text-orange-900',
    titleClass: 'text-orange-950',
  },
  application_submitted: {
    label: 'הוגש',
    cardClass: 'border-emerald-200 bg-emerald-50/50',
    unreadRingClass: 'ring-emerald-300',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    titleClass: 'text-emerald-950',
  },
  system: {
    label: 'מערכת',
    cardClass: 'border-slate-200 bg-slate-50/50',
    unreadRingClass: 'ring-slate-300',
    badgeClass: 'bg-slate-100 text-slate-700',
    titleClass: 'text-slate-900',
  },
};

function isDeadlineExpired(item: NotificationItem): boolean {
  return Boolean(
    item.scholarship?.deadline &&
      !isScholarshipDeadlineOpen(item.scholarship.deadline),
  );
}

export function getNotificationVisualKind(
  item: NotificationItem,
): NotificationVisualKind {
  if (item.type === 'SYSTEM') return 'system';

  if (item.type === 'APPLICATION_STATUS') {
    return 'application_submitted';
  }

  const status = item.applicationStatus;
  if (status === 'SUBMITTED') {
    return 'application_submitted';
  }

  if (isDeadlineExpired(item)) {
    return 'deadline_expired';
  }

  if (status === 'IN_PROGRESS') {
    return 'deadline_in_progress';
  }

  return 'deadline_not_started';
}

export function getNotificationStyle(item: NotificationItem): NotificationStyle {
  const kind = getNotificationVisualKind(item);
  return { kind, ...STYLES[kind] };
}

export function getNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'DEADLINE_APPROACHING':
      return 'מועד אחרון';
    case 'APPLICATION_STATUS':
      return 'סטטוס בקשה';
    case 'SYSTEM':
      return 'מערכת';
    default:
      return type;
  }
}

export function getApplicationStatusLabel(
  status: ApplicationStatus | null | undefined,
): string | null {
  if (!status) return null;
  switch (status) {
    case 'NOT_STARTED':
      return 'טרם התחיל';
    case 'IN_PROGRESS':
      return 'בתהליך';
    case 'SUBMITTED':
      return 'הוגש';
    case 'ACCEPTED':
      return 'התקבל';
    case 'REJECTED':
      return 'נדחה';
    default:
      return null;
  }
}
