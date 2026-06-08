import { Injectable } from '@nestjs/common';
import { StudentProfile } from '@prisma/client';

@Injectable()
export class ProfileSummarizerService {
  summarize(profile: StudentProfile): string {
    const parts: string[] = [];

    if (profile.fieldOfStudy) {
      parts.push(`תחום לימודים: ${profile.fieldOfStudy}`);
    }
    if (profile.year != null) {
      parts.push(`שנת לימודים: ${profile.year}`);
    }
    if (profile.gpa != null) {
      parts.push(`ממוצע: ${profile.gpa}`);
    }

    const prefs = profile.preferences;
    if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
      const record = prefs as Record<string, unknown>;
      if (Array.isArray(record.interests) && record.interests.length > 0) {
        parts.push(`תחומי עניין: ${record.interests.join(', ')}`);
      }
      if (typeof record.goals === 'string' && record.goals) {
        parts.push(`מטרות: ${record.goals}`);
      }
    }

    return parts.length > 0
      ? parts.join('\n')
      : 'פרופיל סטודנט ללא פרטים מפורטים';
  }
}
