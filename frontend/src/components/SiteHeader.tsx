import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Menu, Music2, ShieldCheck, UserCog, X } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth, useAuthedUser } from "../auth/AuthContext";
import { LanguageSwitch } from "./LanguageSwitch";
import { UserAvatar } from "./UserAvatar";
import { userIsAdmin } from "../api/client";
import { PRODUCT_NAME } from "../siteMeta";
import { isMusicPath } from "../music/musicRoutes";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const hashLink = (id: string) => `/#${id}`;

type Props = {
  className?: string;
  /** 官网暗色舞台首屏用 dark；可随滚动切换 */
  tone?: "light" | "dark";
};

/**
 * 产品站顶栏：AIMATEX-MUSIC；仅功能 / 开始使用 / 进入音乐。
 * 移动端：品牌精简 + 头像/登录收纳进菜单，避免右侧控件挤爆。
 */
export function SiteHeader({ className, tone = "light" }: Props) {
  const { t } = useTranslation();
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const user = useAuthedUser();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isMusic = isMusicPath(pathname);
  const dark = tone === "dark";

  const navButtonClass = dark
    ? "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
    : "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-800/80 transition hover:bg-ink-900/5 hover:text-ink-900";

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSheetEntered, setMobileSheetEntered] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileSheetEntered(false);
      return;
    }
    setUserMenuOpen(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileSheetEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (userMenuRef.current?.contains(node)) return;
      setUserMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (mobileMenuRef.current?.contains(node)) return;
      if (mobileSheetRef.current?.contains(node)) return;
      closeMobileMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [mobileMenuOpen]);

  const sectionNav = (id: string, label: string) =>
    isHome ? (
      <button type="button" onClick={() => scrollToId(id)} className={navButtonClass}>
        {label}
      </button>
    ) : (
      <Link to={hashLink(id)} className={navButtonClass}>
        {label}
      </Link>
    );

  const mobileItemClass = (active?: boolean) =>
    clsx(
      "flex min-h-[48px] w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium transition active:bg-ink-900/5",
      active ? "bg-ink-900/[0.06] text-ink-900" : "text-ink-800 hover:bg-ink-900/[0.04]"
    );

  const authed = state.status === "authed";
  const authLoading = state.status === "loading";
  const musicHref = authed ? "/music" : "/login";
  const displayName = user?.displayName?.trim() || t("userProfile.noName");
  const userMenuItemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-800 transition hover:bg-ink-900/[0.05]";

  const onLogout = () => {
    logout();
    setUserMenuOpen(false);
    closeMobileMenu();
    navigate("/login", { replace: true });
  };

  return (
    <header
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color] duration-300",
        dark
          ? "border-b border-white/10 bg-[#0b0d10]/78"
          : "border-b border-ink-900/[0.06] bg-ink-50/85",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[min(100%,90rem)] items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-8 sm:py-3.5 lg:px-10">
        <Link
          to="/"
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-2.5 text-left md:flex-none md:shrink-0",
            dark ? "text-white" : "text-ink-900"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-netease-accent text-white">
            <Music2 className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 text-left">
            <div className="truncate font-display text-[15px] font-bold tracking-tight sm:text-base">
              {PRODUCT_NAME}
            </div>
            {/* 移动端隐藏副标，避免与右侧控件抢宽 */}
            <div
              className={clsx(
                "mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.14em] sm:block",
                dark ? "text-white/45" : "text-ink-700/55"
              )}
            >
              {t("home.tagline")}
            </div>
          </div>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
          aria-label="Primary"
        >
          {sectionNav("features", t("nav.features"))}
          {sectionNav("immersive", t("nav.immersive"))}
          {sectionNav("modules", t("nav.modules"))}
          {sectionNav("steps", t("nav.steps"))}
          <Link
            to={musicHref}
            state={authed ? undefined : { from: "/music" }}
            className={clsx(
              navButtonClass,
              "inline-flex items-center gap-1.5",
              isMusic &&
                (dark
                  ? "bg-white/10 font-semibold text-white"
                  : "bg-ink-900/[0.06] font-semibold text-ink-900")
            )}
          >
            <Music2 className="h-3.5 w-3.5 opacity-80" />
            {t("nav.enterMusic")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5">
          {/* 桌面：语言 + 账号；移动：只留菜单（账号/语言进抽屉） */}
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitch
              className={clsx("shrink-0", dark ? "border-white/15" : "border-ink-900/10")}
              compact
              aria-label={t("lang.label")}
            />

            {authLoading ? (
              <div
                className={clsx(
                  "h-9 w-9 animate-pulse rounded-full",
                  dark ? "bg-white/15" : "bg-ink-200/70"
                )}
                aria-hidden
              />
            ) : authed && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className={clsx(
                    "group inline-flex items-center gap-1.5 rounded-full p-0.5 transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netease-accent/35",
                    dark
                      ? clsx("text-white hover:bg-white/10", userMenuOpen && "bg-white/10")
                      : clsx(
                          "text-ink-900 hover:bg-ink-900/[0.05]",
                          userMenuOpen && "bg-ink-900/[0.06]"
                        )
                  )}
                  title={displayName}
                  aria-label={t("userProfile.menuAria")}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <UserAvatar
                    user={user}
                    showLevelBadge={false}
                    className={clsx(
                      "h-9 w-9 shrink-0 ring-2",
                      dark
                        ? clsx(
                            "ring-[#0b0d10] shadow-[0_0_0_1px_rgba(255,255,255,0.15)]",
                            userMenuOpen && "ring-netease-accent/40"
                          )
                        : clsx(
                            "ring-white shadow-[0_0_0_1px_rgba(26,31,38,0.08)]",
                            userMenuOpen && "ring-netease-accent/25"
                          )
                    )}
                  />
                  <span className="flex min-w-0 max-w-[7.5rem] items-center gap-1 pr-1.5">
                    <span className="truncate text-left text-[13px] font-semibold tracking-tight">
                      {displayName}
                    </span>
                    <ChevronDown
                      className={clsx(
                        "h-3.5 w-3.5 shrink-0 transition duration-200",
                        dark ? "text-white/45" : "text-ink-700/45",
                        userMenuOpen && (dark ? "rotate-180 text-white" : "rotate-180 text-ink-800")
                      )}
                      aria-hidden
                    />
                  </span>
                </button>
                {userMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.55rem)] z-40 w-[min(calc(100vw-1.5rem),16.5rem)] overflow-hidden rounded-2xl border border-ink-900/10 bg-white/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(15,18,24,0.45)] backdrop-blur-xl"
                  >
                    <div className="mb-1 flex items-center gap-3 rounded-xl bg-ink-50/90 px-3 py-2.5">
                      <UserAvatar user={user} className="h-10 w-10 shrink-0 ring-2 ring-white" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold tracking-tight text-ink-900">
                          {displayName}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-ink-700/55">{user.email}</div>
                        {user.beanLevelCode ? (
                          <div className="mt-1 inline-flex items-center rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800/90">
                            {t("userProfile.beanBalance")} · {user.beanLevelCode}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-0.5 p-0.5">
                      <Link
                        role="menuitem"
                        to="/account/profile"
                        className={userMenuItemClass}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <UserCog className="h-4 w-4 shrink-0 text-ink-700/55" />
                        {t("userProfile.title")}
                      </Link>
                      <Link
                        role="menuitem"
                        to="/account/privacy"
                        className={userMenuItemClass}
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShieldCheck className="h-4 w-4 shrink-0 text-ink-700/55" />
                        {t("userProfile.privacy")}
                      </Link>
                      {userIsAdmin(user) ? (
                        <Link
                          role="menuitem"
                          to="/admin"
                          className={userMenuItemClass}
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4 shrink-0 text-ink-700/55" />
                          {t("userProfile.openAdmin")}
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-1 border-t border-ink-900/10 p-0.5 pt-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-netease-accent transition hover:bg-red-50/90"
                        onClick={onLogout}
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {t("userProfile.logout")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                to="/login"
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition sm:px-4",
                  dark
                    ? "bg-white text-ink-900 hover:bg-white/90"
                    : "bg-ink-900 text-white hover:bg-ink-800"
                )}
              >
                <LogIn className="h-4 w-4" />
                {t("nav.login")}
              </Link>
            )}
          </div>

          {/* 移动端：已登录只露头像入口感；主交互进抽屉 */}
          <div className="flex items-center gap-1.5 md:hidden">
            {!authLoading && authed && user ? (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netease-accent/35"
                aria-label={t("userProfile.menuAria")}
              >
                <UserAvatar
                  user={user}
                  showLevelBadge={false}
                  className={clsx(
                    "h-9 w-9 shrink-0 ring-2",
                    dark
                      ? "ring-[#0b0d10] shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                      : "ring-white shadow-[0_0_0_1px_rgba(26,31,38,0.08)]"
                  )}
                />
              </button>
            ) : null}

            <div ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className={clsx(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition",
                  dark
                    ? mobileMenuOpen
                      ? "border-white/25 bg-white/15 text-white"
                      : "border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
                    : mobileMenuOpen
                      ? "border-ink-900/20 bg-ink-900/5 text-ink-900"
                      : "border-ink-900/10 bg-white/70 text-ink-800 hover:bg-white"
                )}
                aria-expanded={mobileMenuOpen}
                aria-haspopup="dialog"
                aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.menuAria")}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                ) : (
                  <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
          </div>

          {mobileMenuOpen
            ? createPortal(
                <div className="fixed inset-0 z-[100] md:hidden">
                  <button
                    type="button"
                    className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]"
                    aria-hidden
                    tabIndex={-1}
                    onClick={closeMobileMenu}
                  />
                  <div
                    ref={mobileSheetRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mobile-nav-sheet-title"
                    className={clsx(
                      "absolute inset-x-0 top-0 z-10 flex max-h-[min(100dvh,40rem)] flex-col overflow-hidden rounded-b-[1.75rem] border-b border-ink-900/10 bg-ink-50 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                      "pt-[env(safe-area-inset-top,0px)]",
                      mobileSheetEntered ? "translate-y-0" : "-translate-y-full"
                    )}
                  >
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-900/10 px-4 py-3">
                      <h2
                        id="mobile-nav-sheet-title"
                        className="font-display text-lg font-bold tracking-tight text-ink-900"
                      >
                        {t("nav.menuSheetTitle")}
                      </h2>
                      <button
                        type="button"
                        onClick={closeMobileMenu}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-900/10 bg-white text-ink-800"
                        aria-label={t("nav.closeMenu")}
                      >
                        <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                      {authed && user ? (
                        <div className="border-b border-ink-900/10 px-4 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} className="h-11 w-11 shrink-0 ring-2 ring-white" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-ink-900">{displayName}</div>
                              <div className="mt-0.5 truncate text-[11px] text-ink-700/55">{user.email}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Link
                              to="/account/profile"
                              onClick={closeMobileMenu}
                              className="rounded-xl bg-ink-900/[0.04] px-3 py-2.5 text-center text-xs font-medium text-ink-800"
                            >
                              {t("userProfile.title")}
                            </Link>
                            <Link
                              to="/account/privacy"
                              onClick={closeMobileMenu}
                              className="rounded-xl bg-ink-900/[0.04] px-3 py-2.5 text-center text-xs font-medium text-ink-800"
                            >
                              {t("userProfile.privacy")}
                            </Link>
                          </div>
                        </div>
                      ) : null}

                      <nav aria-label={t("nav.menuSheetTitle")}>
                        {(
                          [
                            ["features", t("nav.features")],
                            ["immersive", t("nav.immersive")],
                            ["modules", t("nav.modules")],
                            ["steps", t("nav.steps")],
                          ] as const
                        ).map(([id, label]) =>
                          isHome ? (
                            <button
                              key={id}
                              type="button"
                              className={mobileItemClass()}
                              onClick={() => {
                                scrollToId(id);
                                closeMobileMenu();
                              }}
                            >
                              {label}
                            </button>
                          ) : (
                            <Link
                              key={id}
                              to={hashLink(id)}
                              className={mobileItemClass()}
                              onClick={closeMobileMenu}
                            >
                              {label}
                            </Link>
                          )
                        )}
                        <Link
                          to={musicHref}
                          state={authed ? undefined : { from: "/music" }}
                          className={mobileItemClass(isMusic)}
                          aria-current={isMusic ? "page" : undefined}
                          onClick={closeMobileMenu}
                        >
                          <Music2 className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                          {t("nav.enterMusic")}
                        </Link>
                      </nav>

                      <div className="mt-2 border-t border-ink-900/10 px-4 py-4">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-700/45">
                          {t("lang.label")}
                        </p>
                        <LanguageSwitch
                          className="border-ink-900/10 bg-ink-900/[0.03]"
                          compact
                          aria-label={t("lang.label")}
                        />
                      </div>

                      <div className="border-t border-ink-900/10 px-4 py-4">
                        {!authLoading && !authed ? (
                          <Link
                            to="/login"
                            onClick={closeMobileMenu}
                            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white"
                          >
                            <LogIn className="h-4 w-4" />
                            {t("nav.login")}
                          </Link>
                        ) : null}
                        {authed && user ? (
                          <div className="space-y-2">
                            {userIsAdmin(user) ? (
                              <Link
                                to="/admin"
                                onClick={closeMobileMenu}
                                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-ink-900/10 bg-white px-4 text-sm font-medium text-ink-800"
                              >
                                <LayoutDashboard className="h-4 w-4" />
                                {t("userProfile.openAdmin")}
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              onClick={onLogout}
                              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-netease-accent/20 bg-red-50 px-4 text-sm font-medium text-netease-accent"
                            >
                              <LogOut className="h-4 w-4" />
                              {t("userProfile.logout")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}
        </div>
      </div>
    </header>
  );
}
