import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil } from "lucide-react";
import { fetchAdminUsers, patchAdminUser, type AdminUserRowDto } from "../api/client";
import { useAuthedUser } from "../auth/AuthContext";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";
import { AdminUserEditModal } from "./AdminUserEditModal";
import { AdminUserRowIdentity } from "./AdminUserListPanel";
import clsx from "clsx";
import { adminTableActionTd, adminTableActionTh } from "./adminStickyTable";

function roleKeys(u: AdminUserRowDto): string[] {
  if (u.roles && u.roles.length > 0) return u.roles;
  return [u.role];
}

function hasDeveloper(u: AdminUserRowDto): boolean {
  return roleKeys(u).includes("DEVELOPER");
}

/**
 * 已授予 DEVELOPER 的用户；数据来自全站用户列表的筛选，编辑能力与用户管理一致。
 */
export function AdminDeveloperListPanel() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const me = useAuthedUser();
  const [rows, setRows] = useState<AdminUserRowDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<AdminUserRowDto | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchAdminUsers();
      setRows(data.filter(hasDeveloper));
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const mergeRow = (u: AdminUserRowDto) => {
    setRows((prev) => {
      if (prev == null) return prev;
      if (!hasDeveloper(u)) {
        return prev.filter((r) => r.id !== u.id);
      }
      return prev.map((r) => (r.id === u.id ? u : r));
    });
  };

  const formatJoined = (ms: number) =>
    new Date(ms).toLocaleString(dateLoc, { dateStyle: "medium", timeStyle: "short" });

  const roleLabel = (r: string) => {
    if (r === "ADMIN") return t("admin.roleAdmin");
    if (r === "DEVELOPER") return t("admin.roleDeveloper");
    return t("admin.roleUser");
  };

  const isSelf = (u: AdminUserRowDto) => me != null && u.id === me.id;

  const onToggleEnabled = async (u: AdminUserRowDto) => {
    if (isSelf(u)) return;
    setBusyId(u.id);
    setActionErr(null);
    try {
      const next = await patchAdminUser(u.id, { enabled: !u.enabled });
      mergeRow(next);
    } catch (e) {
      setActionErr(mapApiError(t, e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      {actionErr ? <p className="mb-2 text-xs text-red-400/90">{actionErr}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-800/90 bg-zinc-900/50">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            {t("common.loading")}
          </div>
        ) : err ? (
          <p className="p-6 text-center text-sm text-red-400/90">{err}</p>
        ) : !rows || rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">{t("admin.devListEmpty")}</p>
        ) : (
          <table className="w-full min-w-[40rem] border-collapse text-left text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-500 sm:px-4">{t("admin.colId")}</th>
                <th className="min-w-[10rem] px-3 py-2.5 font-medium text-zinc-500 sm:min-w-[12rem] sm:px-4">
                  {t("admin.colUser")}
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-500 sm:px-4">{t("admin.colRole")}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-500 sm:px-4">{t("admin.colStatus")}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-500 sm:px-4">{t("admin.colJoined")}</th>
                <th className={clsx(adminTableActionTh, "font-medium text-zinc-500")}>{t("admin.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const self = isSelf(u);
                const en = u.enabled !== false;
                return (
                  <tr key={u.id} className="group border-b border-zinc-800/60 transition hover:bg-zinc-800/40">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500 tabular-nums sm:px-4 sm:text-xs">
                      {u.id}
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <AdminUserRowIdentity u={u} />
                    </td>
                    <td className="px-3 py-2.5 sm:px-4">
                      <div className="flex max-w-[10rem] flex-wrap gap-0.5 sm:max-w-[14rem]">
                        {roleKeys(u).map((r) => (
                          <span
                            key={r}
                            className={clsx(
                              "whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-0.5",
                              r === "ADMIN"
                                ? "bg-violet-500/20 text-violet-300"
                                : r === "DEVELOPER"
                                  ? "bg-amber-500/20 text-amber-200"
                                  : "bg-zinc-700/60 text-zinc-400"
                            )}
                          >
                            {roleLabel(r)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          en ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400/90"
                        )}
                      >
                        {en ? t("admin.statusEnabled") : t("admin.statusDisabled")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500 tabular-nums sm:px-4">
                      {formatJoined(u.createdAtMillis)}
                    </td>
                    <td className={adminTableActionTd}>
                      <div
                        className={clsx(
                          "group/act inline-flex h-8 max-w-[14rem] items-stretch overflow-hidden rounded-md border text-[11px] sm:max-w-none sm:text-xs",
                          "border-zinc-600/50 bg-zinc-950/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setEditRow(u)}
                          disabled={busyId === u.id}
                          className="inline-flex flex-1 min-w-0 items-center justify-center gap-1.5 px-2.5 font-medium text-zinc-200 transition hover:bg-violet-500/10 hover:text-violet-100 focus-visible:relative focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-violet-500/60 focus-visible:ring-offset-0 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-35 sm:px-3"
                        >
                          <Pencil
                            className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition group-hover/act:text-violet-400/90"
                            strokeWidth={1.75}
                          />
                          <span className="truncate">{t("admin.editUser")}</span>
                        </button>
                        {!self ? (
                          <>
                            <div className="w-px shrink-0 bg-zinc-700/70" aria-hidden />
                            <button
                              type="button"
                              onClick={() => void onToggleEnabled(u)}
                              disabled={busyId === u.id}
                              className="shrink-0 px-2.5 text-zinc-500 transition hover:bg-zinc-800/90 hover:text-zinc-200 focus-visible:relative focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-zinc-500/50 focus-visible:ring-offset-0 focus-visible:ring-offset-zinc-950 disabled:opacity-35 sm:px-3"
                            >
                              {en ? t("admin.toggleDisable") : t("admin.toggleEnable")}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editRow ? (
        <AdminUserEditModal
          open
          user={editRow}
          isSelf={isSelf(editRow)}
          onClose={() => setEditRow(null)}
          onSaved={(u) => {
            mergeRow(u);
            setEditRow(null);
          }}
        />
      ) : null}
    </section>
  );
}
