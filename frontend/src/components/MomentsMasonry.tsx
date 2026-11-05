import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { MomentPhotoDto } from "../api/client";

type Props = {
  items: MomentPhotoDto[];
  onOpen: (index: number) => void;
  className?: string;
  /** 幻灯片即将开始时，轻提示第一张 */
  spotlightId?: number | null;
};

function columnCountForWidth(w: number): number {
  if (w >= 1024) return 4;
  if (w >= 640) return 3;
  return 2;
}

function useMasonryColumns(): number {
  const [cols, setCols] = useState(() =>
    typeof window === "undefined" ? 2 : columnCountForWidth(window.innerWidth)
  );
  useEffect(() => {
    const onResize = () => setCols(columnCountForWidth(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}

function relativeHeight(photo: MomentPhotoDto): number {
  if (photo.width != null && photo.height != null && photo.width > 0) {
    return photo.height / photo.width;
  }
  return 1.2;
}

/**
 * 标准瀑布流：按最短列追加。同一批前缀的列归属稳定，加载更多只在底部接高，不会像 CSS columns 那样整页重排。
 */
export function MomentsMasonry({ items, onOpen, className, spotlightId }: Props) {
  const colCount = useMasonryColumns();

  const columns = useMemo(() => {
    const cols: { photo: MomentPhotoDto; index: number }[][] = Array.from(
      { length: colCount },
      () => []
    );
    const heights = Array.from({ length: colCount }, () => 0);
    items.forEach((photo, index) => {
      let shortest = 0;
      for (let c = 1; c < colCount; c++) {
        if (heights[c] < heights[shortest]) shortest = c;
      }
      cols[shortest].push({ photo, index });
      heights[shortest] += relativeHeight(photo);
    });
    return cols;
  }, [items, colCount]);

  return (
    <div className={clsx("flex items-start gap-3 sm:gap-4", className)}>
      {columns.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          {col.map(({ photo: m, index }) => {
            const spotlight = spotlightId != null && m.id === spotlightId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpen(index)}
                className={clsx(
                  "group relative block w-full origin-center overflow-hidden rounded-2xl bg-white/40",
                  "shadow-sm ring-1 ring-white/50",
                  "transition-[transform,box-shadow,ring-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "hover:-translate-y-1 hover:scale-[1.025] hover:shadow-[0_18px_40px_rgba(41,37,36,0.16)] hover:ring-rose-200/70",
                  "active:scale-[0.985] active:duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70",
                  spotlight && "z-[1] scale-[1.03] ring-2 ring-rose-300/80 shadow-[0_16px_36px_rgba(190,80,90,0.18)]"
                )}
              >
                <img
                  src={m.thumbUrl || m.publicUrl}
                  alt={m.caption || ""}
                  loading="lazy"
                  className="h-auto w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  style={
                    m.width != null && m.height != null && m.width > 0
                      ? { aspectRatio: `${m.width} / ${m.height}` }
                      : undefined
                  }
                />
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-900/35 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                {m.caption ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 px-3 pb-2.5 text-left text-[11px] text-white/90 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    {m.caption}
                  </span>
                ) : null}
                {m.dominantHue != null || (m.dominantSat != null && m.dominantSat < 12) ? (
                  <span
                    className="absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full ring-2 ring-white/80 transition-transform duration-300 group-hover:scale-125"
                    style={{
                      background:
                        m.dominantHue == null ? "#a8a29e" : `hsl(${m.dominantHue} 55% 48%)`,
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
