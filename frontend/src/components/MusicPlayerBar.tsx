import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Play, Pause, SkipBack, SkipForward, Volume2, Music2, Repeat, Repeat1, Shuffle, History } from "lucide-react";
import clsx from "clsx";
import { useAudioAnalyserGlow } from "../music/useAudioAnalyserGlow";

function formatTime(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 与当前播放到的时间重叠的已缓冲区末端（秒），用于网易云式「浅灰已加载」条 */
function bufferedEndSec(el: HTMLAudioElement): number {
  const b = el.buffered;
  if (!b || b.length === 0) return 0;
  const t = el.currentTime;
  for (let i = 0; i < b.length; i++) {
    if (b.start(i) <= t + 0.25 && t <= b.end(i) + 0.01) {
      return b.end(i);
    }
  }
  let max = 0;
  for (let i = 0; i < b.length; i++) {
    max = Math.max(max, b.end(i));
  }
  return max;
}

export type MusicPlayerBarProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  coverSrc: string | null;
  title: string;
  artist: string;
  playPos: number;
  barMax: number;
  scrubbing: boolean;
  onScrubbingChange: (scrubbing: boolean) => void;
  onPlayPosChange: (seconds: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** 无曲目时上一首/下一首禁用 */
  playlistEmpty: boolean;
  /** 当前是否有选中曲目（控制播放按钮） */
  hasTrack: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  /** 紧挨进度条滑轨下方一行当前歌词；为 null 时不占高度（显隐替换） */
  barLyricLine?: string | null;
  /** 切歌时重建缓冲进度监听，传当前曲 id 即可 */
  currentTrackId?: number | null;
  playMode: "single" | "list" | "shuffle";
  onCyclePlayMode: () => void;
  onOpenHistoryPanel: () => void;
};

export function MusicPlayerBar({
  audioRef,
  coverSrc,
  title,
  artist,
  playPos,
  barMax,
  scrubbing,
  onScrubbingChange,
  onPlayPosChange,
  playing,
  onTogglePlay,
  onPrev,
  onNext,
  playlistEmpty,
  hasTrack,
  volume,
  onVolumeChange,
  barLyricLine = null,
  currentTrackId = null,
  playMode,
  onCyclePlayMode,
  onOpenHistoryPanel,
}: MusicPlayerBarProps) {
  const { t } = useTranslation();
  const footerRef = useRef<HTMLElement | null>(null);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  useAudioAnalyserGlow(audioRef, footerRef, {
    playing,
    hasTrack,
    volume,
  });

  useEffect(() => {
    if (!scrubbing) return;
    const end = () => onScrubbingChange(false);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [scrubbing, onScrubbingChange]);

  useEffect(() => {
    if (!hasTrack) {
      setBufferedEnd(0);
      return;
    }
    const a = audioRef.current;
    if (!a) {
      setBufferedEnd(0);
      return;
    }
    const tick = () => {
      if (!audioRef.current) return;
      setBufferedEnd(bufferedEndSec(audioRef.current));
    };
    tick();
    const onAny = () => tick();
    a.addEventListener("progress", onAny);
    a.addEventListener("loadedmetadata", onAny);
    a.addEventListener("durationchange", onAny);
    a.addEventListener("canplay", onAny);
    a.addEventListener("canplaythrough", onAny);
    a.addEventListener("timeupdate", onAny);
    return () => {
      a.removeEventListener("progress", onAny);
      a.removeEventListener("loadedmetadata", onAny);
      a.removeEventListener("durationchange", onAny);
      a.removeEventListener("canplay", onAny);
      a.removeEventListener("canplaythrough", onAny);
      a.removeEventListener("timeupdate", onAny);
    };
  }, [hasTrack, audioRef, currentTrackId]);


  // 计算进度百分比，用于定制化进度条的视觉表现
  const progressPercent = barMax > 0 ? (playPos / barMax) * 100 : 0;
  const progressMax = barMax > 0 ? barMax : 0;
  const a = audioRef.current;
  const scaleDuration =
    a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : barMax;
  const bufferedPercent =
    hasTrack && scaleDuration > 0
      ? Math.min(100, (Math.min(bufferedEnd, scaleDuration) / scaleDuration) * 100)
      : 0;

  const applySeek = (raw: number) => {
    const t = Number(raw);
    const a = audioRef.current;
    if (!a || !Number.isFinite(t) || t < 0) return;
    a.currentTime = t;
    onPlayPosChange(t);
  };

  const modeTitle =
    playMode === "single"
      ? t("player.modeSingle")
      : playMode === "shuffle"
        ? t("player.modeShuffle")
        : t("player.modeList");
  const modeAriaLabel = t("player.modeSwitch", { mode: modeTitle });
  const ModeIcon = playMode === "single" ? Repeat1 : playMode === "shuffle" ? Shuffle : Repeat;

  return (
    <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 sm:bottom-6 sm:px-6">
      <footer
        ref={footerRef}
        className={clsx(
          "pointer-events-auto w-full max-w-5xl overflow-hidden transition-colors duration-300",
          "rounded-[32px] sm:rounded-full",
          "bg-zinc-900/85 shadow-[0_16px_48px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
          "backdrop-blur-3xl backdrop-saturate-200"
        )}
      >
        <div className="flex flex-col gap-0 p-2 sm:gap-0 sm:pr-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          
          {/* 左侧：封面与歌曲信息 & 移动端控制按钮 */}
          <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[240px] sm:max-w-[300px] shrink-0 rounded-full bg-white/[0.03] p-1.5 pr-4 shadow-sm ring-1 ring-white/[0.05]">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-md bg-zinc-800 ring-2 ring-zinc-900">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={title}
                  className="h-full w-full object-cover animate-[spin_12s_linear_infinite]"
                  style={{ animationPlayState: playing ? "running" : "paused" }}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-zinc-500">
                  <Music2 className="h-5 w-5 opacity-50" />
                </div>
              )}
              {/* 黑胶唱片中心圆孔 */}
              <div className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-zinc-900 border border-zinc-700/50 shadow-inner" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold leading-tight tracking-wide text-zinc-100">
                {title || t("player.idle")}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-medium leading-tight text-zinc-500">
                {artist || t("player.unknownArtist")}
              </div>
            </div>

            {/* 移动端专属控制区（整合在左侧面板右边缘） */}
            <div className="flex items-center gap-1 sm:hidden">
              <button
                type="button"
                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10"
                onClick={onCyclePlayMode}
                title={modeTitle}
                aria-label={modeAriaLabel}
              >
                <ModeIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-white text-black shadow-lg transition active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                onClick={onTogglePlay}
                disabled={!hasTrack}
              >
                {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </button>
              <button
                type="button"
                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10"
                onClick={onOpenHistoryPanel}
                title={t("music.playHistory")}
                aria-label={t("music.playHistory")}
              >
                <History className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 桌面端居中：播放控制区 */}
          <div className="hidden sm:flex items-center justify-center gap-2 shrink-0">
            <button
              type="button"
              className="group rounded-full p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 active:scale-90"
              onClick={onCyclePlayMode}
              title={modeTitle}
              aria-label={modeAriaLabel}
            >
              <ModeIcon className="h-5 w-5 transition group-hover:scale-110" />
            </button>
            <button
              type="button"
              className="group rounded-full p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={onPrev}
              disabled={playlistEmpty}
            >
              <SkipBack className="h-5 w-5 fill-current transition group-hover:scale-110" />
            </button>
            <button
              type="button"
              className={clsx(
                "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300",
                "bg-gradient-to-br from-rose-500 to-red-600 ring-1 ring-white/20 shadow-red-900/30",
                "hover:scale-105 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:brightness-100"
              )}
              onClick={onTogglePlay}
              disabled={!hasTrack}
            >
              {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-1" />}
            </button>
            <button
              type="button"
              className="group rounded-full p-2.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={onNext}
              disabled={playlistEmpty}
            >
              <SkipForward className="h-5 w-5 fill-current transition group-hover:scale-110" />
            </button>
          </div>

          {/* 进度条与时间；歌词仅出现在滑轨正下方（与时间列对齐的 grid） */}
          <div
            className={clsx(
              "flex min-w-0 flex-1 flex-col px-3 py-1 sm:min-w-[11rem] sm:px-2 sm:py-0 md:min-w-[14rem]",
              barLyricLine ? "gap-1" : "gap-0"
            )}
          >
            <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-x-3">
              <span className="min-w-0 text-right text-[12px] font-medium tabular-nums tracking-wider text-zinc-400">
                {formatTime(playPos)}
              </span>

              <div className="group relative flex h-8 min-w-0 touch-none items-center cursor-pointer sm:h-6">
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
                    onScrubbingChange(true);
                  }}
                  onChange={(e) => applySeek(e.target.valueAsNumber)}
                  onInput={(e) => applySeek((e.target as HTMLInputElement).valueAsNumber)}
                />
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/80 transition-all group-hover:h-2">
                  {/* 已缓冲 / 可播范围（参考网易云底轨浅灰条） */}
                  <div
                    className="absolute left-0 top-0 z-0 h-full rounded-full bg-zinc-500/50 transition-[width] duration-200 ease-out"
                    style={{
                      width: `${Number.isFinite(bufferedPercent) ? bufferedPercent : 0}%`,
                    }}
                    aria-hidden
                  />
                  {/* 已播放 */}
                  <div
                    className="absolute left-0 top-0 z-[1] h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-150 ease-out"
                    style={{ width: `${progressPercent}%` }}
                    aria-hidden
                  />
                </div>
                <div
                  className="pointer-events-none absolute h-3 w-3 -ml-1.5 scale-50 rounded-full bg-white opacity-0 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-200 group-hover:scale-100 group-hover:opacity-100"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <span className="min-w-0 text-left text-[12px] font-medium tabular-nums tracking-wider text-zinc-500">
                {formatTime(barMax)}
              </span>
            </div>

            {barLyricLine ? (
              <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-start gap-x-3">
                <div className="min-w-0" aria-hidden />
                <p className="min-w-0 truncate text-center text-[12px] font-medium leading-snug text-zinc-200/95 sm:text-[13px]">
                  {barLyricLine}
                </p>
                <div className="min-w-0" aria-hidden />
              </div>
            ) : null}
          </div>

          {/* 桌面端：音量控制 */}
          <div className="hidden sm:flex shrink-0 items-center gap-2 w-32 pl-2">
            <Volume2 className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
            <div className="group relative flex h-5 flex-1 items-center cursor-pointer">
              <input
                type="range"
                aria-label={t("player.ariaVolume")}
                className="music-volume-range absolute z-10 w-full h-full opacity-0 cursor-pointer"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
              />
              <div className="relative w-full h-1.5 overflow-hidden rounded-full bg-zinc-700/50 transition-all group-hover:h-2">
                <div 
                  className="absolute left-0 top-0 h-full rounded-full bg-zinc-300"
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              className="ml-1 rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
              onClick={onOpenHistoryPanel}
              title={t("music.playHistory")}
              aria-label={t("music.playHistory")}
            >
              <History className="h-4 w-4" />
            </button>
          </div>
          </div>
        </div>
      </footer>
    </div>
  );
}