import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Code2,
  Coins,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Music2,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "../components/UserAvatar";

/**
 * 管理后台：左侧菜单 + 右侧内容，无官网顶栏。
 * 窄屏（小于 md）：侧栏默认隐藏，顶栏打开抽屉；md 及以上为固定左侧栏。
 */
export function AdminPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state: authState, logout } = useAuth();
  const user = authState.status === "authed" ? authState.user : null;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onCrossMd = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    mq.addEventListener("change", onCrossMd);
    return () => mq.removeEventListener("change", onCrossMd);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);
  const isUsers = useMatch({ path: "/admin/users", end: true });
  const isGuestbook = useMatch({ path: "/admin/guestbook", end: true });
  const isWishlist = useMatch({ path: "/admin/wishlist", end: true });
  const isBeans = useMatch({ path: "/admin/beans", end: true });
  const isRegApps = useMatch({ path: "/admin/registration-applications", end: true });
  const inDevSection = pathname.startsWith("/admin/developers");
  const isDevApps = pathname.includes("/admin/developers/applications");
  const sectionTitle = inDevSection
    ? t("admin.navDevelopers")
    : isRegApps
      ? t("admin.navRegApps")
    : isGuestbook
      ? t("admin.guestbookTitle")
      : isWishlist
        ? t("admin.wishlistTitle")
        : isBeans
          ? "豆值管理"
        : isUsers
          ? t("admin.usersTitle")
          : t("admin.pageTitle");
  const sectionSub = inDevSection
    ? isDevApps
      ? t("admin.devAppTabSub")
      : t("admin.devListSub")
    : isRegApps
      ? t("admin.regAppSub")
    : isGuestbook
      ? t("admin.guestbookSub")
      : isWishlist
        ? t("admin.wishlistSub")
        : isBeans
          ? "配置豆值规则与等级，并查看流水"
        : isUsers
          ? t("admin.usersSub")
          : t("admin.pageSub");

  const sideNavItemCls = (active: boolean) =>
    clsx(
      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition",
      active
        ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30"
        : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
    );

  const closeMobileNav = () => setMobileNavOpen(false);
  const navLinkProps = { onClick: closeMobileNav };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-zinc-950 text-zinc-200 md:flex-row">
      {/* 移动端抽屉遮罩 */}
      <button
        type="button"
        aria-label={t("admin.closeMenu")}
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden",
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobileNav}
        tabIndex={mobileNavOpen ? 0 : -1}
      />

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[min(17.5rem,88vw)] flex-col border-r border-zinc-800/90 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur-md transition-transform duration-200 ease-out md:relative md:z-auto md:w-60 md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        aria-hidden={false}
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-800/80 px-3 py-3 md:px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
            <LayoutDashboard className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{t("admin.pageTitle")}</p>
            <p className="truncate text-[10px] text-zinc-500">{t("admin.pageSub")}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-zinc-700/80 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
            onClick={closeMobileNav}
            aria-label={t("admin.closeMenu")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          id="admin-site-nav"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2 md:gap-0.5 md:p-2.5"
          aria-label={t("admin.pageTitle")}
        >
          <NavLink
            to="users"
            className={({ isActive }) => sideNavItemCls(isActive)}
            {...navLinkProps}
          >
            <Users className="h-4 w-4 shrink-0 opacity-90" />
            {t("admin.navUsers")}
          </NavLink>
          <NavLink
            to="guestbook"
            className={({ isActive }) => sideNavItemCls(isActive)}
            {...navLinkProps}
          >
            <MessageSquareText className="h-4 w-4 shrink-0 opacity-90" />
            {t("admin.navGuestbook")}
          </NavLink>
          <NavLink
            to="wishlist"
            className={({ isActive }) => sideNavItemCls(isActive)}
            {...navLinkProps}
          >
            <Heart className="h-4 w-4 shrink-0 opacity-90" />
            {t("admin.navWishlist")}
          </NavLink>
          <NavLink
            to="beans"
            className={({ isActive }) => sideNavItemCls(isActive)}
            {...navLinkProps}
          >
            <Coins className="h-4 w-4 shrink-0 opacity-90" />
            豆值管理
          </NavLink>
          <NavLink
            to="registration-applications"
            className={({ isActive }) => sideNavItemCls(isActive)}
            {...navLinkProps}
          >
            <UserPlus className="h-4 w-4 shrink-0 opacity-90" />
            {t("admin.navRegApps")}
          </NavLink>
          <NavLink
            to="developers/list"
            className={({ isActive }) => sideNavItemCls(isActive || inDevSection)}
            {...navLinkProps}
          >
            <Code2 className="h-4 w-4 shrink-0 opacity-90" />
            {t("admin.navDevelopers")}
          </NavLink>
        </nav>

        <div className="mt-auto shrink-0 border-t border-zinc-800/80 p-2.5 md:p-3">
          {user ? (
            <div className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-2.5">
              <div className="flex items-center gap-2.5">
                <UserAvatar
                  user={user}
                  className="h-9 w-9 text-sm ring-1 ring-white/10"
                  showLevelBadge={false}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-zinc-100">
                    {user.displayName?.trim() || t("userProfile.noName")}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500" title={user.email}>
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(user.roles?.length ? user.roles : user.role ? [user.role] : ["ADMIN"]).map((role) => (
                  <span
                    key={role}
                    className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-violet-200/90 ring-1 ring-violet-500/25"
                  >
                    {t(`admin.role.${role}`, { defaultValue: role })}
                  </span>
                ))}
                {user.beanBalance != null ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200/85 ring-1 ring-amber-500/20">
                    <Coins className="h-2.5 w-2.5" />
                    {user.beanBalance}
                    {user.beanLevelName ? ` · ${user.beanLevelName}` : null}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  closeMobileNav();
                  navigate("/login", { replace: true });
                }}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-900/60 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200"
              >
                <LogOut className="h-3 w-3" />
                {t("userProfile.logout")}
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start gap-3 border-b border-zinc-800/90 bg-zinc-900/50 px-3 py-3 md:px-5 md:py-3.5">
          <button
            type="button"
            className="shrink-0 rounded-lg border border-zinc-700/80 bg-zinc-900/70 p-2 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-expanded={mobileNavOpen}
            aria-controls="admin-site-nav"
            aria-label={t("admin.openMenu")}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 pt-0.5 md:pt-0">
            <h1 className="text-sm font-semibold text-zinc-100 md:text-base">{sectionTitle}</h1>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 md:text-xs">{sectionSub}</p>
          </div>
          {/* 站点快捷入口：放在内容顶栏右侧，离开后台时更顺手 */}
          <div
            className="flex shrink-0 items-center gap-1.5 pt-0.5"
            aria-label={t("admin.siteSection")}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-500/50 hover:bg-zinc-800/60 hover:text-zinc-100 sm:px-3 sm:text-xs"
              title={t("admin.linkOfficial")}
            >
              <Home className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="hidden sm:inline">{t("admin.linkOfficial")}</span>
            </Link>
            <Link
              to="/music"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950/40 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-rose-500/35 hover:bg-rose-500/10 hover:text-rose-200/90 sm:px-3 sm:text-xs"
              title={t("admin.linkMusicCorner")}
            >
              <Music2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="hidden sm:inline">{t("admin.linkMusicCorner")}</span>
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
