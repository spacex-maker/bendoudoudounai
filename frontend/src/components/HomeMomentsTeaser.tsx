import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Images } from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { listMomentPhotos, type MomentPhotoDto } from "../api/client";

type Phase = "loading" | "ready" | "empty";

/** 首页片刻预览：浪漫加载态 + 几张安静画面，链到完整相册 */
export function HomeMomentsTeaser() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MomentPhotoDto[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    void listMomentPhotos({ page: 0, size: 8, sort: "newest" })
      .then((res) => {
        if (cancelled) return;
        const next = res.content ?? [];
        setItems(next);
        setPhase(next.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setPhase("empty");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "empty") return null;

  return (
    <section
      id="moments"
      className="scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/35 bg-gradient-to-b from-white/20 to-rose-50/30 py-14 sm:py-18"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end">
          <div className="max-w-lg">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500/85">
              <Images className="h-3.5 w-3.5" />
              {t("moments.nav")}
            </p>
            <h2 className="font-display text-2xl text-warm-600 sm:text-3xl">{t("home.momentsTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600/85 sm:text-base">{t("home.momentsSub")}</p>
          </div>
          {phase === "ready" ? (
            <Link
              to="/moments"
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/70 bg-white/60 px-4 py-2 text-sm text-warm-600 transition hover:bg-white/90"
            >
              {t("home.momentsCta")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {phase === "loading" ? (
          <div
            className="home-moments-loader relative overflow-hidden rounded-[1.75rem] border border-rose-100/70 bg-gradient-to-br from-rose-50/80 via-white/55 to-amber-50/45 px-6 py-14 sm:px-10 sm:py-16"
            role="status"
            aria-live="polite"
            aria-label={t("home.momentsLoading")}
          >
            <div className="pointer-events-none absolute inset-0 home-moments-loader__glow" aria-hidden />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={clsx("home-moments-loader__petal", reduceMotion && "home-moments-loader__petal--static")}
                  style={{ ["--i" as string]: String(i) }}
                />
              ))}
            </div>

            <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
              <div
                className={clsx(
                  "home-moments-loader__stack relative mb-7 h-28 w-28 sm:h-32 sm:w-32",
                  reduceMotion && "home-moments-loader__stack--static"
                )}
                aria-hidden
              >
                <span className="home-moments-loader__card home-moments-loader__card--a" />
                <span className="home-moments-loader__card home-moments-loader__card--b" />
                <span className="home-moments-loader__card home-moments-loader__card--c" />
                <span className="home-moments-loader__bloom" />
              </div>
              <p className="font-display text-lg text-warm-600/90 sm:text-xl">{t("home.momentsLoading")}</p>
              <p className="mt-1.5 text-xs tracking-[0.14em] text-rose-400/80 sm:text-sm">
                {t("home.momentsLoadingHint")}
              </p>
            </div>
          </div>
        ) : (
          <div className="columns-2 gap-2.5 sm:columns-3 sm:gap-3 lg:columns-4">
            {items.map((m, i) => (
              <Link
                key={m.id}
                to="/moments"
                className={clsx(
                  "home-moments-tile mb-2.5 block break-inside-avoid overflow-hidden rounded-2xl bg-white/40 shadow-sm ring-1 ring-white/50 transition hover:shadow-md sm:mb-3",
                  !reduceMotion && "home-moments-tile--enter"
                )}
                style={{ animationDelay: reduceMotion ? undefined : `${Math.min(i, 7) * 70}ms` }}
              >
                <img
                  src={m.thumbUrl || m.publicUrl}
                  alt=""
                  loading="lazy"
                  className="h-auto w-full object-cover"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}