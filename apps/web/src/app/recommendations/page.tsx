'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  getApplications,
  getRecommendations,
  refreshRecommendations,
  STATUS_LABELS,
  type Application,
  type ApplicationStatus,
  type RecommendationsResponse,
} from '@/lib/api';

const TERMINAL_STATUSES: ApplicationStatus[] = [
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
];

function RecommendationActions({
  scholarshipId,
  application,
}: {
  scholarshipId: string;
  application?: Application;
}) {
  const detailsHref = `/scholarships/${scholarshipId}`;

  if (!application) {
    return (
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          href={detailsHref}
          className="text-sm font-medium text-primary hover:underline"
        >
          פרטים
        </Link>
        <Link
          href={`${detailsHref}?track=1`}
          className="text-sm font-medium text-cta-dark hover:underline"
        >
          הוסף למעקב
        </Link>
      </div>
    );
  }

  if (TERMINAL_STATUSES.includes(application.status)) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {STATUS_LABELS[application.status]}
        </span>
        <Link
          href={`/applications/${application.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          צפה בבקשה
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      <Link
        href={detailsHref}
        className="text-sm font-medium text-primary hover:underline"
      >
        פרטים
      </Link>
      <Link
        href={`/applications/${application.id}`}
        className="text-sm font-medium text-cta-dark hover:underline"
      >
        המשך בקשה
      </Link>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (score >= 60) return 'bg-indigo-100 text-indigo-800';
  return 'bg-amber-100 text-amber-800';
}

export default function RecommendationsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [applicationsByScholarship, setApplicationsByScholarship] = useState<
    Map<string, Application>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  function indexApplications(apps: Application[]) {
    const map = new Map<string, Application>();
    for (const app of apps) {
      map.set(app.scholarshipId, app);
    }
    setApplicationsByScholarship(map);
  }

  useEffect(() => {
    if (session?.accessToken) {
      loadRecommendations();
    }
  }, [session?.accessToken]);

  async function loadRecommendations() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [result, applications] = await Promise.all([
        getRecommendations(session.accessToken),
        getApplications(session.accessToken),
      ]);
      setData(result);
      indexApplications(applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!session?.accessToken) return;
    setRefreshing(true);
    setError('');
    try {
      const [result, applications] = await Promise.all([
        refreshRecommendations(session.accessToken),
        getApplications(session.accessToken),
      ]);
      setData(result);
      indexApplications(applications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ברענון');
    } finally {
      setRefreshing(false);
    }
  }

  const sourceLabel =
    data?.source === 'ai'
      ? 'דירוג AI (Claude)'
      : 'דירוג על בסיס כללים';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="sp-page-title">המלצות בשבילי</h1>
          <p className="sp-page-subtitle">
            מלגות מדורגות לפי התאמה לפרופיל האקדמי שלך
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="sp-btn-secondary shrink-0 disabled:opacity-50"
        >
          {refreshing ? 'מרענן...' : 'רענן המלצות'}
        </button>
      </div>

      {data && !loading && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
            {sourceLabel}
          </span>
          <span>
            עודכן: {new Date(data.computedAt).toLocaleString('he-IL')}
          </span>
          <span>{data.items.length} מלגות מתאימות</span>
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-slate-500">טוען המלצות...</p>
      )}

      {error && (
        <div className="sp-card space-y-3 border-red-100 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
          {error.includes('פרופיל') && (
            <Link href="/profile" className="sp-btn-primary inline-block">
              השלם פרופיל
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {data?.items.map((item, index) => (
          <article
            key={item.id}
            className="sp-card flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {index + 1}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreColor(item.score)}`}
              >
                {item.score}%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-indigo-950">
                {item.scholarship.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                {item.scholarship.description}
              </p>
              {item.matchReason && (
                <p className="mt-2 text-sm font-medium text-emerald-700">
                  {item.matchReason}
                </p>
              )}
              {item.scholarship.deadline && (
                <p className="mt-2 text-xs text-amber-700">
                  מועד אחרון:{' '}
                  {new Date(item.scholarship.deadline).toLocaleDateString(
                    'he-IL',
                  )}
                </p>
              )}
              <RecommendationActions
                scholarshipId={item.scholarship.id}
                application={applicationsByScholarship.get(item.scholarship.id)}
              />
            </div>
          </article>
        ))}
      </div>

      {!loading && data?.items.length === 0 && !error && (
        <div className="sp-card text-center text-slate-500">
          לא נמצאו מלגות מתאימות לפרופיל שלך. נסה לעדכן את הפרופיל או לרענן.
        </div>
      )}
    </div>
  );
}
