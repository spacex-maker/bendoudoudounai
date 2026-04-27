import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, MessageSquareReply, PenLine, Sparkles } from "lucide-react";
import clsx from "clsx";
import {
  fetchGuestbookThreads,
  fetchUserDirectoryForGuestbook,
  userDirectoryAvatarUrl,
  type GuestbookScope,
  type GuestbookMessageDto,
  type UserDirectoryItemDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";
import { SiteHeader } from "../components/SiteHeader";
import { GuestbookPostModal } from "../components/GuestbookPostModal";
import { GuestbookReplyModal } from "../components/GuestbookReplyModal";
import { useAuthedUser } from "../auth/AuthContext";

const PAGE_SIZE = 12;

function MessageAvatar({
  nickname,
  authorUserId,
  showName,
  directoryById,
  compact,
}: {
  nickname: string | null;
  authorUserId: number | null | undefined;
  showName: (n: string | null) => string;
  directoryById: Map<number, UserDirectoryItemDto>;
  /** 回复行略小，主帖为 false */
  compact?: boolean;
}) {
  const dirUser = authorUserId != null ? directoryById.get(authorUserId) : undefined;
  const avatarUrl = dirUser ? userDirectoryAvatarUrl(dirUser) : null;
  const initial = (showName(nickname).charAt(0) || "·").toUpperCase();
  const frame = compact
    ? "h-10 w-10 shrink-0 rounded-xl text-sm"
    : "h-12 w-12 shrink-0 rounded-2xl text-lg";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        draggable={false}
        className={clsx(frame, "border border-white/90 object-cover shadow-inner")}
      />
    );
  }
  return (
    <div
      className={clsx(
        "flex items-center justify-center bg-gradient-to-br from-rose-200/80 to-amber-100/80 font-display text-warm-600 shadow-inner",
        frame
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function PeerFace({
  label,
  dirUser,
  fallbackName,
}: {
  label: string;
  dirUser: UserDirectoryItemDto | undefined;
  fallbackName: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const name = dirUser?.label?.trim() || fallbackName.trim() || "?";
  const avatarUrl = dirUser ? userDirectoryAvatarUrl(dirUser) : null;
  const initial = (name || "?").slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        className="rounded-full outline-none ring-rose-400/0 transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-rose-400/70"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}：${name}`}
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full border border-white/90 object-cover shadow-sm"
            draggable={false}
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200/70 bg-gradient-to-br from-rose-100 to-amber-50 text-[11px] font-semibold text-warm-700 shadow-inner"
            aria-hidden
          >
            {initial}
          </div>
        )}
      </button>
      {open ? (
        <div
          className="absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-stone-700/40 bg-stone-900/95 px-2.5 py-2 text-left text-white shadow-lg shadow-stone-900/25 ring-1 ring-white/10"
          role="dialog"
          aria-label={`${label}：${name}`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">{label}</p>
          <p className="mt-0.5 text-xs font-medium leading-snug text-white">{name}</p>
        </div>
      ) : null}
    </div>
  );
}

function ThreadCard({
  t,
  thread: th,
  onRequestReply,
  formatTime,
  showName,
  viewerUserId,
  directoryById,
}: {
  t: (k: string, opts?: Record<string, string | number>) => string;
  thread: GuestbookMessageDto;
  onRequestReply: (threadId: number, mainAuthorLabel: string) => void;
  formatTime: (ms: number) => string;
  showName: (n: string | null) => string;
  viewerUserId: number | null;
  directoryById: Map<number, UserDirectoryItemDto>;
}) {
  const visId = th.visibleToUserId ?? null;
  const target = th.targetDisplayName ?? null;
  const mine = viewerUserId != null && th.authorUserId === viewerUserId;
  const showDirectPair =
    visId != null &&
    viewerUserId != null &&
    (th.authorUserId === viewerUserId || visId === viewerUserId);
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
            <MessageAvatar
              nickname={th.nickname}
              authorUserId={th.authorUserId}
              showName={showName}
              directoryById={directoryById}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-warm-700">{showName(th.nickname)}</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                  {t("guestbook.mainThread")}
                </span>
                {mine ? (
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    {t("guestbook.myBadge")}
                  </span>
                ) : null}
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
            {th.replies.map((r) => {
              const replyMine = viewerUserId != null && r.authorUserId === viewerUserId;
              return (
                <li key={r.id} className="px-4 py-3 pl-4 sm:px-6 sm:pl-8">
                  <div className="flex gap-3 sm:gap-4">
                    <MessageAvatar
                      nickname={r.nickname}
                      authorUserId={r.authorUserId}
                      showName={showName}
                      directoryById={directoryById}
                      compact
                    />
                    <div className="min-w-0 flex-1 border-l-2 border-rose-200/50 pl-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-warm-700">{showName(r.nickname)}</span>
                        {replyMine ? (
                          <span className="rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                            {t("guestbook.myBadge")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-stone-700/95">{r.content}</p>
                      <time
                        className="mt-2 block text-left text-[10px] tabular-nums text-stone-400"
                        dateTime={new Date(r.createdAtMillis).toISOString()}
                      >
                        {formatTime(r.createdAtMillis)}
                      </time>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-col gap-3 bg-gradient-to-b from-rose-50/30 to-white/20 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2 self-stretch sm:pb-0.5">
            {showDirectPair ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="sr-only">{t("guestbook.directPairHint")}</span>
                <PeerFace
                  label={t("guestbook.peerLabelAuthor")}
                  dirUser={th.authorUserId != null ? directoryById.get(th.authorUserId) : undefined}
                  fallbackName={showName(th.nickname)}
                />
                <PeerFace
                  label={t("guestbook.peerLabelRecipient")}
                  dirUser={directoryById.get(visId)}
                  fallbackName={target ?? ""}
                />
              </div>
            ) : null}
            <time
              className="text-[11px] tabular-nums text-stone-400"
              dateTime={new Date(th.createdAtMillis).toISOString()}
            >
              {formatTime(th.createdAtMillis)}
            </time>
          </div>
          <div className="flex w-full shrink-0 justify-end sm:w-auto">
            <button
              type="button"
              onClick={() => onRequestReply(th.id, showName(th.nickname))}
              className="inline-flex items-center gap-2 rounded-full border border-rose-300/50 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:border-rose-400/60 hover:bg-white/90"
            >
              <MessageSquareReply className="h-4 w-4" />
              {t("guestbook.reply")}
            </button>
          </div>
        </div>
      </article>
    </li>
  );
}

export function MessageBoardPage() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const me = useAuthedUser();
  const [userDir, setUserDir] = useState<UserDirectoryItemDto[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; label: string } | null>(null);
  const [rows, setRows] = useState<GuestbookMessageDto[]>([]);
  const [scope, setScope] = useState<"public" | "about_me">("public");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const directoryById = useMemo(() => new Map(userDir.map((u) => [u.id, u])), [userDir]);

  useEffect(() => {
    if (me == null) {
      setUserDir([]);
      return;
    }
    void fetchUserDirectoryForGuestbook()
      .then(setUserDir)
      .catch(() => setUserDir([]));
  }, [me]);

  const showName = useCallback(
    (n: string | null) => (n?.trim() ? n.trim() : t("common.anonymous")),
    [t]
  );

  const formatTime = useCallback(
    (ms: number) => new Date(ms).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" }),
    [dateLoc]
  );

  const apiScope: GuestbookScope = scope;

  const load = useCallback(
    async (p: number, append: boolean) => {
      if (append) setLoadMoreBusy(true);
      else {
        setLoading(true);
        setErr(null);
      }
      try {
        const res = await fetchGuestbookThreads(p, PAGE_SIZE, apiScope);
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
    [apiScope, t]
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);
  useEffect(() => {
    if (me == null && scope === "about_me") {
      setScope("public");
    }
  }, [me, scope]);


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
          <div className="mt-5 flex justify-center">
            <div className="inline-flex rounded-full border border-rose-200/70 bg-white/60 p-1 shadow-sm backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setScope("public")}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  scope === "public" ? "bg-rose-500 text-white shadow-sm" : "text-warm-700 hover:bg-white/70"
                )}
              >
                {t("guestbook.filterPublic")}
              </button>
              <button
                type="button"
                onClick={() => setScope("about_me")}
                disabled={me == null}
                className={clsx(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  scope === "about_me" ? "bg-rose-500 text-white shadow-sm" : "text-warm-700 hover:bg-white/70",
                  me == null && "cursor-not-allowed opacity-50"
                )}
                title={me == null ? t("guestbook.loginForDirect") : undefined}
              >
                {t("guestbook.filterAboutMe")}
              </button>
            </div>
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
                viewerUserId={me?.id ?? null}
                directoryById={directoryById}
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
