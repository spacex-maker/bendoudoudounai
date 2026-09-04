import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";

type Props = {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

/**
 * 列表铺满容器宽度；滚动条叠在右侧，不挤占内容布局。
 */
export function OverlayScroll({ className, contentClassName, children }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const syncThumb = useCallback(() => {
    const el = scrollerRef.current;
    const thumb = thumbRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const overflow = scrollHeight > clientHeight + 1;
    setCanScroll(overflow);
    if (!thumb || !overflow) return;
    const trackH = clientHeight;
    const thumbH = Math.max(28, (clientHeight / scrollHeight) * trackH);
    const maxTop = Math.max(0, trackH - thumbH);
    const top =
      scrollHeight <= clientHeight
        ? 0
        : (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncThumb();
    el.addEventListener("scroll", syncThumb, { passive: true });
    const ro = new ResizeObserver(() => syncThumb());
    ro.observe(el);
    const child = el.firstElementChild;
    if (child) ro.observe(child);
    window.addEventListener("resize", syncThumb);
    return () => {
      el.removeEventListener("scroll", syncThumb);
      window.removeEventListener("resize", syncThumb);
      ro.disconnect();
    };
  }, [syncThumb, children]);

  return (
    <div className={clsx("relative min-h-0 min-w-0", className)}>
      <div
        ref={scrollerRef}
        className="h-full overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className={contentClassName}>{children}</div>
      </div>
      <div
        className={clsx(
          "pointer-events-none absolute inset-y-1 right-0.5 w-1.5 transition-opacity",
          canScroll ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      >
        <div
          ref={thumbRef}
          className="w-full rounded-full bg-zinc-300/35 shadow-sm ring-1 ring-black/20"
        />
      </div>
    </div>
  );
}
