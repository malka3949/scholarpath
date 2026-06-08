'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  getUnreadCount,
  syncDeadlineNotifications,
} from '@/lib/api';

const SYNC_KEY = 'sp_deadline_sync_done';

export function NotificationBell() {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const { count: n } = await getUnreadCount(session.accessToken);
      setCount(n);
    } catch {
      setCount(0);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken) return;

    async function init() {
      if (typeof window !== 'undefined' && !sessionStorage.getItem(SYNC_KEY)) {
        try {
          await syncDeadlineNotifications(session.accessToken!);
          sessionStorage.setItem(SYNC_KEY, '1');
        } catch {
          // ignore sync errors
        }
      }
      await refreshCount();
    }

    init();
  }, [session?.accessToken, refreshCount]);

  useEffect(() => {
    const handler = () => refreshCount();
    window.addEventListener('sp-notifications-updated', handler);
    return () => window.removeEventListener('sp-notifications-updated', handler);
  }, [refreshCount]);

  if (!session) return null;

  return (
    <Link
      href="/notifications"
      className="relative rounded-lg px-3 py-2 text-sm font-medium text-indigo-900/80 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
      aria-label="התראות"
    >
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="absolute -left-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-xs font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

export function notifyNotificationsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('sp-notifications-updated'));
  }
}
