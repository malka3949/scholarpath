'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  fetchActions,
  regenerateActions,
  updateActionStatus,
  getRecommendations,
  getApplications,
  isDeadlineWithinDays,
  filterOpenOpportunities,
  type UserActionItem,
  type RecommendationItem,
  type Application,
  ApiError,
} from '@/lib/api';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [actions, setActions] = useState<UserActionItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [actionsRes, recRes, apps] = await Promise.all([
        fetchActions(session.accessToken, { status: 'OPEN', limit: 5 }),
        getRecommendations(session.accessToken).catch(() => ({
          items: [] as RecommendationItem[],
        })),
        getApplications(session.accessToken).catch(() => [] as Application[]),
      ]);
      setActions(actionsRes.items);
      setRecommendations(
        filterOpenOpportunities(recRes.items, apps).slice(0, 3),
      );
      setApplications(apps);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'שגיאה בטעינת לוח הבקרה');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') return;
    if (!session?.accessToken) {
      setError('לא ניתן לטעון את לוח הבקרה. נסו להתחבר מחדש.');
      setLoading(false);
      return;
    }
    void load();
  }, [status, session?.accessToken, load]);

  async function handleRefresh() {
    if (!session?.accessToken) return;
    setRefreshing(true);
    setMessage('');
    setError('');
    try {
      const res = await regenerateActions(session.accessToken);
      setActions(res.items);
      setMessage('הפעולות עודכנו');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'שגיאה ברענון');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleStatus(id: string, next: 'DONE' | 'DISMISSED') {
    if (!session?.accessToken) return;
    try {
      await updateActionStatus(session.accessToken, id, next);
      setActions((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'שגיאה בעדכון פעולה');
    }
  }

  const pressureApps = applications.filter(
    (app) =>
      (app.status === 'NOT_STARTED' || app.status === 'IN_PROGRESS') &&
      isDeadlineWithinDays(app.scholarship.deadline, 7),
  );

  if (status === 'loading' || loading) {
    return (
      <div className="sp-container py-12 text-center text-slate-600">
        טוען לוח בקרה...
      </div>
    );
  }

  return (
    <div className="sp-container space-y-10 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-950">לוח בקרה</h1>
          <p className="sp-page-subtitle mt-1">
            הפעולות הבאות שלך, הזדמנויות ודדליינים במקום אחד
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="sp-btn-secondary cursor-pointer disabled:opacity-60"
        >
          {refreshing ? 'מרענן...' : 'רענון פעולות'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-indigo-950">
            הפעולות הבאות שלך
          </h2>
          <Link
            href="/dashboard/actions"
            className="text-sm text-indigo-600 hover:underline"
          >
            הצג הכל
          </Link>
        </div>
        {actions.length === 0 ? (
          <div className="sp-card p-6 text-center">
            <p className="text-slate-600">אין פעולות כרגע — מעולה!</p>
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-indigo-950">
                        {action.title}
                      </h3>
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
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-indigo-950">
            הזדמנויות מומלצות
          </h2>
          <Link href="/recommendations" className="text-sm text-indigo-600 hover:underline">
            כל ההמלצות
          </Link>
        </div>
        {recommendations.length === 0 ? (
          <div className="sp-card p-5 text-sm text-slate-600">
            אין המלצות עדיין —{' '}
            <Link href="/profile" className="text-indigo-600 hover:underline">
              השלם/י פרופיל
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {recommendations.map((rec) => (
              <Link
                key={rec.id}
                href={`/scholarships/${rec.scholarship.id}`}
                className="sp-card block p-4 transition-shadow hover:shadow-md"
              >
                <p className="font-medium text-indigo-950">
                  {rec.scholarship.title}
                </p>
                <p className="mt-1 text-xs text-slate-500">ציון {rec.score}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-indigo-950">דדליינים קרובים</h2>
        {pressureApps.length === 0 ? (
          <div className="sp-card p-5 text-sm text-slate-600">
            אין דדליינים בשבוע הקרוב
          </div>
        ) : (
          <ul className="space-y-2">
            {pressureApps.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}`}
                  className="sp-card flex items-center justify-between p-4 hover:shadow-md"
                >
                  <span className="font-medium text-indigo-950">
                    {app.scholarship.title}
                  </span>
                  <span className="text-sm text-amber-700">
                    {app.scholarship.deadline
                      ? new Date(app.scholarship.deadline).toLocaleDateString(
                          'he-IL',
                        )
                      : '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
