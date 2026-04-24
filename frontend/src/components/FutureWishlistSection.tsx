import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles, UserRound, Wand2 } from "lucide-react";
import clsx from "clsx";
import {
  fetchWishlistEntries,
  submitWishlistEntry,
  type WishlistEntryDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";

export const WISH_PLAN_IDS = [
  "track-note",
  "listen-goal",
  "now-playing",
  "time-footprint",
  "visual-polish",
] as const;

const SECTION_ID = "wishlist";
const CONTENT_MAX = 500;
const NICK_MAX = 32;

type Props = {
  className?: string;
};

function displayName(t: (k: string) => string, n: WishlistEntryDto) {
  const s = n.nickname?.trim();
  return s && s.length > 0 ? s : t("common.anonymous");
}

export function FutureWishlistSection({ className }: Props) {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [entries, setEntries] = useState<WishlistEntryDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [draftNick, setDraftNick] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formatTime = useCallback(
    (ms: number) => new Date(ms).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" }),
    [dateLoc]
  );

  const load = useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const p = await fetchWishlistEntries(0, 50);
      setEntries(p.content);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const c = draftContent.trim();
    if (!c) {
      setFormErr(t("wishlist.emptyForm"));
      return;
    }
    setSubmitting(true);
    setFormErr(null);
    try {
      await submitWishlistEntry({ content: c, nickname: draftNick || null });
      setDraftContent("");
      await load();
    } catch (ex) {
      setFormErr(mapApiError(t, ex));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id={SECTION_ID}
      className={clsx(
        "scroll-mt-24 sm:scroll-mt-28 relative z-10 border-t border-white/30 bg-gradient-to-b from-white/15 to-white/[0.07] py-16 backdrop-blur-sm sm:py-20",
        className
      )}
      aria-labelledby="wishlist-heading"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="mb-2 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-white/45 px-4 py-1.5 text-xs font-medium text-rose-600/90 backdrop-blur">
            <Wand2 className="h-3.5 w-3.5" strokeWidth={2} />
            {t("wishlist.badge")}
          </div>
        </div>
        <h2 id="wishlist-heading" className="text-center font-display text-2xl text-warm-600 sm:text-3xl">
          {t("wishlist.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-relaxed text-stone-600/88">
          {t("wishlist.sub")}
        </p>

        <h3 className="mt-10 text-center text-sm font-medium text-warm-600/90">{t("wishlist.planSection")}</h3>
        <ul className="mt-4 space-y-3">
          {WISH_PLAN_IDS.map((id, index) => (
            <li
              key={id}
              className="group flex gap-3 rounded-2xl border border-white/55 bg-white/50 px-4 py-3.5 shadow-sm backdrop-blur transition hover:border-rose-200/60 hover:bg-white/65 sm:gap-4 sm:px-5 sm:py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100/85 text-xs font-semibold tabular-nums text-rose-600">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/80" />
                  <span className="font-medium leading-snug text-warm-600">{t(`wishlistPlans.${id}.title`)}</span>
                </div>
                <p className="mt-1.5 pl-[1.375rem] text-[13px] leading-relaxed text-stone-500/95">
                  {t(`wishlistPlans.${id}.hint`)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="mt-12 text-center text-sm font-medium text-warm-600/90">{t("wishlist.anonSection")}</h3>
        <p className="mx-auto mt-1 max-w-lg text-center text-xs text-stone-500/90">
          {t("wishlist.anonHint", { max: CONTENT_MAX })}
        </p>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mt-4 space-y-3 rounded-2xl border border-rose-200/50 bg-white/45 p-4 backdrop-blur sm:p-5"
        >
          <div>
            <label htmlFor="wish-nick" className="mb-1 block text-left text-xs text-stone-500">
              {t("wishlist.nickLabel")}
            </label>
            <input
              id="wish-nick"
              type="text"
              maxLength={NICK_MAX}
              value={draftNick}
              onChange={(e) => {
                setDraftNick(e.target.value);
                setFormErr(null);
              }}
              placeholder={t("wishlist.nickPh")}
              disabled={submitting}
              className="w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/50 disabled:opacity-60"
            />
            <p className="mt-0.5 text-right text-[10px] text-stone-400">{draftNick.length}/{NICK_MAX}</p>
          </div>
          <div>
            <label htmlFor="wish-content" className="mb-1 block text-left text-xs text-stone-500">
              {t("wishlist.contentLabel")}
            </label>
            <textarea
              id="wish-content"
              required
              rows={4}
              maxLength={CONTENT_MAX}
              value={draftContent}
              onChange={(e) => {
                setDraftContent(e.target.value);
                setFormErr(null);
              }}
              placeholder={t("wishlist.contentPh")}
              disabled={submitting}
              className="w-full resize-y rounded-xl border border-white/60 bg-white/80 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/50 disabled:opacity-60"
            />
            <p className="mt-0.5 text-right text-[10px] text-stone-400">{draftContent.length}/{CONTENT_MAX}</p>
          </div>
          {formErr ? <p className="text-center text-xs text-red-500/90">{formErr}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !draftContent.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-warm-500/90 px-5 py-2 text-sm font-medium text-white shadow-md transition hover:bg-warm-600 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? t("wishlist.submitting") : t("wishlist.submit")}
            </button>
          </div>
        </form>

        {listErr ? <p className="mt-4 text-center text-xs text-amber-700/90">{listErr}</p> : null}
        {listLoading ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("wishlist.loadingList")}
          </p>
        ) : (
          <ul className="mt-6 space-y-3" aria-label="wishlist entries">
            {entries.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-stone-200/80 bg-white/30 py-8 text-center text-sm text-stone-500">
                {t("wishlist.empty")}
              </li>
            ) : (
              entries.map((w) => (
                <li
                  key={w.id}
                  className="rounded-2xl border border-white/50 bg-white/40 px-4 py-3 text-left shadow-sm backdrop-blur sm:px-5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                    <span className="inline-flex items-center gap-1.5 text-stone-600">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      {displayName(t, w)}
                    </span>
                    <time className="shrink-0 tabular-nums" dateTime={new Date(w.createdAtMillis).toISOString()}>
                      {formatTime(w.createdAtMillis)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700/95">{w.content}</p>
                </li>
              ))
            )}
          </ul>
        )}

        <p className="mt-8 text-center text-[11px] text-stone-400/90">
          {t("wishlist.footerNote")}
        </p>
      </div>
    </section>
  );
}

export { SECTION_ID as WISHLIST_SECTION_ID };
