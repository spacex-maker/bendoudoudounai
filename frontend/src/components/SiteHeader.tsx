import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookHeart, Compass, Heart, LogIn, LogOut, Menu, Music2, ShieldCheck, UserCog, X } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth, useAuthedUser } from "../auth/AuthContext";
import { LanguageSwitch } from "./LanguageSwitch";
import { UserAvatar } from "./UserAvatar";
import { userIsAdmin } from "../api/client";
import { FOR_NAME } from "../siteMeta";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const navButtonClass =
  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-white/30";
const hashLink = (id: string) => `/#${id}`;

type Props = {
  className?: string;
};

/**
 * 官网公共顶栏：首页、留言板等 romantic 风格页面共用（fixed，下同 main 需留 pt-24 等安全区）
 * 桌面：居中导航含音乐角；移动端：右上角菜单按钮展开全站导航。
 */
export function SiteHeader({ className }: Props) {
  const { t } = useTranslation();
  const { state, logout } = useAuth();
  const navigate = useNavigate();
  const user = useAuthedUser();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isMessages = pathname === "/messages";
  const isDevDiary = pathname.startsWith("/dev-diary");
  const isMusic = pathname === "/music";

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
      const t = e.target as Node;
      if (userMenuRef.current?.contains(t)) return;
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
      const t = e.target as Node;
      if (mobileMenuRef.current?.contains(t)) return;
      if (mobileSheetRef.current?.contains(t)) return;
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
      "flex min-h-[44px] w-full items-center gap-3 px-4 py-3.5 text-left text-base font-medium transition active:bg-white/40",
      active ? "bg-white/35 text-warm-800" : "text-warm-700 hover:bg-white/25"
    );

  const authed = state.status === "authed";
  const authLoading = state.status === "loading";

  return (
    <header
      className={clsx(
        "fixed top-0 left-0 right-0 z-50",
        "border-b border-white/35",
        "bg-gradient-to-b from-white/50 to-white/[0.22]",
        "backdrop-blur-2xl backdrop-saturate-150",
        "shadow-[0_1px_0_rgba(255,255,255,0.55)_inset,0_4px_24px_rgba(0,0,0,0.05)]",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-[min(100%,90rem)] items-center justify-between gap-3 px-4 py-4.5 sm:gap-4 sm:px-8 sm:py-4 lg:px-10">
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center gap-2.5 text-left text-warm-600"
        >
          <Heart className="h-7 w-7 shrink-0 text-rose-400 sm:h-6 sm:w-6" fill="currentColor" fillOpacity={0.35} />
          <div className="min-w-0 text-left">
            <div className="font-display text-xl leading-tight sm:text-xl">{t("home.siteFor", { name: FOR_NAME })}</div>
            <div className="mt-0.5 text-[11px] text-rose-500/75 sm:text-[11px]">{t("home.tagline")}</div>
          </div>
        </Link>
        <nav
          className="hidden min-h-0 min-w-0 flex-1 flex-nowrap items-center justify-center gap-1 overflow-visible text-sm font-medium text-warm-600/90 md:flex"
          aria-label="Primary"
        >
          {sectionNav("features", t("nav.features"))}
          {sectionNav("steps", t("nav.steps"))}
          <details className="group relative shrink-0">
            <summary
              className={clsx(
                navButtonClass,
                "inline-flex cursor-pointer list-none items-center gap-1",
                (isMessages || isMusic || isDevDiary) && "bg-white/35 font-medium text-warm-700"
              )}
            >
              <Compass className="h-3.5 w-3.5 shrink-0 opacity-80" />
              {t("nav.discover")}
            </summary>
            <div className="absolute left-1/2 top-[calc(100%+0.4rem)] z-30 w-44 -translate-x-1/2 overflow-hidden rounded-xl border border-white/45 bg-white/90 py-1 shadow-lg shadow-rose-200/25 backdrop-blur-xl">
              <Link to={hashLink("wishlist")} className="flex items-center gap-2 px-3 py-2 text-xs text-warm-700 transition hover:bg-white/60">
                <Heart className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {t("nav.wishlist")}
              </Link>
              <Link to="/messages" className="flex items-center gap-2 px-3 py-2 text-xs text-warm-700 transition hover:bg-white/60">
                <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-warm-400/50" aria-hidden />
                {t("nav.messages")}
              </Link>
              <Link to="/music" className="flex items-center gap-2 px-3 py-2 text-xs text-warm-700 transition hover:bg-white/60">
                <Music2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {t("nav.musicCorner")}
              </Link>
              <Link to="/dev-diary" className="flex items-center gap-2 px-3 py-2 text-xs text-warm-700 transition hover:bg-white/60">
                <BookHeart className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {t("nav.diary")}
              </Link>
              <Link to="/beans" className="flex items-center gap-2 px-3 py-2 text-xs text-warm-700 transition hover:bg-white/60">
                <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-400/80 px-1 text-[9px] font-bold text-black">豆</span>
                豆值系统
              </Link>
            </div>
          </details>
          {sectionNav("about", t("nav.about"))}
        </nav>
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5">
          {/* 移动端：汉堡菜单；语言在右侧与头像/登录同组 */}
          <div ref={mobileMenuRef} className="relative z-[60] md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className={clsx(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition sm:h-10 sm:w-10",
                mobileMenuOpen
                  ? "border-warm-400/50 bg-white/40 text-warm-800"
                  : "border-white/45 bg-white/20 text-warm-700 hover:bg-white/35"
              )}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="menu"
              aria-label={t("nav.menuAria")}
            >
              <Menu className="h-6 w-6 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
            </button>
            {mobileMenuOpen
              ? createPortal(
                  <div ref={mobileSheetRef} className="fixed inset-0 z-[100] md:hidden">
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
                      aria-hidden
                      tabIndex={-1}
                      onClick={closeMobileMenu}
                    />
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="mobile-nav-sheet-title"
                      className={clsx(
                        "absolute inset-x-0 top-0 z-10 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden border-b border-white/35 bg-gradient-to-b from-white/97 via-white/93 to-white/[0.88] shadow-[0_16px_48px_rgba(0,0,0,0.12)] backdrop-blur-2xl transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                        "pt-[env(safe-area-inset-top,0px)]",
                        mobileSheetEntered ? "translate-y-0" : "-translate-y-full"
                      )}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/40 px-4 py-3">
                        <h2 id="mobile-nav-sheet-title" className="font-display text-lg font-semibold tracking-tight text-warm-800">
                          {t("nav.menuSheetTitle")}
                        </h2>
                        <button
                          type="button"
                          onClick={closeMobileMenu}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/35 text-warm-800 transition active:bg-white/55"
                          aria-label={t("nav.closeMenu")}
                        >
                          <X className="h-6 w-6" strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                      <nav
                        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
                        aria-label={t("nav.menuSheetTitle")}
                      >
                        {isHome ? (
                          <button
                            type="button"
                            className={mobileItemClass()}
                            onClick={() => {
                              scrollToId("features");
                              closeMobileMenu();
                            }}
                          >
                            {t("nav.features")}
                          </button>
                        ) : (
                          <Link to={hashLink("features")} className={mobileItemClass()} onClick={closeMobileMenu}>
                            {t("nav.features")}
                          </Link>
                        )}
                        {isHome ? (
                          <button
                            type="button"
                            className={mobileItemClass()}
                            onClick={() => {
                              scrollToId("steps");
                              closeMobileMenu();
                            }}
                          >
                            {t("nav.steps")}
                          </button>
                        ) : (
                          <Link to={hashLink("steps")} className={mobileItemClass()} onClick={closeMobileMenu}>
                            {t("nav.steps")}
                          </Link>
                        )}
                        <div className="mt-3 border-t border-white/40 pt-2">
                          <div className="flex items-center gap-2 px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-warm-500">
                            <Compass className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                            {t("nav.discover")}
                          </div>
                          <Link to={hashLink("wishlist")} className={mobileItemClass()} onClick={closeMobileMenu}>
                            <Heart className="h-5 w-5 shrink-0 opacity-75" aria-hidden />
                            {t("nav.wishlist")}
                          </Link>
                          <Link
                            to="/messages"
                            className={mobileItemClass(isMessages)}
                            aria-current={isMessages ? "page" : undefined}
                            onClick={closeMobileMenu}
                          >
                            <span className="inline-block h-5 w-5 shrink-0 rounded-full border border-warm-400/50" aria-hidden />
                            {t("nav.messages")}
                          </Link>
                          <Link
                            to="/music"
                            className={mobileItemClass(isMusic)}
                            aria-current={isMusic ? "page" : undefined}
                            onClick={closeMobileMenu}
                          >
                            <Music2 className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                            {t("nav.musicCorner")}
                          </Link>
                          <Link
                            to="/dev-diary"
                            className={mobileItemClass(isDevDiary)}
                            aria-current={isDevDiary ? "page" : undefined}
                            onClick={closeMobileMenu}
                          >
                            <BookHeart className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
                            {t("nav.diary")}
                          </Link>
                          <Link to="/beans" className={mobileItemClass()} onClick={closeMobileMenu}>
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/80 px-1 text-[10px] font-bold text-black">豆</span>
                            豆值系统
                          </Link>
                        </div>
                        {isHome ? (
                          <button
                            type="button"
                            className={mobileItemClass()}
                            onClick={() => {
                              scrollToId("about");
                              closeMobileMenu();
                            }}
                          >
                            {t("nav.about")}
                          </button>
                        ) : (
                          <Link to={hashLink("about")} className={mobileItemClass()} onClick={closeMobileMenu}>
                            {t("nav.about")}
                          </Link>
                        )}
                        {!authLoading && !authed ? (
                          <div className="mt-2 border-t border-white/35 pt-2">
                            <Link to="/login" className={mobileItemClass()} onClick={closeMobileMenu}>
                              <LogIn className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                              {t("nav.login")}
                            </Link>
                          </div>
                        ) : null}
                      </nav>
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </div>

          <LanguageSwitch className="shrink-0 border-warm-300/30" compact aria-label={t("lang.label")} />

          {authLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-white/35" aria-hidden />
          ) : authed && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="inline-flex max-w-[min(100%,14rem)] items-center gap-2 rounded-full border border-white/40 bg-white/25 py-1 pl-1 pr-2.5 text-warm-800 shadow-sm transition hover:bg-white/40 sm:max-w-[18rem] sm:gap-2.5 sm:pl-1.5 sm:pr-3"
                title={t("userProfile.title")}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <UserAvatar user={user} className="h-8 w-8 shrink-0 border border-white/50 shadow sm:h-9 sm:w-9" />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                  {user.displayName?.trim() || user.email}
                </span>
              </button>
              {userMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.45rem)] z-40 w-48 overflow-hidden rounded-xl border border-white/45 bg-white/95 py-1 text-xs shadow-lg shadow-rose-200/25 backdrop-blur-xl">
                  <Link
                    to="/account/profile"
                    className="flex items-center gap-2 px-3 py-2 text-warm-700 transition hover:bg-white/70"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <UserCog className="h-3.5 w-3.5" />
                    个人信息
                  </Link>
                  <Link
                    to="/account/privacy"
                    className="flex items-center gap-2 px-3 py-2 text-warm-700 transition hover:bg-white/70"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    隐私设置
                  </Link>
                  {userIsAdmin(user) ? (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 px-3 py-2 text-warm-700 transition hover:bg-white/70"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Compass className="h-3.5 w-3.5" />
                      管理后台
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-rose-600 transition hover:bg-rose-50"
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                      navigate("/login", { replace: true });
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-warm-500/90 px-3 py-2 text-sm text-white shadow-md shadow-rose-200/50 transition hover:bg-warm-600 sm:px-4"
            >
              <LogIn className="h-4 w-4" />
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
