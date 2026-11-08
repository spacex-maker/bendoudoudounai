import { useEffect, useMemo, useRef, useState } from "react";
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
/** 渐显/渐隐：约 2.8s；仅用透明度，避免 blur 造成卡顿 */
const FADE_MS = 2800;
/** 影院层整页进场 / 退场 */
const ENTER_MS = 1400;
const EXIT_MS = 900;

function photoSrc(p: MomentPhotoDto) {
  return p.largeUrl || p.publicUrl || p.thumbUrl || "";
}

function preloadDecoded(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const im = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    im.onload = () => {
      if (typeof im.decode === "function") {
        im.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    im.onerror = done;
    im.decoding = "async";
    im.src = src;
    if (im.complete && im.naturalWidth > 0) {
      if (typeof im.decode === "function") {
        im.decode().then(done).catch(done);
      } else {
        done();
      }
    }
  });
}

/**
 * 片刻页空闲后的影院式幻灯：全屏暗场 + Ken Burns 缓推 + 双层交叉淡入淡出。
 * 任意指针/滚轮/键盘操作退出；点图进入手动 lightbox。
 */
export function MomentsCinematic({ items, active, onDismiss, onOpenIndex }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  /** 上一张仍叠在下层渐隐；key 用 photo.id，避免把正在显示的图拆掉重挂导致闪一下 */
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const advancingRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const safeItems = useMemo(() => items.filter((x) => !!(x.largeUrl || x.publicUrl || x.thumbUrl)), [items]);
  const len = Math.max(1, safeItems.length);
  const current = safeItems[index % len];
  const outgoing = outgoingIndex != null ? safeItems[outgoingIndex % len] : null;

  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    setIndex(0);
    setOutgoingIndex(null);
    advancingRef.current = false;
  }, [active, safeItems.length]);

  // 整页进场 / 退场：先挂载再淡入，退出先淡出再卸载
  useEffect(() => {
    if (active && safeItems.length >= 2) {
      setMounted(true);
      setRevealed(false);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setRevealed(true));
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }
    setRevealed(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [active, safeItems.length]);

  // 预热当前 + 后两张，切图时不必再等网络解码
  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    const targets = [0, 1, 2].map((offset) => {
      const item = safeItems[(index + offset) % safeItems.length];
      return item ? photoSrc(item) : "";
    });
    void Promise.all(targets.map((src) => preloadDecoded(src)));
  }, [active, index, safeItems]);

  useEffect(() => {
    if (!active || safeItems.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled || advancingRef.current) return;
        advancingRef.current = true;
        const nextIndex = (index + 1) % safeItems.length;
        const next = safeItems[nextIndex];
        // 下一张解码完成后再开交叉淡变，避免淡入过程中图片突然蹦出来
        await preloadDecoded(next ? photoSrc(next) : "");
        if (cancelled) {
          advancingRef.current = false;
          return;
        }
        setOutgoingIndex(index);
        setIndex(nextIndex);
        advancingRef.current = false;
      })();
    }, FADE_MS + HOLD_MS + (index === 0 ? ENTER_MS : 0));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, index, safeItems]);

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

  if (!mounted || !current || safeItems.length < 2) return null;

  const openCurrent = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    const realIndex = items.findIndex((x) => x.id === current.id);
    onDismiss();
    if (realIndex >= 0) onOpenIndex(realIndex);
  };

  const layers: Array<{ item: MomentPhotoDto; role: "in" | "out" }> = [];
  if (outgoing && outgoing.id !== current.id) {
    layers.push({ item: outgoing, role: "out" });
  }
  layers.push({ item: current, role: "in" });

  return createPortal(
    <div
      className={clsx(
        "moments-cinematic-root fixed inset-0 z-[110] flex items-center justify-center overflow-hidden",
        "bg-stone-950/72 backdrop-blur-[7px] backdrop-saturate-125 supports-[backdrop-filter]:bg-stone-950/62",
        revealed ? "moments-cinematic-root--in" : "moments-cinematic-root--out"
      )}
      role="presentation"
      aria-label={t("moments.slideshowAria")}
      data-cinematic-portal
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
        {/* 固定舞台尺寸，避免不同比例切图时整页回流闪一下 */}
        <div
          className={clsx(
            "moments-cinematic-stage relative h-[min(88dvh,920px)] w-[min(94vw,1100px)]",
            revealed ? "moments-cinematic-stage--in" : "moments-cinematic-stage--out"
          )}
        >
          {layers.map(({ item, role }) => (
            <div
              key={item.id}
              className={clsx(
                "moments-xfade absolute inset-0 flex items-center justify-center",
                role === "in" ? "moments-xfade--in z-[2]" : "moments-xfade--out z-[1]"
              )}
              aria-hidden={role === "out"}
            >
              <img
                src={photoSrc(item)}
                alt={role === "in" ? item.caption || "" : ""}
                draggable={false}
                decoding="async"
                className={clsx(
                  "moments-cinematic-frame moments-kenburns max-h-full max-w-full object-contain",
                  "rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10 sm:rounded-3xl"
                )}
              />
            </div>
          ))}
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
        .moments-cinematic-root {
          opacity: 0;
          transition:
            opacity ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
            backdrop-filter ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity;
        }
        .moments-cinematic-root--in {
          opacity: 1;
        }
        .moments-cinematic-root--out {
          opacity: 0;
          transition-duration: ${EXIT_MS}ms;
        }
        .moments-cinematic-stage {
          transform: scale(0.94) translateY(10px);
          opacity: 0.35;
          transition:
            transform ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity;
        }
        .moments-cinematic-stage--in {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
        .moments-cinematic-stage--out {
          transform: scale(0.97) translateY(6px);
          opacity: 0;
          transition-duration: ${EXIT_MS}ms;
        }
        .moments-xfade {
          will-change: opacity;
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
        /* 只用透明度交叉溶解：blur 在大图上会掉帧并闪一下 */
        @keyframes moments-cross-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes moments-cross-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes moments-cap-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes moments-kenburns {
          from { transform: scale(1.02); }
          to { transform: scale(1.08); }
        }
        .moments-kenburns {
          animation: moments-kenburns ${HOLD_MS + FADE_MS}ms linear forwards;
          transform-origin: 50% 45%;
          will-change: transform;
          display: block;
        }
        @media (prefers-reduced-motion: reduce) {
          .moments-cinematic-root,
          .moments-cinematic-stage {
            transition: none !important;
          }
          .moments-cinematic-root--in,
          .moments-cinematic-stage--in {
            opacity: 1 !important;
            transform: none !important;
          }
          .moments-xfade--in,
          .moments-xfade--out,
          .moments-kenburns,
          .moments-cinematic-caption {
            animation: none !important;
            opacity: 1;
            transform: none;
          }
          .moments-xfade--out { opacity: 0; }
        }
      `}</style>
    </div>,
    document.body
  );
}