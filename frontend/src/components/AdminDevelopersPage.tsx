import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

/**
 * 开发者管理：子 Tab 为「开发者列表」「申请记录」。
 */
export function AdminDevelopersPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 gap-0 border-b border-zinc-800/90">
        <NavLink
          to="list"
          end
          className={({ isActive }) =>
            clsx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4",
              isActive
                ? "border-violet-500 text-violet-200"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )
          }
        >
          {t("admin.devTabList")}
        </NavLink>
        <NavLink
          to="applications"
          end
          className={({ isActive }) =>
            clsx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4",
              isActive
                ? "border-amber-500/80 text-amber-100/95"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )
          }
        >
          {t("admin.devTabApps")}
        </NavLink>
      </div>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
