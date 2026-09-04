import clsx from "clsx";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

const LOCALES = [
  { code: "zh" as const, short: "中文", fullKey: "lang.zh" as const },
  { code: "ja" as const, short: "日本語", fullKey: "lang.ja" as const },
];

type Props = {
  className?: string;
  /** 窄位：仍显示完整短标签（中文/日本語），仅略缩小字号 */
  compact?: boolean;
  /** 背景色调；默认 dark 适配音乐/登录深色界面 */
  tone?: "dark" | "light";
  "aria-label"?: string;
};

/**
 * 语言切换：带图标的分段控件，开/关态对比明确。
 */
export function LanguageSwitch({
  className,
  compact = false,
  tone = "dark",
  "aria-label": ariaLabel,
}: Props) {
  const { t, i18n } = useTranslation();
  const current = i18n.language === "ja" ? "ja" : "zh";
  const light = tone === "light";

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border shadow-sm",
        compact ? "p-0.5" : "p-1",
        light
          ? "border-ink-900/15 bg-white text-ink-900"
          : "border-white/20 bg-black/35 text-white backdrop-blur-md",
        className
      )}
      role="group"
      aria-label={ariaLabel ?? t("lang.label")}
    >
      <span
        className={clsx(
          "inline-flex shrink-0 items-center justify-center rounded-full",
          compact ? "h-7 w-7" : "h-8 w-8",
          light ? "bg-ink-900/[0.06] text-ink-700" : "bg-white/10 text-white/85"
        )}
        aria-hidden
      >
        <Languages className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.25} />
      </span>

      <div
        className={clsx(
          "inline-flex items-center gap-0.5 rounded-full p-0.5",
          light ? "bg-ink-900/[0.05]" : "bg-black/25"
        )}
      >
        {LOCALES.map((loc) => {
          const active = current === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => void i18n.changeLanguage(loc.code)}
              aria-pressed={active}
              lang={loc.code}
              title={t(loc.fullKey)}
              className={clsx(
                "rounded-full font-semibold tracking-tight transition",
                compact ? "min-w-[2.75rem] px-2.5 py-1 text-[12px]" : "min-w-[3.25rem] px-3 py-1.5 text-[13px]",
                active
                  ? light
                    ? "bg-ink-900 text-white shadow-sm"
                    : "bg-white text-ink-900 shadow-sm"
                  : light
                    ? "text-ink-700/70 hover:bg-ink-900/[0.06] hover:text-ink-900"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
              )}
            >
              {loc.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
