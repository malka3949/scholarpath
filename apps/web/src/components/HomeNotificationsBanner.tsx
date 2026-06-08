'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getUnreadCount } from '@/lib/api';

export function HomeNotificationsBanner() {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session?.accessToken) return;
    getUnreadCount(session.accessToken)
      .then((r) => setCount(r.count))
      .catch(() => setCount(0));
  }, [session?.accessToken]);

  if (!session || count === 0) return null;

  return (
    <Link
      href="/notifications"
      className="sp-card block border-emerald-200 bg-emerald-50/50 transition-shadow hover:shadow-md"
    >
      <p className="font-semibold text-emerald-800">
        יש לך {count} התראות שלא נקראו
      </p>
      <p className="mt-1 text-sm text-emerald-700">לחץ לצפייה בתזכורות ומועדים</p>
    </Link>
  );
}
