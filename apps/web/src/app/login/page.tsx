'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('אימייל או סיסמה שגויים');
      return;
    }
    router.push('/scholarships');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="sp-page-title">התחברות</h1>
        <p className="sp-page-subtitle">ברוך שובך ל-ScholarPath</p>
      </div>
      <form onSubmit={handleSubmit} className="sp-card space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <div>
          <label className="sp-label">אימייל</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sp-input"
            required
          />
        </div>
        <div>
          <label className="sp-label">סיסמה</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sp-input"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="sp-btn-primary w-full disabled:opacity-50"
        >
          {loading ? 'מתחבר...' : 'התחבר'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        אין לך חשבון?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          הרשמה
        </Link>
      </p>
      <p className="rounded-lg bg-indigo-50 p-3 text-center text-xs text-indigo-700">
        דמו: student@scholarpath.local / student123
      </p>
    </div>
  );
}
