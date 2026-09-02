import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  History,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Type,
  Volume2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { findActiveIndex } from "../music/lyricsUtils";
import { useMusicPlayer } from "../music/MusicPlayerContext";
import { useSyncedLyrics } from "../music/useSyncedLyrics";

const FONT_SCALE_KEY = "bendoudou_immersive_lyric_font_scale";
const DOCK_EXPANDED_KEY = "bendoudou_immersive_dock_expanded";
const FONT_SCALE_MIN = 0.7;
const FONT_SCALE_MAX = 1.8;
const FONT_SCALE_DEFAULT = 1;
/** 播放中无操作多久后隐藏顶栏 + 控制台 */
const CHROME_IDLE_MS = 3400;

function formatTime(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function readDockExpanded(): boolean {
  try {
    const raw = localStorage.getItem(DOCK_EXPANDED_KEY);
    if (raw == null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

function readFontScale(): number {
  try {
    const raw = localStorage.getItem(FONT_SCALE_KEY);
    if (raw == null) return FONT_SCALE_DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return FONT_SCALE_DEFAULT;
    return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n));
  } catch {
    return FONT_SCALE_DEFAULT;
  }
}

type Props = {
  onOpenHistoryPanel: () => void;
};

/**
 * 沉浸歌词舞台：全屏只留歌词 + 光效背景，大胆字号与切行动效。
 */
export function ImmersiveLyricsStage({ onOpenHistoryPanel }: Props) {
  const { t } = useTranslation();
  const {
    immersiveLyricsOpen,
    setImmersiveLyricsOpen,
    currentTrack,
    coverSrc,
    playPos,
    setPlayPos,
    playDur,
    playing,
    setPlaying,
    seekNext,
    seekPrev,
    queue,
    audioRef,
    volume,
    setVolume,
    scrubbing,
    setScrubbing,
    playMode,
    setPlayMode,
  } = useMusicPlayer();

  const rootRef = useRef<HTMLDivElement>(null);
  const lyricsStageRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [isFs, setIsFs] = useState(false);
  const [fontScale, setFontScale] = useState(FONT_SCALE_DEFAULT);
  const [dockExpanded, setDockExpanded] = useState(false);
  /** 顶栏 + 底栏控制台是否可见（播放闲置后隐藏） */
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromePinnedRef = useRef(false);
  const hideChromeTimerRef = useRef<number | null>(null);
  /** 按沉浸区实际宽度计算的单行缩放（1 = 不缩） */
  const [fitScales, setFitScales] = useState<number[]>([]);
  const { lines, loading, loadError } = useSyncedLyrics(currentTrack);
  const timeMs = Math.max(0, playPos * 1000);
  const activeIndex = useMemo(() => findActiveIndex(lines, timeMs), [lines, timeMs]);
  const playlistEmpty = queue.length === 0;
  const hasTrack = currentTrack != null;

  const barMax = useMemo(() => {
    if (playDur > 0 && Number.isFinite(playDur)) return playDur;
    const d = currentTrack?.durationSeconds ?? 0;
    return d > 0 ? d : 0;
  }, [playDur, currentTrack?.durationSeconds]);
  const progressMax = barMax > 0 ? barMax : 0;
  const progressPercent = barMax > 0 ? Math.min(100, (playPos / barMax) * 100) : 0;

  const applySeek = (raw: number) => {
    const next = Number(raw);
    const a = audioRef.current;
    if (!a || !Number.isFinite(next) || next < 0) return;
    a.currentTime = next;
    setPlayPos(next);
  };

  useEffect(() => {
    if (immersiveLyricsOpen) {
      setFontScale(readFontScale());
      setDockExpanded(readDockExpanded());
      setChromeVisible(true);
    }
  }, [immersiveLyricsOpen]);

  const clearHideChromeTimer = useCallback(() => {
    if (hideChromeTimerRef.current != null) {
      window.clearTimeout(hideChromeTimerRef.current);
      hideChromeTimerRef.current = null;
    }
  }, []);

  const scheduleHideChrome = useCallback(() => {
    clearHideChromeTimer();
    if (!playing || scrubbing || chromePinnedRef.current) return;
    hideChromeTimerRef.current = window.setTimeout(() => {
      if (chromePinnedRef.current) return;
      setChromeVisible(false);
    }, CHROME_IDLE_MS);
  }, [clearHideChromeTimer, playing, scrubbing]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    scheduleHideChrome();
  }, [scheduleHideChrome]);

  const pinChrome = (pinned: boolean) => {
    chromePinnedRef.current = pinned;
    if (pinned) {
      clearHideChromeTimer();
      setChromeVisible(true);
    } else {
      scheduleHideChrome();
    }
  };

  useEffect(() => {
    if (!immersiveLyricsOpen) {
      clearHideChromeTimer();
      setChromeVisible(true);
      chromePinnedRef.current = false;
      return;
    }
    if (!playing || scrubbing) {
      clearHideChromeTimer();
      setChromeVisible(true);
      return;
    }
    scheduleHideChrome();
  }, [immersiveLyricsOpen, playing, scrubbing, clearHideChromeTimer, scheduleHideChrome]);

  useEffect(() => {
    if (!immersiveLyricsOpen) return;
    const el = rootRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      // 触摸滑动歌词时不反复唤出，避免刷屏；点按仍会显示
      if (e.pointerType === "touch") return;
      revealChrome();
    };
    const onDown = () => revealChrome();
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
    };
  }, [immersiveLyricsOpen, revealChrome]);

  useEffect(() => () => clearHideChromeTimer(), [clearHideChromeTimer]);

  const toggleDockExpanded = () => {
    setDockExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DOCK_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!scrubbing || !immersiveLyricsOpen) return;
    const end = () => setScrubbing(false);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [scrubbing, immersiveLyricsOpen, setScrubbing]);

  const onFontScaleChange = (next: number) => {
    const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next));
    setFontScale(clamped);
    try {
      localStorage.setItem(FONT_SCALE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  };

  const close = useCallback(() => {
    const el = rootRef.current;
    if (document.fullscreenElement && el && document.fullscreenElement === el) {
      void document.exitFullscreen().catch(() => undefined);
    }
    setImmersiveLyricsOpen(false);
  }, [setImmersiveLyricsOpen]);

  useEffect(() => {
    if (!immersiveLyricsOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === " " && hasTrack) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [immersiveLyricsOpen, close, hasTrack, setPlaying]);

  useEffect(() => {
    if (!immersiveLyricsOpen) {
      setIsFs(false);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const syncFs = () => setIsFs(document.fullscreenElement === el);
    const id = window.setTimeout(() => {
      if (!document.fullscreenElement) {
        void el
          .requestFullscreen?.()
          .catch(() => undefined)
          .finally(syncFs);
      } else {
        syncFs();
      }
    }, 40);
    document.addEventListener("fullscreenchange", syncFs);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("fullscreenchange", syncFs);
    };
  }, [immersiveLyricsOpen]);

  useEffect(() => {
    if (!immersiveLyricsOpen || activeIndex < 0) return;
    const el = lineRefs.current[activeIndex];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, immersiveLyricsOpen, lines.length]);

  /** 以沉浸滚动区实际可用宽度为准：单行不换行，过长用 transform 缩进容器 */
  useLayoutEffect(() => {
    if (!immersiveLyricsOpen || lines.length === 0) {
      setFitScales([]);
      return;
    }
    const stage = lyricsStageRef.current;
    const scroll = stage?.parentElement;
    if (!stage || !scroll) return;

    const measure = () => {
      // clientWidth 含 padding，要扣掉左右内边距才是歌词真正可画的宽度
      const cs = getComputedStyle(scroll);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const avail = Math.max(0, scroll.clientWidth - padX);
      if (avail <= 0) return;
      const next: number[] = new Array(lines.length);
      for (let i = 0; i < lines.length; i++) {
        const el = lineRefs.current[i];
        if (!el) {
          next[i] = 1;
          continue;
        }
        const span = el.querySelector("[data-lyric-text]") as HTMLElement | null;
        if (!span) {
          next[i] = 1;
          continue;
        }
        // 先清掉缩放再量自然宽度（字号保持原始设定）
        const prevTransform = span.style.transform;
        span.style.transform = "none";
        const need = span.scrollWidth;
        span.style.transform = prevTransform;
        next[i] = need > avail + 0.5 ? Math.max(0.2, avail / need) : 1;
      }
      setFitScales((prev) => {
        if (
          prev.length === next.length &&
          prev.every((v, i) => Math.abs(v - (next[i] ?? 1)) < 0.01)
        ) {
          return prev;
        }
        return next;
      });
    };

    // 等字体/布局稳定后再量一次
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(scroll);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [immersiveLyricsOpen, lines, fontScale, activeIndex]);

  lineRefs.current.length = lines.length;

  if (!immersiveLyricsOpen) return null;

  const title = currentTrack?.title ?? t("music.pickTrack");
  const artist = currentTrack?.artist ?? t("music.unknownArtist");
  const scalePct = Math.round(fontScale * 100);

  return createPortal(
    <div
      ref={rootRef}
      className={clsx(
        "immersive-lyrics-root fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#05060a] text-white",
        !chromeVisible && "immersive-chrome-away"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t("lyrics.immersiveTitle")}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-[52px] saturate-150"
          />
        ) : null}
        <div className="absolute inset-0 bg-[#05060a]/55" />
        <div className="immersive-orb immersive-orb-a" />
        <div className="immersive-orb immersive-orb-b" />
        <div className="immersive-orb immersive-orb-c" />
        <div className="immersive-beam" />
        <div className="immersive-grid" />
        <div className="immersive-vignette" />
        <div className="immersive-noise" />
      </div>

      <div
        className="immersive-chrome-top absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6"
        onPointerEnter={() => pinChrome(true)}
        onPointerLeave={() => pinChrome(false)}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/40">
            {t("lyrics.immersiveTitle")}
          </p>
          <h2 className="mt-1 truncate text-base font-semibold tracking-tight text-white/90 sm:text-lg">{title}</h2>
          <p className="truncate text-xs text-white/45">{artist}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const el = rootRef.current;
              if (!el) return;
              if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => undefined);
              else void el.requestFullscreen?.().catch(() => undefined);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            title={t("lyrics.immersiveToggleFs")}
            aria-label={t("lyrics.immersiveToggleFs")}
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={t("lyrics.immersiveExit")}
            title={t("lyrics.immersiveExit")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col pt-16 sm:pt-20">
        {currentTrack == null ? (
          <p className="m-auto px-6 text-center text-sm text-white/45">{t("lyrics.selectTrack")}</p>
        ) : !currentTrack.hasLyrics ? (
          <div className="m-auto px-6 text-center">
            <p className="text-lg text-white/70">{t("lyrics.noLyrics")}</p>
            <p className="mt-2 text-xs text-white/35">{t("lyrics.noLyricsHint")}</p>
          </div>
        ) : loading ? (
          <p className="m-auto text-sm text-white/45">{t("lyrics.loading")}</p>
        ) : loadError ? (
          <p className="m-auto text-sm text-rose-300/90">{loadError}</p>
        ) : lines.length === 0 ? (
          <p className="m-auto text-sm text-white/45">{t("lyrics.empty")}</p>
        ) : (
          <div className="immersive-lyrics-scroll min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 sm:px-5 md:px-8">
            <div
              ref={lyricsStageRef}
              className="mx-auto flex min-h-full w-full flex-col justify-center py-[22vh] pb-[18vh]"
            >
              {lines.map((line, i) => {
                const dist = activeIndex < 0 ? i : Math.abs(i - activeIndex);
                const isActive = activeIndex >= 0 && i === activeIndex;
                const isNear = dist === 1;
                const baseSize = isActive
                  ? "clamp(1.75rem, 5.5vw, 3.75rem)"
                  : isNear
                    ? "clamp(1.05rem, 2.8vw, 1.75rem)"
                    : "clamp(0.85rem, 2vw, 1.2rem)";
                const fit = fitScales[i] ?? 1;
                const depthScale = isActive ? 1 : Math.max(0.92, 1 - dist * 0.03);
                return (
                  <p
                    key={`${line.timeMs}-${i}-${line.text.slice(0, 20)}`}
                    ref={(node) => {
                      lineRefs.current[i] = node;
                    }}
                    className={clsx(
                      "immersive-lyric-line flex w-full justify-center overflow-visible px-0 text-center font-semibold tracking-tight transition-[opacity,filter] duration-500 ease-out",
                      isActive && "immersive-lyric-active my-5 sm:my-7",
                      isNear && "my-3 text-white/55 sm:my-4",
                      !isActive && !isNear && "my-2 text-white/22"
                    )}
                    style={{
                      fontSize: `calc(${baseSize} * ${fontScale})`,
                      lineHeight: 1.35,
                      filter: isActive ? "none" : dist > 2 ? "blur(1.5px)" : dist > 1 ? "blur(0.6px)" : "none",
                      opacity: isActive ? 1 : Math.max(0.12, 0.55 - dist * 0.12),
                    }}
                  >
                    <span
                      data-lyric-text
                      className={clsx(
                        "inline-block whitespace-nowrap will-change-transform",
                        isActive && "immersive-lyric-sheen"
                      )}
                      style={{
                        transform: `scale(${fit * depthScale})`,
                        transformOrigin: "center center",
                      }}
                    >
                      {line.text || " "}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        className="immersive-chrome-dock-wrap pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-1 sm:px-5"
        onPointerEnter={() => pinChrome(true)}
        onPointerLeave={() => pinChrome(false)}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-5xl">
          <div
            className={clsx(
              "overflow-hidden border border-white/[0.08] bg-zinc-900/85 shadow-[0_16px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)_inset] backdrop-blur-3xl backdrop-saturate-150 transition-[border-radius] duration-300",
              dockExpanded ? "rounded-[1.75rem] sm:rounded-[2rem]" : "rounded-[2rem] sm:rounded-full"
            )}
          >
            {/* 主行：对齐底栏播放控制台 */}
            <div
              className={clsx(
                "flex p-2 sm:pr-3",
                dockExpanded
                  ? "flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                  : "flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3"
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:max-w-[240px] md:max-w-[280px]">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-800 shadow-md ring-2 ring-zinc-950/80 sm:h-12 sm:w-12">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt=""
                      className="h-full w-full object-cover animate-[spin_12s_linear_infinite]"
                      style={{ animationPlayState: playing ? "running" : "paused" }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-500">
                      <Music2 className="h-4 w-4 opacity-60" />
                    </div>
                  )}
                  <div className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full border border-zinc-700/60 bg-zinc-900 shadow-inner" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold leading-tight tracking-wide text-zinc-100 sm:text-[14px]">
                    {title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-medium leading-tight text-zinc-500 sm:text-[12px]">
                    {artist}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                {dockExpanded ? (
                  <button
                    type="button"
                    className="hidden h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 sm:flex"
                    onClick={() =>
                      setPlayMode((prev) => (prev === "list" ? "single" : prev === "single" ? "shuffle" : "list"))
                    }
                    title={
                      playMode === "single"
                        ? t("player.modeSingle")
                        : playMode === "shuffle"
                          ? t("player.modeShuffle")
                          : t("player.modeList")
                    }
                    aria-label={t("player.modeSwitch", {
                      mode:
                        playMode === "single"
                          ? t("player.modeSingle")
                          : playMode === "shuffle"
                            ? t("player.modeShuffle")
                            : t("player.modeList"),
                    })}
                  >
                    {playMode === "single" ? (
                      <Repeat1 className="h-4 w-4" />
                    ) : playMode === "shuffle" ? (
                      <Shuffle className="h-4 w-4" />
                    ) : (
                      <Repeat className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                  onClick={seekPrev}
                  disabled={playlistEmpty && !hasTrack}
                  aria-label={t("player.prev", { defaultValue: "上一首" })}
                >
                  <SkipBack className="h-4 w-4 fill-current" />
                </button>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-red-900/30 ring-1 ring-white/15 transition hover:brightness-110 disabled:opacity-40 sm:h-12 sm:w-12"
                  onClick={() => hasTrack && setPlaying((p) => !p)}
                  disabled={!hasTrack}
                  aria-label={playing ? t("vinyl.pause") : t("vinyl.play")}
                >
                  {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </button>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                  onClick={seekNext}
                  disabled={playlistEmpty && !hasTrack}
                  aria-label={t("player.next", { defaultValue: "下一首" })}
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                </button>
              </div>

              <div
                className={clsx(
                  "min-w-0 px-1 sm:px-2",
                  dockExpanded ? "w-full flex-1 sm:w-auto" : "order-last w-full basis-full sm:order-none sm:basis-auto sm:flex-1"
                )}
              >
                <div className="grid grid-cols-[2.4rem_1fr_2.4rem] items-center gap-x-2">
                  <span className="text-right text-[10px] tabular-nums text-zinc-500 sm:text-[11px]">
                    {formatTime(playPos)}
                  </span>
                  <div className="group relative flex h-6 min-w-0 touch-none items-center">
                    <input
                      type="range"
                      aria-label={t("player.ariaProgress")}
                      className="music-progress-range absolute inset-0 z-20 h-full w-full cursor-pointer opacity-[0.01] disabled:cursor-not-allowed"
                      min={0}
                      max={progressMax}
                      step={0.01}
                      value={progressMax > 0 ? Math.min(playPos, progressMax) : 0}
                      disabled={!hasTrack || progressMax <= 0}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setScrubbing(true);
                      }}
                      onChange={(e) => applySeek(e.target.valueAsNumber)}
                      onInput={(e) => applySeek((e.target as HTMLInputElement).valueAsNumber)}
                    />
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80 transition-all group-hover:h-2">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400"
                        style={{ width: `${progressPercent}%` }}
                        aria-hidden
                      />
                    </div>
                  </div>
                  <span className="text-left text-[10px] tabular-nums text-zinc-600 sm:text-[11px]">
                    {formatTime(barMax)}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {dockExpanded ? (
                  <>
                    <div className="mr-1 hidden w-[7.5rem] items-center gap-1.5 md:flex">
                      <Volume2 className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
                      <div className="group relative flex h-5 min-w-0 flex-1 items-center">
                        <input
                          type="range"
                          aria-label={t("player.ariaVolume")}
                          className="music-volume-range absolute z-10 h-full w-full cursor-pointer opacity-0"
                          min={0}
                          max={1}
                          step={0.02}
                          value={volume}
                          onChange={(e) => setVolume(Number(e.target.value))}
                        />
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/50 transition-all group-hover:h-2">
                          <div
                            className="absolute left-0 top-0 h-full rounded-full bg-zinc-300"
                            style={{ width: `${volume * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const el = rootRef.current;
                        const open = () => onOpenHistoryPanel();
                        if (el && document.fullscreenElement === el) {
                          void document.exitFullscreen().then(open).catch(open);
                        } else {
                          open();
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                      title={t("music.playHistory")}
                      aria-label={t("music.playHistory")}
                    >
                      <History className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={toggleDockExpanded}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                  title={dockExpanded ? t("lyrics.immersiveDockCollapse") : t("lyrics.immersiveDockExpand")}
                  aria-label={dockExpanded ? t("lyrics.immersiveDockCollapse") : t("lyrics.immersiveDockExpand")}
                  aria-expanded={dockExpanded}
                >
                  {dockExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 展开：更多设置 */}
            {dockExpanded ? (
              <div className="border-t border-white/[0.06] px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 md:hidden">
                    <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <div className="group relative flex h-5 w-28 items-center">
                      <input
                        type="range"
                        aria-label={t("player.ariaVolume")}
                        className="music-volume-range absolute z-10 h-full w-full cursor-pointer opacity-0"
                        min={0}
                        max={1}
                        step={0.02}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                      />
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/50">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-zinc-300"
                          style={{ width: `${volume * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/10 sm:hidden"
                    onClick={() =>
                      setPlayMode((prev) => (prev === "list" ? "single" : prev === "single" ? "shuffle" : "list"))
                    }
                  >
                    {playMode === "single" ? (
                      <Repeat1 className="h-3.5 w-3.5" />
                    ) : playMode === "shuffle" ? (
                      <Shuffle className="h-3.5 w-3.5" />
                    ) : (
                      <Repeat className="h-3.5 w-3.5" />
                    )}
                    {playMode === "single"
                      ? t("player.modeSingle")
                      : playMode === "shuffle"
                        ? t("player.modeShuffle")
                        : t("player.modeList")}
                  </button>

                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Type className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                    <span className="hidden shrink-0 text-[11px] text-zinc-500 sm:inline">
                      {t("lyrics.immersiveFontSize")}
                    </span>
                    <span className="select-none text-[11px] text-zinc-600" aria-hidden>
                      A
                    </span>
                    <input
                      type="range"
                      min={FONT_SCALE_MIN}
                      max={FONT_SCALE_MAX}
                      step={0.05}
                      value={fontScale}
                      onChange={(e) => onFontScaleChange(Number(e.target.value))}
                      className="immersive-font-slider min-w-0 flex-1"
                      aria-label={t("lyrics.immersiveFontSize")}
                      title={`${t("lyrics.immersiveFontSize")} ${scalePct}%`}
                    />
                    <span className="select-none text-[13px] font-semibold text-zinc-400" aria-hidden>
                      A
                    </span>
                    <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-zinc-500">{scalePct}%</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {dockExpanded ? (
            <p className="mt-2 text-center text-[10px] tracking-wide text-white/28">{t("lyrics.immersiveHint")}</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
