'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  apiFetch,
  generateMotivationLetter,
  getApplication,
  saveMotivationLetter,
  type Application,
  type ApplicationStatus,
  STATUS_LABELS,
  NEXT_STATUS,
} from '@/lib/api';

export default function ApplicationWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [letter, setLetter] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [letterSource, setLetterSource] = useState<'ai' | 'template' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.accessToken) loadApplication();
  }, [session?.accessToken, applicationId]);

  async function loadApplication() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await getApplication(session.accessToken, applicationId);
      setApplication(data);
      setLetter(data.motivationLetter ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!session?.accessToken || !letter.trim()) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updated = await saveMotivationLetter(
        session.accessToken,
        applicationId,
        letter.trim(),
      );
      setApplication(updated);
      setMessage('הטיוטה נשמרה');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!session?.accessToken) return;
    setGenerating(true);
    setMessage('');
    setError('');
    try {
      const result = await generateMotivationLetter(
        session.accessToken,
        applicationId,
        notes.trim() || undefined,
      );
      setApplication(result.application);
      setLetter(result.application.motivationLetter ?? '');
      setLetterSource(result.source);
      setMessage(
        result.source === 'ai'
          ? 'מכתב נוצר בעזרת AI — ערוך ושמור לפני הגשה'
          : 'טיוטה נוצרה (ללא AI) — ערוך ושמור',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירה');
    } finally {
      setGenerating(false);
    }
  }

  async function updateStatus(newStatus: ApplicationStatus) {
    if (!session?.accessToken) return;
    try {
      const updated = await apiFetch<Application>(
        `/applications/${applicationId}/status`,
        {
          method: 'PATCH',
          token: session.accessToken,
          body: JSON.stringify({ status: newStatus }),
        },
      );
      setApplication(updated);
      setMessage(`סטטוס עודכן: ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס');
    }
  }

  if (status === 'loading' || loading) {
    return <p className="text-center text-sm text-slate-500">טוען בקשה...</p>;
  }

  if (!application) {
    return (
      <div className="sp-card text-center">
        <p className="text-red-700">{error || 'בקשה לא נמצאה'}</p>
        <Link href="/applications" className="sp-btn-secondary mt-4 inline-block">
          חזרה לבקשות
        </Link>
      </div>
    );
  }

  const nextStatuses = NEXT_STATUS[application.status] ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/applications" className="text-sm font-medium text-primary hover:underline">
        ← חזרה לבקשות שלי
      </Link>

      <div className="sp-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="sp-page-title text-2xl">{application.scholarship.title}</h1>
            <p className="sp-page-subtitle">עריכת מכתב מוטיבציה והגשת בקשה</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            {STATUS_LABELS[application.status]}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          {application.scholarship.description}
        </p>
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <section className="sp-card space-y-4">
        <div>
          <label className="sp-label">הערות ל-AI (אופציונלי)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="למשל: הדגש ניסיון בפרויקט גמר, התנדבות..."
            className="sp-input"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="sp-btn-cta disabled:opacity-50"
          >
            {generating ? 'יוצר מכתב...' : 'צור מכתב עם AI'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !letter.trim()}
            className="sp-btn-primary disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמור טיוטה'}
          </button>
        </div>

        {letterSource && (
          <p className="text-xs text-slate-500">
            מקור אחרון: {letterSource === 'ai' ? 'Claude AI' : 'תבנית בסיסית'}
          </p>
        )}
      </section>

      <section className="sp-card space-y-3">
        <label htmlFor="motivation-letter" className="sp-label">
          מכתב מוטיבציה
        </label>
        <textarea
          id="motivation-letter"
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          rows={16}
          placeholder="כתוב כאן את מכתב המוטיבציה, או לחץ 'צור מכתב עם AI'..."
          className="sp-input min-h-[320px] resize-y leading-relaxed"
        />
        <p className="text-xs text-slate-500">{letter.length} תווים</p>
      </section>

      {nextStatuses.length > 0 && (
        <section className="sp-card flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-700">עדכון סטטוס:</span>
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className="sp-btn-secondary text-sm"
            >
              → {STATUS_LABELS[s]}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
