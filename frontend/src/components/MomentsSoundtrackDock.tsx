import { useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import clsx from "clsx";
import { coverDisplayUrl } from "../api/client";
import { useMusicPlayer } from "../music/MusicPlayerContext";

function formatTime(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  audioRef: RefObject<HTMLAudioElement | null>;
  barMax: number;
  onTogglePlay: () => void;
  onCyclePlayMode: () => void;
};

/**
 * 片刻页右下角：收起为迷你条，点击展开精选曲目坞（切歌 / 进度 / 音量）。
 */
export function MomentsSoundtrackDock({
  audioRef,
  barMax,
  onTogglePlay,
  onCyclePlayMode,
}: Props) {
  const { t } = useTranslation();
  const {
    currentTrack,
    currentId,
    playing,
    playPos,
    setPlayPos,
    scrubbing,
    setScrubbing,
    volume,
    setVolume,
    playMode,
    queue,
    selectTrack,
    seekNext,
    seekPrev,
    coverSrc,
    playerBarExpanded,
    setPlayerBarExpanded,
  } = useMusicPlayer();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const hasTrack = currentTrack != null;
  const playlistEmpty = queue.length === 0;
  const progressPercent = barMax > 0 ? (playPos / barMax) * 100 : 0;

  const modeTitle =
    playMode === "single"
      ? t("player.modeSingle")
      : playMode === "shuffle"
        ? t("player.modeShuffle")
        : t("player.modeList");
  const ModeIcon = playMode === "single" ? Repeat1 : playMode === "shuffle" ? Shuffle : Repeat;

  useEffect(() => {
    if (!playerBarExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayerBarExpanded(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      const target = e.target as Node | null;
      if (el && target && !el.contains(target)) setPlayerBarExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [playerBarExpanded, setPlayerBarExpanded]);

  useEffect(() => {
    if (!scrubbing) return;
    const end = () => setScrubbing(false);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [scrubbing, setScrubbing]);

  const applySeek = (raw: number) => {
    const sec = Number(raw);
    const a = audioRef.current;
    if (!a || !Number.isFinite(sec) || sec < 0) return;
    a.currentTime = sec;
    setPlayPos(sec);
  };

  const tracks = queue;

  if (!hasTrack && tracks.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-4 right-4 z-[135] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      {playerBarExpanded ? (
        <div className="pointer-events-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/92 text-zinc-100 shadow-[0_24px_64px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-start gap-3 border-b border-white/[0.06] p-3.5">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt=""
                  className="h-full w-full animate-[spin_14s_linear_infinite] object-cover"
                  style={{ animationPlayState: playing ? "running" : "paused" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                  <Music2 className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-rose-300/80">
                {t("moments.soundtrackTitle")}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-zinc-50">
                {currentTrack?.title ?? t("music.pickTrack")}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {currentTrack?.artist ?? t("music.unknownArtist")}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
              onClick={() => setPlayerBarExpanded(false)}
              aria-label={t("moments.soundtrackCollapse")}
              title={t("moments.soundtrackCollapse")}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-3.5 pb-3.5 pt-3">
            <div className="space-y-1.5">
              <div className="group relative flex h-7 touch-none items-center">
                <input
                  type="range"
                  className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-[0.01] disabled:cursor-not-allowed"
                  min={0}
                  max={barMax > 0 ? barMax : 0}
                  step={0.05}
                  value={barMax > 0 ? Math.min(playPos, barMax) : 0}
                  disabled={!hasTrack || barMax <= 0}
                  aria-label={t("player.ariaProgress", { defaultValue: "播放进度" })}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setScrubbing(true);
                  }}
                  onChange={(e) => applySeek(Number(e.target.value))}
                  onInput={(e) => applySeek(Number((e.target as HTMLInputElement).value))}
                />
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-700/80 ring-1 ring-white/10 transition-all group-hover:h-2.5">
                  <div
                    className="absolute left-0 top-0 z-[1] h-full rounded-full bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300"
                    style={{ width: `${Number.isFinite(progressPercent) ? progressPercent : 0}%` }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute z-[2] h-3.5 w-3.5 -ml-[7px] rounded-full border-2 border-white/90 bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.55)]"
                  style={{ left: `${Number.isFinite(progressPercent) ? progressPercent : 0}%` }}
                  aria-hidden
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium tabular-nums tracking-wide text-zinc-300">
                <span>{formatTime(playPos)}</span>
                <span className="text-zinc-500">{formatTime(barMax)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10"
                onClick={onCyclePlayMode}
                title={modeTitle}
                aria-label={t("player.modeSwitch", { mode: modeTitle })}
              >
                <ModeIcon className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-200 transition hover:bg-white/10 disabled:opacity-30"
                  onClick={seekPrev}
                  disabled={playlistEmpty}
                  aria-label={t("player.prev", { defaultValue: "上一首" })}
                >
                  <SkipBack className="h-4 w-4 fill-current" />
                </button>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg transition active:scale-95 disabled:opacity-30"
                  onClick={onTogglePlay}
                  disabled={!hasTrack}
                  aria-label={playing ? t("player.pause", { defaultValue: "暂停" }) : t("player.play", { defaultValue: "播放" })}
                >
                  {playing ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  )}
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-200 transition hover:bg-white/10 disabled:opacity-30"
                  onClick={seekNext}
                  disabled={playlistEmpty}
                  aria-label={t("player.next", { defaultValue: "下一首" })}
                >
                  <SkipForward className="h-4 w-4 fill-current" />
                </button>
              </div>
              <div className="flex w-[4.75rem] items-center gap-1">
                <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <div className="relative flex h-5 flex-1 items-center">
                  <input
                    type="range"
                    className="music-volume-range absolute z-10 h-full w-full cursor-pointer opacity-0"
                    min={0}
                    max={1}
                    step={0.02}
                    value={volume}
                    aria-label={t("player.ariaVolume")}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                  <div className="relative h-1 w-full overflow-hidden rounded-full bg-zinc-700/55">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-zinc-300"
                      style={{ width: `${volume * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar">
              {tracks.length === 0 ? (
                <p className="px-1 py-3 text-center text-xs text-zinc-500">
                  {t("moments.soundtrackEmpty")}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {tracks.map((tr, idx) => {
                    const active = tr.id === currentId;
                    const cover = coverDisplayUrl(tr);
                    return (
                      <li key={tr.id}>
                        <button
                          type="button"
                          className={clsx(
                            "flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition",
                            active ? "bg-white/12 ring-1 ring-white/10" : "hover:bg-white/[0.06]"
                          )}
                          onClick={() => selectTrack(tr, true)}
                        >
                          <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-zinc-500">
                            {idx + 1}
                          </span>
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                            {cover ? (
                              <img src={cover} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                                <Music2 className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={clsx("truncate text-xs", active ? "text-rose-200" : "text-zinc-100")}>
                              {tr.title}
                            </div>
                            <div className="truncate text-[11px] text-zinc-500">{tr.artist}</div>
                          </div>
                          {active && playing ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-zinc-900/95 px-1.5 py-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setPlayerBarExpanded(true)}
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-0 bg-zinc-800 p-0 ring-1 ring-white/10 appearance-none"
          aria-label={t("moments.soundtrackExpand")}
          title={t("moments.soundtrackExpand")}
        >
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              className="h-full w-full animate-[spin_12s_linear_infinite] object-cover"
              style={{ animationPlayState: playing ? "running" : "paused" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-500">
              <Music2 className="h-4 w-4" />
            </div>
          )}
          <div className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full border border-zinc-700/40 bg-zinc-900" />
        </button>

        <button
          type="button"
          onClick={() => setPlayerBarExpanded(true)}
          className="min-w-0 max-w-[110px] border-0 bg-transparent p-0 px-1 text-left appearance-none"
          aria-label={t("moments.soundtrackExpand")}
        >
          <div className="truncate text-xs font-semibold leading-tight text-zinc-100">
            {currentTrack?.title ?? t("moments.soundtrackTitle")}
          </div>
          <div className="truncate text-[10px] text-zinc-500">
            {currentTrack?.artist ?? t("moments.soundtrackHint")}
          </div>
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-200 transition hover:bg-white/20"
          aria-label={playing ? t("player.pause", { defaultValue: "暂停" }) : t("player.play", { defaultValue: "播放" })}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
