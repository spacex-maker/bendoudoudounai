import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { MusicTrackDto } from "../api/client";
import { findActiveIndex } from "../music/lyricsUtils";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import { LyricModeSwitcher } from "./LyricModeSwitcher";

/** 手动滚动/拖拽后，暂停自动跟唱一段时间（毫秒） */
const AUTO_SCROLL_PAUSE_MS = 2800;

export type TrackLyricsScrollProps = {
  track: Pick<
    MusicTrackDto,
    | "id"
    | "lyricsUrl"
    | "hasLyrics"
    | "durationSeconds"
    | "hasTranslatedLyrics"
    | "translatedLyricsUrl"
    | "hasRomaLyrics"
    | "romaLyricsUrl"
  > | null;
  currentTimeSec: number;
  className?: string;
  /** 与左侧封面并排时减小左内边距、歌词块靠左，拉近与封面的距离 */
  compactLeading?: boolean;
};

function Placeholder({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "flex min-h-0 h-full w-full flex-1 items-center justify-center px-3 text-center text-xs text-zinc-500",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TrackLyricsScroll({ track, currentTimeSec, className, compactLeading }: TrackLyricsScrollProps) {
  const { t } = useTranslation();
  const { displayLines, loading, loadError, mode, setMode, availableModes } = useSyncedLyrics(track);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const autoScrollLockUntil = useRef(0);
  const prevTrackId = useRef<number | null>(null);

  const pauseAutoScroll = useCallback(() => {
    autoScrollLockUntil.current = Date.now() + AUTO_SCROLL_PAUSE_MS;
  }, []);

  const timeMs = Math.max(0, currentTimeSec * 1000);
  const activeIndex = useMemo(() => findActiveIndex(displayLines, timeMs), [displayLines, timeMs]);

  lineRefs.current.length = displayLines.length;

  useEffect(() => {
    const tid = track?.id ?? null;
    if (tid !== prevTrackId.current) {
      prevTrackId.current = tid;
      autoScrollLockUntil.current = 0;
    }
  }, [track?.id]);

  useEffect(() => {
    if (activeIndex < 0 || displayLines.length === 0) return;
    if (Date.now() < autoScrollLockUntil.current) return;
    const el = lineRefs.current[activeIndex];
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, displayLines.length]);

  const hasAnyLyrics = availableModes.length > 0;
  const hasRenderableLyrics =
    track != null && hasAnyLyrics && !loading && !loadError && displayLines.length > 0;

  return (
    <div className={clsx("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      {hasAnyLyrics ? (
        <div className={clsx("mb-2 flex shrink-0", compactLeading ? "justify-start" : "justify-center sm:justify-end")}>
          <LyricModeSwitcher mode={mode} availableModes={availableModes} onChange={setMode} />
        </div>
      ) : null}
      {hasRenderableLyrics ? (
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
            {displayLines.map((line, i) => {
              const isActive = activeIndex >= 0 && i === activeIndex;
              const isBeforeFirst = activeIndex < 0 && i === 0;
              return (
                <div
                  key={`${mode}-${line.timeMs}-${i}-${line.primary.slice(0, 24)}`}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className={clsx(
                    "px-2 py-2.5 text-center transition-colors duration-200",
                    isActive && "text-white",
                    isBeforeFirst && "text-zinc-400",
                    !isActive && !isBeforeFirst && "text-zinc-600 hover:text-zinc-500"
                  )}
                >
                  <p
                    className={clsx(
                      "leading-7 sm:leading-8",
                      isActive ? "text-[15px] font-medium sm:text-base" : "text-[13px] sm:text-[14px]"
                    )}
                  >
                    {line.primary}
                  </p>
                  {line.secondary ? (
                    <p
                      className={clsx(
                        "mt-0.5 leading-5",
                        isActive
                          ? "text-[12px] font-normal text-white/65 sm:text-[13px]"
                          : "text-[11px] text-inherit opacity-75 sm:text-[12px]"
                      )}
                    >
                      {line.secondary}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : track == null ? (
        <Placeholder>{t("lyrics.selectTrack")}</Placeholder>
      ) : !hasAnyLyrics ? (
        <Placeholder>
          <span className="flex flex-col gap-1">
            <span>{t("lyrics.noLyrics")}</span>
            <span className="text-[11px] text-zinc-600">{t("lyrics.noLyricsHint")}</span>
          </span>
        </Placeholder>
      ) : loading ? (
        <Placeholder>{t("lyrics.loading")}</Placeholder>
      ) : loadError ? (
        <Placeholder className="text-red-400/90">{loadError}</Placeholder>
      ) : (
        <Placeholder>{t("lyrics.empty")}</Placeholder>
      )}
    </div>
  );
}
