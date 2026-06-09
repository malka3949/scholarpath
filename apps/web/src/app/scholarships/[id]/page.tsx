'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  apiFetch,
  recordScholarshipEvent,
  startApplicationWorkflow,
  isScholarshipDeadlineOpen,
  type Scholarship,
} from '@/lib/api';

export default function ScholarshipDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [scholarship, setScholarship] = useState<Scholarship | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const id = params.id as string;
  const shouldStart = searchParams.get('track') === '1';

  useEffect(() => {
    apiFetch<Scholarship>(`/scholarships/${id}`)
      .then(setScholarship)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'שגיאה בטעינה'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!session?.accessToken || !id) return;
    recordScholarshipEvent(session.accessToken, id, 'VIEW').catch(() => {
      // non-blocking analytics
    });
  }, [id, session?.accessToken]);

  useEffect(() => {
    if (shouldStart && session?.accessToken && scholarship && isScholarshipDeadlineOpen(scholarship.deadline)) {
      handleStartWorkflow();
    }
  }, [shouldStart, session?.accessToken, scholarship]);

  async function handleStartWorkflow() {
    if (!session?.accessToken) {
      router.push('/login');
      return;
    }
    if (scholarship && !isScholarshipDeadlineOpen(scholarship.deadline)) {
      setError('המועד האחרון להגשת בקשה למלגה זו עבר');
      return;
    }
    setWorking(true);
    setMessage('');
    setError('');
    try {
      const app = await startApplicationWorkflow(session.accessToken, id);
      router.push(`/applications/${app.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-slate-500">טוען...</p>;
  }

  if (!scholarship) {
    return (
      <div className="sp-card text-center text-slate-500">
        {error || 'מלגה לא נמצאה'}
      </div>
    );
  }

  const canApply = isScholarshipDeadlineOpen(scholarship.deadline);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/scholarships" className="text-sm font-medium text-primary hover:underline">
        ← חזרה למלגות
      </Link>

      <article className="sp-card space-y-4">
        <h1 className="sp-page-title text-2xl">{scholarship.title}</h1>
        <p className="leading-relaxed text-slate-600">{scholarship.description}</p>

        {scholarship.deadline && (
          <p
            className={`text-sm font-medium ${canApply ? 'text-amber-700' : 'text-red-700'}`}
          >
            {canApply ? 'מועד אחרון: ' : 'המועד האחרון עבר: '}
            {new Date(scholarship.deadline).toLocaleDateString('he-IL')}
          </p>
        )}

        {scholarship.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {scholarship.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {scholarship.sourceUrl && (
          <a
            href={scholarship.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            קישור למקור
          </a>
        )}
      </article>

      <div className="flex flex-wrap gap-3">
        {session ? (
          canApply ? (
            <button
              onClick={handleStartWorkflow}
              disabled={working}
              className="sp-btn-cta disabled:opacity-50"
            >
              {working ? 'פותח בקשה...' : 'התחל בקשה + מכתב מוטיבציה'}
            </button>
          ) : (
            <p className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
              לא ניתן להגיש בקשה — המועד האחרון עבר
            </p>
          )
        ) : (
          <Link href="/login" className="sp-btn-primary">
            התחבר כדי להתחיל בקשה
          </Link>
        )}
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
