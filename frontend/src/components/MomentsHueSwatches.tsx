import clsx from "clsx";
import { useTranslation } from "react-i18next";

export type ColorFacet = {
  hue: number | null;
  neutral: boolean;
  count: number;
};

type Props = {
  facets: ColorFacet[];
  activeHue: number | null;
  activeNeutral: boolean;
  onSelectHue: (hue: number) => void;
  onSelectNeutral: () => void;
  onClear: () => void;
  className?: string;
};

/** 主色调色块：一眼点选同色照片 */
export function MomentsHueSwatches({
  facets,
  activeHue,
  activeNeutral,
  onSelectHue,
  onSelectNeutral,
  onClear,
  className,
}: Props) {
  const { t } = useTranslation();
  if (!facets.length) return null;

  const chromatic = facets.filter((f) => !f.neutral && f.hue != null);
  const neutral = facets.find((f) => f.neutral);

  return (
    <div className={clsx("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-600">{t("moments.hueFilterLabel")}</p>
        {activeHue != null || activeNeutral ? (
          <button
            type="button"
            className="text-[11px] text-rose-500/90 underline-offset-2 hover:underline"
            onClick={onClear}
          >
            {t("moments.hueFilterClear")}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {chromatic.map((f) => {
          const h = f.hue!;
          const selected =
            activeHue != null &&
            Math.min(Math.abs(activeHue - h), 360 - Math.abs(activeHue - h)) <= 20;
          return (
            <button
              key={h}
              type="button"
              title={`${t("moments.hueFilterChip")} · ${f.count}`}
              onClick={() => onSelectHue(h)}
              className={clsx(
                "group relative flex h-10 w-10 items-end justify-center rounded-full shadow-sm transition duration-300 sm:h-11 sm:w-11",
                "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95",
                selected
                  ? "scale-110 ring-2 ring-warm-700 ring-offset-2 ring-offset-[#f7f1ea]"
                  : "ring-1 ring-black/10 hover:scale-110 hover:ring-stone-400/60"
              )}
              style={{ background: `hsl(${h} 68% 52%)` }}
            >
              <span
                className={clsx(
                  "mb-0.5 rounded-full px-1 text-[9px] font-semibold tabular-nums leading-none",
                  selected ? "bg-white/90 text-stone-800" : "bg-black/25 text-white"
                )}
              >
                {f.count > 99 ? "99+" : f.count}
              </span>
            </button>
          );
        })}
        {neutral ? (
          <button
            type="button"
            title={`${t("moments.moodNeutral")} · ${neutral.count}`}
            onClick={onSelectNeutral}
            className={clsx(
              "flex h-10 w-10 items-end justify-center rounded-full bg-stone-300 shadow-sm transition sm:h-11 sm:w-11",
              activeNeutral
                ? "scale-110 ring-2 ring-warm-700 ring-offset-2 ring-offset-[#f7f1ea]"
                : "ring-1 ring-black/10 hover:scale-105"
            )}
          >
            <span
              className={clsx(
                "mb-0.5 rounded-full px-1 text-[9px] font-semibold tabular-nums leading-none",
                activeNeutral ? "bg-white/90 text-stone-800" : "bg-black/20 text-white"
              )}
            >
              {neutral.count > 99 ? "99+" : neutral.count}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
