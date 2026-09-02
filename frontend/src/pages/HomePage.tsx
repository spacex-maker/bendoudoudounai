import { Link } from "react-router-dom";
import {
  ChevronRight,
  Cloud,
  Compass,
  Heart,
  History,
  ListMusic,
  Maximize2,
  Mic2,
  Music2,
  Radio,
  ShieldCheck,
  Type,
  Users,
  BarChart3,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { SiteHeader } from "../components/SiteHeader";
import { DEVELOPER_NAME, PRODUCT_NAME, AIMATEX_SIBLING_SITES } from "../siteMeta";

const FEATURE_ITEMS = [
  { key: "0", icon: Compass },
  { key: "1", icon: ListMusic },
  { key: "2", icon: Users },
  { key: "3", icon: Cloud },
  { key: "4", icon: ShieldCheck },
  { key: "5", icon: BarChart3 },
] as const;

const MODULE_ITEMS = [
  { key: "discover", icon: Radio, path: "/music/discover" },
  { key: "liked", icon: Heart, path: "/music/liked" },
  { key: "history", icon: History, path: "/music/history" },
  { key: "playlist", icon: ListMusic, path: "/music" },
] as const;

const IMMERSIVE_POINTS = [
  { key: "0", icon: Maximize2 },
  { key: "1", icon: Mic2 },
  { key: "2", icon: Type },
] as const;

const STEP_KEYS = ["0", "1", "2"] as const;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function HomePage() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const authed = state.status === "authed";
  const musicTo = authed ? "/music" : "/login";
  const musicState = authed ? undefined : { from: "/music" };
  const [headerTone, setHeaderTone] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    const timer = window.setTimeout(() => scrollToId(id), 60);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const updateTone = () => {
      const features = document.getElementById("features");
      const immersive = document.getElementById("immersive");
      if (!features) {
        setHeaderTone("dark");
        return;
      }
      const featTop = features.getBoundingClientRect().top;
      const immTop = immersive?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      // 仅在浅色「能力」区停留时用亮顶栏；沉浸及之后的深色区切回暗顶栏
      setHeaderTone(featTop <= 72 && immTop > 72 ? "light" : "dark");
    };
    updateTone();
    window.addEventListener("scroll", updateTone, { passive: true });
    window.addEventListener("resize", updateTone);
    return () => {
      window.removeEventListener("scroll", updateTone);
      window.removeEventListener("resize", updateTone);
    };
  }, []);

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip bg-[#0b0d10] font-sans text-ink-50">
      <SiteHeader tone={headerTone} />

      <main className="relative z-10">
        {/* Hero — full-bleed stage */}
        <section className="relative flex min-h-dvh flex-col justify-end overflow-hidden pb-16 pt-[5.5rem] sm:pb-20 sm:pt-[6rem]">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_70%_35%,rgba(198,47,47,0.34),transparent_55%),radial-gradient(ellipse_60%_50%_at_15%_80%,rgba(56,189,248,0.08),transparent_50%),linear-gradient(165deg,#12151b_0%,#0b0d10_55%,#070809_100%)]" />
            <div
              className="absolute inset-0 opacity-[0.28] animate-land-grid"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
                backgroundSize: "56px 56px",
                maskImage: "radial-gradient(ellipse 75% 65% at 55% 40%, #000 15%, transparent 72%)",
              }}
            />
            {/* Full-bleed vinyl plane */}
            <div className="absolute -right-[18%] top-[8%] h-[min(92vw,44rem)] w-[min(92vw,44rem)] sm:-right-[12%] sm:top-[4%]">
              <div className="absolute inset-[-6%] rounded-full border border-white/10 animate-land-spin-slow" />
              <div className="absolute inset-[4%] rounded-full border border-dashed border-white/15 animate-land-spin" />
              <div className="absolute inset-[12%] animate-land-spin rounded-full bg-[conic-gradient(from_200deg,#2a2f36_0%,#0f1115_22%,#4a1515_44%,#151a20_68%,#2a2f36_100%)] shadow-[0_0_80px_rgba(198,47,47,0.25)] ring-1 ring-white/10">
                <div className="absolute inset-[7%] rounded-full border border-white/[0.05]" />
                <div className="absolute inset-[14%] rounded-full border border-white/[0.04]" />
                <div className="absolute inset-[22%] rounded-full bg-[#0b0d10]/95 ring-1 ring-white/5" />
                <div className="absolute inset-[44%] rounded-full bg-netease-accent" />
                <div className="absolute inset-[50%] rounded-full bg-[#0b0d10]" />
              </div>
              <div className="absolute inset-[8%] rounded-full border border-netease-accent/25 animate-land-pulse-ring" />
            </div>
            <div className="absolute bottom-[18%] left-[6%] flex items-end gap-1.5 opacity-80 sm:left-[10%]">
              {[0.45, 0.8, 0.35, 1, 0.55, 0.9, 0.4, 0.7, 1, 0.5, 0.85, 0.3, 0.65].map((h, i) => (
                <span
                  key={i}
                  className="w-1 origin-bottom rounded-full bg-netease-accent/85 animate-land-eq sm:w-1.5"
                  style={{ height: `${14 + h * 42}px`, animationDelay: `${i * 0.07}s` }}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10">
            <p
              className="animate-land-fade-up font-display text-[clamp(2.6rem,11vw,6.75rem)] font-extrabold leading-[0.92] tracking-[-0.06em] text-white"
            >
              {PRODUCT_NAME}
            </p>
            <p
              className="animate-land-fade-up mt-5 max-w-[18ch] font-display text-2xl font-bold leading-tight tracking-tight text-white/90 sm:mt-7 sm:text-3xl md:text-4xl"
              style={{ animationDelay: "90ms" }}
            >
              {t("home.heroTitle")}
            </p>
            <p
              className="animate-land-fade-up mt-4 max-w-[36ch] text-sm leading-relaxed text-white/55 sm:mt-5 sm:text-base"
              style={{ animationDelay: "160ms" }}
            >
              {t("home.heroSub")}
            </p>
            <div
              className="animate-land-fade-up mt-9 flex flex-col gap-3 sm:mt-11 sm:flex-row sm:items-center"
              style={{ animationDelay: "240ms" }}
            >
              <Link
                to={musicTo}
                state={musicState}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-netease-accent px-8 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(198,47,47,0.35)] transition hover:brightness-110"
              >
                <span
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-land-shine"
                  aria-hidden
                />
                <span className="relative">{authed ? t("home.ctaEnterMusic") : t("home.ctaLogin")}</span>
                <ChevronRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <button
                type="button"
                onClick={() => scrollToId("features")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                {t("home.ctaFeatures")}
              </button>
            </div>
          </div>
        </section>

        {/* Features — editorial rows, no cards */}
        <section id="features" className="scroll-mt-24 border-t border-white/10 bg-[#f3f4f6] py-20 text-ink-900 sm:scroll-mt-28 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-netease-accent">
              {t("home.sectionFeaturesTitle")}
            </p>
            <h2 className="mt-3 max-w-[16ch] font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
              {t("home.sectionFeaturesSub")}
            </h2>
            <ul className="mt-14 divide-y divide-ink-900/10 border-y border-ink-900/10">
              {FEATURE_ITEMS.map(({ key, icon: Icon }, i) => (
                <li key={key} className="grid gap-4 py-8 sm:grid-cols-[4.5rem_minmax(0,0.9fr)_minmax(0,1.2fr)] sm:items-start sm:gap-8 sm:py-10">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-ink-900/15 sm:text-4xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-5 w-5 shrink-0 text-netease-accent" strokeWidth={1.75} />
                    <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                      {t(`homeFeatures.${key}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-700/80 sm:pt-1 sm:text-base">
                    {t(`homeFeatures.${key}.body`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Immersive / home KTV */}
        <section
          id="immersive"
          className="relative scroll-mt-24 overflow-hidden border-t border-white/10 bg-[#0b0d10] py-20 sm:scroll-mt-28 sm:py-28"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_80%_20%,rgba(198,47,47,0.22),transparent_55%),radial-gradient(ellipse_50%_40%_at_10%_90%,rgba(56,189,248,0.07),transparent_50%)]" />
            <div
              className="absolute inset-x-0 top-1/3 h-px opacity-40"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(253,164,175,0.35), transparent)",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-netease-accent">
              {t("home.sectionImmersiveTitle")}
            </p>
            <h2 className="mt-3 max-w-[14ch] font-display text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
              {t("home.sectionImmersiveHeadline")}
            </h2>
            <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-white/55 sm:mt-6 sm:text-base">
              {t("home.sectionImmersiveSub")}
            </p>

            <div className="mt-14 grid gap-10 border-t border-white/10 pt-12 sm:grid-cols-3 sm:gap-8">
              {IMMERSIVE_POINTS.map(({ key, icon: Icon }) => (
                <div key={key}>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-netease-accent ring-1 ring-white/10">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-white sm:text-xl">
                    {t(`homeImmersive.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {t(`homeImmersive.${key}.body`)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col gap-3 sm:mt-14 sm:flex-row sm:items-center">
              <Link
                to={musicTo}
                state={musicState}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-netease-accent px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(198,47,47,0.3)] transition hover:brightness-110"
              >
                {t("home.sectionImmersiveCta")}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <p className="text-xs text-white/35 sm:max-w-[28ch] sm:text-[13px]">
                {t("home.sectionImmersiveNote")}
              </p>
            </div>
          </div>
        </section>

        {/* Modules — full-bleed dark band */}
        <section id="modules" className="scroll-mt-24 border-t border-white/10 bg-[#0b0d10] py-20 sm:scroll-mt-28 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-netease-accent">
              {t("home.sectionModulesTitle")}
            </p>
            <h2 className="mt-3 max-w-[18ch] font-display text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
              {t("home.sectionModulesSub")}
            </h2>
            <div className="mt-12 space-y-0 border-t border-white/10">
              {MODULE_ITEMS.map(({ key, icon: Icon, path }) => (
                <Link
                  key={key}
                  to={authed ? path : "/login"}
                  state={authed ? undefined : { from: path }}
                  className="group flex items-center gap-4 border-b border-white/10 py-7 transition hover:bg-white/[0.03] sm:gap-6 sm:py-9"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white transition group-hover:bg-netease-accent sm:h-14 sm:w-14">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
                      {t(`homeModules.${key}.title`)}
                    </span>
                    <span className="mt-1 block text-sm text-white/45 sm:text-base">
                      {t(`homeModules.${key}.body`)}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/25 transition group-hover:translate-x-1 group-hover:text-netease-accent" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section
          id="steps"
          className="scroll-mt-24 border-t border-white/10 bg-netease-accent py-20 text-white sm:scroll-mt-28 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10">
            <h2 className="font-display text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">
              {t("home.sectionStepsTitle")}
            </h2>
            <p className="mt-3 max-w-[36ch] text-sm text-white/75 sm:text-base">{t("home.sectionStepsSub")}</p>
            <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {STEP_KEYS.map((k, i) => (
                <li key={k}>
                  <div className="font-display text-5xl font-extrabold tabular-nums text-white/25 sm:text-6xl">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold tracking-tight">
                    {t(`homeSteps.${k}.label`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t(`homeSteps.${k}.sub`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing */}
        <section className="relative overflow-hidden border-t border-white/10 bg-[#0b0d10] py-24 sm:py-32">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(198,47,47,0.28), transparent 60%)",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <Music2 className="mx-auto h-8 w-8 text-netease-accent" />
            <h2 className="mt-6 font-display text-[clamp(2rem,6vw,3.75rem)] font-extrabold tracking-[-0.05em] text-white">
              {t("home.closingTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-[34ch] text-sm text-white/50 sm:text-base">{t("home.closingSub")}</p>
            <div className="mt-10">
              <Link
                to={musicTo}
                state={musicState}
                className={clsx(
                  "group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-10 py-4 text-sm font-semibold text-white transition",
                  "bg-netease-accent shadow-[0_16px_40px_rgba(198,47,47,0.35)] hover:brightness-110"
                )}
              >
                <span
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-land-shine"
                  aria-hidden
                />
                <span className="relative">{authed ? t("home.openMusic") : t("home.goLogin")}</span>
                <ChevronRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#070809] px-4 pt-10 pb-[calc(2.25rem+env(safe-area-inset-bottom,0px))] text-center text-xs text-white/40">
        <p className="font-display text-sm font-bold tracking-tight text-white">{t("home.footerTitle")}</p>
        <p className="mt-2 text-white/45">{t("home.footerSlogan")}</p>

        <div className="mx-auto mt-8 max-w-2xl border-t border-white/10 pt-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
            {t("home.footerProducts")}
          </p>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
            {AIMATEX_SIBLING_SITES.map((site, i) => (
              <li key={site.href} className="inline-flex items-center">
                {i > 0 ? <span className="mx-2 text-white/15" aria-hidden>·</span> : null}
                <a
                  href={site.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-medium text-white/55 transition hover:text-white"
                >
                  {site.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-white/25">© {new Date().getFullYear()} {PRODUCT_NAME}</p>
        <p className="mt-4 border-t border-white/10 pt-4 text-[11px] text-white/30">
          {t("home.footerDev", { dev: DEVELOPER_NAME })}
        </p>
      </footer>
    </div>
  );
}
