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
import type { InviteCodeItemDto, MeResponse, MyInvitesDto } from "../api/client";
import {
  changeMyPassword,
  fetchMyInvites,
  fetchMyPrivacySettings,
  generateInviteCodes,
  updateMyPrivacySettings,
  uploadUserAvatar,
  userIsAdmin,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useAuth } from "../auth/AuthContext";
import { useDateLocale } from "../i18n/useDateLocale";
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
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
        on ? "justify-end bg-music-accent" : "justify-start bg-zinc-600/70",
        disabled && "opacity-50"
      )}
    >
      <span className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export function UserProfileModal({ open, onClose, user }: Props) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<MyInvitesDto | null>(null);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [genBusy, setGenBusy] = useState(false);
  const isAdmin = userIsAdmin(user);

  const reloadInvites = async () => {
    setInvitesLoading(true);
    try {
      setInvites(await fetchMyInvites());
    } catch (ex) {
      setErr(mapApiError(t, ex));
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPwdMsg(null);
    setPwdSuccess(false);
    setPwdOld("");
    setPwdNew("");
    setTab("invite");
    setCopiedCode(null);
    setGenCount(5);
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
    void reloadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅打开弹窗时刷新
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
      className="fixed inset-0 z-[130] flex items-end justify-center bg-zinc-950/65 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          "flex w-full flex-col overflow-hidden border border-white/[0.08] bg-[#141820] text-zinc-200 shadow-[0_28px_80px_rgba(0,0,0,0.55)]",
          "h-[min(94dvh,100%)] max-h-[94dvh] rounded-t-3xl border-b-0",
          "sm:h-auto sm:max-h-[min(88dvh,720px)] sm:max-w-[32rem] sm:rounded-3xl sm:border-b"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" aria-hidden />

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
          <div className="relative flex items-center justify-between px-4 pt-2.5 sm:px-6 sm:pt-4">
            <h2 id="profile-modal-title" className="text-[13px] font-semibold tracking-wide text-zinc-100 sm:text-sm">
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

          <div className="relative flex items-center gap-3 px-4 pb-3.5 pt-2 sm:gap-4 sm:px-6 sm:pb-5 sm:pt-3">
            <div className="relative shrink-0">
              <UserAvatar
                user={user}
                className="h-14 w-14 text-lg ring-2 ring-white/10 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-2xl"
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

            <div className="min-w-0 flex-1">
              <p className="max-w-full truncate text-[15px] font-semibold tracking-tight text-zinc-50 sm:text-lg">
                {displayName}
              </p>
              <p className="mt-0.5 max-w-full truncate text-[12px] text-zinc-500 sm:text-[13px]">{user.email}</p>
              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-400/15 bg-amber-500/[0.1] px-2.5 py-1 text-[11px] text-amber-100 sm:mt-2.5 sm:px-3 sm:text-xs">
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
          </div>

          {/* Tabs */}
          <div className="relative px-3 pb-3 sm:px-5 sm:pb-4" role="tablist" aria-label={t("userProfile.title")}>
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
                      "rounded-lg px-1.5 py-2.5 text-center text-[12px] font-medium transition sm:px-3 sm:py-2.5 sm:text-[13px]",
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
          className="profile-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 sm:px-6 sm:py-4"
          role="tabpanel"
        >
          {tab === "invite" ? (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-medium text-zinc-100">{t("userProfile.inviteTitle")}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{t("userProfile.inviteHint")}</p>
                <p className="mt-2 text-[11px] text-zinc-400">
                  {t("userProfile.inviteStats", {
                    unused: invites?.unusedCount ?? user.inviteUnusedCount ?? 0,
                    total: invites?.totalCount ?? user.inviteTotalCount ?? 0,
                  })}
                </p>
              </div>

              {isAdmin ? (
                <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3">
                  <p className="text-[12px] font-medium text-zinc-200">{t("userProfile.inviteAdminGenerate")}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                    {t("userProfile.inviteAdminGenerateHint")}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={genCount}
                      onChange={(e) => setGenCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-[12px] text-zinc-100 outline-none focus:border-music-accent/40"
                      aria-label={t("userProfile.inviteGenCount")}
                    />
                    <button
                      type="button"
                      disabled={genBusy}
                      onClick={() => {
                        setGenBusy(true);
                        setErr(null);
                        void (async () => {
                          try {
                            await generateInviteCodes(genCount);
                            await reloadInvites();
                            await refreshMe();
                          } catch (ex) {
                            setErr(mapApiError(t, ex));
                          } finally {
                            setGenBusy(false);
                          }
                        })();
                      }}
                      className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-zinc-100 transition hover:bg-white/[0.12] disabled:opacity-40"
                    >
                      {genBusy ? t("common.loading") : t("userProfile.inviteGenSubmit")}
                    </button>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  {t("userProfile.inviteCodesTitle")}
                </p>
                {invitesLoading && !invites ? (
                  <p className="text-[11px] text-zinc-500">{t("common.loading")}</p>
                ) : (invites?.codes.filter((c) => !c.used) ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-[11px] text-zinc-500">
                    {t("userProfile.inviteCodesEmpty")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(invites?.codes.filter((c) => !c.used) ?? []).map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/25 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <code className="block truncate font-mono text-[14px] font-semibold tracking-[0.16em] text-zinc-100">
                            {c.code}
                          </code>
                          <p className="mt-0.5 text-[10px] text-zinc-600">
                            {t(`userProfile.inviteSource.${c.source}`, {
                              defaultValue: c.source,
                            })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(c.code).then(() => {
                              setCopiedCode(c.code);
                              window.setTimeout(() => setCopiedCode(null), 1600);
                            });
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/10"
                        >
                          {copiedCode === c.code ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedCode === c.code ? t("userProfile.inviteCopied") : t("userProfile.inviteCopy")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  {t("userProfile.inviteRecordsTitle")}
                </p>
                {(invites?.records ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-[11px] text-zinc-500">
                    {t("userProfile.inviteRecordsEmpty")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(invites?.records ?? []).map((c: InviteCodeItemDto) => {
                      const when = c.usedAt
                        ? new Date(c.usedAt).toLocaleString(dateLocale, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—";
                      return (
                        <li
                          key={c.id}
                          className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-zinc-200">
                                {c.inviteeLabel || "—"}
                              </p>
                              <code className="mt-0.5 block truncate font-mono text-[10px] tracking-wider text-zinc-500">
                                {c.code}
                              </code>
                            </div>
                            <span className="shrink-0 text-[10px] text-zinc-500">{when}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
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
        <div className="shrink-0 space-y-2 border-t border-white/[0.06] bg-black/20 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3.5">
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
