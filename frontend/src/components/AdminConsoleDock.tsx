import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { userIsAdmin } from "../api/client";

/**
 * 管理员全局入口：固定左下角（z-40 低于播放条 z-50）。
 * 音乐页左栏底部有个人信息，与视口左下角重叠，故在 /music 不渲染，改由音乐侧栏内入口进入后台。
 */
export function AdminConsoleDock() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { state } = useAuth();
  if (pathname === "/music") return null;
  if (state.status !== "authed" || !userIsAdmin(state.user)) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-40 sm:bottom-4 sm:left-4">
      <Link
        to="/admin"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-violet-300/50 bg-white/90 px-3 py-2 text-xs font-medium text-violet-800 shadow-lg shadow-violet-200/30 backdrop-blur-md transition hover:border-violet-400/60 hover:bg-white"
      >
        <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
        {t("admin.consoleLink")}
      </Link>
    </div>
  );
}
