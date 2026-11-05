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
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  BarChart3,
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";
import { FutureWishlistSection } from "../components/FutureWishlistSection";
import { HomeMomentsTeaser } from "../components/HomeMomentsTeaser";
import { SiteHeader } from "../components/SiteHeader";
import { DEVELOPER_NAME, FOR_NAME } from "../siteMeta";

const FEATURE_ITEMS = [
  { key: "0", icon: ListMusic },
  { key: "1", icon: Music2 },
  { key: "2", icon: Headphones },
  { key: "3", icon: ShieldCheck },
  { key: "4", icon: BarChart3 },
  { key: "5", icon: SlidersHorizontal },
  { key: "6", icon: UserRound },
  { key: "7", icon: ImageIcon },
] as const;
const STEP_KEYS = ["0", "1", "2"] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const primaryCtaClass =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-[0_14px_36px_rgba(244,63,94,0.38)] transition hover:bg-rose-600 hover:shadow-[0_16px_40px_rgba(244,63,94,0.45)] active:scale-[0.98]";

const secondaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200/70 bg-white/55 px-8 py-3.5 text-base font-medium text-rose-700/90 backdrop-blur transition hover:border-rose-300 hover:bg-white/85";

export function HomePage() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const { wallpaperActive } = usePageAppearance();
  const authed = state.status === "authed";
  const musicTo = authed ? "/music" : "/login";
  const musicState = authed ? undefined : { from: "/music" };

  return (
    <div className="relative w-full">
      <SiteHeader />

      <div
        className={clsx(
          "relative overflow-x-clip overflow-y-clip",
          wallpaperActive ? "" : "bg-theme-home"
        )}
      >
        {!wallpaperActive ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute -left-24 -top-16 h-[22rem] w-[22rem] rounded-full bg-rose-300/30 blur-3xl animate-home-blob" />
            <div className="absolute -right-16 top-24 h-[18rem] w-[18rem] rounded-full bg-pink-200/40 blur-3xl animate-home-blob-delay" />
            <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />
            <div className="absolute inset-0 bg-theme-home-overlay" />
            <div
              className="absolute inset-0 opacity-[0.28]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E")`,
              }}
            />
          </div>
        ) : null}

        <main className="relative z-10 pt-24 sm:pt-[5.75rem]">
          <section className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-6 text-center sm:px-8 sm:pb-20 sm:pt-8">
            {/* soft vinyl motif */}
            <div
              className="pointer-events-none absolute -right-6 top-8 hidden h-56 w-56 opacity-50 sm:block lg:-right-2 lg:h-72 lg:w-72"
              aria-hidden
            >
              <div className="absolute inset-0 rounded-full border border-rose-200/50 animate-home-spin-slow" />
              <div className="absolute inset-[10%] rounded-full border border-dashed border-rose-300/40 animate-home-spin" />
              <div className="absolute inset-[22%] rounded-full bg-gradient-to-br from-rose-200/50 via-white/40 to-pink-100/30 shadow-inner" />
              <div className="absolute inset-[42%] rounded-full bg-rose-400/80" />
              <div className="absolute inset-[48%] rounded-full bg-white/70" />
            </div>

            <p className="animate-home-fade-up mb-4 inline-flex items-center gap-1.5 rounded-full border border-rose-200/60 bg-white/45 px-3.5 py-1 text-sm font-medium text-rose-500 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              {t("home.heroKicker", { name: FOR_NAME })}
            </p>

            <h1 className="animate-home-fade-up font-display text-[clamp(2.4rem,8vw,3.75rem)] leading-[1.12] tracking-tight text-rose-950/85 [animation-delay:70ms]">
              <span className="block text-rose-500/90">{t("home.siteFor", { name: FOR_NAME })}</span>
              <span className="mt-3 block text-[0.72em] font-normal text-warm-600 sm:mt-4">
                {t("home.heroTitleLine1")}
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> </span>
                {t("home.heroTitleLine2")}
              </span>
            </h1>

            <p className="animate-home-fade-up mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-stone-600/90 sm:mt-6 sm:text-lg [animation-delay:140ms]">
              {t("home.heroSub")}
            </p>

            <div className="animate-home-fade-up mt-10 flex flex-col items-stretch justify-center gap-3 sm:mt-12 sm:flex-row sm:items-center sm:gap-4 [animation-delay:210ms]">
              <Link to={musicTo} state={musicState} className={primaryCtaClass}>
                <span
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-home-shine"
                  aria-hidden
                />
                <Music2 className="relative h-4 w-4 opacity-95" />
                <span className="relative">
                  {authed ? t("home.ctaEnterMusic") : t("home.ctaLogin")}
                </span>
                <ChevronRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link to="/moments" className={secondaryCtaClass}>
                <ImageIcon className="h-4 w-4 opacity-90" />
                {t("home.ctaMoments")}
              </Link>
            </div>
          </section>

          <HomeMomentsTeaser />

          <section
            id="features"
            className="scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/40 bg-white/25 py-16 backdrop-blur-sm sm:py-20"
          >
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
              <div className="mb-10 text-center sm:mb-14">
                <h2 className="font-display text-2xl text-warm-600 sm:text-3xl">
                  {t("home.sectionFeaturesTitle")}
                </h2>
                <p className="mt-2 text-sm text-stone-600/85 sm:text-base">
                  {t("home.sectionFeaturesSub")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {FEATURE_ITEMS.map(({ key, icon: Icon }) => (
                  <div
                    key={key}
                    className="group flex gap-4 rounded-[1.35rem] border border-white/60 bg-white/50 p-5 text-left shadow-[0_8px_28px_rgba(244,114,140,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_14px_36px_rgba(244,114,140,0.12)] sm:p-6"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-500 transition group-hover:scale-105 group-hover:bg-rose-500 group-hover:text-white sm:h-12 sm:w-12">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-warm-600">
                        {t(`homeFeatures.${key}.title`)}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-600/90">
                        {t(`homeFeatures.${key}.body`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rose-200/70 bg-rose-50/50 px-5 py-4 text-center text-sm text-stone-600/90 sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
                <MessageCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{t("home.featuresFuture")}</span>
              </div>
            </div>
          </section>

          <section
            id="dev-diary-intro"
            className="scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/30 bg-gradient-to-b from-rose-50/40 to-transparent py-16 sm:py-20"
          >
            <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-500/85">
                {t("home.devDiaryKicker")}
              </p>
              <h2 className="font-display text-2xl text-warm-600 sm:text-3xl">
                {t("home.devDiaryTitle")}
              </h2>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-stone-600/90 sm:text-base">
                {t("home.devDiarySub")}
              </p>
              <Link
                to="/dev-diary"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(244,63,94,0.32)] transition hover:bg-rose-600"
              >
                {t("home.devDiaryCta")}
              </Link>
            </div>
          </section>

          <section id="steps" className="scroll-mt-24 sm:scroll-mt-28 relative z-10 py-16 sm:py-20">
            <div className="mx-auto max-w-3xl px-5 sm:px-8">
              <h2 className="text-center font-display text-2xl text-warm-600 sm:text-3xl">
                {t("home.sectionStepsTitle")}
              </h2>
              <p className="mt-2 text-center text-sm text-stone-600/85">{t("home.sectionStepsSub")}</p>
              <ol className="mt-10 space-y-0">
                {STEP_KEYS.map((k, i) => (
                  <li key={k} className="flex gap-4 sm:gap-6">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-sm font-semibold text-white shadow-md shadow-rose-300/40">
                        {String(i + 1)}
                      </div>
                      {i < STEP_KEYS.length - 1 ? (
                        <div className="min-h-[2.5rem] w-px flex-1 bg-gradient-to-b from-rose-300/70 to-rose-100/40" />
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
            className="scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/30 bg-stone-900/[0.025] py-16 sm:py-20"
          >
            <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
              <div className="mb-4 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-white/55 px-4 py-1.5 text-xs text-stone-500 backdrop-blur">
                  <CircleDot className="h-3.5 w-3.5 text-rose-400" />
                  {t("home.aboutBadge")}
                </div>
              </div>
              <h2 className="font-display text-xl text-warm-600 sm:text-2xl">
                {t("home.aboutTitle", { name: FOR_NAME })}
              </h2>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-stone-600/90 sm:text-base">
                {t("home.aboutP1", { name: FOR_NAME })}
              </p>
              <p className="mt-3 text-pretty text-sm text-stone-500/90">
                {t("home.aboutP2", { name: FOR_NAME })}
              </p>
              <div className="mt-10">
                <Link
                  to={musicTo}
                  state={musicState}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-7 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(244,63,94,0.3)] transition hover:bg-rose-600"
                >
                  {authed ? t("home.openMusic") : t("home.goLogin")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 border-t border-white/25 bg-white/15 px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-8 text-center text-xs text-stone-500 backdrop-blur-sm">
          <p className="font-display text-sm text-stone-600/90">
            {t("home.footerTitle", { name: FOR_NAME })}
          </p>
          <p className="mt-2 text-stone-500">{t("home.footerSlogan")}</p>
          <p className="mt-3 text-stone-400">© {new Date().getFullYear()}</p>
          <p className="mt-4 border-t border-white/25 pt-4 text-[11px] leading-relaxed text-stone-500/90">
            <span className="text-stone-400">Powered with care</span>
            <span className="mx-1.5 text-stone-300/80">·</span>
            <span>{t("home.footerDev", { dev: DEVELOPER_NAME })}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
