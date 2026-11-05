import type { PointerEvent } from "react";
import clsx from "clsx";

type Props = {
  hue: number | null;
  onChange: (hue: number | null) => void;
  className?: string;
};

/** 安静色轮：点选色相；再点同一区域或点中心清除 */
export function MomentsColorWheel({ hue, onChange, className }: Props) {
  const onPointer = (e: PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const r = Math.hypot(dx, dy);
    const maxR = rect.width / 2;
    if (r < maxR * 0.22) {
      onChange(null);
      return;
    }
    if (r > maxR * 0.98) return;
    // CSS conic-gradient 从顶部开始，0°=红在右需转换：atan2 → 度，再映射到色相
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0=右
    deg = (deg + 360) % 360;
    // conic-gradient from top: 0deg 在顶部 = 红；我们把顶部对齐为 0 色相
    const hueDeg = Math.round((deg + 90) % 360);
    onChange(hue != null && Math.abs(((hue - hueDeg + 540) % 360) - 180) < 8 ? null : hueDeg);
  };

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-label="色轮筛选"
        onPointerDown={onPointer}
        className="relative h-24 w-24 shrink-0 rounded-full shadow-inner ring-1 ring-stone-300/70 transition hover:ring-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 sm:h-28 sm:w-28"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 70% 45%), hsl(180 70% 45%), hsl(240 75% 55%), hsl(300 75% 55%), hsl(360 85% 55%))",
        }}
      >
        <span className="pointer-events-none absolute inset-[22%] rounded-full bg-[#f7f1ea] shadow-sm ring-1 ring-white/70" />
        {hue != null ? (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              background: `hsl(${hue} 70% 50%)`,
              transform: `translate(-50%, -50%) rotate(${hue}deg) translateY(-38px) rotate(-${hue}deg)`,
            }}
          />
        ) : null}
      </button>
      <div className="min-w-0 text-xs leading-relaxed text-stone-500">
        <p>{hue == null ? "点色轮筛选相近色调" : `色相约 ${hue}°`}</p>
        {hue != null ? (
          <button
            type="button"
            className="mt-1 text-rose-500/90 underline-offset-2 hover:underline"
            onClick={() => onChange(null)}
          >
            清除色相
          </button>
        ) : (
          <p className="text-stone-400">中心圆可清空</p>
        )}
      </div>
    </div>
  );
}
