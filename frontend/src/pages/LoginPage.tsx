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
  const { t } = useTranslation();
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
        wallpaperActive ? "bg-transparent" : "bg-romantic-mesh"
      )}
    >
      {!wallpaperActive ? (
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PCEtLSBsaWdodCBkaWFtb25kIHBhdHRlcm4gLS0+PHBhdGggZD0iTTMwIDMwYzAgNCAzIDcgNyA3IDQgMCA3LTMgNy03IDAtNCAtMy03LTctNy0zIDAtNCA0LTQgOCAwIDYgNCA4IDggMnoiIGZpbGw9IiNGRkYiIGZpbGwtb3BhY2l0eT0iLjA2Ii8+PC9zdmc+')] opacity-50" />
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
        <div className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg shadow-rose-200/20 backdrop-blur">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 text-rose-400">
              <Heart className="h-7 w-7" fill="currentColor" fillOpacity={0.25} />
            </div>
            <h1 className="font-display text-2xl text-warm-600">{t("auth.welcomeBack")}</h1>
            <p className="mt-1 text-sm text-stone-500">{t("auth.subLogin")}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
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
