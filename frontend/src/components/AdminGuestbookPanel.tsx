import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { fetchAdminGuestbookThreads, type GuestbookMessageDto } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";

function nickLabel(n: string | null | undefined, t: (k: string) => string) {
  const s = n?.trim();
  return s ? s : t("admin.guestbookAnon");
}

export function AdminGuestbookPanel() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<GuestbookMessageDto[] | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadBusy, setLoadBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const pageSize = 15;

  const load = useCallback(
    async (p: number, opts?: { soft?: boolean }) => {
      const soft = opts?.soft ?? false;
      if (soft) setLoadBusy(true);
      else setLoading(true);
      setErr(null);
      try {
        const data = await fetchAdminGuestbookThreads(p, pageSize);
        setRows(data.content);
        setTotalPages(Math.max(0, data.totalPages));
        setPage(data.number);
      } catch (e) {
        setErr(mapApiError(t, e));
        setRows([]);
      } finally {
        setLoading(false);
        setLoadBusy(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" });

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:mb-4">
        <button
          type="button"
          onClick={() => void load(page, { soft: true })}
          disabled={loadBusy || loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600/80 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 sm:py-1.5"
        >
          {loadBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t("admin.refresh")}
        </button>
        <p className="text-[11px] text-zinc-500">
          {t("admin.guestbookPageInfo", { page: page + 1, total: Math.max(totalPages, 1) })}
        </p>
      </div>
      {err ? <p className="mb-3 text-xs text-red-400/90">{err}</p> : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin opacity-60" />
        </div>
      ) : rows != null && rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          {t("admin.guestbookEmpty")}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          {(rows ?? []).map((th) => {
            const isOpen = expanded.has(th.id);
            const replyCount = th.replies?.length ?? 0;
            const direct = th.visibleToUserId != null;
            return (
              <li key={th.id}>
                <article
                  className={clsx(
                    "overflow-hidden rounded-xl border bg-zinc-900/35",
                    direct ? "border-violet-500/35" : "border-zinc-800/90"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-800/80 px-3 py-2.5 sm:px-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-zinc-500">#{th.id}</span>
                        <time className="text-[11px] tabular-nums text-zinc-500">{formatTime(th.createdAtMillis)}</time>
                        {direct ? (
                          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                            {t("admin.guestbookVisibilityDirect")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-400">
                            {t("admin.guestbookVisibilityPublic")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-200">
                        <span className="text-zinc-500">{t("admin.guestbookColAuthor")}</span>{" "}
                        {nickLabel(th.nickname, t)}
                        {th.authorUserId != null ? (
                          <span className="ml-1.5 font-mono text-[11px] text-zinc-500">uid {th.authorUserId}</span>
                        ) : null}
                      </p>
                      {direct ? (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          <span className="text-zinc-500">{t("admin.guestbookColTarget")}</span>{" "}
                          {th.targetDisplayName?.trim() || `uid ${th.visibleToUserId}`}
                          {th.visibleToUserId != null ? (
                            <span className="ml-1 font-mono text-[11px] text-zinc-500">({th.visibleToUserId})</span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    {replyCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(th.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700/80 px-2 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {t("admin.guestbookRepliesCount", { count: replyCount })}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-zinc-600">{t("admin.guestbookNoReplies")}</span>
                    )}
                  </div>
                  <div className="px-3 py-3 sm:px-4">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">{th.content}</p>
                  </div>
                  {isOpen && replyCount > 0 ? (
                    <ul className="border-t border-zinc-800/80 bg-black/20 px-3 py-2 sm:px-4">
                      {th.replies.map((r) => (
                        <li key={r.id} className="border-b border-zinc-800/60 py-2 last:border-b-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-mono text-[10px] text-zinc-600">#{r.id}</span>
                            <time className="text-[10px] tabular-nums text-zinc-600">{formatTime(r.createdAtMillis)}</time>
                            <span className="text-sm text-zinc-300">{nickLabel(r.nickname, t)}</span>
                            {r.authorUserId != null ? (
                              <span className="font-mono text-[10px] text-zinc-600">uid {r.authorUserId}</span>
                            ) : null}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap pl-0 text-[13px] leading-relaxed text-zinc-400">{r.content}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-zinc-800/80 pt-4">
          <button
            type="button"
            disabled={page <= 0 || loading || loadBusy}
            onClick={() => void load(page - 1)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {t("admin.guestbookPrev")}
          </button>
          <span className="text-[11px] text-zinc-500">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1 || loading || loadBusy}
            onClick={() => void load(page + 1)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
          >
            {t("admin.guestbookNext")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
