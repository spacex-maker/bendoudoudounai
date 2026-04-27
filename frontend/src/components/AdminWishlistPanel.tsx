import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { deleteAdminWishlistEntry, fetchAdminWishlistEntries, type WishlistEntryDto } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";
import clsx from "clsx";
import { adminTableActionTdWishlist, adminTableActionThWishlist } from "./adminStickyTable";

function nickOrAnon(n: string | null | undefined, t: (k: string) => string) {
  const s = n?.trim();
  return s ? s : t("admin.wishlistAnon");
}

export function AdminWishlistPanel() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<WishlistEntryDto[] | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadBusy, setLoadBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const pageSize = 30;

  const load = useCallback(
    async (p: number, opts?: { soft?: boolean }) => {
      const soft = opts?.soft ?? false;
      if (soft) setLoadBusy(true);
      else setLoading(true);
      setErr(null);
      try {
        const data = await fetchAdminWishlistEntries(p, pageSize);
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

  const onDelete = async (entry: WishlistEntryDto) => {
    if (!window.confirm(t("admin.wishlistDeleteConfirm", { id: entry.id }))) return;
    setDeletingId(entry.id);
    setActionErr(null);
    try {
      await deleteAdminWishlistEntry(entry.id);
      await load(page, { soft: true });
    } catch (e) {
      setActionErr(mapApiError(t, e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:mb-4">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-400/80" aria-hidden />
          <button
            type="button"
            onClick={() => void load(page, { soft: true })}
            disabled={loadBusy || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600/80 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 sm:py-1.5"
          >
            {loadBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("admin.refresh")}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          {t("admin.wishlistPageInfo", { page: page + 1, total: Math.max(totalPages, 1) })}
        </p>
      </div>
      {err ? <p className="mb-3 text-xs text-red-400/90">{err}</p> : null}
      {actionErr ? <p className="mb-3 text-xs text-red-400/90">{actionErr}</p> : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin opacity-60" />
        </div>
      ) : rows != null && rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          {t("admin.wishlistEmpty")}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950 pb-2 pr-3 font-medium">
                  {t("admin.wishlistColId")}
                </th>
                <th className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950 pb-2 pr-3 font-medium">
                  {t("admin.wishlistColTime")}
                </th>
                <th className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950 pb-2 pr-3 font-medium">
                  {t("admin.wishlistColNick")}
                </th>
                <th className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950 pb-2 pr-3 font-medium">
                  {t("admin.wishlistColContent")}
                </th>
                <th
                  className={clsx(
                    adminTableActionThWishlist,
                    "border-b border-zinc-800 pb-2 font-medium uppercase tracking-wide text-zinc-500"
                  )}
                >
                  {t("admin.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((row) => (
                <tr key={row.id} className="group border-b border-zinc-800/70 align-top">
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-zinc-500">#{row.id}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-[11px] tabular-nums text-zinc-400">
                    {formatTime(row.createdAtMillis)}
                  </td>
                  <td className="max-w-[10rem] py-2.5 pr-3 text-zinc-300">
                    <span className="line-clamp-2" title={nickOrAnon(row.nickname, t)}>
                      {nickOrAnon(row.nickname, t)}
                    </span>
                  </td>
                  <td className="max-w-xl py-2.5 text-zinc-300">
                    <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed" title={row.content}>
                      {row.content}
                    </p>
                  </td>
                  <td className={adminTableActionTdWishlist}>
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => void onDelete(row)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-900/50 bg-red-950/30 px-2 py-1 text-[11px] text-red-300/90 transition hover:border-red-700/60 hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {t("admin.wishlistDelete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
