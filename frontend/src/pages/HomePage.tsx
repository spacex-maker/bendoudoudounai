import { Link } from "react-router-dom";
import {
  ListMusic,
  Music2,
  ImageIcon,
  Sparkles,
  Headphones,
  MessageCircle,
  CircleDot,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";
import { FutureWishlistSection } from "../components/FutureWishlistSection";
import { SiteHeader } from "../components/SiteHeader";
import { DEVELOPER_NAME, FOR_NAME } from "../siteMeta";

const FEATURE_ICONS = [ListMusic, Music2, ImageIcon, Headphones] as const;
const FEATURE_KEYS = ["0", "1", "2", "3"] as const;
const STEP_KEYS = ["0", "1", "2"] as const;

export function HomePage() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const { wallpaperActive } = usePageAppearance();

  return (
    <div className="relative w-full">
      <SiteHeader />

      <div
        className={clsx(
          "relative overflow-x-clip overflow-y-clip",
          wallpaperActive ? "" : "bg-romantic-mesh"
        )}
      >
        {!wallpaperActive ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-pink-200/25 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-72 w-72 translate-y-1/4 rounded-full bg-rose-200/30 blur-3xl" />
            <div className="absolute left-1/3 top-1/4 h-48 w-48 rounded-full bg-amber-100/35 blur-2xl" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
              }}
            />
          </div>
        ) : null}

        <main className="relative z-10 pt-24 sm:pt-[5.75rem]">
        <section className="relative z-10 mx-auto max-w-4xl px-5 pb-20 pt-8 text-center sm:px-8 sm:pt-10">
          <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-500/90">
            <Sparkles className="h-4 w-4 shrink-0" />
            {t("home.heroKicker", { name: FOR_NAME })}
          </p>
          <h1 className="font-display text-4xl leading-[1.15] text-warm-600 sm:text-5xl sm:leading-tight">
            {t("home.heroTitleLine1")}
            <br />
            {t("home.heroTitleLine2")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-stone-600/90 sm:text-lg">
            {t("home.heroSub")}
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to={state.status === "authed" ? "/music" : "/login"}
              state={state.status === "authed" ? undefined : { from: "/music" }}
              className={clsx(
                "group inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-medium text-white shadow-lg transition",
                "bg-gradient-to-r from-rose-500/95 to-warm-500/95 hover:from-rose-500 hover:to-warm-600"
              )}
            >
              {state.status === "authed" ? t("home.ctaEnterMusic") : t("home.ctaLogin")}
              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={() => scrollToId("features")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-warm-400/30 bg-white/50 px-8 py-3.5 text-base font-medium text-warm-600 backdrop-blur transition hover:bg-white/80"
            >
              {t("home.ctaFeatures")}
            </button>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/30 bg-white/20 py-16 backdrop-blur-sm sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mb-10 text-center sm:mb-14">
              <h2 className="font-display text-2xl text-warm-600 sm:text-3xl">{t("home.sectionFeaturesTitle")}</h2>
              <p className="mt-2 text-sm text-stone-600/85 sm:text-base">{t("home.sectionFeaturesSub")}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {FEATURE_KEYS.map((k, i) => {
                const Icon = FEATURE_ICONS[i]!;
                return (
                  <div
                    key={k}
                    className="group flex gap-4 rounded-3xl border border-white/50 bg-white/55 p-6 text-left shadow-sm backdrop-blur transition hover:bg-white/75 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100/80 text-rose-600 transition group-hover:scale-105">
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-warm-600">{t(`homeFeatures.${k}.title`)}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-600/90">{t(`homeFeatures.${k}.body`)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rose-200/60 bg-rose-50/40 px-5 py-4 text-center text-sm text-stone-600/90 sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
              <MessageCircle className="h-5 w-5 shrink-0 text-rose-400/90" />
              <span>{t("home.featuresFuture")}</span>
            </div>
          </div>
        </section>

        <section id="steps" className="scroll-mt-24 sm:scroll-mt-28 relative z-10 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <h2 className="text-center font-display text-2xl text-warm-600 sm:text-3xl">{t("home.sectionStepsTitle")}</h2>
            <p className="mt-2 text-center text-sm text-stone-600/85">{t("home.sectionStepsSub")}</p>
            <ol className="mt-10 space-y-0">
              {STEP_KEYS.map((k, i) => (
                <li key={k} className="flex gap-4 sm:gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-500/90 text-sm font-semibold text-white">
                      {String(i + 1)}
                    </div>
                    {i < STEP_KEYS.length - 1 ? (
                      <div className="w-px flex-1 min-h-[2.5rem] bg-gradient-to-b from-warm-300/50 to-rose-200/40" />
                    ) : null}
                  </div>
                  <div className="pb-10 pt-1 sm:pb-12">
                    <h3 className="font-medium text-warm-600">{t(`homeSteps.${k}.label`)}</h3>
                    <p className="mt-1 text-sm text-stone-600/88">{t(`homeSteps.${k}.sub`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <FutureWishlistSection />

        <section
          id="about"
          className="scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/25 bg-stone-900/[0.03] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <div className="mb-4 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/50 px-4 py-1.5 text-xs text-stone-500 backdrop-blur">
                <CircleDot className="h-3.5 w-3.5 text-rose-400" />
                {t("home.aboutBadge")}
              </div>
            </div>
            <h2 className="font-display text-xl text-warm-600 sm:text-2xl">{t("home.aboutTitle", { name: FOR_NAME })}</h2>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-stone-600/90 sm:text-base">
              {t("home.aboutP1", { name: FOR_NAME })}
            </p>
            <p className="mt-3 text-pretty text-sm text-stone-500/90">
              {t("home.aboutP2", { name: FOR_NAME })}
            </p>
            <div className="mt-10">
              <Link
                to={state.status === "authed" ? "/music" : "/login"}
                state={state.status === "authed" ? undefined : { from: "/music" }}
                className="inline-flex items-center gap-2 rounded-full border border-warm-400/40 bg-white/60 px-6 py-2.5 text-sm font-medium text-warm-600 backdrop-blur transition hover:bg-white/90"
              >
                {state.status === "authed" ? t("home.openMusic") : t("home.goLogin")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
        </main>

        <footer className="relative z-10 border-t border-white/20 bg-white/10 px-4 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] text-center text-xs text-stone-500 backdrop-blur-sm">
        <p className="font-display text-sm text-stone-600/90">{t("home.footerTitle", { name: FOR_NAME })}</p>
        <p className="mt-2 text-stone-500">{t("home.footerSlogan")}</p>
        <p className="mt-3 text-stone-400">© {new Date().getFullYear()}</p>
        <p className="mt-4 border-t border-white/20 pt-4 text-[11px] leading-relaxed text-stone-500/90">
          <span className="text-stone-400">Powered with care</span>
          <span className="mx-1.5 text-stone-300/80">·</span>
          <span>
            {t("home.footerDev", { dev: DEVELOPER_NAME })}
          </span>
        </p>
        </footer>
      </div>
    </div>
  );
}
