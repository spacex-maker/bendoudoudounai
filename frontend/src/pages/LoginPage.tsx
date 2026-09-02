import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Disc3, KeyRound, Lock, Mail, Ticket, UserRound } from "lucide-react";
import clsx from "clsx";
import {
  login,
  registerWithEmail,
  applyForRegistration,
  fetchRegisterApplyStatus,
  resetPasswordWithEmail,
  sendRegisterEmailCode,
  sendResetPasswordEmailCode,
  validateInviteCode,
  type RegisterApplyStatusDto,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { PRODUCT_NAME } from "../siteMeta";
import { mapApiError } from "../i18n/mapApiError";
import i18n from "../i18n/config";

const REMEMBER_LOGIN_KEY = "bendoudou_login_remember";

type Mode = "login" | "register" | "reset";
type RegisterPath = "invite" | "apply";

export function LoginPage() {
  const { t } = useTranslation();
  const { loginWithToken, state: authState } = useAuth();
  const { wallpaperActive } = usePageAppearance();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;

  const [mode, setMode] = useState<Mode>("login");
  const [registerPath, setRegisterPath] = useState<RegisterPath>("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applyStatus, setApplyStatus] = useState<RegisterApplyStatusDto | null>(null);
  const [inviteHint, setInviteHint] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_LOGIN_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { email?: string; password?: string; remember?: boolean };
      if (!saved?.remember) return;
      setRememberPassword(true);
      if (typeof saved.email === "string") setEmail(saved.email);
      if (typeof saved.password === "string") setPassword(saved.password);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (authState.status === "authed") {
      nav(from && from !== "/login" ? from : "/music", { replace: true });
    }
  }, [authState.status, from, nav]);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const id = window.setTimeout(() => setCodeCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [codeCooldown]);

  useEffect(() => {
    if (mode !== "register") return;
    if (registerPath !== "invite") {
      setInviteHint(null);
      setInviteValid(false);
      return;
    }
    const raw = inviteCode.trim();
    if (raw.length < 4) {
      setInviteHint(null);
      setInviteValid(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void validateInviteCode(raw)
        .then((r) => {
          setInviteValid(r.valid);
          setInviteHint(r.valid ? t("auth.inviteValid") : r.message || t("auth.inviteInvalid"));
        })
        .catch(() => {
          setInviteValid(false);
          setInviteHint(null);
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [inviteCode, mode, registerPath, t]);

  useEffect(() => {
    if (mode !== "register" || registerPath !== "apply") {
      setApplyStatus(null);
      return;
    }
    const em = email.trim();
    if (!em.includes("@")) {
      setApplyStatus(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchRegisterApplyStatus(em)
        .then((r) => setApplyStatus(r))
        .catch(() => setApplyStatus(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [email, mode, registerPath]);

  if (authState.status === "loading") {
    return (
      <div
        className={clsx(
          "flex min-h-dvh items-center justify-center font-sans text-ink-500",
          wallpaperActive ? "bg-transparent" : "bg-[#e8ecf1]"
        )}
      >
        {t("common.loading")}
      </div>
    );
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setErr(null);
    setOkMsg(null);
    setInviteHint(null);
    setInviteValid(false);
    setApplyStatus(null);
    setCode("");
    if (next !== "login") setPassword("");
    setCodeCooldown(0);
  };

  async function onSendCode() {
    setErr(null);
    setOkMsg(null);
    if (!email.trim()) {
      setErr(t("auth.emailRequired"));
      return;
    }
    setSendingCode(true);
    try {
      if (mode === "reset") {
        await sendResetPasswordEmailCode(email, i18n.language);
      } else {
        await sendRegisterEmailCode(email, i18n.language);
      }
      setCodeCooldown(60);
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setSendingCode(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        const res = await login(email, password);
        if (rememberPassword) {
          localStorage.setItem(
            REMEMBER_LOGIN_KEY,
            JSON.stringify({ email: email.trim(), password, remember: true })
          );
        } else {
          localStorage.removeItem(REMEMBER_LOGIN_KEY);
        }
        await loginWithToken(res.token);
        nav(from && from !== "/login" ? from : "/music", { replace: true });
      } else if (mode === "register") {
        if (password.length < 6) {
          setErr(t("auth.passwordPh"));
          return;
        }
        if (registerPath === "apply") {
          if (applyStatus?.status === "PENDING") {
            setErr(t("auth.applyPending"));
            return;
          }
          const r = await applyForRegistration({
            email,
            password,
            code,
            displayName: displayName || undefined,
            message: applyMessage || undefined,
            locale: i18n.language,
          });
          setApplyStatus(r);
          setOkMsg(r.message || t("auth.applySubmitted"));
          setPassword("");
          setCode("");
          setApplyMessage("");
        } else {
          const res = await registerWithEmail({
            email,
            password,
            code,
            inviteCode,
            displayName: displayName || undefined,
          });
          await loginWithToken(res.token);
          nav(from && from !== "/login" ? from : "/music", { replace: true });
        }
      } else {
        if (password.length < 6) {
          setErr(t("auth.passwordPh"));
          return;
        }
        await resetPasswordWithEmail({ email, code, password });
        localStorage.removeItem(REMEMBER_LOGIN_KEY);
        setRememberPassword(false);
        setPassword("");
        setCode("");
        setMode("login");
        setOkMsg(t("auth.resetOk"));
      }
    } catch (e: unknown) {
      if (mode === "login" && e && typeof e === "object" && "response" in e) {
        const res = (e as { response?: { status?: number; data?: { message?: string } } }).response;
        if (res?.status === 403) {
          setErr(t("errors.accountDisabled"));
        } else {
          const d = res?.data;
          setErr(typeof d?.message === "string" ? d.message : t("auth.genericError"));
        }
      } else {
        setErr(mapApiError(t, e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "login" ? t("auth.welcomeBack") : mode === "register" ? t("auth.registerTitle") : t("auth.resetTitle");
  const subtitle =
    mode === "login" ? t("auth.subLogin") : mode === "register" ? t("auth.subRegister") : t("auth.subReset");
  const footer =
    mode === "login" ? t("auth.footerNote") : mode === "register" ? t("auth.footerRegister") : t("auth.footerReset");

  return (
    <div
      className={clsx(
        "relative min-h-dvh w-full overflow-hidden font-sans",
        wallpaperActive ? "bg-transparent" : "bg-theme-login"
      )}
    >
      {!wallpaperActive ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-24 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-[rgba(198,47,47,0.12)] blur-3xl" />
          <div className="absolute right-[-8rem] top-[20%] h-[32rem] w-[32rem] rounded-full bg-[rgba(26,31,38,0.08)] blur-3xl" />
          <div className="absolute bottom-[-10rem] left-[30%] h-[28rem] w-[28rem] rounded-full bg-[rgba(56,189,248,0.08)] blur-3xl" />
          <div className="absolute inset-0 bg-theme-login-overlay" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ink-500 transition hover:text-ink-800"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {t("common.backHome")}
          </Link>
          <LanguageSwitch />
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-ink-900/10 bg-[#0f1218]/[0.92] p-8 text-white shadow-[0_28px_60px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 90% 0%, rgba(198,47,47,0.28), transparent 55%), radial-gradient(ellipse 60% 45% at 0% 100%, rgba(56,189,248,0.12), transparent 50%)",
            }}
          />

          <div className="relative z-10 mb-6">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-music-accent/30 bg-music-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#fda4af]">
              <Disc3 className="h-3.5 w-3.5" />
              {PRODUCT_NAME}
            </p>
            <h1 className="font-display text-[2rem] font-extrabold tracking-[-0.04em] text-white sm:text-[2.15rem]">
              {title}
            </h1>
            <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-white/55">
              {mode === "register"
                ? registerPath === "apply"
                  ? t("auth.subRegisterApply")
                  : t("auth.subRegister")
                : subtitle}
            </p>
            {mode !== "reset" ? (
              <div className="mt-4 flex rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={clsx(
                    "flex-1 rounded-lg py-2 font-medium transition",
                    mode === "login" ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
                  )}
                >
                  {t("auth.toLogin")}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={clsx(
                    "flex-1 rounded-lg py-2 font-medium transition",
                    mode === "register" ? "bg-white/15 text-white" : "text-white/45 hover:text-white/70"
                  )}
                >
                  {t("auth.toRegister")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mt-4 text-xs text-white/50 transition hover:text-white/80"
              >
                ← {t("auth.backToLogin")}
              </button>
            )}
            {mode === "register" ? (
              <div className="mt-3 flex rounded-xl border border-white/10 bg-black/20 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterPath("invite");
                    setErr(null);
                    setOkMsg(null);
                  }}
                  className={clsx(
                    "flex-1 rounded-lg py-1.5 font-medium transition",
                    registerPath === "invite" ? "bg-white/12 text-white" : "text-white/40 hover:text-white/65"
                  )}
                >
                  {t("auth.registerPathInvite")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegisterPath("apply");
                    setErr(null);
                    setOkMsg(null);
                  }}
                  className={clsx(
                    "flex-1 rounded-lg py-1.5 font-medium transition",
                    registerPath === "apply" ? "bg-white/12 text-white" : "text-white/40 hover:text-white/65"
                  )}
                >
                  {t("auth.registerPathApply")}
                </button>
              </div>
            ) : null}
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="relative z-10 space-y-3.5">
            {mode === "register" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">{t("auth.displayNameLabel")}</label>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-music-accent/80" />
                  <input
                    type="text"
                    autoComplete="nickname"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-music-accent/50 focus:ring-2 focus:ring-music-accent/25"
                    placeholder={t("auth.displayNamePh")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">{t("auth.email")}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-music-accent/80" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-music-accent/50 focus:ring-2 focus:ring-music-accent/25"
                  placeholder={t("auth.emailPh")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {mode === "register" || mode === "reset" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">{t("auth.verifyCode")}</label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-music-accent/80" />
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={8}
                      autoComplete="one-time-code"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-music-accent/50 focus:ring-2 focus:ring-music-accent/25"
                      placeholder={t("auth.verifyCodePh")}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={sendingCode || codeCooldown > 0}
                    onClick={() => void onSendCode()}
                    className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-medium text-white/85 transition hover:bg-white/15 disabled:opacity-40"
                  >
                    {codeCooldown > 0
                      ? t("auth.resendIn", { sec: codeCooldown })
                      : sendingCode
                        ? t("auth.sendingCode")
                        : t("auth.sendCode")}
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-white/50">
                  {mode === "reset" ? t("auth.newPassword") : t("auth.password")}
                </label>
                {mode === "login" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("reset")}
                    className="text-[11px] text-white/45 transition hover:text-[#fda4af]"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-music-accent/80" />
                <input
                  type="password"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-music-accent/50 focus:ring-2 focus:ring-music-accent/25"
                  placeholder={t("auth.passwordPh")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {mode === "register" ? (
              registerPath === "invite" ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">{t("auth.inviteCode")}</label>
                  <div className="relative">
                    <Ticket className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-music-accent/80" />
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-3 text-sm uppercase tracking-wider text-white placeholder:text-white/30 outline-none transition focus:border-music-accent/50 focus:ring-2 focus:ring-music-accent/25"
                      placeholder={t("auth.inviteCodePh")}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  {inviteHint ? (
                    <p
                      className={clsx(
                        "mt-1.5 text-[11px]",
                        inviteValid ? "text-emerald-300/90" : "text-amber-300/90"
                      )}
                    >
                      {inviteHint}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-white/35">{t("auth.inviteRequiredHint")}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {applyStatus?.status === "PENDING" ? (
                    <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-100/90">
                      {t("auth.applyPending")}
                    </p>
                  ) : null}
                  {applyStatus?.status === "REJECTED" ? (
                    <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-rose-100/90">
                      <p className="font-medium">{t("auth.applyRejectedTitle")}</p>
                      <p className="mt-1 whitespace-pre-wrap text-rose-100/75">
                        {applyStatus.rejectionReason || t("auth.applyRejectedNoReason")}
                      </p>
                      <p className="mt-1.5 text-[11px] text-rose-100/55">{t("auth.applyRejectedHint")}</p>
                    </div>
                  ) : null}
                  {applyStatus?.status === "APPROVED" || applyStatus?.status === "REGISTERED" ? (
                    <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-[12px] text-emerald-100/90">
                      {applyStatus.message || t("auth.applyApprovedLogin")}
                    </p>
                  ) : null}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/50">{t("auth.applyMessage")}</label>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      disabled={applyStatus?.status === "PENDING"}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-music-accent/50 focus:ring-2 focus:ring-music-accent/25 disabled:opacity-50"
                      placeholder={t("auth.applyMessagePh")}
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                    />
                  </div>
                </div>
              )
            ) : mode === "login" ? (
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-music-accent focus:ring-music-accent/40"
                />
                <span>{t("auth.rememberPassword")}</span>
              </label>
            ) : (
              <p className="text-[11px] leading-relaxed text-white/35">{t("auth.resetHint")}</p>
            )}

            {okMsg ? (
              <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-center text-sm text-emerald-200">
                {okMsg}
              </p>
            ) : null}

            {err ? (
              <p className="rounded-xl border border-music-accent/25 bg-music-accent/10 px-3 py-2.5 text-center text-sm text-[#fda4af]">
                {err}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                (mode === "register" &&
                  registerPath === "apply" &&
                  (applyStatus?.status === "PENDING" ||
                    applyStatus?.status === "APPROVED" ||
                    applyStatus?.status === "REGISTERED"))
              }
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-music-accent to-[#9f1f1f] py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(198,47,47,0.35)] transition hover:brightness-110 disabled:opacity-60"
            >
              <span className="relative z-10">
                {submitting
                  ? t("auth.submitWait")
                  : mode === "login"
                    ? t("auth.loginBtn")
                    : mode === "register"
                      ? registerPath === "apply"
                        ? t("auth.applyBtn")
                        : t("auth.registerBtn")
                      : t("auth.resetBtn")}
              </span>
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-500/80">{footer}</p>
      </div>
    </div>
  );
}
