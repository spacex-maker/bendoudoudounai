import type { PointerEvent } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

type Props = {
  hue: number | null;
  onChange: (hue: number | null) => void;
  className?: string;
  /** Visual size of the wheel (default large for Moments stage) */
  size?: "md" | "lg";
  showCaption?: boolean;
};

/** Quiet color wheel: tap a hue; retap nearby / center clears */
export function MomentsColorWheel({
  hue,
  onChange,
  className,
  size = "lg",
  showCaption = true,
}: Props) {
  const { t } = useTranslation();

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
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    deg = (deg + 360) % 360;
    const hueDeg = Math.round((deg + 90) % 360);
    onChange(hue != null && Math.abs(((hue - hueDeg + 540) % 360) - 180) < 8 ? null : hueDeg);
  };

  const dim =
    size === "lg"
      ? "h-36 w-36 sm:h-44 sm:w-44"
      : "h-24 w-24 sm:h-28 sm:w-28";
  const markerTravel = size === "lg" ? 58 : 38;

  return (
    <div className={clsx("flex flex-col items-center gap-3 sm:flex-row sm:items-center", className)}>
      <button
        type="button"
        aria-label={t("moments.wheelAria")}
        onPointerDown={onPointer}
        className={clsx(
          "relative shrink-0 rounded-full shadow-[0_18px_40px_rgba(41,37,36,0.12),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-white/70 transition duration-500",
          "hover:scale-[1.03] hover:shadow-[0_22px_48px_rgba(41,37,36,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300",
          dim
        )}
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 70% 45%), hsl(180 70% 45%), hsl(240 75% 55%), hsl(300 75% 55%), hsl(360 85% 55%))",
        }}
      >
        <span className="pointer-events-none absolute inset-[22%] rounded-full bg-[#fff7f4] shadow-inner ring-1 ring-white/80" />
        {hue != null ? (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md sm:h-4 sm:w-4"
            style={{
              background: `hsl(${hue} 70% 50%)`,
              transform: `translate(-50%, -50%) rotate(${hue}deg) translateY(-${markerTravel}px) rotate(-${hue}deg)`,
            }}
          />
        ) : null}
      </button>
      {showCaption ? (
        <div className="min-w-0 text-center text-sm leading-relaxed text-stone-500 sm:text-left">
          <p className="font-medium text-stone-600/90">
            {hue == null ? t("moments.wheelHint") : t("moments.wheelHue", { hue })}
          </p>
          {hue != null ? (
            <button
              type="button"
              className="mt-1.5 text-sm text-rose-500/90 underline-offset-4 transition hover:underline"
              onClick={() => onChange(null)}
            >
              {t("moments.wheelClear")}
            </button>
          ) : (
            <p className="mt-1 text-xs text-stone-400">{t("moments.wheelCenterHint")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}