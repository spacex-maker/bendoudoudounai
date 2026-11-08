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

const CHAR_IN_MS = 58;
const CHAR_OUT_MS = 42;
const FADE_ENTER_MS = 900;
const FADE_LEAVE_MS = 420;

/**
 * 片刻页底部氛围歌词：随默认配乐当前句若隐若现，不抢交互。
 * 支持 fade（整句淡入淡出）与 typewriter（逐字显现再逐字消散）。
 */
export function MomentsAmbientLyrics({ elevated = false }: Props) {
  const { currentTrack, playing, playPos, playerBarExpanded, momentsLyricEffect } = useMusicPlayer();
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

  const chars = useMemo(() => (shown ? Array.from(shown) : []), [shown]);
  const isTypewriter = momentsLyricEffect === "typewriter" && !reduceMotion;

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

    const enterMs = (text: string) => {
      if (reduceMotion) return 0;
      if (momentsLyricEffect === "typewriter") {
        return Math.min(2800, Math.max(480, Array.from(text).length * CHAR_IN_MS + 280));
      }
      return FADE_ENTER_MS;
    };
    const leaveMs = (text: string | null) => {
      if (reduceMotion) return 0;
      if (momentsLyricEffect === "typewriter" && text) {
        return Math.min(1800, Math.max(280, Array.from(text).length * CHAR_OUT_MS + 160));
      }
      return FADE_LEAVE_MS;
    };

    if (!playing || !active) {
      setPhase("out");
      swapTimerRef.current = window.setTimeout(() => setShown(null), leaveMs(shown));
      return () => window.clearTimeout(swapTimerRef.current);
    }

    if (active === shown) {
      if (phase === "out") {
        setPhase("in");
        enterTimerRef.current = window.setTimeout(() => setPhase("hold"), enterMs(active));
      }
      return () => window.clearTimeout(enterTimerRef.current);
    }

    const commit = () => {
      setShown(active);
      setPhase("in");
      enterTimerRef.current = window.setTimeout(() => setPhase("hold"), enterMs(active));
    };

    if (shown == null || phase === "out") {
      commit();
      return () => window.clearTimeout(enterTimerRef.current);
    }

    setPhase("out");
    swapTimerRef.current = window.setTimeout(commit, leaveMs(shown));
    return () => {
      window.clearTimeout(swapTimerRef.current);
      window.clearTimeout(enterTimerRef.current);
    };
    // phase 故意不进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, playing, shown, reduceMotion, momentsLyricEffect]);

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
        elevated ? "z-[120]" : "z-[45]"
      )}
      aria-hidden
    >
      <div
        className={clsx(
          "moments-ambient-lyric-veil absolute inset-x-0 bottom-0 h-44 sm:h-56",
          elevated ? "moments-ambient-lyric-veil--dark" : "moments-ambient-lyric-veil--light"
        )}
      />
      <p
        key={`${momentsLyricEffect}-${shown ?? ""}`}
        className={clsx(
          "moments-ambient-lyric relative max-w-[min(42rem,94vw)] text-center font-display text-[clamp(1.35rem,3.8vw,2.2rem)] leading-snug tracking-[0.05em]",
          elevated ? "moments-ambient-lyric--dark" : "moments-ambient-lyric--light",
          reduceMotion && "moments-ambient-lyric--static",
          !isTypewriter && !reduceMotion && phase === "in" && "moments-ambient-lyric--enter",
          !isTypewriter && !reduceMotion && phase === "hold" && "moments-ambient-lyric--breathe",
          !isTypewriter && !reduceMotion && phase === "out" && "moments-ambient-lyric--leave",
          isTypewriter && phase === "in" && "moments-ambient-lyric--type-in",
          isTypewriter && phase === "hold" && "moments-ambient-lyric--type-hold",
          isTypewriter && phase === "out" && "moments-ambient-lyric--type-out"
        )}
      >
        {isTypewriter
          ? chars.map((ch, i) => (
              <span
                key={`${i}-${ch}`}
                className="moments-ambient-lyric__char"
                style={{ ["--i" as string]: String(i), ["--n" as string]: String(Math.max(chars.length - 1, 1)) }}
              >
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))
          : shown}
      </p>
    </div>,
    document.body
  );
}