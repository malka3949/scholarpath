'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiFetch, type StudentProfile } from '@/lib/api';

const FIELDS = [
  'מדעי המחשב',
  'הנדסת תוכנה',
  'הנדסת חשמל',
  'הנדסת מחשבים',
  'הנדסת תעשייה וניהול',
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [year, setYear] = useState(1);
  const [gpa, setGpa] = useState(85);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (!session?.accessToken) return;
    apiFetch<StudentProfile>('/student/profile', {
      token: session.accessToken,
    })
      .then((profile) => {
        if (profile.fieldOfStudy) setFieldOfStudy(profile.fieldOfStudy);
        if (profile.year) setYear(profile.year);
        if (profile.gpa) setGpa(profile.gpa);
        if (profile.emailNotificationsEnabled !== undefined) {
          setEmailNotificationsEnabled(profile.emailNotificationsEnabled);
        }
      })
      .catch(() => {
        const profile = session?.user?.profile;
        if (profile) {
          if (profile.fieldOfStudy) setFieldOfStudy(profile.fieldOfStudy);
          if (profile.year) setYear(profile.year);
          if (profile.gpa) setGpa(profile.gpa);
        }
      });
  }, [session?.accessToken, session?.user?.profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await apiFetch<StudentProfile>('/student/profile', {
        method: 'PUT',
        token: session.accessToken,
        body: JSON.stringify({
          fieldOfStudy,
          year,
          gpa,
          emailNotificationsEnabled,
        }),
      });
      setMessage('הפרופיל נשמר בהצלחה');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירה');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading') return <p>טוען...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">פרופיל סטודנט</h1>
      <p className="text-slate-600">מלא את הפרטים שלך כדי לקבל התאמה טובה יותר לעתיד.</p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        {message && (
          <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p>
        )}
        {error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">תחום לימודים</label>
          <select
            value={fieldOfStudy}
            onChange={(e) => setFieldOfStudy(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          >
            <option value="">בחר תחום</option>
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">שנת לימודים</label>
          <input
            type="number"
            min={1}
            max={10}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">ממוצע (GPA)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={gpa}
            onChange={(e) => setGpa(Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
        <div className="rounded border border-slate-100 bg-slate-50 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={emailNotificationsEnabled}
              onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">קבל התראות במייל</span>
              <span className="mt-1 block text-xs text-slate-600">
                התראות באתר ימשיכו להופיע גם כשהמייל כבוי
              </span>
            </span>
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'שומר...' : 'שמור פרופיל'}
        </button>
      </form>
    </div>
  );
}
