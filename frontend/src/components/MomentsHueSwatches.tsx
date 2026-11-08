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
  compact?: boolean;
};

/** Main-hue chips: tap to gather same-colored photos */
export function MomentsHueSwatches({
  facets,
  activeHue,
  activeNeutral,
  onSelectHue,
  onSelectNeutral,
  onClear,
  className,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  if (!facets.length) return null;

  const chromatic = facets.filter((f) => !f.neutral && f.hue != null);
  const neutral = facets.find((f) => f.neutral);
  const chip = compact
    ? "h-10 w-10 sm:h-11 sm:w-11"
    : "h-12 w-12 sm:h-14 sm:w-14";

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-base tracking-wide text-warm-700/90 sm:text-lg">
            {t("moments.hueFilterLabel")}
          </p>
          <p className="mt-0.5 text-xs text-stone-500/90 sm:text-sm">{t("moments.paletteStageHint")}</p>
        </div>
        {activeHue != null || activeNeutral ? (
          <button
            type="button"
            className="shrink-0 text-xs text-rose-500/90 underline-offset-4 transition hover:underline sm:text-sm"
            onClick={onClear}
          >
            {t("moments.hueFilterClear")}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:gap-3.5">
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
                "group relative flex items-end justify-center rounded-full shadow-[0_8px_20px_rgba(41,37,36,0.12)] transition duration-300",
                chip,
                "hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(41,37,36,0.16)] active:translate-y-0 active:scale-95",
                selected
                  ? "scale-110 ring-2 ring-warm-700/90 ring-offset-2 ring-offset-[#fff7f4]"
                  : "ring-1 ring-black/10 hover:scale-105 hover:ring-stone-400/50"
              )}
              style={{ background: `hsl(${h} 68% 52%)` }}
            >
              <span
                className={clsx(
                  "mb-1 rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none sm:text-[11px]",
                  selected ? "bg-white/95 text-stone-800" : "bg-black/30 text-white"
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
              "flex items-end justify-center rounded-full bg-gradient-to-br from-stone-200 to-stone-400 shadow-[0_8px_20px_rgba(41,37,36,0.1)] transition",
              chip,
              activeNeutral
                ? "scale-110 ring-2 ring-warm-700/90 ring-offset-2 ring-offset-[#fff7f4]"
                : "ring-1 ring-black/10 hover:-translate-y-1 hover:scale-105"
            )}
          >
            <span
              className={clsx(
                "mb-1 rounded-full px-1.5 text-[10px] font-semibold tabular-nums leading-none sm:text-[11px]",
                activeNeutral ? "bg-white/95 text-stone-800" : "bg-black/25 text-white"
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