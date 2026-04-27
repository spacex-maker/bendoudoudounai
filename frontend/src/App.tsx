import clsx from "clsx";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminGuestbookPanel } from "./components/AdminGuestbookPanel";
import { AdminWishlistPanel } from "./components/AdminWishlistPanel";
import { AdminUserListPanel } from "./components/AdminUserListPanel";
import { AdminDeveloperApplicationPanel } from "./components/AdminDeveloperApplicationPanel";
import { AdminDevelopersPage } from "./components/AdminDevelopersPage";
import { AdminDeveloperListPanel } from "./components/AdminDeveloperListPanel";
import { userIsAdmin } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { AdminConsoleDock } from "./components/AdminConsoleDock";
import { usePageAppearance } from "./pageAppearance/PageAppearanceContext";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MessageBoardPage } from "./pages/MessageBoardPage";
import { MusicPage } from "./pages/MusicPage";
import { DevDiaryListPage } from "./pages/devDiary/DevDiaryListPage";
import { DevDiaryEntryPage } from "./pages/devDiary/DevDiaryEntryPage";
import { DevDiaryEditorPage } from "./pages/devDiary/DevDiaryEditorPage";
import { DevDiaryManageGate } from "./components/DevDiaryManageGate";

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
      <Route path="/dev-diary" element={<DevDiaryListPage />} />
      <Route path="/dev-diary/entry/:id/edit" element={
        <DevDiaryManageGate>
          <DevDiaryEditorPage mode="edit" />
        </DevDiaryManageGate>
      } />
      <Route path="/dev-diary/compose" element={
        <DevDiaryManageGate>
          <DevDiaryEditorPage mode="new" />
        </DevDiaryManageGate>
      } />
      <Route path="/dev-diary/entry/:id" element={<DevDiaryEntryPage />} />
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
      >
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<AdminUserListPanel />} />
        <Route path="guestbook" element={<AdminGuestbookPanel />} />
        <Route path="wishlist" element={<AdminWishlistPanel />} />
        <Route path="developers" element={<AdminDevelopersPage />}>
          <Route index element={<Navigate to="list" replace />} />
          <Route path="list" element={<AdminDeveloperListPanel />} />
          <Route path="applications" element={<AdminDeveloperApplicationPanel />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
      <AdminConsoleDock />
    </>
  );
}
