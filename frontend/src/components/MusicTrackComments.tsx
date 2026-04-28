import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageSquare, Send, X } from "lucide-react";
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

function Avatar({
  label,
  userId,
  hasAvatar,
  size = "md",
}: {
  label: string;
  userId: number;
  hasAvatar: boolean;
  size?: "sm" | "md";
}) {
  const src = hasAvatar ? userDirectoryAvatarUrl({ id: userId, hasAvatar }) : null;
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={clsx(dim, "shrink-0 rounded-full object-cover ring-1 ring-white/20")}
        draggable={false}
      />
    );
  }
  return (
    <div
      className={clsx(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 font-bold text-zinc-200 ring-1 ring-white/10"
      )}
    >
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canMore = page < totalPages - 1;

  const fmt = useCallback(
    (ms: number) =>
      new Date(ms).toLocaleString(dateLoc, { dateStyle: "short", timeStyle: "short" }),
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

  const onToggleLike = useCallback(
    async (comment: MusicTrackCommentDto, parentId?: number) => {
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
        const latest = comment.likedByMe
          ? await unlikeTrackComment(comment.id)
          : await likeTrackComment(comment.id);
        setRows((prev) =>
          prev.map((x) => {
            if (x.id === comment.id)
              return { ...x, likeCount: latest.likeCount, likedByMe: latest.likedByMe };
            if (parentId != null && x.id === parentId) {
              return {
                ...x,
                replies: x.replies.map((r) =>
                  r.id === comment.id
                    ? { ...r, likeCount: latest.likeCount, likedByMe: latest.likedByMe }
                    : r
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
    },
    [t]
  );

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

  const startReply = useCallback(
    (id: number, label: string) => {
      setReplyingTo({ id, label });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    []
  );

  const emptyHint = useMemo(() => t("music.commentsEmpty"), [t]);

  return (
    <section className="mx-auto mb-8 w-full max-w-6xl" aria-label="Track Comments">
      {/* 标题行 */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80">
          <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200">{t("music.commentsTitle")}</h3>
        {!loading && rows.length > 0 && (
          <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
            {rows.length}
          </span>
        )}
      </div>

      {/* 输入框区域 */}
      <div className="mb-5">
        {replyingTo ? (
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            <span className="truncate">{t("music.commentsReplyTo", { name: replyingTo.label })}</span>
            <button
              type="button"
              className="ml-2 shrink-0 rounded-full p-0.5 text-rose-400/70 transition hover:bg-rose-500/20 hover:text-rose-300"
              onClick={() => setReplyingTo(null)}
              aria-label={t("common.cancel")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
            }}
            rows={2}
            placeholder={t("music.commentsPlaceholder")}
            className="custom-scrollbar w-full min-h-[4.5rem] resize-none rounded-2xl border border-white/[0.08] bg-zinc-900/50 py-2.5 pl-3.5 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-white/20 focus:outline-none"
          />
          <button
            type="button"
            disabled={posting || !composer.trim()}
            onClick={() => void submit()}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t("music.commentsSend")}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {err ? <p className="mb-3 text-xs text-red-400/90">{err}</p> : null}

      {/* 评论列表 */}
      <div className="space-y-3">
        {rows.map((c) => (
          <article
            key={c.id}
            className="group rounded-2xl border border-white/[0.07] bg-zinc-900/35 px-4 py-4 transition hover:bg-zinc-900/50 hover:border-white/10"
          >
            <div className="flex items-start gap-3">
              <Avatar label={c.authorLabel} userId={c.authorUserId} hasAvatar={c.authorHasAvatar} />
              <div className="min-w-0 flex-1">
                {/* 作者 + 时间 */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-zinc-100">{c.authorLabel}</span>
                  <time className="text-[11px] text-zinc-600">{fmt(c.createdAtMillis)}</time>
                </div>
                {/* 正文 */}
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{c.content}</p>
                {/* 操作行 */}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onToggleLike(c)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition",
                      c.likedByMe
                        ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/20"
                        : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    )}
                  >
                    <Heart className={clsx("h-3.5 w-3.5", c.likedByMe && "fill-current")} />
                    {c.likeCount > 0 ? c.likeCount : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => startReply(c.id, c.authorLabel)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t("music.commentsReply")}
                  </button>
                </div>
              </div>
            </div>

            {/* 回复列表 */}
            {c.replies.length > 0 ? (
              <div className="mt-3 ml-12 space-y-2.5">
                {c.replies.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-white/[0.06] bg-black/25 px-3.5 py-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar
                        label={r.authorLabel}
                        userId={r.authorUserId}
                        hasAvatar={r.authorHasAvatar}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-xs font-semibold text-zinc-200">{r.authorLabel}</span>
                          <time className="text-[10px] text-zinc-600">{fmt(r.createdAtMillis)}</time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{r.content}</p>
                        <button
                          type="button"
                          onClick={() => void onToggleLike(r, c.id)}
                          className={clsx(
                            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition",
                            r.likedByMe
                              ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/20"
                              : "bg-zinc-800/50 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
                          )}
                        >
                          <Heart className={clsx("h-3 w-3", r.likedByMe && "fill-current")} />
                          {r.likeCount > 0 ? r.likeCount : null}
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

      {/* 空状态 */}
      {!loading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-600">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <p className="text-sm">{emptyHint}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-zinc-600">{t("common.loading")}</p>
        </div>
      ) : null}

      <div ref={loadMoreRef} className="h-6" />
      {loadingMore ? (
        <p className="text-center text-xs text-zinc-600">{t("common.loading")}</p>
      ) : null}
    </section>
  );
}
