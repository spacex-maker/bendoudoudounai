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

/** 停留略长，给慢交叉淡入留呼吸感 */
const HOLD_MS = 6000;
/** 渐显：约 2.8s，起手更慢；渐隐同步 */
const FADE_MS = 2800;

function photoSrc(p: MomentPhotoDto) {
  return p.largeUrl || p.publicUrl || p.thumbUrl || "";
}

/**
 * 片刻页空闲后的影院式幻灯：全屏暗场 + Ken Burns 缓推 + 双层交叉淡入淡出。
 * 任意指针/滚轮/键盘操作退出；点图进入手动 lightbox。
 */
export function MomentsCinematic({ items, active, onDismiss, onOpenIndex }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  /** 上一张仍叠在下层渐隐，实现真正的交叉溶解（不再先黑屏再淡入） */
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);

  const safeItems = useMemo(() => items.filter((x) => !!(x.largeUrl || x.publicUrl || x.thumbUrl)), [items]);
  const len = Math.max(1, safeItems.length);
  const current = safeItems[index % len];
  const outgoing = outgoingIndex != null ? safeItems[outgoingIndex % len] : null;

  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    setIndex(0);
    setOutgoingIndex(null);
  }, [active, safeItems.length]);

  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    let cancelled = false;
    // 先等本张慢淡入结束，再完整停留 HOLD，最后才切下一张交叉溶解
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setOutgoingIndex(index);
      setIndex((i) => (i + 1) % safeItems.length);
    }, FADE_MS + HOLD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, index, safeItems.length]);

  useEffect(() => {
    if (outgoingIndex == null) return;
    const timer = window.setTimeout(() => setOutgoingIndex(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [outgoingIndex, index]);

  useEffect(() => {
    if (!active) return;
    const stop = (e: Event) => {
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

  const openCurrent = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const realIndex = items.findIndex((x) => x.id === current.id);
    onDismiss();
    if (realIndex >= 0) onOpenIndex(realIndex);
  };

  const frameClass =
    "overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10 sm:rounded-3xl";

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-stone-950/92"
      role="presentation"
      aria-label={t("moments.slideshowAria")}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 transition-[background] duration-[2800ms] ease-out"
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
        onClick={openCurrent}
      />

      <div className="pointer-events-none relative z-[5] flex h-full w-full items-center justify-center px-6 py-16 sm:px-12">
        <div className="relative max-h-[min(88dvh,920px)] max-w-[min(94vw,1100px)]">
          {outgoing ? (
            <div
              key={`out-${outgoing.id}-${outgoingIndex}`}
              className={clsx("moments-xfade moments-xfade--out absolute inset-0 z-[1]", frameClass)}
              aria-hidden
            >
              <img
                src={photoSrc(outgoing)}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null}
          <div
            key={`in-${current.id}-${index}`}
            className={clsx("moments-xfade moments-xfade--in relative z-[2]", frameClass)}
          >
            <img
              src={photoSrc(current)}
              alt={current.caption || ""}
              draggable={false}
              className="moments-kenburns max-h-[min(88dvh,920px)] max-w-[min(94vw,1100px)] object-contain"
            />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
          {current.caption ? (
            <p
              key={`cap-${current.id}`}
              className="moments-cinematic-caption text-sm text-white/80 sm:text-base"
            >
              {current.caption}
            </p>
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
                  "h-1 rounded-full transition-all duration-700",
                  i === index % safeItems.length ? "w-5 bg-white/80" : "w-1.5 bg-white/30"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .moments-xfade {
          will-change: opacity, filter;
        }
        .moments-xfade--in {
          animation: moments-cross-in ${FADE_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1) both;
        }
        .moments-xfade--out {
          animation: moments-cross-out ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .moments-cinematic-caption {
          animation: moments-cap-in ${Math.round(FADE_MS * 0.9)}ms cubic-bezier(0.45, 0.05, 0.25, 1) both;
        }
        @keyframes moments-cross-in {
          0% { opacity: 0; filter: blur(8px); }
          35% { opacity: 0.22; filter: blur(5px); }
          100% { opacity: 1; filter: blur(0); }
        }
        @keyframes moments-cross-out {
          from { opacity: 1; filter: blur(0); }
          to { opacity: 0; filter: blur(7px); }
        }
        @keyframes moments-cap-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes moments-kenburns {
          from { transform: scale(1.02); }
          to { transform: scale(1.1); }
        }
        .moments-kenburns {
          animation: moments-kenburns ${HOLD_MS + FADE_MS}ms linear forwards;
          transform-origin: 50% 45%;
          will-change: transform;
          display: block;
        }
        @media (prefers-reduced-motion: reduce) {
          .moments-xfade--in,
          .moments-xfade--out,
          .moments-kenburns,
          .moments-cinematic-caption {
            animation: none !important;
            opacity: 1;
            filter: none;
            transform: none;
          }
          .moments-xfade--out { opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}