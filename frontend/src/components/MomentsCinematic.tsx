import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { MomentPhotoDto } from "../api/client";

type Props = {
  items: MomentPhotoDto[];
  active: boolean;
  onDismiss: () => void;
  onOpenIndex: (index: number) => void;
};

const HOLD_MS = 5200;
const FADE_MS = 900;

/**
 * 片刻页空闲后的影院式幻灯：全屏暗场 + Ken Burns 缓推 + 交叉淡入淡出。
 * 任意指针/滚轮/键盘操作退出；点图进入手动 lightbox。
 */
export function MomentsCinematic({ items, active, onDismiss, onOpenIndex }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  const safeItems = useMemo(() => items.filter((x) => !!(x.largeUrl || x.publicUrl || x.thumbUrl)), [items]);
  const current = safeItems[index % Math.max(1, safeItems.length)];

  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    setIndex(0);
    setPhase("in");
  }, [active, safeItems.length]);

  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    let cancelled = false;
    let timer = 0;

    const schedule = () => {
      if (phase === "in") {
        timer = window.setTimeout(() => {
          if (!cancelled) setPhase("hold");
        }, FADE_MS);
      } else if (phase === "hold") {
        timer = window.setTimeout(() => {
          if (!cancelled) setPhase("out");
        }, HOLD_MS);
      } else {
        timer = window.setTimeout(() => {
          if (cancelled) return;
          setIndex((i) => (i + 1) % safeItems.length);
          setPhase("in");
        }, FADE_MS);
      }
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, phase, index, safeItems.length]);

  useEffect(() => {
    if (!active) return;
    const stop = (e: Event) => {
      // 点在「轻触看大图」时交给按钮，不立刻 dismiss 与 click 冲突
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-cinematic-keep]")) return;
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === " ") {
        onDismiss();
      }
    };
    window.addEventListener("pointerdown", stop, { capture: true });
    window.addEventListener("wheel", stop, { capture: true, passive: true });
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("pointerdown", stop, true);
      window.removeEventListener("wheel", stop, true);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active, onDismiss]);

  if (!active || !current || safeItems.length < 2) return null;

  const src = current.largeUrl || current.publicUrl || current.thumbUrl;
  const visible = phase !== "out";

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-stone-950/92"
      role="presentation"
      aria-label={t("moments.slideshowAria")}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            current.dominantHue == null
              ? "radial-gradient(ellipse at 50% 40%, rgba(120,113,108,0.35), transparent 65%)"
              : `radial-gradient(ellipse at 50% 40%, hsl(${current.dominantHue} 40% 40% / 0.35), transparent 65%)`,
        }}
      />

      <button
        type="button"
        data-cinematic-keep
        className="absolute inset-0 z-10 cursor-zoom-in"
        aria-label={t("moments.slideshowOpen")}
        onClick={(e) => {
          e.stopPropagation();
          const realIndex = items.findIndex((x) => x.id === current.id);
          onDismiss();
          if (realIndex >= 0) onOpenIndex(realIndex);
        }}
      />

      <div className="pointer-events-none relative z-[5] flex h-full w-full items-center justify-center px-6 py-16 sm:px-12">
        <img
          key={`${current.id}-${index}-${phase === "in" ? "a" : "b"}`}
          src={src}
          alt={current.caption || ""}
          draggable={false}
          className={clsx(
            "moments-kenburns max-h-[min(88dvh,920px)] max-w-[min(94vw,1100px)] rounded-sm object-contain shadow-[0_30px_80px_rgba(0,0,0,0.45)]",
            visible ? "opacity-100" : "opacity-0",
            "transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          )}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
          {current.caption ? (
            <p className="text-sm text-white/80 sm:text-base">{current.caption}</p>
          ) : null}
          <p className="text-[11px] tracking-[0.18em] text-white/45 uppercase">
            {t("moments.slideshowHint", {
              current: (index % safeItems.length) + 1,
              total: safeItems.length,
            })}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            {safeItems.slice(0, Math.min(12, safeItems.length)).map((p, i) => (
              <span
                key={p.id}
                className={clsx(
                  "h-1 rounded-full transition-all duration-500",
                  i === index % safeItems.length ? "w-5 bg-white/80" : "w-1.5 bg-white/30"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes moments-kenburns {
          from { transform: scale(1.02); }
          to { transform: scale(1.12); }
        }
        .moments-kenburns {
          animation: moments-kenburns ${HOLD_MS + FADE_MS * 2}ms linear forwards;
          transform-origin: 50% 45%;
          will-change: transform, opacity;
        }
        @media (prefers-reduced-motion: reduce) {
          .moments-kenburns { animation: none; }
        }
      `}</style>
    </div>,
    document.body
  );
}
