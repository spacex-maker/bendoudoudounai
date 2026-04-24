import clsx from "clsx";
import { useTranslation } from "react-i18next";

const LOCALES = [
  { code: "zh" as const, labelKey: "lang.zh" as const },
  { code: "ja" as const, labelKey: "lang.ja" as const },
];

type Props = {
  className?: string;
  /** 窄位：只显示「中 / 日」 */
  compact?: boolean;
  /** 隐藏文字标签时仍给读屏用 */
  "aria-label"?: string;
};

export function LanguageSwitch({ className, compact, "aria-label": ariaLabel }: Props) {
  const { t, i18n } = useTranslation();
  const current = i18n.language === "ja" ? "ja" : "zh";
  return (
    <div
      className={clsx("inline-flex items-center gap-0.5 rounded-full border border-white/25 bg-white/10 p-0.5 text-[11px] font-medium backdrop-blur", className)}
      role="group"
      aria-label={ariaLabel ?? t("lang.label")}
    >
      {LOCALES.map((loc) => {
        const active = current === loc.code;
        return (
          <button
            key={loc.code}
            type="button"
            onClick={() => void i18n.changeLanguage(loc.code)}
            className={clsx(
              "rounded-full px-2 py-0.5 transition",
              active ? "bg-warm-500/90 text-white shadow-sm" : "text-warm-700/75 hover:bg-white/20"
            )}
            lang={loc.code}
          >
            {compact && loc.code === "zh" ? "中" : compact && loc.code === "ja" ? "日" : t(loc.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
