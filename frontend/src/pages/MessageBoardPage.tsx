import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessageCircle, MessageSquareReply, PenLine } from "lucide-react";
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
import { FOR_NAME } from "../siteMeta";

const PAGE_SIZE = 12;

/** 满一个月起半消失；再过两个月，字影更淡。 */
function wordsWeather(createdAtMillis: number, now = Date.now()): { faded: boolean; deep: boolean } {
  if (!Number.isFinite(createdAtMillis)) return { faded: false, deep: false };
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  if (createdAtMillis >= monthAgo.getTime()) return { faded: false, deep: false };
  const deepAgo = new Date(now);
  deepAgo.setMonth(deepAgo.getMonth() - 3);
  return { faded: true, deep: createdAtMillis < deepAgo.getTime() };
}

function FadedWords({
  text,
  textClassName,
  deep,
  hint,
}: {
  text: string;
  textClassName: string;
  deep: boolean;
  hint: string;
}) {
  return (
    <div className="mt-3">
      <div className="relative overflow-hidden py-3">
        <p
          className={clsx(
            "pointer-events-none select-none whitespace-pre-wrap text-[#5c2434]",
            textClassName,
            deep ? "opacity-40 blur-[18px]" : "opacity-75 blur-[12px]"
          )}
        >
          {text}
        </p>
      </div>
      <p className="font-letter text-sm italic tracking-[0.08em] text-[#9a6b76]">{hint}</p>
    </div>
  );
}

/** 无称呼，或登录后匿名发且称呼不是账号名：不露头像。 */
function isAnonymousGuestbookPost(
  nickname: string | null,
  authorUserId: number | null | undefined,
  directoryById: Map<number, UserDirectoryItemDto>
): boolean {
  const nick = nickname?.trim() || "";
  if (!nick) return true;
  if (authorUserId == null) return false;
  const account = directoryById.get(authorUserId)?.label?.trim() || "";
  return Boolean(account) && nick !== account;
}

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
  compact?: boolean;
}) {
  if (isAnonymousGuestbookPost(nickname, authorUserId, directoryById)) return null;
  const dirUser = authorUserId != null ? directoryById.get(authorUserId) : undefined;
  const avatarUrl = dirUser ? userDirectoryAvatarUrl(dirUser) : null;
  const initial = (showName(nickname).charAt(0) || "·").toUpperCase();
  const frame = compact ? "h-9 w-9 shrink-0 rounded-full text-sm" : "h-11 w-11 shrink-0 rounded-full text-base";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        draggable={false}
        className={clsx(frame, "border border-[#f0d4da] object-cover")}
      />
    );
  }
  return (
    <div
      className={clsx(
        "flex items-center justify-center bg-[#f7e4e8] font-letter text-[#8b3a4a]",
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
        className="rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-[#c73e5a]/60"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}：${name}`}
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full border border-[#f0d4da] object-cover"
            draggable={false}
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#f0d4da] bg-[#f7e4e8] text-[11px] font-semibold text-[#8b3a4a]"
            aria-hidden
          >
            {initial}
          </div>
        )}
      </button>
      {open ? (
        <div
          className="absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-[#3a1f28]/50 bg-[#2a151c]/95 px-2.5 py-2 text-left text-white"
          role="dialog"
          aria-label={`${label}：${name}`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/55">{label}</p>
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
  index,
}: {
  t: (k: string, opts?: Record<string, string | number>) => string;
  thread: GuestbookMessageDto;
  onRequestReply: (threadId: number, mainAuthorLabel: string) => void;
  formatTime: (ms: number) => string;
  showName: (n: string | null) => string;
  viewerUserId: number | null;
  directoryById: Map<number, UserDirectoryItemDto>;
  index: number;
}) {
  const visId = th.visibleToUserId ?? null;
  const target = th.targetDisplayName ?? null;
  const mine = viewerUserId != null && th.authorUserId === viewerUserId;
  const showDirectPair =
    visId != null &&
    viewerUserId != null &&
    (th.authorUserId === viewerUserId || visId === viewerUserId);
  const mainWeather = wordsWeather(th.createdAtMillis);
  const fadedHint = t("guestbook.fadedByTime");
  const tilt = ((index % 5) - 2) * 0.55;
  const shift = index % 2 === 0 ? "sm:ml-0 sm:mr-8" : "sm:ml-8 sm:mr-0";

  return (
    <li
      className={clsx("animate-wall-letter-in transition duration-500 hover:-translate-y-1.5", shift)}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div style={{ transform: `rotate(${tilt}deg)` }}>
      <article
        className={clsx(
          "group relative overflow-hidden border border-[#ead0d6]/80 bg-[#fffaf8]",
          mainWeather.faded ? "opacity-90" : "shadow-[0_18px_40px_-28px_rgba(92,36,52,0.35)]"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 8%, rgba(199,62,90,0.08), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.35), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-[#c73e5a]/70" aria-hidden />

        <div className="relative px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start gap-3 sm:gap-4">
            {!isAnonymousGuestbookPost(th.nickname, th.authorUserId, directoryById) ? (
              <div className={clsx(mainWeather.faded && "opacity-50 grayscale")}>
                <MessageAvatar
                  nickname={th.nickname}
                  authorUserId={th.authorUserId}
                  showName={showName}
                  directoryById={directoryById}
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={clsx(
                    "font-letter text-lg leading-none",
                    mainWeather.faded ? "text-[#b08a93]" : "text-[#4a1f2c]"
                  )}
                >
                  {showName(th.nickname)}
                </span>
                <span className="text-[11px] tracking-[0.18em] text-[#9a6b76]">{t("guestbook.mainThread")}</span>
                {mine ? (
                  <span className="text-[11px] tracking-[0.14em] text-[#6d8f6a]">{t("guestbook.myBadge")}</span>
                ) : null}
                {visId == null ? (
                  <span className="text-[11px] tracking-[0.14em] text-[#9a6b76]/80">{t("guestbook.publicBadge")}</span>
                ) : target ? (
                  <span className="max-w-full truncate text-[11px] tracking-[0.08em] text-[#8b3a4a]" title={target}>
                    {t("guestbook.audienceBadge", { name: target })}
                  </span>
                ) : null}
              </div>

              {mainWeather.faded ? (
                <FadedWords
                  text={th.content}
                  textClassName="font-letter text-[1.05rem] leading-relaxed sm:text-[1.15rem]"
                  deep={mainWeather.deep}
                  hint={fadedHint}
                />
              ) : (
                <p className="mt-4 whitespace-pre-wrap font-letter text-[1.05rem] leading-[1.75] text-[#3d2430] sm:text-[1.15rem]">
                  {th.content}
                </p>
              )}
            </div>
          </div>
        </div>

        {th.replies && th.replies.length > 0 ? (
          <ul className="relative space-y-0 border-t border-[#f0dce1] bg-[#fff5f7]/55">
            {th.replies.map((r) => {
              const replyMine = viewerUserId != null && r.authorUserId === viewerUserId;
              const replyWeather = wordsWeather(r.createdAtMillis);
              return (
                <li key={r.id} className="px-5 py-4 sm:px-7 sm:pl-16">
                  <div className="flex gap-3">
                    {!isAnonymousGuestbookPost(r.nickname, r.authorUserId, directoryById) ? (
                      <div className={clsx(replyWeather.faded && "opacity-50 grayscale")}>
                        <MessageAvatar
                          nickname={r.nickname}
                          authorUserId={r.authorUserId}
                          showName={showName}
                          directoryById={directoryById}
                          compact
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 border-l border-[#ead0d6] pl-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span
                          className={clsx(
                            "font-letter text-base",
                            replyWeather.faded ? "text-[#b08a93]" : "text-[#4a1f2c]"
                          )}
                        >
                          {showName(r.nickname)}
                        </span>
                        {replyMine ? (
                          <span className="text-[10px] tracking-[0.12em] text-[#6d8f6a]">{t("guestbook.myBadge")}</span>
                        ) : null}
                      </div>
                      {replyWeather.faded ? (
                        <FadedWords
                          text={r.content}
                          textClassName="font-letter text-[0.98rem] leading-relaxed"
                          deep={replyWeather.deep}
                          hint={fadedHint}
                        />
                      ) : (
                        <p className="mt-2 whitespace-pre-wrap font-letter text-[0.98rem] leading-relaxed text-[#4a3038]">
                          {r.content}
                        </p>
                      )}
                      <time
                        className="mt-2 block text-left text-[11px] tabular-nums tracking-wide text-[#9a6b76]"
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

        <div className="relative flex flex-col gap-3 border-t border-[#f0dce1] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
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
              className="font-letter text-sm italic tabular-nums text-[#9a6b76]"
              dateTime={new Date(th.createdAtMillis).toISOString()}
            >
              {formatTime(th.createdAtMillis)}
            </time>
          </div>
          <button
            type="button"
            onClick={() => onRequestReply(th.id, showName(th.nickname))}
            className="inline-flex items-center gap-2 self-end border-b border-[#c73e5a]/50 pb-0.5 font-letter text-base text-[#c73e5a] transition hover:border-[#c73e5a] hover:text-[#9d2f46]"
          >
            <MessageSquareReply className="h-4 w-4" />
            {t("guestbook.reply")}
          </button>
        </div>
      </article>
      </div>
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
    <div className="relative min-h-dvh w-full overflow-x-clip bg-[#f8e9ed] text-[#4a1f2c]">
      <SiteHeader />

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,#ffd0db_0%,transparent_58%),radial-gradient(ellipse_70%_50%_at_100%_30%,rgba(255,190,150,0.45),transparent_50%),radial-gradient(ellipse_60%_45%_at_0%_80%,rgba(214,120,140,0.28),transparent_55%),linear-gradient(180deg,#fff1f4_0%,#f8e9ed_42%,#f3d7df_100%)]" />
        <div className="absolute -left-20 top-24 h-[28rem] w-[28rem] rounded-full bg-[#ffb7c5]/35 blur-3xl animate-wall-drift" />
        <div className="absolute -right-16 top-[38%] h-[32rem] w-[32rem] rounded-full bg-[#ffd7b8]/40 blur-3xl animate-wall-ink" />
        <div className="absolute bottom-[-10%] left-[28%] h-[22rem] w-[22rem] rounded-full bg-[#e8a0b0]/30 blur-3xl animate-land-float" />
        <div
          className="absolute inset-0 opacity-[0.22] mix-blend-multiply"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-5xl flex-col justify-center px-4 pb-10 pt-24 sm:px-6 sm:pt-[5.75rem]">
        <p className="animate-land-fade-up font-display text-[11px] font-bold uppercase tracking-[0.28em] text-[#c73e5a]">
          {t("home.siteFor", { name: FOR_NAME })}
        </p>
        <h1 className="animate-land-fade-up mt-4 max-w-[10ch] font-letter text-[clamp(3.4rem,14vw,7.5rem)] font-normal leading-[0.92] tracking-[-0.03em] text-[#4a1f2c] [animation-delay:80ms]">
          {t("guestbook.title")}
        </h1>
        <p className="animate-land-fade-up mt-6 max-w-[22ch] font-letter text-xl italic leading-snug text-[#7a4452] sm:text-2xl [animation-delay:150ms]">
          {t("guestbook.heroLine")}
        </p>
        <div className="animate-land-fade-up mt-10 [animation-delay:220ms]">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group inline-flex items-center gap-3 bg-[#c73e5a] px-7 py-3.5 text-sm font-semibold tracking-wide text-white transition hover:bg-[#b0334d]"
          >
            <PenLine className="h-4 w-4 transition group-hover:-rotate-12" />
            {t("guestbook.newPost")}
          </button>
        </div>
        <p
          className="pointer-events-none absolute -right-2 top-[28%] hidden select-none font-letter text-[clamp(5rem,18vw,11rem)] italic leading-none text-[#c73e5a]/[0.08] sm:block"
          aria-hidden
        >
          letters
        </p>
      </section>

      <main className="relative mx-auto max-w-3xl px-4 pb-28 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 border-t border-[#d9a8b4]/50 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-[#c73e5a]">wall</p>
          <div className="flex gap-5">
            <button
              type="button"
              onClick={() => setScope("public")}
              className={clsx(
                "pb-1 font-letter text-base transition",
                scope === "public"
                  ? "border-b-2 border-[#c73e5a] text-[#4a1f2c]"
                  : "border-b-2 border-transparent text-[#9a6b76] hover:text-[#4a1f2c]"
              )}
            >
              {t("guestbook.filterPublic")}
            </button>
            <button
              type="button"
              onClick={() => setScope("about_me")}
              disabled={me == null}
              className={clsx(
                "pb-1 font-letter text-base transition",
                scope === "about_me"
                  ? "border-b-2 border-[#c73e5a] text-[#4a1f2c]"
                  : "border-b-2 border-transparent text-[#9a6b76] hover:text-[#4a1f2c]",
                me == null && "cursor-not-allowed opacity-45"
              )}
              title={me == null ? t("guestbook.loginForDirect") : undefined}
            >
              {t("guestbook.filterAboutMe")}
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
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-[#9a6b76]">
            <Loader2 className="h-6 w-6 animate-spin text-[#c73e5a]" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        ) : err ? (
          <p className="py-16 text-center text-sm text-red-700/90">{err}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center border border-dashed border-[#d9a8b4] bg-[#fffaf8]/70 px-6 py-20 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-[#d9a8b4]" strokeWidth={1.25} />
            <p className="font-letter text-lg text-[#7a4452]">{t("guestbook.empty")}</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-5 font-letter text-base text-[#c73e5a] underline decoration-[#c73e5a]/40 underline-offset-4 hover:decoration-[#c73e5a]"
            >
              {t("guestbook.newPost")}
            </button>
          </div>
        ) : (
          <ul className="space-y-10 sm:space-y-12">
            {rows.map((row, index) => (
              <ThreadCard
                key={row.id}
                t={t}
                thread={row}
                onRequestReply={(id, label) => setReplyTo({ id, label })}
                formatTime={formatTime}
                showName={showName}
                viewerUserId={me?.id ?? null}
                directoryById={directoryById}
                index={index}
              />
            ))}
          </ul>
        )}

        {!loading && !err && canMore ? (
          <div className="mt-14 flex justify-center">
            <button
              type="button"
              disabled={loadMoreBusy}
              onClick={() => void load(page + 1, true)}
              className="border border-[#c73e5a]/40 bg-[#fffaf8]/80 px-8 py-3 font-letter text-base text-[#8b3a4a] transition hover:border-[#c73e5a] hover:bg-white disabled:opacity-50"
            >
              {loadMoreBusy ? t("common.loading") : t("guestbook.loadMore")}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
