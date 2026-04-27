import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookHeart, PenLine, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import {
  applyForDeveloperRole,
  fetchDevDiaryEntry,
  fetchDevDiaryPage,
  type DevDiaryListItemDto,
  userCanManageDevDiary,
  userIsAdmin,
  userIsDeveloper,
} from "../../api/client";
import { useAuth, useAuthedUser } from "../../auth/AuthContext";
import { SiteHeader } from "../../components/SiteHeader";
import { useDateLocale } from "../../i18n/useDateLocale";
import { mapApiError } from "../../i18n/mapApiError";

type ApplyPanel = "off" | "login" | "form" | "infoAdmin" | "infoDev";

function extractPreview(body: string | null | undefined): string {
  if (!body) return "";
  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain;
}

export function DevDiaryListPage() {
  const { t } = useTranslation();
  const { state } = useAuth();
  const user = useAuthedUser();
  const dateLoc = useDateLocale();
  const canManage = state.status === "authed" && userCanManageDevDiary(user);
  const canApply = state.status === "authed" && user != null && !userIsDeveloper(user);
  const isAdmin = state.status === "authed" && user != null && userIsAdmin(user);
  const [applyPanel, setApplyPanel] = useState<ApplyPanel>("off");
  const [applyMsg, setApplyMsg] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [items, setItems] = useState<DevDiaryListItemDto[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const size = 20;

  useEffect(() => {
    setLoading(true);
    setErr(null);
    setPreviews({});
    void fetchDevDiaryPage(page, size)
      .then(async (d) => {
        setItems(d.content);
        setTotal(d.totalElements);
        const previewRows = await Promise.all(
          d.content.map(async (row) => {
            try {
              const full = await fetchDevDiaryEntry(row.id);
              return [row.id, extractPreview(full.bodyMd)] as const;
            } catch {
              return [row.id, ""] as const;
            }
          })
        );
        setPreviews(Object.fromEntries(previewRows));
      })
      .catch((e) => setErr(mapApiError(t, e)))
      .finally(() => setLoading(false));
  }, [page, t]);

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-romantic-mesh text-warm-600">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:pt-28 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-rose-500/90">
              <BookHeart className="h-3.5 w-3.5" />
              {t("devDiary.kicker")}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl text-warm-600">{t("devDiary.listTitle")}</h1>
            <p className="mt-2 text-sm text-stone-600/90">{t("devDiary.listSub")}</p>
          </div>
          <div className="mt-1 flex max-w-[14rem] flex-col items-end gap-1.5 sm:max-w-[16rem]">
            {canManage ? (
              <Link
                to="/dev-diary/compose"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-rose-600"
              >
                <PenLine className="h-3 w-3" />
                {t("devDiary.writeNew")}
              </Link>
            ) : null}
            {state.status === "anon" ? (
              <button
                type="button"
                onClick={() => setApplyPanel("login")}
                className="rounded-full border border-rose-300/50 bg-white/60 px-3 py-1 text-[11px] font-medium text-rose-700/90 shadow-sm transition hover:bg-white"
              >
                {t("devDiary.applyCta")}
              </button>
            ) : canApply ? (
              <button
                type="button"
                onClick={() => setApplyPanel("form")}
                className="rounded-full border border-rose-300/50 bg-white/60 px-3 py-1 text-[11px] font-medium text-rose-700/90 shadow-sm transition hover:bg-white"
              >
                {t("devDiary.applyCta")}
              </button>
            ) : null}
            {isAdmin && canManage ? (
              <>
                <Link
                  to="/admin/developers/applications"
                  className="text-right text-[11px] font-medium text-violet-700/90 underline decoration-violet-300/50 underline-offset-2 hover:text-violet-900"
                >
                  {t("devDiary.applyTopAdminLink")}
                </Link>
                <button
                  type="button"
                  onClick={() => setApplyPanel("infoAdmin")}
                  className="text-[11px] text-stone-500 underline decoration-stone-300/50 underline-offset-2 hover:text-rose-700"
                >
                  {t("devDiary.applyInfoCta")}
                </button>
              </>
            ) : canManage && !isAdmin ? (
              <button
                type="button"
                onClick={() => setApplyPanel("infoDev")}
                className="text-[11px] text-stone-500 underline decoration-stone-300/50 underline-offset-2 hover:text-rose-700"
              >
                {t("devDiary.applyInfoCta")}
              </button>
            ) : null}
            {applyFeedback ? (
              <p className="max-w-[14rem] text-right text-[11px] text-emerald-700/90 sm:max-w-[16rem]">{applyFeedback}</p>
            ) : null}
          </div>
        </div>

        {applyPanel !== "off" ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
            onClick={() => {
              if (!applyBusy) setApplyPanel("off");
            }}
            role="presentation"
          >
            <div
              className="max-h-[min(88vh,36rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-zinc-900 p-5 text-left text-sm text-zinc-200 shadow-2xl sm:max-h-[min(88vh,40rem)] sm:p-6"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dev-diary-apply-title"
            >
              {applyPanel === "login" ? (
                <>
                  <h2 id="dev-diary-apply-title" className="text-base font-medium text-zinc-100">
                    {t("devDiary.applyLoginTitle")}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">{t("devDiary.applyLoginPrompt")}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setApplyPanel("off")}
                      className="rounded-full px-3 py-2 text-xs text-zinc-400"
                    >
                      {t("common.cancel")}
                    </button>
                    <Link
                      to="/login"
                      state={{ from: "/dev-diary" }}
                      onClick={() => setApplyPanel("off")}
                      className="inline-flex items-center justify-center rounded-full border border-rose-400/50 bg-rose-500/90 px-4 py-2 text-center text-xs font-medium text-white transition hover:bg-rose-600"
                    >
                      {t("devDiary.applyLoginCta")}
                    </Link>
                  </div>
                </>
              ) : null}

              {applyPanel === "form" && user ? (
                <>
                  <h2 id="dev-diary-apply-title" className="text-base font-medium text-zinc-100">
                    {t("devDiary.applyTitle")}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                    {isAdmin && canApply
                      ? t("devDiary.applyHintAdmin")
                      : t("devDiary.applyHint")}
                  </p>
                  {isAdmin && canApply ? (
                    <p className="mt-2 text-xs text-violet-300/90">
                      <Link
                        to="/admin/developers/applications"
                        onClick={() => setApplyPanel("off")}
                        className="font-medium underline decoration-violet-500/50 underline-offset-2 hover:text-violet-200"
                      >
                        {t("devDiary.applyFooterReviewCta")}
                      </Link>
                    </p>
                  ) : null}
                  <textarea
                    value={applyMsg}
                    onChange={(e) => setApplyMsg(e.target.value)}
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-200"
                    placeholder={t("devDiary.applyPlaceholder")}
                  />
                  {applyError ? <p className="mt-2 text-xs text-red-300">{applyError}</p> : null}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!applyBusy) setApplyPanel("off");
                      }}
                      className="rounded-full px-3 py-1.5 text-xs text-zinc-400"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={applyBusy}
                      onClick={async () => {
                        setApplyError(null);
                        setApplyBusy(true);
                        try {
                          await applyForDeveloperRole(applyMsg.trim() || undefined);
                          setApplyPanel("off");
                          setApplyMsg("");
                          setApplyFeedback(t("devDiary.applySuccess"));
                        } catch (e) {
                          setApplyError(mapApiError(t, e));
                        } finally {
                          setApplyBusy(false);
                        }
                      }}
                      className="rounded-full bg-rose-500 px-4 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      {applyBusy ? t("devDiary.applySending") : t("devDiary.applySubmit")}
                    </button>
                  </div>
                </>
              ) : null}

              {applyPanel === "infoAdmin" ? (
                <>
                  <h2 id="dev-diary-apply-title" className="text-base font-medium text-zinc-100">
                    {t("devDiary.applyFooterKicker")}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                    {t("devDiary.applyFooterAdminHint")}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setApplyPanel("off")}
                      className="rounded-full px-3 py-2 text-xs text-zinc-400"
                    >
                      {t("common.cancel")}
                    </button>
                    <Link
                      to="/admin/developers/applications"
                      onClick={() => setApplyPanel("off")}
                      className="inline-flex items-center justify-center rounded-full border border-violet-400/50 bg-violet-600/90 px-4 py-2 text-center text-xs font-medium text-white transition hover:bg-violet-600"
                    >
                      {t("devDiary.applyFooterAdminCta")}
                    </Link>
                  </div>
                </>
              ) : null}

              {applyPanel === "infoDev" ? (
                <>
                  <h2 id="dev-diary-apply-title" className="text-base font-medium text-zinc-100">
                    {t("devDiary.applyFooterKicker")}
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                    {t("devDiary.applyFooterDevOnlyHint")}
                  </p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setApplyPanel("off")}
                      className="rounded-full bg-zinc-800 px-4 py-2 text-xs text-zinc-200"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {loading ? <p className="text-sm text-stone-500">{t("common.loading")}</p> : null}
        {err ? <p className="text-sm text-rose-600">{err}</p> : null}

        <ul className="relative space-y-3">
          {items.map((e, idx) => (
            <li key={e.id} className="relative pl-8 sm:pl-32">
              {idx !== items.length - 1 ? (
                <span className="pointer-events-none absolute left-[11px] top-8 h-[calc(100%+0.75rem)] w-px bg-rose-200/70" aria-hidden />
              ) : null}
              <span className="pointer-events-none absolute left-[5px] top-6 h-3.5 w-3.5 rounded-full border border-rose-300/80 bg-rose-100/90 shadow-sm" aria-hidden />
              <span className="absolute left-8 top-4 hidden text-[11px] tabular-nums text-stone-500 sm:inline">
                {new Date(e.createdAtMillis).toLocaleDateString(dateLoc, { month: "2-digit", day: "2-digit" })}
              </span>
              <Link
                to={`/dev-diary/entry/${e.id}`}
                className="group flex flex-col gap-2 rounded-2xl border border-white/55 bg-white/55 px-4 py-3.5 text-left shadow-sm transition hover:bg-white/85 hover:shadow"
              >
                <span className="font-medium text-warm-600 group-hover:text-rose-600">{e.title}</span>
                <span className="text-[11px] text-stone-500">
                  {e.authorLabel} · {new Date(e.createdAtMillis).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <p className="line-clamp-2 text-xs leading-relaxed text-stone-600/95">
                  {(previews[e.id] || "").slice(0, 96) || t("devDiary.emptyBody")}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {!loading && total > size && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border border-warm-300/50 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {t("devDiary.prev")}
            </button>
            <span className="text-xs text-stone-500 tabular-nums">
              {page + 1} / {Math.max(1, Math.ceil(total / size))}
            </span>
            <button
              type="button"
              disabled={(page + 1) * size >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-warm-300/50 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {t("devDiary.next")}
            </button>
          </div>
        )}

        <Link
          to="/"
          className={clsx("mt-10 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-rose-600")}
        >
          <ChevronLeft className="h-4 w-4" />
          {t("common.backHome")}
        </Link>
      </main>
    </div>
  );
}
