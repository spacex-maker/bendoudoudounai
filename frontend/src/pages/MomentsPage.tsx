import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Crop, Loader2, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  deleteMomentPhoto,
  listMomentColorFacets,
  listMomentPhotos,
  listMomentsSoundtrack,
  userIsAdmin,
  type MomentColorFacetDto,
  type MomentListQuery,
  type MomentPhotoDto,
} from "../api/client";
import { useAuthedUser } from "../auth/AuthContext";
import { ConfirmModal } from "../components/ConfirmModal";
import { MomentsAmbientLyrics } from "../components/MomentsAmbientLyrics";
import { MomentsCinematic } from "../components/MomentsCinematic";
import { MomentsColorWheel } from "../components/MomentsColorWheel";
import { MomentsCropModal } from "../components/MomentsCropModal";
import { MomentsHueSwatches } from "../components/MomentsHueSwatches";
import { MomentsMasonry } from "../components/MomentsMasonry";
import { SiteHeader } from "../components/SiteHeader";
import { useMusicPlayer } from "../music/MusicPlayerContext";
import { parsePaletteJson } from "../moments/colorExtract";

type Mood = NonNullable<MomentListQuery["mood"]>;

/** 停留多久后进入影院幻灯（毫秒） */
const CINEMATIC_IDLE_MS = 11000;
/** 幻灯开始前 1.6s 轻提示首张 */
const CINEMATIC_WINDUP_MS = 1600;

export function MomentsPage() {
  const { t } = useTranslation();
  const user = useAuthedUser();
  const isAdmin = userIsAdmin(user);
  const [items, setItems] = useState<MomentPhotoDto[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [hue, setHue] = useState<number | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [sort, setSort] = useState<"newest" | "hue">("newest");
  const [cropping, setCropping] = useState<MomentPhotoDto | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [facets, setFacets] = useState<MomentColorFacetDto[]>([]);
  const [soundtrackPrompt, setSoundtrackPrompt] = useState(false);
  const [soundtrackReady, setSoundtrackReady] = useState(false);
  const [cinematic, setCinematic] = useState(false);
  const [cinematicWindup, setCinematicWindup] = useState(false);
  const { setQueue, selectTrack, setPlayMode, playing, queue } = useMusicPlayer();
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const idleTimerRef = useRef(0);
  const windupTimerRef = useRef(0);

  const queryBase = useCallback(
    (): MomentListQuery => ({
      hue,
      mood,
      sort,
      size: 40,
      tolerance: hue != null ? 20 : null,
    }),
    [hue, mood, sort]
  );

  useEffect(() => {
    void listMomentColorFacets()
      .then(setFacets)
      .catch(() => setFacets([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listMomentsSoundtrack()
      .then((tracks) => {
        if (cancelled || !tracks.length) return;
        setSoundtrackReady(true);
        setQueue(tracks);
        setPlayMode("shuffle");
        const pick = tracks[Math.floor(Math.random() * tracks.length)]!;
        selectTrack(pick, true);
        window.setTimeout(() => {
          if (!cancelled && !playingRef.current) setSoundtrackPrompt(true);
        }, 900);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // 仅进入片刻页时拉一次精选曲目
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (playing) setSoundtrackPrompt(false);
  }, [playing]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listMomentPhotos({ ...queryBase(), page: 0 });
      setItems(res.content);
      setPage(res.number);
      setLast(res.last);
      setLightbox(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("moments.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [queryBase, t]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (loadingMore || last) return;
    setLoadingMore(true);
    try {
      const res = await listMomentPhotos({ ...queryBase(), page: page + 1 });
      setItems((prev) => [...prev, ...res.content]);
      setPage(res.number);
      setLast(res.last);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("moments.loadFailed"));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, last, queryBase, page, t]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || last) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMoreRef.current();
        }
      },
      { rootMargin: "320px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading, last, items.length]);

  useEffect(() => {
    if (lightbox == null || cropping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i == null ? i : Math.min(items.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setLightbox((i) => (i == null ? i : Math.max(0, i - 1)));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, items.length, cropping]);

  // 停留一段时间后进入影院幻灯；交互则重置计时
  useEffect(() => {
    const canRun =
      !loading &&
      !cinematic &&
      lightbox == null &&
      !cropping &&
      !deleteOpen &&
      items.length >= 2 &&
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clearTimers = () => {
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(windupTimerRef.current);
      setCinematicWindup(false);
    };

    if (!canRun) {
      clearTimers();
      return;
    }

    const arm = () => {
      clearTimers();
      idleTimerRef.current = window.setTimeout(() => {
        setCinematicWindup(true);
        windupTimerRef.current = window.setTimeout(() => {
          setCinematicWindup(false);
          setCinematic(true);
        }, CINEMATIC_WINDUP_MS);
      }, CINEMATIC_IDLE_MS);
    };

    const bump = () => {
      if (cinematic) return;
      arm();
    };

    arm();
    // 不用 pointermove：鼠标微抖会永远掐死幻灯
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("wheel", bump, { passive: true });
    window.addEventListener("keydown", bump);
    window.addEventListener("scroll", bump, { passive: true, capture: true });
    return () => {
      clearTimers();
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("wheel", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("scroll", bump, true);
    };
  }, [loading, cinematic, lightbox, cropping, deleteOpen, items.length]);

  const active = lightbox != null ? items[lightbox] : null;

  const onConfirmDelete = async () => {
    if (!active) return;
    setErr(null);
    try {
      const id = active.id;
      await deleteMomentPhoto(id);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        setLightbox((cur) => {
          if (cur == null) return null;
          if (next.length === 0) return null;
          return Math.min(cur, next.length - 1);
        });
        return next;
      });
      void listMomentColorFacets()
        .then(setFacets)
        .catch(() => undefined);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("moments.deleteFailed"));
      throw e;
    }
  };

  const moods: { id: Mood; label: string }[] = [
    { id: "warm", label: t("moments.moodWarm") },
    { id: "cool", label: t("moments.moodCool") },
    { id: "soft", label: t("moments.moodSoft") },
    { id: "vivid", label: t("moments.moodVivid") },
    { id: "neutral", label: t("moments.moodNeutral") },
  ];

  return (
    <div
      className={clsx(
        "relative min-h-dvh w-full bg-theme-home transition-[filter] duration-700 ease-out",
        (cinematic || cinematicWindup) && "moments-page--cinematic-blur"
      )}
    >
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <header className="mb-6 max-w-xl sm:mb-8">
          <h1 className="font-display text-3xl text-warm-600 transition-transform duration-500 hover:translate-x-0.5 sm:text-4xl">
            {t("moments.title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600/85 sm:text-base">{t("moments.sub")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <Link
                to="/admin/moments"
                className="inline-block text-xs text-rose-500/80 underline-offset-4 transition hover:text-rose-600 hover:underline"
              >
                {t("moments.manage")}
              </Link>
            ) : null}
            {soundtrackReady && soundtrackPrompt ? (
              <button
                type="button"
                onClick={() => {
                  const pick = queue[Math.floor(Math.random() * Math.max(1, queue.length))];
                  if (pick) selectTrack(pick, true);
                  setSoundtrackPrompt(false);
                }}
                className="rounded-full border border-rose-200/70 bg-white/70 px-3 py-1 text-xs text-warm-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0"
              >
                {t("moments.playSoundtrack")}
              </button>
            ) : null}
            {items.length >= 2 && !cinematic ? (
              <button
                type="button"
                onClick={() => setCinematic(true)}
                className="rounded-full border border-stone-200/80 bg-white/50 px-3 py-1 text-xs text-stone-600 transition hover:-translate-y-0.5 hover:bg-white hover:text-warm-700 hover:shadow-sm active:translate-y-0"
              >
                {t("moments.slideshowStart")}
              </button>
            ) : null}
          </div>
        </header>

        <section className="mb-8 space-y-5 rounded-2xl border border-white/50 bg-white/35 p-4 backdrop-blur-sm transition duration-500 hover:border-rose-100/70 hover:bg-white/45 hover:shadow-[0_12px_40px_rgba(41,37,36,0.06)] sm:p-5">
          <MomentsHueSwatches
            facets={facets}
            activeHue={hue}
            activeNeutral={mood === "neutral"}
            onSelectHue={(h) => {
              setHue(h);
              setMood(null);
              setSort("hue");
            }}
            onSelectNeutral={() => {
              setHue(null);
              setMood("neutral");
              setSort("newest");
            }}
            onClear={() => {
              setHue(null);
              setMood(null);
            }}
          />
          <div className="flex flex-col gap-4 border-t border-white/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <MomentsColorWheel
              hue={hue}
              onChange={(h) => {
                setHue(h);
                if (h != null) {
                  setMood(null);
                  setSort("hue");
                }
              }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {moods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMood((cur) => (cur === m.id ? null : m.id));
                      if (m.id === "warm" || m.id === "cool" || m.id === "neutral") setHue(null);
                    }}
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs transition duration-300",
                      "hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95",
                      mood === m.id
                        ? "bg-warm-600 text-white shadow-sm"
                        : "bg-white/55 text-stone-600 ring-1 ring-stone-200/80 hover:bg-white/90"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span>{t("moments.sortLabel")}</span>
                <button
                  type="button"
                  className={clsx(
                    "rounded-full px-2.5 py-1 transition duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
                    sort === "newest" ? "bg-stone-800 text-white" : "bg-white/55 ring-1 ring-stone-200/80 hover:bg-white"
                  )}
                  onClick={() => setSort("newest")}
                >
                  {t("moments.sortNewest")}
                </button>
                <button
                  type="button"
                  className={clsx(
                    "rounded-full px-2.5 py-1 transition duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
                    sort === "hue" ? "bg-stone-800 text-white" : "bg-white/55 ring-1 ring-stone-200/80 hover:bg-white"
                  )}
                  onClick={() => setSort("hue")}
                >
                  {t("moments.sortHue")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {err ? (
          <p className="mb-4 rounded-xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-sm text-rose-700">{err}</p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-stone-500">{t("moments.emptyFilter")}</p>
        ) : (
          <>
            <MomentsMasonry
              items={items}
              onOpen={setLightbox}
              spotlightId={cinematicWindup ? items[0]?.id ?? null : null}
            />
            {!last ? (
              <div ref={sentinelRef} className="mt-8 flex justify-center py-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-white/60 px-5 py-2 text-sm text-warm-600 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-md active:translate-y-0 disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("moments.loadMore")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>

      <MomentsAmbientLyrics elevated={cinematic || lightbox != null} />

      <MomentsCinematic
        items={items}
        active={cinematic && lightbox == null && !cropping}
        onDismiss={() => setCinematic(false)}
        onOpenIndex={setLightbox}
      />

      {active && !cropping
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex flex-col bg-stone-950/88 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onClick={() => setLightbox(null)}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
                <p className="truncate text-xs text-white/55">
                  {lightbox != null ? `${lightbox + 1} / ${items.length}` : ""}
                </p>
                <button
                  type="button"
                  className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                  aria-label={t("common.close")}
                  onClick={() => setLightbox(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative flex min-h-0 flex-1 cursor-zoom-out items-center justify-center px-12 sm:px-16">
                {lightbox != null && lightbox > 0 ? (
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 sm:left-4"
                    aria-label={t("moments.prev")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox((i) => (i == null ? i : Math.max(0, i - 1)));
                    }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                ) : null}
                {lightbox != null && lightbox < items.length - 1 ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 sm:right-4"
                    aria-label={t("moments.next")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox((i) => (i == null ? i : Math.min(items.length - 1, i + 1)));
                    }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                ) : null}
                <img
                  src={active.largeUrl || active.publicUrl}
                  alt={active.caption || ""}
                  className="max-h-full max-w-full cursor-zoom-out rounded-2xl object-contain select-none shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:rounded-3xl"
                  draggable={false}
                  onClick={() => setLightbox(null)}
                />
              </div>

              <div className="shrink-0 space-y-2.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
                {isAdmin ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropping(active);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white transition hover:bg-white/25"
                    >
                      <Crop className="h-3.5 w-3.5" />
                      {t("moments.crop")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/80 px-3 py-1.5 text-xs text-white transition hover:bg-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("moments.delete")}
                    </button>
                  </div>
                ) : null}
                {parsePaletteJson(active.paletteJson).length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {parsePaletteJson(active.paletteJson).map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={t("moments.filterBySwatch")}
                        className="h-5 w-5 rounded-full ring-2 ring-white/50 transition hover:scale-110"
                        style={{ background: sw.hex }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHue(Math.round(sw.h) % 360);
                          setMood(null);
                          setLightbox(null);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                {active.caption ? (
                  <p className="text-center text-sm text-white/75">{active.caption}</p>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {cropping ? (
        <MomentsCropModal
          photo={cropping}
          onClose={() => setCropping(null)}
          onReplaced={(next) => {
            setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)));
            setCropping(null);
          }}
        />
      ) : null}

      <ConfirmModal
        open={deleteOpen && !!active}
        onClose={() => setDeleteOpen(false)}
        title={t("moments.deleteTitle")}
        confirmLabel={t("moments.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={onConfirmDelete}
      >
        <p>{t("moments.deleteConfirm")}</p>
      </ConfirmModal>
    </div>
  );
}
