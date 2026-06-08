'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { apiFetch, scholarshipSourceLabel, type Scholarship } from '@/lib/api';

function asTags(tags: Scholarship['tags']): string[] {
  return Array.isArray(tags) ? tags : [];
}

export default function ScholarshipsPage() {
  const { data: session } = useSession();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadScholarships('');
  }, []);

  async function loadScholarships(q: string) {
    setLoading(true);
    setError('');
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const data = await apiFetch<Scholarship[]>(`/scholarships${params}`);
      setScholarships(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadScholarships(query);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="sp-page-title">מלגות</h1>
        <p className="sp-page-subtitle">
          {scholarships.length > 0 && !loading
            ? `${scholarships.length} מלגות זמינות`
            : 'מצא מלגות מתאימות לתחום הלימודים שלך'}
        </p>
      </div>

      <form onSubmit={handleSearch} className="sp-card flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, תיאור או תגית..."
          className="sp-input flex-1"
        />
        <button type="submit" className="sp-btn-primary sm:px-8">
          חיפוש
        </button>
      </form>

      {loading && (
        <p className="text-center text-sm text-slate-500">טוען מלגות...</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {scholarships.map((s) => (
          <article
            key={s.id}
            className="sp-card flex flex-col transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-indigo-950">{s.title}</h2>
              {scholarshipSourceLabel(s.source) && (
                <span
                  className={
                    s.source === 'IMPORTED'
                      ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800'
                      : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'
                  }
                >
                  {scholarshipSourceLabel(s.source)}
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
              {s.description}
            </p>
            {s.deadline && (
              <p className="mt-3 text-xs font-medium text-amber-700">
                מועד אחרון: {new Date(s.deadline).toLocaleDateString('he-IL')}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {asTags(s.tags)
                .slice(0, 3)
                .map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                  >
                    {tag}
                  </span>
                ))}
            </div>
            <div className="mt-4 flex gap-3 border-t border-indigo-50 pt-4">
              <Link
                href={`/scholarships/${s.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                פרטים
              </Link>
              {session && (
                <Link
                  href={`/scholarships/${s.id}?track=1`}
                  className="text-sm font-medium text-cta-dark hover:underline"
                >
                  הוסף למעקב
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>

      {!loading && scholarships.length === 0 && !error && (
        <div className="sp-card text-center text-slate-500">
          לא נמצאו מלגות. נסה חיפוש אחר.
        </div>
      )}
    </div>
  );
}
