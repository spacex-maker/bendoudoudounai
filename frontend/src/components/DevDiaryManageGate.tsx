import { Navigate, useLocation, type ReactNode } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { userCanManageDevDiary } from "../api/client";
import { useAuth, useAuthedUser } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";

/**
 * 需登录 + 管理员或「开发者」角色，否则回到开发日记列表。
 */
export function DevDiaryManageGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state } = useAuth();
  const user = useAuthedUser();
  const { wallpaperActive } = usePageAppearance();
  const loc = useLocation();
  if (state.status === "loading") {
    return (
      <div
        className={clsx(
          "flex min-h-dvh items-center justify-center text-warm-600",
          wallpaperActive ? "bg-transparent" : "bg-romantic-mesh"
        )}
      >
        {t("common.loading")}
      </div>
    );
  }
  if (state.status !== "authed" || !userCanManageDevDiary(user)) {
    return <Navigate to="/dev-diary" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}
