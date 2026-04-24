import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import clsx from "clsx";
import { createAdminUser, type UserRole } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { isAxiosError } from "axios";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function AdminUserCreateModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setDisplayName("");
    setPassword("");
    setPassword2("");
    setRole("USER");
    setErr(null);
  }, [open]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErr(t("admin.passwordMin6"));
      return;
    }
    if (password !== password2) {
      setErr(t("admin.passwordMismatch"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createAdminUser({
        email,
        password,
        displayName: displayName.trim() || null,
        role,
      });
      onCreated();
      onClose();
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        setErr(t("admin.emailExists"));
      } else {
        setErr(mapApiError(t, e));
      }
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
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.addUserTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form id={formId} onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500" htmlFor={`${formId}-email`}>
              {t("admin.colEmail")}
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500" htmlFor={`${formId}-name`}>
              {t("admin.colName")}
            </label>
            <input
              id={`${formId}-name`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("common.optional")}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none"
              maxLength={255}
            />
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
            <div className="mt-2 space-y-1 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2 text-[10px] leading-relaxed text-zinc-500">
              <p>
                <span className="font-medium text-zinc-400">{t("admin.roleUser")}</span>
                <span className="text-zinc-600"> — </span>
                {t("admin.roleHelpUser")}
              </p>
              <p>
                <span className="font-medium text-zinc-400">{t("admin.roleAdmin")}</span>
                <span className="text-zinc-600"> — </span>
                {t("admin.roleHelpAdmin")}
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500" htmlFor={`${formId}-pw`}>
              {t("admin.initialPasswordOnCreate")}
            </label>
            <input
              id={`${formId}-pw`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder={t("admin.passwordConfirmPh")}
              required
              minLength={6}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-zinc-600">{t("admin.initialPasswordOnCreateHint")}</p>
            <p className="mt-1.5 rounded-md border border-zinc-700/60 bg-zinc-900/60 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-500">
              {t("common.passwordNoRecoveryNote")}
            </p>
          </div>
        </form>

        {err ? <p className="mt-2 text-center text-xs text-red-400">{err}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? t("admin.saving") : t("admin.createUser")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
