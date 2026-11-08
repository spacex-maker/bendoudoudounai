import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

type Props = {
  open: boolean;
  seconds?: number;
  onComplete: () => void;
  onCancel: () => void;
  onStartNow: () => void;
};

const RING = 2 * Math.PI * 54; // r=54

/**
 * Moments cinematic prelude: cancellable countdown, then slideshow + music.
 */
export function MomentsCinematicCountdown({
  open,
  seconds = 5,
  onComplete,
  onCancel,
  onStartNow,
}: Props) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(seconds);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setLeft(seconds);
      return;
    }
    setLeft(seconds);
    setEntered(false);
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, seconds]);

  const completeRef = useRef(onComplete);
  const cancelRef = useRef(onCancel);
  const startNowRef = useRef(onStartNow);
  const finishedRef = useRef(false);
  completeRef.current = onComplete;
  cancelRef.current = onCancel;
  startNowRef.current = onStartNow;

  useEffect(() => {
    if (!open) {
      finishedRef.current = false;
      return;
    }
  }, [open]);

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    completeRef.current();
  };

  useEffect(() => {
    if (!open) return;
    if (left <= 0) {
      finishOnce();
      return;
    }
    const timer = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, left]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (finishedRef.current) return;
        finishedRef.current = true;
        startNowRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const progress = left / seconds;
  const dash = RING * progress;

  return createPortal(
    <div
      className={clsx(
        "moments-countdown fixed inset-0 z-[112] flex items-center justify-center px-4",
        entered ? "moments-countdown--in" : "moments-countdown--out"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t("moments.countdownAria")}
    >
      <div className="absolute inset-0 bg-stone-950/35 backdrop-blur-[3px]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(255, 210, 220, 0.28), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="moments-countdown__card relative w-full max-w-[22rem] overflow-hidden rounded-[2rem] border border-white/55 px-6 pb-6 pt-7 text-center shadow-[0_28px_80px_rgba(41,37,36,0.22)]">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/88 via-[#fff7f4]/82 to-rose-50/75 backdrop-blur-xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-rose-200/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-amber-100/50 blur-3xl"
          aria-hidden
        />

        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/50 p-1.5 text-stone-500 transition hover:bg-white hover:text-stone-700"
          aria-label={t("moments.countdownCancel")}
          title={t("moments.countdownCancel")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-500/80">
            {t("moments.countdownKicker")}
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-tight text-warm-800 sm:text-[1.65rem]">
            {t("moments.countdownTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600/90">
            {t("moments.countdownHint")}
          </p>

          <div className="relative mx-auto mt-6 flex h-40 w-40 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden>
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="6"
              />
              <circle
                className="moments-countdown__ring"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="url(#momentsCountdownGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING - dash}
              />
              <defs>
                <linearGradient id="momentsCountdownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
            <div className="relative text-center">
              <span
                key={left}
                className="moments-countdown__num block font-display text-6xl leading-none text-warm-800"
              >
                {Math.max(left, 0)}
              </span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                {t("moments.countdownSec")}
              </span>
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/55 px-3 py-1.5 text-xs text-stone-600 ring-1 ring-rose-100/80">
            <Music2 className="h-3.5 w-3.5 text-rose-500" aria-hidden />
            {t("moments.countdownMusic")}
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (finishedRef.current) return;
                finishedRef.current = true;
                onStartNow();
              }}
              className="rounded-full bg-warm-700 px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(120,53,15,0.22)] transition hover:-translate-y-0.5 hover:bg-warm-800 active:translate-y-0"
            >
              {t("moments.countdownStartNow")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-5 py-2 text-sm text-stone-500 transition hover:bg-white/70 hover:text-stone-700"
            >
              {t("moments.countdownCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}