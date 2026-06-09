'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  fetchActions,
  updateActionStatus,
  type UserActionItem,
  ApiError,
} from '@/lib/api';

const PAGE_SIZE = 20;

export default function DashboardActionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [actions, setActions] = useState<UserActionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchActions(session.accessToken, {
        status: 'OPEN',
        limit: PAGE_SIZE,
        offset,
        sort: 'priority_score',
      });
      setActions(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'שגיאה בטעינת פעולות');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, offset]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') return;
    if (!session?.accessToken) {
      setError('לא ניתן לטעון את הפעולות. נסו להתחבר מחדש.');
      setLoading(false);
      return;
    }
    void load();
  }, [status, session?.accessToken, load]);

  async function handleStatus(id: string, next: 'DONE' | 'DISMISSED') {
    if (!session?.accessToken) return;
    try {
      await updateActionStatus(session.accessToken, id, next);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'שגיאה בעדכון פעולה');
    }
  }

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  if (status === 'loading' || loading) {
    return (
      <div className="sp-container py-12 text-center text-slate-600">
        טוען פעולות...
      </div>
    );
  }

  return (
    <div className="sp-container space-y-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← חזרה ללוח בקרה
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-indigo-950">
            כל הפעולות שלך
          </h1>
          <p className="sp-page-subtitle mt-1">
            {total > 0 ? `${total} פעולות פתוחות` : 'אין פעולות פתוחות'}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {actions.length === 0 ? (
        <div className="sp-card p-6 text-center">
          <p className="text-slate-600">אין פעולות פתוחות כרגע.</p>
          <Link href="/scholarships" className="sp-btn-primary mt-4 inline-block">
            עיון במלגות
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {actions.map((action) => (
            <div key={action.id} className="sp-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-indigo-950">
                      {action.title}
                    </h2>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {action.priorityScore}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{action.description}</p>
                </div>
                {action.ctaPath && (
                  <Link href={action.ctaPath} className="sp-btn-primary shrink-0">
                    המשך
                  </Link>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStatus(action.id, 'DONE')}
                  className="cursor-pointer rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50"
                >
                  סיימתי
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(action.id, 'DISMISSED')}
                  className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  התעלם
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="sp-btn-secondary cursor-pointer disabled:opacity-50"
          >
            הקודם
          </button>
          <span className="text-sm text-slate-600">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} מתוך {total}
          </span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="sp-btn-secondary cursor-pointer disabled:opacity-50"
          >
            הבא
          </button>
        </div>
      )}
    </div>
  );
}
