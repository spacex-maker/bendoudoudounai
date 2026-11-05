import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Images } from "lucide-react";
import { useTranslation } from "react-i18next";
import { listMomentPhotos, type MomentPhotoDto } from "../api/client";

/** 首页片刻预览：几张安静画面，链到完整相册 */
export function HomeMomentsTeaser() {
  const { t } = useTranslation();
  const [items, setItems] = useState<MomentPhotoDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listMomentPhotos({ page: 0, size: 8, sort: "newest" })
      .then((res) => {
        if (!cancelled) setItems(res.content ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

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
          <Link
            to="/moments"
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/70 bg-white/60 px-4 py-2 text-sm text-warm-600 transition hover:bg-white/90"
          >
            {t("home.momentsCta")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="columns-2 gap-2.5 sm:columns-3 sm:gap-3 lg:columns-4">
          {items.map((m) => (
            <Link
              key={m.id}
              to="/moments"
              className="mb-2.5 block break-inside-avoid overflow-hidden rounded-2xl bg-white/40 shadow-sm ring-1 ring-white/50 transition hover:shadow-md sm:mb-3"
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
      </div>
    </section>
  );
}
