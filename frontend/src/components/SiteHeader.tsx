import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, LogIn, Music2 } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth, useAuthedUser } from "../auth/AuthContext";
import { LanguageSwitch } from "./LanguageSwitch";
import { UserAvatar } from "./UserAvatar";
import { UserProfileModal } from "./UserProfileModal";
import { FOR_NAME } from "../siteMeta";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const navButtonClass = "rounded-full px-3 py-1.5 transition hover:bg-white/30";
const hashLink = (id: string) => `/#${id}`;

type Props = {
  className?: string;
};

/**
 * 官网公共顶栏：首页、留言板等romantic 风格页面共用（fixed，下同 main 需留 pt-24 等安全区）
 */
export function SiteHeader({ className }: Props) {
  const { t } = useTranslation();
  const { state, logout } = useAuth();
  const user = useAuthedUser();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const isMessages = pathname === "/messages";

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

  const authed = state.status === "authed";
  const authLoading = state.status === "loading";
  const [profileOpen, setProfileOpen] = useState(false);

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
      <div className="mx-auto flex w-full max-w-[min(100%,90rem)] items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-8 sm:py-4 lg:px-10">
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center gap-2 text-left text-warm-600"
        >
          <Heart className="h-6 w-6 shrink-0 text-rose-400" fill="currentColor" fillOpacity={0.35} />
          <div className="min-w-0 text-left">
            <div className="font-display text-lg leading-tight sm:text-xl">{t("home.siteFor", { name: FOR_NAME })}</div>
            <div className="mt-0.5 text-[10px] text-rose-500/75 sm:text-[11px]">{t("home.tagline")}</div>
          </div>
        </Link>
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 text-sm font-medium text-warm-600/90 md:flex"
          aria-label="Primary"
        >
          {sectionNav("features", t("nav.features"))}
          {sectionNav("steps", t("nav.steps"))}
          {sectionNav("wishlist", t("nav.wishlist"))}
          <Link
            to="/messages"
            className={clsx(
              navButtonClass,
              isMessages && "bg-white/35 font-medium text-warm-700"
            )}
            aria-current={isMessages ? "page" : undefined}
          >
            {t("nav.messages")}
          </Link>
          {sectionNav("about", t("nav.about"))}
          <LanguageSwitch className="ml-1 border-warm-300/30" compact />
        </nav>
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-3">
          <LanguageSwitch className="border-warm-300/30 md:hidden" compact />
          <Link
            to="/messages"
            className={clsx(
              "shrink-0 rounded-full px-2 py-1.5 text-sm text-warm-600/90 transition hover:bg-white/30 md:hidden",
              isMessages && "bg-white/35 font-medium"
            )}
            aria-current={isMessages ? "page" : undefined}
            >
              {t("nav.messages")}
            </Link>
            {authLoading ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-white/35" aria-hidden />
          ) : authed && user ? (
            <>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="inline-flex max-w-[min(100%,14rem)] items-center gap-2 rounded-full border border-white/40 bg-white/25 py-1 pl-1 pr-2.5 text-warm-800 shadow-sm transition hover:bg-white/40 sm:max-w-[18rem] sm:gap-2.5 sm:pl-1.5 sm:pr-3"
                title={t("userProfile.title")}
              >
                <UserAvatar user={user} className="h-8 w-8 shrink-0 border border-white/50 shadow sm:h-9 sm:w-9" />
                <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                  {user.displayName?.trim() || user.email}
                </span>
              </button>
              <Link
                to="/music"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warm-400/35 bg-warm-500/90 text-white shadow-md shadow-rose-200/35 transition hover:bg-warm-600 sm:h-10 sm:w-10"
                title={t("nav.enterMusic")}
                aria-label={t("nav.enterMusic")}
              >
                <Music2 className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-full px-2 py-1.5 text-sm text-warm-500/85 transition hover:text-warm-600"
              >
                {t("nav.logout")}
              </button>
              <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
            </>
          ) : (
            <>
              <Link
                to="/login"
                state={{ from: "/music" }}
                className="rounded-full px-3 py-1.5 text-sm text-warm-600/90 transition hover:bg-white/25"
              >
                {t("nav.music")}
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-full bg-warm-500/90 px-4 py-2 text-sm text-white shadow-md shadow-rose-200/50 transition hover:bg-warm-600"
              >
                <LogIn className="h-4 w-4" />
                {t("nav.login")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
