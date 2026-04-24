import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { MusicTrackDto } from "../api/client";
import { findActiveIndex } from "../music/lyricsUtils";
import { useSyncedLyrics } from "../music/useSyncedLyrics";

/** 手动滚动/拖拽后，暂停自动跟唱一段时间（毫秒） */
const AUTO_SCROLL_PAUSE_MS = 2800;

export type TrackLyricsScrollProps = {
  track: Pick<MusicTrackDto, "id" | "lyricsUrl" | "hasLyrics" | "durationSeconds"> | null;
  currentTimeSec: number;
  className?: string;
  /** 与左侧封面并排时减小左内边距、歌词块靠左，拉近与封面的距离 */
  compactLeading?: boolean;
};

function Placeholder({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "flex min-h-[8rem] items-center justify-center px-3 text-center text-xs text-zinc-500",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TrackLyricsScroll({ track, currentTimeSec, className, compactLeading }: TrackLyricsScrollProps) {
  const { t } = useTranslation();
  const { lines, loading, loadError } = useSyncedLyrics(track);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const autoScrollLockUntil = useRef(0);
  const prevTrackId = useRef<number | null>(null);

  const pauseAutoScroll = useCallback(() => {
    autoScrollLockUntil.current = Date.now() + AUTO_SCROLL_PAUSE_MS;
  }, []);

  const timeMs = Math.max(0, currentTimeSec * 1000);
  const activeIndex = useMemo(() => findActiveIndex(lines, timeMs), [lines, timeMs]);

  lineRefs.current.length = lines.length;

  useEffect(() => {
    const tid = track?.id ?? null;
    if (tid !== prevTrackId.current) {
      prevTrackId.current = tid;
      autoScrollLockUntil.current = 0;
    }
  }, [track?.id]);

  useEffect(() => {
    if (activeIndex < 0 || lines.length === 0) return;
    if (Date.now() < autoScrollLockUntil.current) return;
    const el = lineRefs.current[activeIndex];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, lines.length]);

  if (track == null) {
    return <Placeholder className={className}>{t("lyrics.selectTrack")}</Placeholder>;
  }

  if (!track.hasLyrics) {
    return (
      <Placeholder className={className}>
        <span className="flex flex-col gap-1">
          <span>{t("lyrics.noLyrics")}</span>
          <span className="text-[11px] text-zinc-600">{t("lyrics.noLyricsHint")}</span>
        </span>
      </Placeholder>
    );
  }

  if (loading) {
    return <Placeholder className={className}>{t("lyrics.loading")}</Placeholder>;
  }

  if (loadError) {
    return <Placeholder className={clsx(className, "text-red-400/90")}>{loadError}</Placeholder>;
  }

  if (lines.length === 0) {
    return <Placeholder className={className}>{t("lyrics.empty")}</Placeholder>;
  }

  return (
    <div className={clsx("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div
        className={clsx(
          "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
          "py-2",
          compactLeading ? "pl-0 pr-1 sm:pl-0 sm:pr-3" : "px-1 sm:px-3",
          "[scrollbar-width:thin] [scrollbar-color:rgba(82,82,91,0.55)_transparent]"
        )}
        onWheel={pauseAutoScroll}
        onTouchStart={pauseAutoScroll}
        onMouseDown={pauseAutoScroll}
      >
        <div
          className={clsx(
            "pb-16 pt-6",
            compactLeading ? "ml-0 mr-auto max-w-lg" : "mx-auto max-w-lg"
          )}
        >
          {lines.map((line, i) => {
            const isActive = activeIndex >= 0 && i === activeIndex;
            const isBeforeFirst = activeIndex < 0 && i === 0;
            return (
              <p
                key={`${line.timeMs}-${i}-${line.text.slice(0, 24)}`}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className={clsx(
                  "px-2 py-2.5 text-center text-[13px] leading-7 transition-colors duration-200 sm:text-[14px] sm:leading-8",
                  isActive && "text-[15px] font-medium text-white sm:text-base",
                  isActive && "drop-shadow-[0_0_20px_rgba(255,255,255,0.08)]",
                  isBeforeFirst && "text-zinc-400",
                  !isActive && !isBeforeFirst && "text-zinc-600 hover:text-zinc-500"
                )}
              >
                {line.text}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
