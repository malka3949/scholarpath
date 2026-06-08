import { Injectable, Logger } from '@nestjs/common';
import { Scholarship } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

export type RankedScholarship = {
  scholarshipId: string;
  score: number;
  reason: string;
};

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic | null = null;

  isAvailable(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async rankScholarships(
    profileSummary: string,
    scholarships: Scholarship[],
    ruleScores: Map<string, number>,
  ): Promise<RankedScholarship[]> {
    if (!this.isAvailable()) {
      return this.fallbackRanking(scholarships, ruleScores);
    }

    const scholarshipList = scholarships
      .slice(0, 25)
      .map(
        (s, i) =>
          `${i + 1}. id=${s.id}\n   כותרת: ${s.title}\n   תיאור: ${s.description.slice(0, 200)}\n   תגיות: ${s.tags.join(', ')}`,
      )
      .join('\n\n');

    const prompt = `אתה מומחה להתאמת מלגות לסטודנטים בישראל בתחומי מדעי המחשב והנדסה.

פרופיל הסטודנט:
${profileSummary}

מלגות מועמדות (כבר עברו סינון בסיסי):
${scholarshipList}

דרג כל מלגה בציון רלוונטיות 0-100 והסבר קצר (משפט אחד) בעברית.
החזר JSON בלבד — מערך של אובייקטים:
[{"scholarshipId": "...", "score": 85, "reason": "..."}]

דרג לפי התאמה לפרופיל, תחום, מוטיבציה ופוטנציאל קבלה.`;

    try {
      const response = await this.getClient().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as RankedScholarship[];
      return parsed
        .filter(
          (r) =>
            typeof r.scholarshipId === 'string' &&
            typeof r.score === 'number' &&
            r.score >= 0 &&
            r.score <= 100,
        )
        .map((r) => ({
          scholarshipId: r.scholarshipId,
          score: Math.round(r.score),
          reason: r.reason || 'התאמה לפרופיל',
        }));
    } catch (err) {
      this.logger.warn(
        `Claude ranking failed, using rule-based fallback: ${err instanceof Error ? err.message : err}`,
      );
      return this.fallbackRanking(scholarships, ruleScores);
    }
  }

  private fallbackRanking(
    scholarships: Scholarship[],
    ruleScores: Map<string, number>,
  ): RankedScholarship[] {
    return scholarships.map((s) => ({
      scholarshipId: s.id,
      score: ruleScores.get(s.id) ?? 50,
      reason: 'דירוג על בסיס התאמה לכללי זכאות (ללא AI)',
    }));
  }

  async generateMotivationLetter(input: {
    profileSummary: string;
    studentName: string | null;
    scholarshipTitle: string;
    scholarshipDescription: string;
    notes?: string;
  }): Promise<{ letter: string; source: 'ai' | 'template' }> {
    if (!this.isAvailable()) {
      return {
        letter: this.buildTemplateLetter(input),
        source: 'template',
      };
    }

    const notesBlock = input.notes
      ? `\nהערות נוספות מהסטודנט:\n${input.notes}\n`
      : '';

    const prompt = `כתוב מכתב מוטיבציה בעברית לבקשת מלגה.

פרופיל הסטודנט:
${input.profileSummary}
${input.studentName ? `שם: ${input.studentName}` : ''}

פרטי המלגה:
כותרת: ${input.scholarshipTitle}
תיאור: ${input.scholarshipDescription}
${notesBlock}
דרישות:
- 250–400 מילים
- טון אישי, מקצועי ואותנטי
- הדגש התאמה לתחום, מוטיבציה ותרומה עתידית
- אל תכלול כותרות או bullet points — פסקאות רציפות בלבד
- החזר רק את טקסט המכתב, ללא הקדמה`;

    try {
      const response = await this.getClient().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      const letter = textBlock.text.trim();
      if (letter.length < 50) {
        throw new Error('Generated letter too short');
      }

      return { letter, source: 'ai' };
    } catch (err) {
      this.logger.warn(
        `Claude letter generation failed, using template: ${err instanceof Error ? err.message : err}`,
      );
      return {
        letter: this.buildTemplateLetter(input),
        source: 'template',
      };
    }
  }

  private buildTemplateLetter(input: {
    profileSummary: string;
    studentName: string | null;
    scholarshipTitle: string;
    scholarshipDescription: string;
    notes?: string;
  }): string {
    const name = input.studentName ?? 'סטודנט/ית';
    const notes = input.notes ? `\n\n${input.notes}` : '';

    return `שלום רב,

שמי ${name}, ואני פונה אליכם בבקשה לשקול את מועמדותי למלגת "${input.scholarshipTitle}".

${input.profileSummary.split('\n').join('. ')}.

לאור תיאור המלגה — ${input.scholarshipDescription.slice(0, 180)} — אני מאמין/ה שהמלגה מתאימה לכיוון הלימודים והשאיפות שלי. אני מחויב/ת להמשיך ולהתפתח בתחום, ולתרום לקהילה האקדמית והמקצועית.${notes}

תודה על הזמן והשקילה,
${name}`;
  }
}
