'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  createCommunityPost,
  getCommunityPosts,
  type CommunityPostItem,
} from '@/lib/api';

export default function CommunityPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<CommunityPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCommunityPosts()
      .then(setPosts)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'שגיאה בטעינה'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) {
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const post = await createCommunityPost(
        session.accessToken,
        title.trim(),
        body.trim(),
      );
      setTitle('');
      setBody('');
      router.push(`/community/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="sp-page-title">קהילה</h1>
        <p className="sp-page-subtitle">
          שאלות ותשובות בין סטודנטים — קריאה פתוחה, כתיבה לאחר התחברות
        </p>
      </div>

      <form onSubmit={handleCreate} className="sp-card space-y-4">
        <h2 className="font-semibold text-indigo-950">פוסט חדש</h2>
        {!session && (
          <p className="text-sm text-slate-600">
            <Link href="/login" className="font-medium text-primary hover:underline">
              התחבר
            </Link>{' '}
            כדי לפרסם שאלה
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת (5–120 תווים)"
          className="sp-input w-full"
          minLength={5}
          maxLength={120}
          disabled={!session}
          required
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="תוכן השאלה..."
          className="sp-input min-h-[120px] w-full"
          minLength={10}
          maxLength={3000}
          disabled={!session}
          required
        />
        <button
          type="submit"
          className="sp-btn-primary"
          disabled={!session || submitting}
        >
          {submitting ? 'שולח...' : 'פרסם'}
        </button>
      </form>

      {loading && (
        <p className="text-center text-sm text-slate-500">טוען פוסטים...</p>
      )}

      <div className="space-y-4">
        {posts.map((p) => (
          <article key={p.id} className="sp-card">
            <Link
              href={`/community/${p.id}`}
              className="block hover:text-primary"
            >
              <h2 className="text-lg font-semibold text-indigo-950">{p.title}</h2>
            </Link>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.body}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {p.authorName} ·{' '}
                {new Date(p.createdAt).toLocaleDateString('he-IL')} ·{' '}
                {p.commentCount ?? 0} תגובות
              </p>
              <Link
                href={`/community/${p.id}#comments`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {p.commentCount ? 'צפה בתגובות' : 'הוסף תגובה'}
              </Link>
            </div>
          </article>
        ))}
      </div>

      {!loading && posts.length === 0 && !error && (
        <div className="sp-card text-center text-slate-500">
          עדיין אין פוסטים — היה/י הראשון/ה לשאול!
        </div>
      )}
    </div>
  );
}
