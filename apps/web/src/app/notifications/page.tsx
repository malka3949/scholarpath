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
  isScholarshipDeadlineOpen,
  type NotificationItem,
} from '@/lib/api';
import {
  getNotificationStyle,
  getNotificationTypeLabel,
} from '@/lib/notification-styles';
import { notifyNotificationsUpdated } from '@/components/NotificationBell';

function NotificationCard({
  item,
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
}) {
  const style = getNotificationStyle(item);
  const deadlineExpired =
    item.scholarship?.deadline &&
    !isScholarshipDeadlineOpen(item.scholarship.deadline);

  return (
    <article
      className={`sp-card border ${style.cardClass} ${
        !item.readAt ? `ring-2 ring-offset-1 ${style.unreadRingClass}` : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badgeClass}`}
            >
              {style.label}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600">
              {getNotificationTypeLabel(item.type)}
            </span>
            {!item.readAt && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">
                חדש
              </span>
            )}
          </div>
          <h2 className={`mt-2 font-semibold ${style.titleClass}`}>
            {item.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{item.body}</p>
          {deadlineExpired &&
            item.type === 'DEADLINE_APPROACHING' &&
            item.applicationStatus !== 'SUBMITTED' && (
            <p className="mt-2 text-sm font-medium text-red-700">
              המועד האחרון להגשה עבר — לא ניתן להגיש בקשה חדשה
            </p>
          )}
          {item.scholarship?.deadline && (
            <p
              className={`mt-2 text-xs font-medium ${
                deadlineExpired ? 'text-red-600' : 'text-amber-700'
              }`}
            >
              {deadlineExpired ? 'מועד אחרון (עבר): ' : 'מועד אחרון: '}
              {new Date(item.scholarship.deadline).toLocaleDateString('he-IL')}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {new Date(item.createdAt).toLocaleString('he-IL')}
          </p>
        </div>
        {!item.readAt && (
          <button
            onClick={() => onMarkRead(item.id)}
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
  );
}

const LEGEND = [
  { label: 'פג תוקף', badgeClass: 'bg-red-100 text-red-800' },
  { label: 'טרם התחיל', badgeClass: 'bg-amber-100 text-amber-900' },
  { label: 'בתהליך', badgeClass: 'bg-orange-100 text-orange-900' },
  { label: 'הוגש', badgeClass: 'bg-emerald-100 text-emerald-800' },
  { label: 'מערכת', badgeClass: 'bg-slate-100 text-slate-700' },
] as const;

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

      <div className="flex flex-wrap gap-2">
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${item.badgeClass}`}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <NotificationCard
            key={item.id}
            item={item}
            onMarkRead={handleMarkRead}
          />
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
