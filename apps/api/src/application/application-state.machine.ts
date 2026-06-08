import { ApplicationStatus } from '@scholarpath/database';

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.NOT_STARTED]: [ApplicationStatus.IN_PROGRESS],
  [ApplicationStatus.IN_PROGRESS]: [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.NOT_STARTED,
  ],
  [ApplicationStatus.SUBMITTED]: [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.IN_PROGRESS,
  ],
  [ApplicationStatus.ACCEPTED]: [],
  [ApplicationStatus.REJECTED]: [ApplicationStatus.IN_PROGRESS],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.NOT_STARTED]: 'לא התחיל',
  [ApplicationStatus.IN_PROGRESS]: 'בתהליך',
  [ApplicationStatus.SUBMITTED]: 'הוגש',
  [ApplicationStatus.ACCEPTED]: 'התקבל',
  [ApplicationStatus.REJECTED]: 'נדחה',
};
