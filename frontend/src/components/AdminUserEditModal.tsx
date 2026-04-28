import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import clsx from "clsx";
import {
  changeMyPassword,
  patchAdminUser,
  resetAdminUserPassword,
  type AdminUserRowDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { AdminRoleGuide } from "./AdminRoleGuide";

type Props = {
  open: boolean;
  user: AdminUserRowDto;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (u: AdminUserRowDto) => void;
};

export function AdminUserEditModal({ open, user, isSelf, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"UNKNOWN" | "MALE" | "FEMALE">("UNKNOWN");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [enabled, setEnabled] = useState(true);
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdNew2, setPwdNew2] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaultPwBusy, setDefaultPwBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(user.displayName?.trim() ?? "");
    setGender((user.gender ?? "UNKNOWN") as "UNKNOWN" | "MALE" | "FEMALE");
    setRole(user.role === "ADMIN" ? "ADMIN" : "USER");
    setEnabled(user.enabled);
    setPwdOld("");
    setPwdNew("");
    setPwdNew2("");
    setErr(null);
  }, [open, user]);

  if (!open) return null;

  const onResetToDefault = () => {
    if (!window.confirm(t("admin.resetPasswordConfirm", { email: user.email }))) return;
    setDefaultPwBusy(true);
    setErr(null);
    void (async () => {
      try {
        await resetAdminUserPassword(user.id);
        window.alert(t("admin.resetPasswordDone"));
      } catch (e) {
        setErr(mapApiError(t, e));
      } finally {
        setDefaultPwBusy(false);
      }
    })();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = pwdOld.trim();
    const b = pwdNew.trim();
    const c = pwdNew2.trim();
    const hasPw = Boolean(a || b || c);
    if (isSelf && hasPw) {
      if (!a || !b || !c) {
        setErr(t("admin.passwordFieldsIncomplete"));
        return;
      }
      if (b.length < 6) {
        setErr(t("admin.passwordMin6"));
        return;
      }
      if (b !== c) {
        setErr(t("admin.passwordMismatch"));
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      if (isSelf && hasPw) {
        await changeMyPassword(a, b);
      }
      const body: {
        displayName?: string | null;
        gender?: "UNKNOWN" | "MALE" | "FEMALE";
        role?: "USER" | "ADMIN";
        enabled?: boolean;
      } = {
        displayName: displayName.trim() || null,
        gender,
      };
      if (!isSelf) {
        body.role = role;
        body.enabled = enabled;
      }
      const updated = await patchAdminUser(user.id, body);
      onSaved(updated);
      onClose();
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700/80 bg-zinc-900 p-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.editTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy || defaultPwBusy}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-1 break-all text-xs text-zinc-500">{user.email}</p>
        {isSelf ? <p className="mb-3 text-[11px] text-amber-500/90">{t("admin.selfNote")}</p> : null}

        <form id={formId} onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500" htmlFor={`${formId}-name`}>
              {t("admin.colName")}
            </label>
            <input
              id={`${formId}-name`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
              maxLength={255}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              性别
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-zinc-700 bg-zinc-950/80 p-1">
              {[
                { key: "UNKNOWN", label: "保密", tone: "text-zinc-300" },
                { key: "MALE", label: "男 ♂", tone: "text-sky-300" },
                { key: "FEMALE", label: "女 ♀", tone: "text-pink-300" },
              ].map((item) => {
                const active = gender === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setGender(item.key as "UNKNOWN" | "MALE" | "FEMALE")}
                    className={clsx(
                      "rounded-md px-2 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-zinc-800 ring-1 ring-violet-500/40"
                        : "text-zinc-500 hover:bg-zinc-800/70",
                      active && item.tone
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          {isSelf ? (
            <div className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5">
              <div className="text-[11px] font-medium text-zinc-400">{t("userProfile.changePassword")}</div>
              <input
                type="password"
                autoComplete="current-password"
                value={pwdOld}
                onChange={(e) => setPwdOld(e.target.value)}
                placeholder={t("userProfile.currentPassword")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                placeholder={t("userProfile.newPassword")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={pwdNew2}
                onChange={(e) => setPwdNew2(e.target.value)}
                placeholder={t("admin.passwordConfirmPh")}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
              />
              <p className="text-[10px] text-zinc-600">
                {t("userProfile.newPasswordHint")} · {t("admin.selfPasswordOptionalHint")}
              </p>
              <p className="mt-1.5 rounded-md border border-zinc-700/60 bg-zinc-900/60 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-500">
                {t("common.passwordNoRecoveryNote")}
              </p>
            </div>
          ) : null}
          {!isSelf ? (
            <>
              <div>
                <button
                  type="button"
                  onClick={onResetToDefault}
                  disabled={busy || defaultPwBusy}
                  className="w-full rounded-md border border-amber-800/50 bg-amber-950/30 px-2 py-1.5 text-left text-[11px] text-amber-200/90 hover:bg-amber-900/30 disabled:opacity-50"
                >
                  {t("admin.forgotPasswordReset")}
                </button>
                <p className="mt-1 text-[10px] text-zinc-600">{t("admin.forgotPasswordInEditNoteOther")}</p>
                <p className="mt-1.5 rounded-md border border-zinc-700/60 bg-zinc-900/60 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-500">
                  {t("common.passwordNoRecoveryNote")}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-zinc-500">{t("admin.colRole")}</span>
                <div className="flex gap-2">
                  {(["USER", "ADMIN"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        role === r
                          ? "bg-violet-500/30 text-violet-200"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      )}
                    >
                      {r === "ADMIN" ? t("admin.roleAdmin") : t("admin.roleUser")}
                    </button>
                  ))}
                </div>
                <AdminRoleGuide compact className="mt-2" />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                {t("admin.accountActive")}
              </label>
            </>
          ) : null}
        </form>

        {err ? <p className="mt-2 text-center text-xs text-red-400">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy || defaultPwBusy}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy || defaultPwBusy}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? t("admin.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
