'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  syncDeadlineNotifications,
  type NotificationItem,
} from '@/lib/api';
import { notifyNotificationsUpdated } from '@/components/NotificationBell';

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (session?.accessToken) load();
  }, [session?.accessToken]);

  async function load() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await getNotifications(session.accessToken);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!session?.accessToken) return;
    setSyncing(true);
    setMessage('');
    try {
      const { created } = await syncDeadlineNotifications(session.accessToken);
      setMessage(
        created > 0
          ? `נוספו ${created} תזכורות חדשות`
          : 'אין תזכורות חדשות כרגע',
      );
      await load();
      notifyNotificationsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ברענון');
    } finally {
      setSyncing(false);
    }
  }

  async function handleMarkRead(id: string) {
    if (!session?.accessToken) return;
    try {
      await markNotificationRead(session.accessToken, id);
      await load();
      notifyNotificationsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    }
  }

  async function handleMarkAllRead() {
    if (!session?.accessToken) return;
    try {
      await markAllNotificationsRead(session.accessToken);
      await load();
      notifyNotificationsUpdated();
      setMessage('כל ההתראות סומנו כנקראו');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    }
  }

  if (status === 'loading' || loading) {
    return <p className="text-center text-sm text-slate-500">טוען התראות...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="sp-page-title">התראות</h1>
          <p className="sp-page-subtitle">
            תזכורות מועד אחרון ועדכוני בקשות
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="sp-btn-secondary disabled:opacity-50"
          >
            {syncing ? 'מרענן...' : 'רענן תזכורות'}
          </button>
          {items.some((i) => !i.readAt) && (
            <button onClick={handleMarkAllRead} className="sp-btn-primary">
              סמן הכל כנקרא
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={`sp-card ${!item.readAt ? 'border-indigo-200 bg-indigo-50/30' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-indigo-950">{item.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString('he-IL')}
                </p>
              </div>
              {!item.readAt && (
                <button
                  onClick={() => handleMarkRead(item.id)}
                  className="sp-btn-secondary shrink-0 text-sm"
                >
                  סמן כנקרא
                </button>
              )}
            </div>
            {item.applicationId && (
              <Link
                href={`/applications/${item.applicationId}`}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                לבקשה
              </Link>
            )}
          </article>
        ))}
      </div>

      {items.length === 0 && !error && (
        <div className="sp-card text-center text-slate-500">
          <p>אין התראות כרגע.</p>
          <p className="mt-2 text-sm">
            הוסף בקשות למלגות עם מועד קרוב ולחץ &quot;רענן תזכורות&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
