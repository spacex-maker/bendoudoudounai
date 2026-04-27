import { useTranslation } from "react-i18next";
import { ChevronDown, CircleHelp } from "lucide-react";
import clsx from "clsx";

type Props = {
  className?: string;
  /** 编辑用户弹窗内：更紧凑，展开区长内容可滚动 */
  compact?: boolean;
};

/**
 * 管理端：各角色区别说明（可折叠）。
 */
export function AdminRoleGuide({ className, compact }: Props) {
  const { t } = useTranslation();
  return (
    <details
      className={clsx(
        "group rounded-xl border border-zinc-700/80 bg-zinc-900/60 text-left transition-colors open:border-violet-500/25",
        compact ? "max-w-full" : "max-w-full sm:max-w-2xl",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 px-2.5 py-2 pr-1.5 text-left text-zinc-200 [&::-webkit-details-marker]:hidden">
        <CircleHelp className={clsx("mt-0.5 shrink-0 text-violet-400/90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={clsx("font-medium text-violet-200", compact ? "text-xs" : "text-sm")}>
            {t("admin.roleGuideTitle")}
          </span>
          <span
            className={clsx(
              "mt-0.5 block font-normal leading-snug text-zinc-500",
              compact ? "text-[10px]" : "text-[11px]"
            )}
          >
            {t("admin.roleGuideSummary")}
          </span>
        </span>
        <ChevronDown
          className={clsx(
            "mt-0.5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180",
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
          aria-hidden
        />
      </summary>
      <div
        className={clsx(
          "border-t border-zinc-800/90 px-2.5 pb-2.5 pt-2 leading-relaxed text-zinc-500",
          compact ? "max-h-[min(45vh,18rem)] overflow-y-auto text-[10px]" : "text-[12px] sm:text-[13px]"
        )}
      >
        <p>{t("admin.roleGuideLead")}</p>
        <dl className="mt-2 space-y-2">
          <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-2 py-1.5">
            <dt className="font-medium text-zinc-200">{t("admin.roleGuideUserTitle")}</dt>
            <dd className="mt-0.5">{t("admin.roleGuideUserBody")}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-2 py-1.5">
            <dt className="font-medium text-zinc-200">{t("admin.roleGuideDeveloperTitle")}</dt>
            <dd className="mt-0.5">{t("admin.roleGuideDeveloperBody")}</dd>
          </div>
          <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-2 py-1.5">
            <dt className="font-medium text-violet-200/95">{t("admin.roleGuideAdminTitle")}</dt>
            <dd className="mt-0.5 text-zinc-400">{t("admin.roleGuideAdminBody")}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}
