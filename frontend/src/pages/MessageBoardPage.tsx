import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, MessageSquareReply, PenLine, Sparkles } from "lucide-react";
import clsx from "clsx";
import { fetchGuestbookThreads, type GuestbookMessageDto } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";
import { SiteHeader } from "../components/SiteHeader";
import { GuestbookPostModal } from "../components/GuestbookPostModal";
import { GuestbookReplyModal } from "../components/GuestbookReplyModal";

const PAGE_SIZE = 12;

function ThreadCard({
  t,
  thread: th,
  onRequestReply,
  formatTime,
  showName,
}: {
  t: (k: string, opts?: Record<string, string | number>) => string;
  thread: GuestbookMessageDto;
  onRequestReply: (threadId: number, mainAuthorLabel: string) => void;
  formatTime: (ms: number) => string;
  showName: (n: string | null) => string;
}) {
  const visId = th.visibleToUserId ?? null;
  const target = th.targetDisplayName ?? null;
  return (
    <li>
      <article
        className={clsx(
          "group relative overflow-hidden rounded-3xl border border-rose-200/50 bg-white/55 shadow-[0_8px_40px_-12px_rgba(190,100,120,0.25)]",
          "backdrop-blur-md transition duration-300 hover:border-rose-300/60 hover:shadow-rose-200/30"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-50/30 via-transparent to-amber-50/20 opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative border-b border-rose-100/50 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-200/80 to-amber-100/80 font-display text-lg text-warm-600 shadow-inner">
              {(showName(th.nickname).charAt(0) || "·").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-warm-700">{showName(th.nickname)}</span>
                <time
                  className="text-[11px] tabular-nums text-stone-400"
                  dateTime={new Date(th.createdAtMillis).toISOString()}
                >
                  {formatTime(th.createdAtMillis)}
                </time>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                  {t("guestbook.mainThread")}
                </span>
                {visId == null ? (
                  <span className="rounded-full bg-stone-500/10 px-2 py-0.5 text-[10px] text-stone-500">{t("guestbook.publicBadge")}</span>
                ) : target ? (
                  <span className="max-w-full truncate rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-800" title={target}>
                    {t("guestbook.audienceBadge", { name: target })}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-800/95">{th.content}</p>
            </div>
          </div>
        </div>
        {th.replies && th.replies.length > 0 ? (
          <ul className="relative divide-y divide-rose-100/40 border-b border-rose-100/30 bg-rose-50/25">
            {th.replies.map((r) => (
              <li key={r.id} className="px-4 py-3 pl-6 sm:px-6 sm:pl-10">
                <div className="flex items-baseline justify-between gap-2 border-l-2 border-rose-200/50 pl-3">
                  <div>
                    <span className="text-sm font-medium text-warm-700">{showName(r.nickname)}</span>
                    <time className="ml-2 text-[10px] text-stone-400 tabular-nums">{formatTime(r.createdAtMillis)}</time>
                  </div>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap pl-3 text-[13px] leading-relaxed text-stone-700/95">{r.content}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end bg-gradient-to-b from-rose-50/30 to-white/20 px-4 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => onRequestReply(th.id, showName(th.nickname))}
            className="inline-flex items-center gap-2 rounded-full border border-rose-300/50 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:border-rose-400/60 hover:bg-white/90"
          >
            <MessageSquareReply className="h-4 w-4" />
            {t("guestbook.reply")}
          </button>
        </div>
      </article>
    </li>
  );
}

export function MessageBoardPage() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [modalOpen, setModalOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; label: string } | null>(null);
  const [rows, setRows] = useState<GuestbookMessageDto[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const showName = useCallback(
    (n: string | null) => (n?.trim() ? n.trim() : t("common.anonymous")),
    [t]
  );

  const formatTime = useCallback(
    (ms: number) => new Date(ms).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" }),
    [dateLoc]
  );

  const load = useCallback(
    async (p: number, append: boolean) => {
      if (append) setLoadMoreBusy(true);
      else {
        setLoading(true);
        setErr(null);
      }
      try {
        const res = await fetchGuestbookThreads(p, PAGE_SIZE);
        setPage(res.number);
        setTotalPages(res.totalPages);
        if (append) setRows((prev) => [...prev, ...res.content]);
        else setRows(res.content);
      } catch (e) {
        setErr(mapApiError(t, e));
      } finally {
        setLoading(false);
        setLoadMoreBusy(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  const refreshFirstPage = useCallback(() => {
    void load(0, false);
  }, [load]);

  const canMore = page < totalPages - 1;

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(255,200,220,0.5),transparent),linear-gradient(180deg,#fff8fa_0%,#ffe8f0_40%,#ffd6e4_100%)]">
      <SiteHeader />
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-rose-300/20 blur-3xl" />
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-24 sm:px-6 sm:pt-[5.75rem]">
        <div className="relative mb-10 text-center sm:mb-12">
          <p className="mb-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-rose-500/90">
            <Sparkles className="h-3.5 w-3.5" />
            wall
          </p>
          <h1 className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 bg-clip-text font-display text-4xl text-transparent sm:text-5xl">
            {t("guestbook.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed text-stone-600/95 sm:text-base">{t("guestbook.intro")}</p>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-400/30 transition hover:from-rose-600 hover:to-pink-600 hover:shadow-xl"
            >
              <PenLine className="h-4 w-4 transition group-hover:rotate-12" />
              {t("guestbook.newPost")}
            </button>
          </div>
        </div>

        <GuestbookPostModal open={modalOpen} onClose={() => setModalOpen(false)} onPosted={refreshFirstPage} />
        <GuestbookReplyModal
          open={replyTo != null}
          parentId={replyTo?.id ?? null}
          replyingToLabel={replyTo?.label ?? ""}
          onClose={() => setReplyTo(null)}
          onPosted={refreshFirstPage}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-stone-500">
            <Loader2 className="h-6 w-6 animate-spin text-rose-400" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        ) : err ? (
          <p className="py-12 text-center text-sm text-red-600/90">{err}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-rose-200/60 bg-white/30 px-6 py-16 text-center backdrop-blur-sm">
            <MessageCircle className="mb-3 h-10 w-10 text-rose-300" strokeWidth={1.25} />
            <p className="text-sm text-stone-500">{t("guestbook.empty")}</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 text-sm font-medium text-rose-600 underline decoration-rose-300 underline-offset-2 hover:text-rose-700"
            >
              {t("guestbook.newPost")}
            </button>
          </div>
        ) : (
          <ul className="space-8">
            {rows.map((row) => (
              <ThreadCard
                key={row.id}
                t={t}
                thread={row}
                onRequestReply={(id, label) => setReplyTo({ id, label })}
                formatTime={formatTime}
                showName={showName}
              />
            ))}
          </ul>
        )}

        {!loading && !err && canMore ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              disabled={loadMoreBusy}
              onClick={() => void load(page + 1, true)}
              className="rounded-full border border-rose-300/50 bg-white/50 px-6 py-2.5 text-sm font-medium text-warm-600 shadow-sm backdrop-blur transition hover:bg-white/90 disabled:opacity-50"
            >
              {loadMoreBusy ? t("common.loading") : t("guestbook.loadMore")}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
