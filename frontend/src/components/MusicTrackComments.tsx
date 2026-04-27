import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageSquare, Send } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import {
  fetchTrackComments,
  likeTrackComment,
  postTrackComment,
  unlikeTrackComment,
  userDirectoryAvatarUrl,
  type MusicTrackCommentDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";

type Props = {
  trackId: number;
};

const PAGE_SIZE = 20;

function Avatar({ label, userId, hasAvatar }: { label: string; userId: number; hasAvatar: boolean }) {
  const src = hasAvatar ? userDirectoryAvatarUrl({ id: userId, hasAvatar }) : null;
  if (src) {
    return <img src={src} alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20" draggable={false} />;
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200 ring-1 ring-white/15">
      {(label.trim().charAt(0) || "?").toUpperCase()}
    </div>
  );
}

export function MusicTrackComments({ trackId }: Props) {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [rows, setRows] = useState<MusicTrackCommentDto[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; label: string } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const canMore = page < totalPages - 1;

  const fmt = useCallback(
    (ms: number) => new Date(ms).toLocaleString(dateLoc, { dateStyle: "short", timeStyle: "short" }),
    [dateLoc]
  );

  const loadPage = useCallback(
    async (p: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setErr(null);
      }
      try {
        const res = await fetchTrackComments(trackId, p, PAGE_SIZE);
        setPage(res.number);
        setTotalPages(res.totalPages);
        setRows((prev) => (append ? [...prev, ...res.content] : res.content));
      } catch (e) {
        setErr(mapApiError(t, e));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t, trackId]
  );

  useEffect(() => {
    setComposer("");
    setReplyingTo(null);
    void loadPage(0, false);
  }, [trackId, loadPage]);

  useEffect(() => {
    if (!canMore) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || loadingMore || loading) return;
        void loadPage(page + 1, true);
      },
      { rootMargin: "280px 0px" }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [canMore, loadPage, loading, loadingMore, page]);

  const onToggleLike = useCallback(async (comment: MusicTrackCommentDto, parentId?: number) => {
    const optimistic = comment.likedByMe
      ? { ...comment, likedByMe: false, likeCount: Math.max(0, comment.likeCount - 1) }
      : { ...comment, likedByMe: true, likeCount: comment.likeCount + 1 };

    setRows((prev) =>
      prev.map((x) => {
        if (x.id === comment.id) return optimistic;
        if (parentId != null && x.id === parentId) {
          return { ...x, replies: x.replies.map((r) => (r.id === comment.id ? optimistic : r)) };
        }
        return x;
      })
    );

    try {
      const latest = comment.likedByMe ? await unlikeTrackComment(comment.id) : await likeTrackComment(comment.id);
      setRows((prev) =>
        prev.map((x) => {
          if (x.id === comment.id) return { ...x, likeCount: latest.likeCount, likedByMe: latest.likedByMe };
          if (parentId != null && x.id === parentId) {
            return {
              ...x,
              replies: x.replies.map((r) =>
                r.id === comment.id ? { ...r, likeCount: latest.likeCount, likedByMe: latest.likedByMe } : r
              ),
            };
          }
          return x;
        })
      );
    } catch (e) {
      setRows((prev) =>
        prev.map((x) => {
          if (x.id === comment.id) return comment;
          if (parentId != null && x.id === parentId) {
            return { ...x, replies: x.replies.map((r) => (r.id === comment.id ? comment : r)) };
          }
          return x;
        })
      );
      alert(mapApiError(t, e));
    }
  }, [t]);

  const submit = useCallback(async () => {
    const content = composer.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const created = await postTrackComment({
        trackId,
        content,
        parentId: replyingTo?.id ?? null,
      });
      setComposer("");
      if (replyingTo) {
        setRows((prev) =>
          prev.map((x) =>
            x.id === replyingTo.id
              ? { ...x, replyCount: x.replyCount + 1, replies: [...x.replies, created] }
              : x
          )
        );
        setReplyingTo(null);
      } else {
        setRows((prev) => [created, ...prev]);
      }
    } catch (e) {
      alert(mapApiError(t, e));
    } finally {
      setPosting(false);
    }
  }, [composer, posting, replyingTo, t, trackId]);

  const emptyHint = useMemo(() => t("music.commentsEmpty"), [t]);

  return (
    <section className="mx-auto mb-6 w-full max-w-6xl" aria-label="Track Comments">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-200">{t("music.commentsTitle")}</h3>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        {replyingTo ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <span>{t("music.commentsReplyTo", { name: replyingTo.label })}</span>
            <button type="button" className="text-zinc-400 hover:text-zinc-200" onClick={() => setReplyingTo(null)}>
              {t("common.cancel")}
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            rows={2}
            placeholder={t("music.commentsPlaceholder")}
            className="custom-scrollbar min-h-[3.5rem] flex-1 resize-y rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
          />
          <button
            type="button"
            disabled={posting || !composer.trim()}
            onClick={() => void submit()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("music.commentsSend")}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {err ? <p className="mt-3 text-xs text-red-400/90">{err}</p> : null}

      <div className="mt-3 space-y-2">
        {rows.map((c) => (
          <article key={c.id} className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
            <div className="flex items-start gap-2">
              <Avatar label={c.authorLabel} userId={c.authorUserId} hasAvatar={c.authorHasAvatar} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-zinc-200">{c.authorLabel}</span>
                  <time className="text-[11px] text-zinc-500">{fmt(c.createdAtMillis)}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{c.content}</p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => void onToggleLike(c)}
                    className={clsx("inline-flex items-center gap-1 transition", c.likedByMe ? "text-rose-400" : "text-zinc-500 hover:text-zinc-300")}
                  >
                    <Heart className={clsx("h-3.5 w-3.5", c.likedByMe && "fill-current")} />
                    {c.likeCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyingTo({ id: c.id, label: c.authorLabel })}
                    className="text-zinc-500 transition hover:text-zinc-300"
                  >
                    {t("music.commentsReply")}
                  </button>
                </div>
              </div>
            </div>

            {c.replies.length > 0 ? (
              <div className="mt-2 space-y-2 border-l border-white/10 pl-3">
                {c.replies.map((r) => (
                  <div key={r.id} className="rounded-xl bg-zinc-900/45 px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <Avatar label={r.authorLabel} userId={r.authorUserId} hasAvatar={r.authorHasAvatar} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-medium text-zinc-200">{r.authorLabel}</span>
                          <time className="text-[10px] text-zinc-500">{fmt(r.createdAtMillis)}</time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-300">{r.content}</p>
                        <button
                          type="button"
                          onClick={() => void onToggleLike(r, c.id)}
                          className={clsx("mt-1 inline-flex items-center gap-1 text-[11px] transition", r.likedByMe ? "text-rose-400" : "text-zinc-500 hover:text-zinc-300")}
                        >
                          <Heart className={clsx("h-3 w-3", r.likedByMe && "fill-current")} />
                          {r.likeCount}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!loading && rows.length === 0 ? <p className="mt-4 text-sm text-zinc-500">{emptyHint}</p> : null}
      {loading ? <p className="mt-4 text-sm text-zinc-500">{t("common.loading")}</p> : null}
      <div ref={loadMoreRef} className="h-6" />
      {loadingMore ? <p className="text-xs text-zinc-500">{t("common.loading")}</p> : null}
    </section>
  );
}
