import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Code2,
  Heart,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Music2,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";

/**
 * 管理后台：左侧菜单 + 右侧内容，无官网顶栏。
 * 窄屏（小于 md）：侧栏默认隐藏，顶栏打开抽屉；md 及以上为固定左侧栏。
 */
export function AdminPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
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
  const inDevSection = pathname.startsWith("/admin/developers");
  const isDevApps = pathname.includes("/admin/developers/applications");
  const sectionTitle = inDevSection
    ? t("admin.navDevelopers")
    : isGuestbook
      ? t("admin.guestbookTitle")
      : isWishlist
        ? t("admin.wishlistTitle")
        : isUsers
          ? t("admin.usersTitle")
          : t("admin.pageTitle");
  const sectionSub = inDevSection
    ? isDevApps
      ? t("admin.devAppTabSub")
      : t("admin.devListSub")
    : isGuestbook
      ? t("admin.guestbookSub")
      : isWishlist
        ? t("admin.wishlistSub")
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
            to="developers/list"
            className={({ isActive }) => sideNavItemCls(isActive || inDevSection)}
            {...navLinkProps}
          >
            <Code2 className="h-4 w-4 shrink-0 opacity-90" />
            {t("admin.navDevelopers")}
          </NavLink>
        </nav>

        <div className="mt-auto border-t border-zinc-800/80 p-2.5 md:p-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            {t("admin.siteSection")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-950/50 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500/50 hover:text-zinc-100"
              onClick={closeMobileNav}
            >
              {t("admin.linkOfficial")}
            </Link>
            <Link
              to="/music"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-950/50 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-rose-500/30 hover:text-rose-200/90"
              onClick={closeMobileNav}
            >
              <Music2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              {t("admin.linkMusicCorner")}
            </Link>
          </div>
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
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
