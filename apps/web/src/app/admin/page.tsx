'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiFetch, importScholarships, type Scholarship } from '@/lib/api';

type FormState = {
  title: string;
  description: string;
  deadline: string;
  tags: string;
};

const emptyForm: FormState = {
  title: '',
  description: '',
  deadline: '',
  tags: '',
};

function toForm(s: Scholarship): FormState {
  return {
    title: s.title,
    description: s.description,
    deadline: s.deadline ? s.deadline.slice(0, 10) : '',
    tags: s.tags.join(', '),
  };
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importResult, setImportResult] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.accessToken && session.user.role === 'ADMIN') {
      loadScholarships();
    }
  }, [session]);

  async function loadScholarships() {
    if (!session?.accessToken) return;
    try {
      const data = await apiFetch<Scholarship[]>('/admin/scholarships', {
        token: session.accessToken,
      });
      setScholarships(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    }
  }

  function parseTags(raw: string) {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError('');
    setMessage('');

    const payload = {
      title: form.title,
      description: form.description,
      deadline: form.deadline || undefined,
      tags: parseTags(form.tags),
    };

    try {
      if (editingId) {
        await apiFetch(`/admin/scholarships/${editingId}`, {
          method: 'PUT',
          token: session.accessToken,
          body: JSON.stringify(payload),
        });
        setMessage('מלגה עודכנה בהצלחה');
      } else {
        await apiFetch('/admin/scholarships', {
          method: 'POST',
          token: session.accessToken,
          body: JSON.stringify(payload),
        });
        setMessage('מלגה נוצרה בהצלחה');
      }
      resetForm();
      await loadScholarships();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה');
    }
  }

  function startEdit(s: Scholarship) {
    setEditingId(s.id);
    setForm(toForm(s));
    setMessage('');
    setError('');
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError('');
    setImportResult('');
    try {
      const items = JSON.parse(importJson) as unknown;
      if (!Array.isArray(items)) {
        throw new Error('JSON חייב להיות מערך של מלגות');
      }
      const result = await importScholarships(session.accessToken, items);
      setImportResult(
        `יובאו: ${result.imported}, דולגו: ${result.skipped}${
          result.errors?.length
            ? ` · שגיאות: ${result.errors.map((e) => `#${e.index}`).join(', ')}`
            : ''
        }`,
      );
      setImportJson('');
      await loadScholarships();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בייבוא');
    }
  }

  async function handleDelete(id: string) {
    if (!session?.accessToken || !confirm('למחוק מלגה?')) return;
    await apiFetch(`/admin/scholarships/${id}`, {
      method: 'DELETE',
      token: session.accessToken,
    });
    if (editingId === id) resetForm();
    await loadScholarships();
  }

  if (status === 'loading') return <p>טוען...</p>;
  if (session?.user?.role !== 'ADMIN') return null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">ניהול מלגות</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
        <h2 className="font-semibold">
          {editingId ? 'עריכת מלגה' : 'יצירת מלגה חדשה'}
        </h2>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="כותרת"
          className="w-full rounded border px-3 py-2"
          required
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="תיאור"
          className="w-full rounded border px-3 py-2"
          rows={4}
          required
        />
        <input
          type="date"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          className="w-full rounded border px-3 py-2"
        />
        <input
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="תגיות (מופרדות בפסיק)"
          className="w-full rounded border px-3 py-2"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {editingId ? 'שמור שינויים' : 'צור מלגה'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded border px-4 py-2 hover:bg-slate-50"
            >
              ביטול
            </button>
          )}
        </div>
      </form>

      <form
        onSubmit={handleImport}
        className="space-y-4 rounded-lg border bg-white p-6"
      >
        <h2 className="font-semibold">ייבוא מלגות (JSON)</h2>
        <p className="text-sm text-slate-600">
          הדבק מערך JSON (עד 50 פריטים). כל פריט: title, description, ואופציונלי
          deadline, sourceUrl, tags.
        </p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder={`[\n  {\n    "title": "מלגת ייבוא לדוגמה",\n    "description": "תיאור מפורט של המלגה לפחות עשרה תווים",\n    "tags": ["הנדסה"]\n  }\n]`}
          className="w-full rounded border px-3 py-2 font-mono text-sm"
          rows={8}
        />
        {importResult && (
          <p className="text-sm text-green-700">{importResult}</p>
        )}
        <button
          type="submit"
          className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          ייבוא
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-semibold">מלגות קיימות ({scholarships.length})</h2>
        {scholarships.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-3"
          >
            <div>
              <p className="font-medium">{s.title}</p>
              {s.deadline && (
                <p className="text-xs text-slate-500">
                  מועד: {new Date(s.deadline).toLocaleDateString('he-IL')}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => startEdit(s)}
                className="text-sm text-blue-600 hover:underline"
              >
                ערוך
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-sm text-red-600 hover:underline"
              >
                מחק
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
