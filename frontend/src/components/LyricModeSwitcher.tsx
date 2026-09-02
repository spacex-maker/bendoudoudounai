import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { LyricDisplayMode } from "../music/trackMeta";

type Props = {
  mode: LyricDisplayMode;
  availableModes: LyricDisplayMode[];
  onChange: (m: LyricDisplayMode) => void;
  className?: string;
  /** 沉浸模式用更淡的样式 */
  tone?: "panel" | "immersive";
};

export function LyricModeSwitcher({ mode, availableModes, onChange, className, tone = "panel" }: Props) {
  const { t } = useTranslation();
  if (availableModes.length <= 1) return null;

  const label = (m: LyricDisplayMode) => {
    switch (m) {
      case "translated":
        return t("lyrics.modeTranslated");
      case "roma":
        return t("lyrics.modeRoma");
      default:
        return t("lyrics.modeOriginal");
    }
  };

  return (
    <div
      className={clsx(
        "inline-flex flex-wrap items-center gap-1",
        tone === "immersive" ? "rounded-full border border-white/15 bg-black/25 p-0.5" : "rounded-lg border border-white/10 bg-white/[0.04] p-0.5",
        className
      )}
      role="tablist"
      aria-label={t("lyrics.modeLabel")}
    >
      {availableModes.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={clsx(
            "rounded-md px-2 py-1 text-[11px] font-medium transition",
            mode === m
              ? tone === "immersive"
                ? "bg-white/20 text-white"
                : "bg-rose-500/20 text-rose-100"
              : tone === "immersive"
                ? "text-white/50 hover:text-white/80"
                : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {label(m)}
        </button>
      ))}
    </div>
  );
}
