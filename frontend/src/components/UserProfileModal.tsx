import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { X, LogOut, Camera, LayoutDashboard, ChevronDown, ShieldCheck } from "lucide-react";
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

export function UserProfileModal({ open, onClose, user }: Props) {
  const { t } = useTranslation();
  const { refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const fileId = useId();
  const [imageVersion, setImageVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [recordLoginActivity, setRecordLoginActivity] = useState(true);
  const [recordPlayActivity, setRecordPlayActivity] = useState(true);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPwdMsg(null);
    setPwdSuccess(false);
    setPwdOld("");
    setPwdNew("");
    setPwdOpen(false);
    setPrivacyLoading(true);
    void (async () => {
      try {
        const p = await fetchMyPrivacySettings();
        setRecordLoginActivity(p.recordLoginActivity);
        setRecordPlayActivity(p.recordPlayActivity);
      } catch {
        // ignore and keep defaults
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
      setErr(ex instanceof Error ? ex.message : "隐私设置更新失败");
    } finally {
      setPrivacyLoading(false);
    }
  };

  /** 挂到 body，避免放在带 backdrop-blur 的 fixed header 内导致 fixed 相对顶栏、弹层挤在页面顶部 */
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-md"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-900/72 text-zinc-200 shadow-[0_24px_64px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06] backdrop-blur-2xl backdrop-saturate-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h2 id="profile-modal-title" className="text-sm font-medium">
            {t("userProfile.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-xs">
          <div className="flex flex-col items-center gap-3">
            <UserAvatar user={user} className="h-20 w-20 text-2xl" imageVersion={imageVersion} />
            <div className="text-center">
              <div className="text-sm font-medium text-zinc-100">
                {user.displayName?.trim() || t("userProfile.noName")}
              </div>
              <div className="mt-1 break-all text-zinc-500">{user.email}</div>
            </div>
            <div>
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
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-zinc-300 transition hover:bg-white/10",
                  busy && "pointer-events-none opacity-50"
                )}
              >
                <Camera className="h-3.5 w-3.5" />
                {busy ? t("userProfile.uploading") : t("userProfile.changeAvatar")}
              </label>
              <p className="mt-2 text-center text-[10px] text-zinc-600">{t("userProfile.avatarHint")}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            <button
              type="button"
              onClick={() => {
                setPwdOpen((o) => {
                  if (o) {
                    setPwdMsg(null);
                    setPwdSuccess(false);
                    setPwdOld("");
                    setPwdNew("");
                  }
                  return !o;
                });
              }}
              aria-expanded={pwdOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
            >
              <span className="text-[11px] font-medium text-zinc-400">{t("userProfile.changePassword")}</span>
              <ChevronDown
                className={clsx("h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200", pwdOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {pwdOpen ? (
              <form
                className="space-y-2 border-t border-white/[0.06] p-3"
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
                <input
                  type="password"
                  autoComplete="current-password"
                  value={pwdOld}
                  onChange={(e) => setPwdOld(e.target.value)}
                  placeholder={t("userProfile.currentPassword")}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950/40 px-2.5 py-1.5 text-zinc-200 placeholder:text-zinc-600"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  placeholder={t("userProfile.newPassword")}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950/40 px-2.5 py-1.5 text-zinc-200 placeholder:text-zinc-600"
                />
                <p className="text-[10px] text-zinc-600">{t("userProfile.newPasswordHint")}</p>
                <p className="mt-0.5 rounded-md border border-white/[0.06] bg-zinc-950/30 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-500">
                  {t("common.passwordNoRecoveryNote")}
                </p>
                {pwdMsg ? (
                  <p
                    className={clsx("text-[11px]", pwdSuccess ? "text-emerald-400/90" : "text-amber-400/90")}
                  >
                    {pwdMsg}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pwdBusy || !pwdOld || !pwdNew}
                  className="w-full rounded-full border border-white/10 bg-white/[0.06] py-2 text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
                >
                  {pwdBusy ? t("common.loading") : t("userProfile.submitPasswordChange")}
                </button>
              </form>
            ) : null}
          </div>

          <div className="space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              隐私设置
            </p>
            <p className="text-[11px] leading-relaxed text-emerald-100/90">
              我们对隐私的保护是认真的。你可以随时关闭登录记录和听歌记录；关闭后系统将不再记录对应数据，同时相关行为也不会计入豆值。
            </p>

            <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/35 p-2.5">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-zinc-300">记录登录活动（并计入豆值）</span>
                <button
                  type="button"
                  disabled={privacyLoading}
                  onClick={() => void onTogglePrivacy("recordLoginActivity", !recordLoginActivity)}
                  className={clsx(
                    "relative h-6 w-11 rounded-full transition",
                    recordLoginActivity ? "bg-emerald-500/80" : "bg-zinc-600/80",
                    privacyLoading && "opacity-50"
                  )}
                  aria-label="切换登录活动记录"
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                      recordLoginActivity ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-zinc-300">记录听歌活动（并计入豆值）</span>
                <button
                  type="button"
                  disabled={privacyLoading}
                  onClick={() => void onTogglePrivacy("recordPlayActivity", !recordPlayActivity)}
                  className={clsx(
                    "relative h-6 w-11 rounded-full transition",
                    recordPlayActivity ? "bg-emerald-500/80" : "bg-zinc-600/80",
                    privacyLoading && "opacity-50"
                  )}
                  aria-label="切换听歌活动记录"
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                      recordPlayActivity ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              </label>
            </div>
          </div>

          {err ? <p className="text-center text-[11px] text-red-400/90">{err}</p> : null}

          {userIsAdmin(user) ? (
            <Link
              to="/admin"
              onClick={() => onClose()}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 py-2.5 text-violet-200 transition hover:bg-violet-500/25"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {t("userProfile.openAdmin")}
            </Link>
          ) : null}

          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-2.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-zinc-200 disabled:opacity-50"
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
