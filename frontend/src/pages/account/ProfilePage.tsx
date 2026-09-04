import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Camera, KeyRound, ShieldCheck } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { useAuthedUser, useAuth } from "../../auth/AuthContext";
import { changeMyPassword, updateMyProfile, uploadUserAvatar } from "../../api/client";
import { UserAvatar } from "../../components/UserAvatar";
import { mapApiError } from "../../i18n/mapApiError";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthedUser();
  const { refreshMe } = useAuth();
  const fileId = useId();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"UNKNOWN" | "MALE" | "FEMALE">("UNKNOWN");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setGender((user.gender ?? "UNKNOWN") as "UNKNOWN" | "MALE" | "FEMALE");
  }, [user]);

  if (!user) return null;

  const onAvatar = async (f: File) => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await uploadUserAvatar(f);
      await refreshMe();
      setImageVersion((v) => v + 1);
      setOk(t("account.avatarUpdated"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("account.avatarFail"));
    } finally {
      setBusy(false);
    }
  };

  const onChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (newPwd.length < 6) {
      setErr(t("account.passwordTooShort"));
      return;
    }
    setBusy(true);
    try {
      await changeMyPassword(oldPwd, newPwd);
      setOldPwd("");
      setNewPwd("");
      setOk(t("userProfile.passwordChangeOk"));
    } catch (ex) {
      setErr(mapApiError(t, ex) || t("account.passwordFail"));
    } finally {
      setBusy(false);
    }
  };

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await updateMyProfile({
        displayName: displayName.trim() || null,
        gender,
      });
      await refreshMe();
      setOk(t("account.profileUpdated"));
    } catch (ex) {
      setErr(mapApiError(t, ex) || t("account.profileFail"));
    } finally {
      setBusy(false);
    }
  };

  const currentDisplayName = user.displayName ?? "";
  const currentGender = (user.gender ?? "UNKNOWN") as "UNKNOWN" | "MALE" | "FEMALE";

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

  return (
    <div className="relative min-h-dvh w-full bg-[#f4f5f7] text-zinc-800">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(26,31,38,0.08),transparent)]"
        aria-hidden
      />
      <SiteHeader />
      <main className="relative mx-auto max-w-3xl px-4 pb-10 pt-24 sm:px-6 sm:pb-12 sm:pt-28">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/music"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 transition hover:text-zinc-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("account.backToMusic")}
            </Link>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-900">
              {t("userProfile.title")}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{t("account.profileSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500">
              {t("account.privateOnly")}
            </span>
            <Link
              to="/account/privacy"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("userProfile.privacy")}
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_12px_40px_-24px_rgba(15,18,24,0.35)]">
          <div className="border-b border-zinc-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative shrink-0 self-start">
                <UserAvatar
                  user={user}
                  className="h-[4.5rem] w-[4.5rem] text-xl ring-2 ring-zinc-100"
                  imageVersion={imageVersion}
                  showLevelBadge={false}
                />
                <input
                  id={fileId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onAvatar(f);
                  }}
                />
                <label
                  htmlFor={fileId}
                  className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800"
                  title={t("userProfile.changeAvatar")}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span className="sr-only">{t("userProfile.changeAvatar")}</span>
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                  {user.displayName?.trim() || t("userProfile.noName")}
                </p>
                <p className="mt-0.5 truncate text-sm text-zinc-500">{user.email}</p>
                <p className="mt-2 text-[12px] text-zinc-400">{t("account.avatarClickHint")}</p>
              </div>
            </div>
          </div>

          <form className="border-b border-zinc-100 px-5 py-5 sm:px-6" onSubmit={(e) => void onSaveProfile(e)}>
            <h2 className="text-sm font-semibold text-zinc-900">{t("account.profileSettings")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-[13px] font-medium text-zinc-600">
                {t("account.displayName")}
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("account.displayNamePh")}
                  className={fieldClass}
                />
              </label>
              <div>
                <p className="text-[13px] font-medium text-zinc-600">{t("account.gender")}</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                  {(
                    [
                      { key: "UNKNOWN" as const, labelKey: "account.genderUnknown" as const },
                      { key: "MALE" as const, labelKey: "account.genderMale" as const },
                      { key: "FEMALE" as const, labelKey: "account.genderFemale" as const },
                    ] as const
                  ).map((item) => {
                    const active = gender === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setGender(item.key)}
                        className={[
                          "rounded-lg px-2 py-2 text-xs font-medium transition",
                          active
                            ? "bg-zinc-900 text-white shadow-sm"
                            : "text-zinc-500 hover:bg-white hover:text-zinc-800",
                        ].join(" ")}
                      >
                        {t(item.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("account.saveProfile")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDisplayName(currentDisplayName);
                  setGender(currentGender);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                {t("account.reset")}
              </button>
            </div>
          </form>

          <form className="px-5 py-5 sm:px-6" onSubmit={(e) => void onChangePwd(e)}>
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              {t("userProfile.changePassword")}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{t("account.passwordPageHint")}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder={t("account.currentPasswordPh")}
                autoComplete="current-password"
                className={fieldClass.replace("mt-1.5 ", "")}
              />
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder={t("account.newPasswordPh")}
                autoComplete="new-password"
                className={fieldClass.replace("mt-1.5 ", "")}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50"
            >
              {t("account.savePassword")}
            </button>
          </form>
        </div>

        {err ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{err}</p>
        ) : null}
        {ok ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            {ok}
          </p>
        ) : null}
      </main>
    </div>
  );
}
