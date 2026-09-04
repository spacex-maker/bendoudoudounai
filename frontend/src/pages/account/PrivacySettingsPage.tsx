import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { fetchMyPrivacySettings, updateMyPrivacySettings } from "../../api/client";
import { SiteHeader } from "../../components/SiteHeader";
import { mapApiError } from "../../i18n/mapApiError";

export function PrivacySettingsPage() {
  const { t } = useTranslation();
  const [recordLoginActivity, setRecordLoginActivity] = useState(true);
  const [recordPlayActivity, setRecordPlayActivity] = useState(true);
  const [publicBeanLevel, setPublicBeanLevel] = useState(true);
  const [publicLastOnline, setPublicLastOnline] = useState(true);
  const [allowPlaylistInvite, setAllowPlaylistInvite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgIsError, setMsgIsError] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const row = await fetchMyPrivacySettings();
        setRecordLoginActivity(row.recordLoginActivity);
        setRecordPlayActivity(row.recordPlayActivity);
        setPublicBeanLevel(row.publicBeanLevel);
        setPublicLastOnline(row.publicLastOnline);
        setAllowPlaylistInvite(row.allowPlaylistInvite);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (
    field:
      | "recordLoginActivity"
      | "recordPlayActivity"
      | "publicBeanLevel"
      | "publicLastOnline"
      | "allowPlaylistInvite",
    next: boolean
  ) => {
    setSaving(true);
    setMsg(null);
    setMsgIsError(false);
    try {
      const row = await updateMyPrivacySettings({ [field]: next });
      setRecordLoginActivity(row.recordLoginActivity);
      setRecordPlayActivity(row.recordPlayActivity);
      setPublicBeanLevel(row.publicBeanLevel);
      setPublicLastOnline(row.publicLastOnline);
      setAllowPlaylistInvite(row.allowPlaylistInvite);
      setMsg(t("userProfile.privacyUpdated"));
    } catch (e) {
      setMsgIsError(true);
      setMsg(mapApiError(t, e) || t("userProfile.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full bg-[#f4f5f7] text-zinc-800">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(26,31,38,0.08),transparent)]"
        aria-hidden
      />
      <SiteHeader />
      <main className="relative mx-auto max-w-3xl px-4 pb-10 pt-24 sm:px-6 sm:pb-12 sm:pt-28">
        <div className="mb-5">
          <Link
            to="/account/profile"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 transition hover:text-zinc-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("account.backToProfile")}
          </Link>
          <h1 className="mt-2 inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-zinc-900">
            <ShieldCheck className="h-6 w-6 text-zinc-500" />
            {t("userProfile.privacy")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">{t("account.privacyPageHint")}</p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_12px_40px_-24px_rgba(15,18,24,0.35)]">
          <div className="divide-y divide-zinc-100">
            <ItemSwitch
              label={t("userProfile.recordLoginTitle")}
              hint={t("userProfile.recordBeanNote")}
              checked={recordLoginActivity}
              disabled={loading || saving}
              onToggle={(v) => void toggle("recordLoginActivity", v)}
            />
            <ItemSwitch
              label={t("userProfile.recordPlayTitle")}
              hint={t("userProfile.recordBeanNote")}
              checked={recordPlayActivity}
              disabled={loading || saving}
              onToggle={(v) => void toggle("recordPlayActivity", v)}
            />
            <ItemSwitch
              label={t("userProfile.publicBeanLevel")}
              checked={publicBeanLevel}
              disabled={loading || saving}
              onToggle={(v) => void toggle("publicBeanLevel", v)}
            />
            <ItemSwitch
              label={t("userProfile.publicLastOnline")}
              checked={publicLastOnline}
              disabled={loading || saving}
              onToggle={(v) => void toggle("publicLastOnline", v)}
            />
            <ItemSwitch
              label={t("userProfile.allowPlaylistInvite")}
              checked={allowPlaylistInvite}
              disabled={loading || saving}
              onToggle={(v) => void toggle("allowPlaylistInvite", v)}
            />
          </div>
        </section>

        {msg ? (
          <p
            className={clsx(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm",
              msgIsError
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            )}
          >
            {msg}
          </p>
        ) : null}
      </main>
    </div>
  );
}

function ItemSwitch({
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-zinc-500">{hint}</p> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        aria-pressed={checked}
        className={clsx(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "justify-end bg-zinc-900" : "justify-start bg-zinc-300",
          disabled && "opacity-50"
        )}
      >
        <span className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm" />
      </button>
    </div>
  );
}
