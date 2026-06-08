'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { NotificationBell } from './NotificationBell';

const navLink =
  'rounded-lg px-3 py-2 text-sm font-medium text-indigo-900/80 transition-colors hover:bg-indigo-50 hover:text-indigo-700';

export function Navbar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-50 border-b border-indigo-100/80 bg-white/90 backdrop-blur-md">
      <div className="sp-container flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            SP
          </span>
          <span className="text-lg font-bold text-indigo-950">ScholarPath</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/scholarships" className={navLink}>
            מלגות
          </Link>
          <Link href="/community" className={navLink}>
            קהילה
          </Link>
          {session && (
            <>
              <NotificationBell />
              <Link href="/recommendations" className={navLink}>
                המלצות
              </Link>
              <Link href="/applications" className={navLink}>
                הבקשות שלי
              </Link>
              <Link href="/profile" className={navLink}>
                פרופיל
              </Link>
              {isAdmin && (
                <Link href="/admin" className={navLink}>
                  ניהול
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
              >
                יציאה
              </button>
            </>
          )}
          {!session && (
            <>
              <Link href="/login" className={navLink}>
                התחברות
              </Link>
              <Link href="/register" className="sp-btn-primary mr-1">
                הרשמה
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
