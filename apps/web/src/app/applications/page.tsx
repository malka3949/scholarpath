'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  apiFetch,
  type Application,
  type ApplicationStatus,
  STATUS_LABELS,
  NEXT_STATUS,
  isDeadlineWithinDays,
} from '@/lib/api';

export default function ApplicationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.accessToken) loadApplications();
  }, [session?.accessToken]);

  async function loadApplications() {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<Application[]>('/applications', {
        token: session.accessToken,
      });
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: ApplicationStatus) {
    if (!session?.accessToken) return;
    try {
      await apiFetch(`/applications/${id}/status`, {
        method: 'PATCH',
        token: session.accessToken,
        body: JSON.stringify({ status: newStatus }),
      });
      await loadApplications();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'שגיאה בעדכון');
    }
  }

  if (status === 'loading' || loading) {
    return <p className="text-center text-sm text-slate-500">טוען בקשות...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="sp-page-title">הבקשות שלי</h1>
        <p className="sp-page-subtitle">
          עקוב אחרי סטטוס, ערוך מכתבי מוטיבציה והגש בקשות
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {applications.length === 0 && (
        <div className="sp-card text-center text-slate-500">
          אין בקשות במעקב.{' '}
          <Link href="/scholarships" className="font-medium text-primary hover:underline">
            עיין במלגות
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {applications.map((app) => {
          const nextStatuses = NEXT_STATUS[app.status] ?? [];
          const hasLetter = Boolean(app.motivationLetter?.trim());
          const deadlineSoon =
            (app.status === 'NOT_STARTED' || app.status === 'IN_PROGRESS') &&
            isDeadlineWithinDays(app.scholarship.deadline);

          return (
            <article key={app.id} className="sp-card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-indigo-950">
                    {app.scholarship.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    סטטוס:{' '}
                    <span className="font-medium text-indigo-800">
                      {STATUS_LABELS[app.status]}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {hasLetter
                      ? 'מכתב מוטיבציה: נשמר'
                      : 'מכתב מוטיבציה: טרם נוצר'}
                  </p>
                  {deadlineSoon && app.scholarship.deadline && (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      מועד אחרון בקרוב:{' '}
                      {new Date(app.scholarship.deadline).toLocaleDateString(
                        'he-IL',
                      )}
                    </p>
                  )}
                </div>
                <Link
                  href={`/applications/${app.id}`}
                  className="sp-btn-primary shrink-0"
                >
                  {hasLetter ? 'ערוך מכתב' : 'התחל בקשה'}
                </Link>
              </div>

              {nextStatuses.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-indigo-50 pt-4">
                  {nextStatuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(app.id, s)}
                      className="sp-btn-secondary text-sm"
                    >
                      → {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
