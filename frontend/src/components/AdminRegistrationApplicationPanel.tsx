import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import clsx from "clsx";
import {
  approveRegistrationApplication,
  fetchAdminRegistrationApplications,
  rejectRegistrationApplication,
  type RegistrationApplicationDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";

function statusPillClass(status: string): string {
  const s = status.toUpperCase();
  if (s === "PENDING") return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25";
  if (s === "APPROVED") return "bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/20";
  if (s === "REJECTED") return "bg-rose-500/12 text-rose-200 ring-1 ring-rose-500/20";
  return "bg-zinc-600/30 text-zinc-300 ring-1 ring-zinc-500/20";
}

function statusLabel(t: (k: string) => string, status: string): string {
  const s = status.toUpperCase();
  if (s === "PENDING") return t("admin.regAppStatusPending");
  if (s === "APPROVED") return t("admin.regAppStatusApproved");
  if (s === "REJECTED") return t("admin.regAppStatusRejected");
  return status;
}

export function AdminRegistrationApplicationPanel() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [list, setList] = useState<RegistrationApplicationDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchAdminRegistrationApplications(
        filter === "PENDING" ? "PENDING" : undefined
      );
      setList(data);
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setLoading(false);
    }
  }, [t, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDt = (ms: number) =>
    new Date(ms).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-zinc-500 sm:text-xs">{t("admin.regAppFilterHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-zinc-700/80 bg-zinc-950/70 p-0.5"
            role="group"
          >
            <button
              type="button"
              onClick={() => setFilter("PENDING")}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                filter === "PENDING"
                  ? "bg-violet-500/25 text-violet-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t("admin.regAppFilterPending")}
            </button>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                filter === "ALL"
                  ? "bg-violet-500/25 text-violet-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t("admin.regAppFilterAll")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600/60 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800/80"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("admin.refresh")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[12rem] flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400/80" />
          <span className="text-sm text-zinc-500">{t("common.loading")}</span>
        </div>
      ) : null}

      {err && !loading ? (
        <div className="mb-3 rounded-xl border border-red-500/25 bg-red-950/20 px-4 py-3 text-sm text-red-300/90">
          {err}
        </div>
      ) : null}

      {!loading && !err && list && list.length === 0 ? (
        <div className="flex min-h-[14rem] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-900/20 px-4 py-10 text-center">
          <Inbox className="h-9 w-9 text-zinc-600" strokeWidth={1.25} />
          <p className="text-sm text-zinc-500">{t("admin.regAppEmpty")}</p>
        </div>
      ) : null}

      {!loading && !err && list && list.length > 0 ? (
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          {list.map((a) => (
            <li
              key={a.id}
              className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/55"
            >
              <div className="flex flex-col gap-3 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-zinc-100">
                        {a.displayName?.trim() || a.email}
                      </h3>
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          statusPillClass(a.status)
                        )}
                      >
                        {statusLabel(t, a.status)}
                      </span>
                    </div>
                    <p className="mt-0.5 break-all text-xs text-zinc-500">{a.email}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">
                      #{a.id} · {formatDt(a.createdAt)}
                    </p>
                  </div>
                  {a.status.toUpperCase() === "PENDING" ? (
                    <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                      <button
                        type="button"
                        disabled={actionId === a.id}
                        onClick={async () => {
                          if (!window.confirm(t("admin.regAppApproveConfirm", { email: a.email }))) return;
                          setActionId(a.id);
                          try {
                            await approveRegistrationApplication(a.id);
                            await load();
                          } catch (e) {
                            alert(mapApiError(t, e));
                          } finally {
                            setActionId(null);
                          }
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50 sm:flex-initial"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {t("admin.regAppApprove")}
                      </button>
                      <button
                        type="button"
                        disabled={actionId === a.id}
                        onClick={async () => {
                          const reason = window.prompt(t("admin.regAppRejectPrompt"));
                          if (reason == null) return;
                          if (!reason.trim()) {
                            alert(t("admin.regAppRejectRequired"));
                            return;
                          }
                          setActionId(a.id);
                          try {
                            await rejectRegistrationApplication(a.id, reason);
                            await load();
                          } catch (e) {
                            alert(mapApiError(t, e));
                          } finally {
                            setActionId(null);
                          }
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50 sm:flex-initial"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("admin.regAppReject")}
                      </button>
                    </div>
                  ) : null}
                </div>
                {a.message ? (
                  <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
                    {a.message}
                  </p>
                ) : null}
                {a.status.toUpperCase() === "REJECTED" && a.resolutionNote ? (
                  <p className="text-xs text-rose-300/90">
                    {t("admin.regAppRejectReason")}: {a.resolutionNote}
                  </p>
                ) : null}
                {a.resolvedAt ? (
                  <p className="text-[10px] text-zinc-600">{t("admin.regAppResolvedAt", { time: formatDt(a.resolvedAt) })}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
