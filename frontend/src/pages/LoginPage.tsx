import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Lock, Mail, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { login } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";
import { LanguageSwitch } from "../components/LanguageSwitch";

const REMEMBER_LOGIN_KEY = "bendoudou_login_remember";

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { loginWithToken, state: authState } = useAuth();
  const { wallpaperActive } = usePageAppearance();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isZh = /^(zh)\b/i.test(i18n.resolvedLanguage ?? i18n.language ?? "");

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
      // ignore invalid saved login payload
    }
  }, []);

  useEffect(() => {
    if (authState.status === "authed") {
      nav(from && from !== "/login" ? from : "/music", { replace: true });
    }
  }, [authState.status, from, nav]);

  if (authState.status === "loading") {
    return (
      <div
        className={clsx(
          "flex min-h-dvh items-center justify-center text-warm-600",
          wallpaperActive ? "bg-transparent" : "bg-romantic-mesh"
        )}
      >
        {t("common.loading")}
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (rememberPassword) {
        localStorage.setItem(
          REMEMBER_LOGIN_KEY,
          JSON.stringify({
            email: email.trim(),
            password,
            remember: true,
          })
        );
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY);
      }
      await loginWithToken(res.token);
      nav(from && from !== "/login" ? from : "/music", { replace: true });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "response" in e) {
        const res = (e as { response?: { status?: number; data?: { message?: string } } }).response;
        if (res?.status === 403) {
          setErr(t("errors.accountDisabled"));
        } else {
          const d = res?.data;
          setErr(typeof d?.message === "string" ? d.message : t("auth.genericError"));
        }
      } else {
        setErr(t("auth.genericError"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={clsx(
        "relative min-h-dvh w-full overflow-hidden",
        wallpaperActive ? "bg-transparent" : "bg-theme-login"
      )}
    >
      {!wallpaperActive ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-20 h-80 w-80 rounded-full bg-rose-300/35 blur-3xl" />
          <div className="absolute right-[-7rem] top-1/4 h-96 w-96 rounded-full bg-fuchsia-300/25 blur-3xl" />
          <div className="absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full bg-amber-200/25 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_38%),radial-gradient(circle_at_78%_30%,rgba(255,170,210,0.25),transparent_35%),radial-gradient(circle_at_50%_82%,rgba(255,210,150,0.2),transparent_34%)]" />
          <div className="absolute inset-0 bg-theme-login-overlay" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTMwIDMwYzAgNCAzIDcgNyA3IDQgMCA3LTMgNy03IDAtNCAtMy03LTctNy0zIDAtNCA0LTQgOCAwIDYgNCA4IDggMnoiIGZpbGw9IiNGRkYiIGZpbGwtb3BhY2l0eT0iLjA2Ii8+PC9zdmc+')] opacity-50" />
        </div>
      ) : null}
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex min-w-0 items-center gap-1.5 text-sm text-warm-500/80 transition hover:text-warm-600"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {t("common.backHome")}
          </Link>
          <LanguageSwitch />
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/72 p-8 shadow-[0_16px_60px_rgba(251,113,133,0.22)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/55" />
          <div className="pointer-events-none absolute -inset-px rounded-3xl bg-[conic-gradient(from_140deg,rgba(255,255,255,0.28),rgba(255,180,210,0.2),rgba(255,240,205,0.22),rgba(255,255,255,0.3))] opacity-65 blur-[1px]" />
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.45),transparent_30%),radial-gradient(circle_at_90%_100%,rgba(255,195,220,0.2),transparent_34%)]" />
          <div className="pointer-events-none absolute -right-8 -top-12 h-64 w-64 text-rose-300/35 blur-[1px]">
            <Heart className="h-full w-full" fill="currentColor" />
          </div>
          <div className="pointer-events-none absolute -left-10 -top-20 h-60 w-60 text-amber-200/25">
            <Heart className="h-full w-full rotate-[-18deg]" fill="currentColor" />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-0 h-52 w-[120%] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.65),rgba(255,255,255,0.18)_45%,transparent_75%)]" />
          <div className="mb-6 text-center relative z-10">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100/95 to-amber-100/95 text-rose-400 shadow-[0_10px_24px_rgba(251,113,133,0.28)]">
              <Heart className="h-8 w-8" fill="currentColor" fillOpacity={0.35} />
            </div>
            <h1
              className={clsx(
                "text-3xl text-warm-600 drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]",
                isZh ? "font-normal tracking-[0.045em]" : "font-semibold tracking-[0.05em]"
              )}
              style={
                isZh
                  ? {
                      fontFamily:
                        '"ZCOOL QingKe HuangYou","Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC",ui-sans-serif,system-ui,sans-serif',
                    }
                  : undefined
              }
            >
              {t("auth.welcomeBack")}
            </h1>
            <div className="mx-auto mt-1.5 h-px w-16 bg-gradient-to-r from-transparent via-stone-300/90 to-transparent" />
            <p className="mx-auto mt-2 max-w-[26ch] text-sm leading-relaxed text-stone-500">{t("auth.subLogin")}</p>
          </div>

          <form onSubmit={onSubmit} className="relative z-10 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t("auth.email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-rose-100/80 bg-white/80 py-2.5 pl-10 pr-3 text-stone-800 placeholder:text-stone-300 focus:border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-200/50"
                  placeholder={t("auth.emailPh")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">{t("auth.password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  minLength={6}
                  className="w-full rounded-xl border border-rose-100/80 bg-white/80 py-2.5 pl-10 pr-3 text-stone-800 placeholder:text-stone-300 focus:border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-200/50"
                  placeholder={t("auth.passwordPh")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 pl-0.5 text-xs text-stone-500">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
                className="h-4 w-4 rounded border-rose-200 text-rose-500 focus:ring-rose-300"
              />
              <span>{t("auth.rememberPassword", { defaultValue: "记住密码" })}</span>
            </label>

            {err && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm text-rose-600">{err}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-rose-400/95 to-amber-300/90 py-3 font-medium text-white shadow-md shadow-rose-300/40 transition hover:from-rose-500 hover:to-amber-400/90 disabled:opacity-60"
            >
              {submitting ? t("auth.submitWait") : t("auth.loginBtn")}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-stone-400/90">{t("auth.footerNote")}</p>
      </div>
    </div>
  );
}
