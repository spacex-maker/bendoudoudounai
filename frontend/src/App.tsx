import clsx from "clsx";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { userIsAdmin } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { AdminConsoleDock } from "./components/AdminConsoleDock";
import { usePageAppearance } from "./pageAppearance/PageAppearanceContext";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MessageBoardPage } from "./pages/MessageBoardPage";
import { MusicPage } from "./pages/MusicPage";

/** 离开音乐页时去掉歌单壁纸叠层，避免首页仍显示上一歌单背景 */
function WallpaperRouteSync() {
  const loc = useLocation();
  const { setWallpaperDisplayUrl, setWallpaperTargetPlaylistId } = usePageAppearance();
  useEffect(() => {
    if (loc.pathname !== "/music") {
      setWallpaperDisplayUrl(null);
      setWallpaperTargetPlaylistId(null);
    }
  }, [loc.pathname, setWallpaperDisplayUrl, setWallpaperTargetPlaylistId]);
  return null;
}

function Protected({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state } = useAuth();
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
  if (state.status !== "authed") {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { state } = useAuth();
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
  if (state.status !== "authed") {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (!userIsAdmin(state.user)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <WallpaperRouteSync />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/messages" element={<MessageBoardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/music"
        element={
          <Protected>
            <MusicPage />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      <AdminConsoleDock />
    </>
  );
}
