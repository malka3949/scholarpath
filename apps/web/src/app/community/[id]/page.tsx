'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  addCommunityComment,
  getCommunityPost,
  type CommunityCommentItem,
  type CommunityPostDetail,
} from '@/lib/api';

type CommentNode = CommunityCommentItem & { replies: CommentNode[] };

function buildCommentTree(comments: CommunityCommentItem[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    byId.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = byId.get(comment.id)!;
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function countThreadMessages(nodes: CommentNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countThreadMessages(node.replies),
    0,
  );
}

function CommentThread({
  comment,
  depth,
  replyingTo,
  replyText,
  submitting,
  sessionActive,
  onReplyClick,
  onReplyTextChange,
  onReplySubmit,
  onReplyCancel,
}: {
  comment: CommentNode;
  depth: number;
  replyingTo: string | null;
  replyText: string;
  submitting: boolean;
  sessionActive: boolean;
  onReplyClick: (id: string) => void;
  onReplyTextChange: (value: string) => void;
  onReplySubmit: (parentId: string) => void;
  onReplyCancel: () => void;
}) {
  const isReplying = replyingTo === comment.id;

  return (
    <div className={depth > 0 ? 'mr-4 border-r-2 border-indigo-100 pr-3' : ''}>
      <div className="rounded-2xl bg-indigo-50/80 px-4 py-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-indigo-950">
            {comment.authorName}
          </span>
          <time className="text-xs text-slate-500">
            {new Date(comment.createdAt).toLocaleString('he-IL')}
          </time>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {comment.body}
        </p>
        {sessionActive && (
          <button
            type="button"
            onClick={() => onReplyClick(comment.id)}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            הגב
          </button>
        )}
      </div>

      {isReplying && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onReplySubmit(comment.id);
          }}
          className="mt-2 space-y-2 rounded-xl border border-indigo-100 bg-white p-3"
        >
          <p className="text-xs text-slate-500">
            מגיב/ה ל-{comment.authorName}
          </p>
          <textarea
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            className="sp-input min-h-[72px] w-full text-sm"
            placeholder="כתוב תגובה..."
            maxLength={1500}
            required
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="sp-btn-primary text-sm"
              disabled={submitting || !replyText.trim()}
            >
              {submitting ? 'שולח...' : 'שלח'}
            </button>
            <button
              type="button"
              onClick={onReplyCancel}
              className="sp-btn-secondary text-sm"
              disabled={submitting}
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              replyingTo={replyingTo}
              replyText={replyText}
              submitting={submitting}
              sessionActive={sessionActive}
              onReplyClick={onReplyClick}
              onReplyTextChange={onReplyTextChange}
              onReplySubmit={onReplySubmit}
              onReplyCancel={onReplyCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommunityPostPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params.id as string;
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [comment, setComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const commentTree = useMemo(
    () => buildCommentTree(post?.comments ?? []),
    [post?.comments],
  );
  const messageCount = useMemo(
    () => countThreadMessages(commentTree),
    [commentTree],
  );

  async function loadPost() {
    setLoading(true);
    setError('');
    try {
      const data = await getCommunityPost(id);
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadPost();
  }, [id]);

  async function submitComment(body: string, parentId?: string) {
    if (!session?.accessToken) {
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await addCommunityComment(session.accessToken, id, body, parentId);
      setComment('');
      setReplyText('');
      setReplyingTo(null);
      await loadPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בתגובה');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTopLevelComment(e: React.FormEvent) {
    e.preventDefault();
    await submitComment(comment.trim());
  }

  function handleReplyClick(commentId: string) {
    setReplyingTo(commentId);
    setReplyText('');
  }

  if (loading) {
    return <p className="text-center text-sm text-slate-500">טוען...</p>;
  }

  if (!post) {
    return (
      <div className="sp-card text-center text-slate-500">
        {error || 'פוסט לא נמצא'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/community" className="text-sm font-medium text-primary hover:underline">
        ← חזרה לקהילה
      </Link>

      <article className="sp-card space-y-3">
        <h1 className="sp-page-title text-2xl">{post.title}</h1>
        <p className="leading-relaxed text-slate-600">{post.body}</p>
        <p className="text-xs text-slate-500">
          {post.authorName} · {new Date(post.createdAt).toLocaleString('he-IL')}
        </p>
      </article>

      <section id="comments" className="scroll-mt-6 space-y-4">
        <h2 className="font-semibold text-indigo-950">
          שיחה ({messageCount})
        </h2>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {commentTree.length === 0 ? (
          <p className="sp-card text-center text-sm text-slate-500">
            עדיין אין הודעות — התחילי את השיחה למטה
          </p>
        ) : (
          <div className="space-y-4">
            {commentTree.map((thread) => (
              <CommentThread
                key={thread.id}
                comment={thread}
                depth={0}
                replyingTo={replyingTo}
                replyText={replyText}
                submitting={submitting}
                sessionActive={!!session}
                onReplyClick={handleReplyClick}
                onReplyTextChange={setReplyText}
                onReplySubmit={(parentId) => submitComment(replyText.trim(), parentId)}
                onReplyCancel={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
              />
            ))}
          </div>
        )}
      </section>

      <form onSubmit={handleTopLevelComment} className="sp-card space-y-3">
        <h3 className="font-medium">הודעה חדשה</h3>
        {!session && (
          <p className="text-sm text-slate-600">
            <Link href="/login" className="font-medium text-primary hover:underline">
              התחבר
            </Link>{' '}
            כדי לכתוב בשיחה
          </p>
        )}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="sp-input min-h-[80px] w-full"
          placeholder="כתוב הודעה..."
          maxLength={1500}
          required
          disabled={!session || !!replyingTo}
        />
        <button
          type="submit"
          className="sp-btn-primary"
          disabled={!session || submitting || !!replyingTo}
        >
          {submitting && !replyingTo ? 'שולח...' : 'שלח הודעה'}
        </button>
      </form>
    </div>
  );
}
