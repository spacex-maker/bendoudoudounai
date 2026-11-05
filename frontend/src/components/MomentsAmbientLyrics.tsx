import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useMusicPlayer } from "../music/MusicPlayerContext";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import { getActiveLyricText } from "../music/lyricsUtils";

type Props = {
  /** 深色叠层（灯箱 / 影院）时改用浅色字 */
  elevated?: boolean;
};

/**
 * 片刻页底部氛围歌词：随默认配乐当前句若隐若现，不抢交互。
 */
export function MomentsAmbientLyrics({ elevated = false }: Props) {
  const { currentTrack, playing, playPos, playerBarExpanded } = useMusicPlayer();
  const { lines, loading } = useSyncedLyrics(currentTrack);
  const active = useMemo(() => {
    if (!currentTrack?.hasLyrics || lines.length === 0) return null;
    return getActiveLyricText(lines, playPos);
  }, [currentTrack?.hasLyrics, lines, playPos]);

  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("out");
  const swapTimerRef = useRef(0);
  const enterTimerRef = useRef(0);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    window.clearTimeout(swapTimerRef.current);
    window.clearTimeout(enterTimerRef.current);

    if (!playing || !active) {
      setPhase("out");
      swapTimerRef.current = window.setTimeout(
        () => setShown(null),
        reduceMotion ? 0 : 420
      );
      return () => window.clearTimeout(swapTimerRef.current);
    }

    if (active === shown) {
      if (phase === "out") {
        setPhase("in");
        enterTimerRef.current = window.setTimeout(
          () => setPhase("hold"),
          reduceMotion ? 0 : 700
        );
      }
      return () => window.clearTimeout(enterTimerRef.current);
    }

    const commit = () => {
      setShown(active);
      setPhase("in");
      enterTimerRef.current = window.setTimeout(
        () => setPhase("hold"),
        reduceMotion ? 0 : 700
      );
    };

    if (shown == null || phase === "out") {
      commit();
      return () => window.clearTimeout(enterTimerRef.current);
    }

    setPhase("out");
    swapTimerRef.current = window.setTimeout(commit, reduceMotion ? 0 : 280);
    return () => {
      window.clearTimeout(swapTimerRef.current);
      window.clearTimeout(enterTimerRef.current);
    };
    // phase 故意不进依赖：由本 effect 内部推进，避免进场被立刻盖成 hold
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, playing, shown, reduceMotion]);

  if (!mounted || typeof document === "undefined") return null;
  if (!currentTrack?.hasLyrics || loading) return null;
  if (!shown && phase === "out") return null;

  return createPortal(
    <div
      className={clsx(
        "pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-10 pt-16 sm:px-16",
        playerBarExpanded
          ? "pb-[max(22rem,env(safe-area-inset-bottom))] sm:pb-[max(24rem,env(safe-area-inset-bottom))]"
          : "pb-[max(4.5rem,env(safe-area-inset-bottom))] sm:pb-[max(5rem,env(safe-area-inset-bottom))]",
        elevated ? "z-[125]" : "z-[45]"
      )}
      aria-hidden
    >
      <div
        className={clsx(
          "moments-ambient-lyric-veil absolute inset-x-0 bottom-0 h-36 sm:h-44",
          elevated ? "moments-ambient-lyric-veil--dark" : "moments-ambient-lyric-veil--light"
        )}
      />
      <p
        key={shown ?? ""}
        className={clsx(
          "moments-ambient-lyric relative max-w-[min(36rem,92vw)] text-center font-display text-[clamp(1.05rem,2.8vw,1.55rem)] leading-relaxed tracking-[0.04em]",
          elevated ? "moments-ambient-lyric--dark" : "moments-ambient-lyric--light",
          reduceMotion && "moments-ambient-lyric--static",
          !reduceMotion && phase === "in" && "moments-ambient-lyric--enter",
          !reduceMotion && phase === "hold" && "moments-ambient-lyric--breathe",
          !reduceMotion && phase === "out" && "moments-ambient-lyric--leave"
        )}
      >
        {shown}
      </p>
    </div>,
    document.body
  );
}