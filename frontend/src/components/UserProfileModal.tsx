import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  X,
  LogOut,
  Camera,
  LayoutDashboard,
  Coins,
  Copy,
  Check,
} from "lucide-react";
import type { MeResponse } from "../api/client";
import {
  changeMyPassword,
  fetchMyPrivacySettings,
  updateMyPrivacySettings,
  uploadUserAvatar,
  userIsAdmin,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useAuth } from "../auth/AuthContext";
import { UserAvatar } from "./UserAvatar";

type Props = {
  open: boolean;
  onClose: () => void;
  user: MeResponse;
};

type TabId = "invite" | "security" | "privacy";

function Toggle({
  on,
  disabled,
  onClick,
  ariaLabel,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={on}
      className={clsx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-music-accent" : "bg-zinc-600/70",
        disabled && "opacity-50"
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          on ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function UserProfileModal({ open, onClose, user }: Props) {
  const { t } = useTranslation();
  const { refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const fileId = useId();
  const [imageVersion, setImageVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("invite");
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [recordLoginActivity, setRecordLoginActivity] = useState(true);
  const [recordPlayActivity, setRecordPlayActivity] = useState(true);
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPwdMsg(null);
    setPwdSuccess(false);
    setPwdOld("");
    setPwdNew("");
    setTab("invite");
    setInviteCopied(false);
    setPrivacyLoading(true);
    void (async () => {
      try {
        const p = await fetchMyPrivacySettings();
        setRecordLoginActivity(p.recordLoginActivity);
        setRecordPlayActivity(p.recordPlayActivity);
      } catch {
        /* keep defaults */
      } finally {
        setPrivacyLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr(t("userProfile.imageOnly"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await uploadUserAvatar(f);
      await refreshMe();
      setImageVersion((v) => v + 1);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t("userProfile.uploadFail"));
    } finally {
      setBusy(false);
    }
  };

  const onLogout = () => {
    logout();
    onClose();
    navigate("/login", { replace: true });
  };

  const onTogglePrivacy = async (field: "recordLoginActivity" | "recordPlayActivity", next: boolean) => {
    setPrivacyLoading(true);
    try {
      const updated = await updateMyPrivacySettings({ [field]: next });
      setRecordLoginActivity(updated.recordLoginActivity);
      setRecordPlayActivity(updated.recordPlayActivity);
      setErr(null);
    } catch (ex) {
      setErr(mapApiError(t, ex));
    } finally {
      setPrivacyLoading(false);
    }
  };

  const switchTab = (next: TabId) => {
    setTab(next);
    setErr(null);
    if (next !== "security") {
      setPwdMsg(null);
      setPwdSuccess(false);
      setPwdOld("");
      setPwdNew("");
    }
  };

  const displayName = user.displayName?.trim() || t("userProfile.noName");
  const beanLevel = user.beanLevelName?.trim();
  const tabs: { id: TabId; label: string }[] = [
    { id: "invite", label: t("userProfile.tabInvite") },
    { id: "security", label: t("userProfile.tabSecurity") },
    { id: "privacy", label: t("userProfile.tabPrivacy") },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-zinc-950/60 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(90dvh,640px)] w-full max-w-[22.5rem] flex-col overflow-hidden rounded-t-3xl border border-white/[0.08] bg-[#141820] text-zinc-200 shadow-[0_28px_80px_rgba(0,0,0,0.55)] sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Identity */}
        <div className="relative shrink-0 border-b border-white/[0.06]">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 85% 70% at 50% -30%, rgba(198,47,47,0.22), transparent 58%)",
            }}
          />
          <div className="relative flex items-center justify-between px-4 pt-3.5">
            <h2 id="profile-modal-title" className="text-[13px] font-semibold tracking-wide text-zinc-100">
              {t("userProfile.title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
              aria-label={t("common.cancel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex flex-col items-center px-5 pb-4 pt-3">
            {/* 头像区：等级角标关掉，避免与更换按钮重叠；等级改在豆值条展示 */}
            <div className="relative">
              <UserAvatar
                user={user}
                className="h-16 w-16 text-xl ring-2 ring-white/10"
                imageVersion={imageVersion}
                showLevelBadge={false}
              />
              <input
                id={fileId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => void onPickFile(e)}
              />
              <label
                htmlFor={fileId}
                className={clsx(
                  "absolute -bottom-1 -right-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-[#1a1f2a] text-zinc-200 shadow-md transition hover:bg-zinc-800 hover:text-white",
                  busy && "pointer-events-none opacity-50"
                )}
                title={t("userProfile.changeAvatar")}
              >
                <Camera className="h-3.5 w-3.5" />
                <span className="sr-only">{busy ? t("userProfile.uploading") : t("userProfile.changeAvatar")}</span>
              </label>
            </div>

            <p className="mt-3 max-w-full truncate text-[15px] font-semibold tracking-tight text-zinc-50">
              {displayName}
            </p>
            <p className="mt-0.5 max-w-full truncate text-[12px] text-zinc-500">{user.email}</p>

            <div className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-400/15 bg-amber-500/[0.1] px-3 py-1 text-[11px] text-amber-100">
              <Coins className="h-3.5 w-3.5 shrink-0 opacity-90" />
              <span className="text-amber-200/75">{t("userProfile.beanBalance")}</span>
              <span className="font-semibold tabular-nums text-amber-50">{user.beanBalance ?? 0}</span>
              {beanLevel ? (
                <>
                  <span className="text-amber-200/35">·</span>
                  <span className="truncate text-amber-200/70">{beanLevel}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Tabs — 分区切换，避免手风琴撑高整页滚动 */}
          <div className="relative px-3 pb-3" role="tablist" aria-label={t("userProfile.title")}>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1 ring-1 ring-white/[0.06]">
              {tabs.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchTab(id)}
                    className={clsx(
                      "rounded-lg px-2 py-2 text-center text-[12px] font-medium transition",
                      active
                        ? "bg-white/[0.1] text-zinc-50 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel */}
        <div
          className="profile-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5"
          role="tabpanel"
        >
          {tab === "invite" ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-zinc-100">{t("userProfile.inviteTitle")}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t("userProfile.inviteHint")}</p>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium",
                    user.inviteCodeUsed
                      ? "bg-amber-500/15 text-amber-200/90"
                      : "bg-emerald-500/15 text-emerald-300/90"
                  )}
                >
                  {user.inviteCodeUsed ? t("userProfile.inviteStatusUsed") : t("userProfile.inviteStatusOpen")}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-black/25 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                    {t("userProfile.inviteCodeLabel")}
                  </p>
                  <code className="mt-0.5 block truncate font-mono text-[15px] font-semibold tracking-[0.18em] text-zinc-100">
                    {user.inviteCode || "—"}
                  </code>
                </div>
                <button
                  type="button"
                  disabled={!user.inviteCode}
                  onClick={() => {
                    if (!user.inviteCode) return;
                    void navigator.clipboard.writeText(user.inviteCode).then(() => {
                      setInviteCopied(true);
                      window.setTimeout(() => setInviteCopied(false), 1600);
                    });
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2 text-[11px] font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
                >
                  {inviteCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {inviteCopied ? t("userProfile.inviteCopied") : t("userProfile.inviteCopy")}
                </button>
              </div>

              <p className="text-[11px] text-zinc-500">
                {user.inviteCodeUsed
                  ? t("userProfile.inviteUsed", { name: user.inviteeLabel || "—" })
                  : t("userProfile.inviteUnused")}
              </p>
            </div>
          ) : null}

          {tab === "security" ? (
            <form
              className="space-y-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                setPwdMsg(null);
                setPwdSuccess(false);
                if (pwdNew.length < 6) {
                  setPwdMsg(t("userProfile.newPasswordHint"));
                  return;
                }
                setPwdBusy(true);
                void (async () => {
                  try {
                    await changeMyPassword(pwdOld, pwdNew);
                    setPwdOld("");
                    setPwdNew("");
                    setPwdMsg(t("userProfile.passwordChangeOk"));
                    setPwdSuccess(true);
                  } catch (ex) {
                    setPwdMsg(mapApiError(t, ex));
                  } finally {
                    setPwdBusy(false);
                  }
                })();
              }}
            >
              <p className="text-[13px] font-medium text-zinc-100">{t("userProfile.changePassword")}</p>
              <input
                type="password"
                autoComplete="current-password"
                value={pwdOld}
                onChange={(e) => setPwdOld(e.target.value)}
                placeholder={t("userProfile.currentPassword")}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-music-accent/40 focus:ring-2 focus:ring-music-accent/20"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                placeholder={t("userProfile.newPassword")}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-music-accent/40 focus:ring-2 focus:ring-music-accent/20"
              />
              <p className="text-[10px] text-zinc-600">{t("userProfile.newPasswordHint")}</p>
              <p className="text-[10px] leading-relaxed text-zinc-500">{t("common.passwordNoRecoveryNote")}</p>
              {pwdMsg ? (
                <p className={clsx("text-[11px]", pwdSuccess ? "text-emerald-400/90" : "text-amber-400/90")}>
                  {pwdMsg}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pwdBusy || !pwdOld || !pwdNew}
                className="w-full rounded-xl bg-white/[0.08] py-2.5 text-[12px] font-medium text-zinc-100 transition hover:bg-white/[0.12] disabled:opacity-40"
              >
                {pwdBusy ? t("common.loading") : t("userProfile.submitPasswordChange")}
              </button>
            </form>
          ) : null}

          {tab === "privacy" ? (
            <div className="space-y-3">
              <div>
                <p className="text-[13px] font-medium text-zinc-100">{t("userProfile.privacy")}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t("userProfile.privacyHint")}</p>
              </div>
              <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-black/20">
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-snug text-zinc-200">
                      {t("userProfile.recordLoginTitle")}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                      {t("userProfile.recordBeanNote")}
                    </p>
                  </div>
                  <Toggle
                    on={recordLoginActivity}
                    disabled={privacyLoading}
                    onClick={() => void onTogglePrivacy("recordLoginActivity", !recordLoginActivity)}
                    ariaLabel={t("userProfile.recordLogin")}
                  />
                </div>
                <div className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium leading-snug text-zinc-200">
                      {t("userProfile.recordPlayTitle")}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                      {t("userProfile.recordBeanNote")}
                    </p>
                  </div>
                  <Toggle
                    on={recordPlayActivity}
                    disabled={privacyLoading}
                    onClick={() => void onTogglePrivacy("recordPlayActivity", !recordPlayActivity)}
                    ariaLabel={t("userProfile.recordPlay")}
                  />
                </div>
              </div>
              <Link
                to="/account/privacy"
                onClick={() => onClose()}
                className="inline-flex text-[11px] text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline"
              >
                {t("userProfile.privacyMore")}
              </Link>
            </div>
          ) : null}

          {err ? (
            <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-[11px] text-red-300">
              {err}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-2 border-t border-white/[0.06] bg-black/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {userIsAdmin(user) ? (
            <Link
              to="/admin"
              onClick={() => onClose()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] py-2.5 text-[12px] font-medium text-zinc-200 transition hover:bg-white/[0.09]"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t("userProfile.openAdmin")}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("userProfile.logout")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
