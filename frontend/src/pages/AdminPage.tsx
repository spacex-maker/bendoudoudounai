import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { AdminUserListPanel } from "../components/AdminUserListPanel";

/**
 * 管理后台：全屏布局（无官网顶栏、无内容区 max-w 限宽）。
 */
export function AdminPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-zinc-950 text-zinc-200">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/90 bg-zinc-900/95 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t("common.backHome")}</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2 border-l border-zinc-700/80 pl-2 sm:gap-3 sm:pl-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 sm:h-10 sm:w-10">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-zinc-100 sm:text-base">{t("admin.pageTitle")}</h1>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500 sm:text-xs">{t("admin.pageSub")}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4 md:p-5">
        <AdminUserListPanel />
      </div>
    </div>
  );
}
