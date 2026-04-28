import { useEffect, useState } from "react";
import clsx from "clsx";
import { ShieldCheck } from "lucide-react";
import { fetchMyPrivacySettings, updateMyPrivacySettings } from "../../api/client";
import { SiteHeader } from "../../components/SiteHeader";

export function PrivacySettingsPage() {
  const [recordLoginActivity, setRecordLoginActivity] = useState(true);
  const [recordPlayActivity, setRecordPlayActivity] = useState(true);
  const [publicBeanLevel, setPublicBeanLevel] = useState(true);
  const [publicLastOnline, setPublicLastOnline] = useState(true);
  const [allowPlaylistInvite, setAllowPlaylistInvite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    try {
      const row = await updateMyPrivacySettings({ [field]: next });
      setRecordLoginActivity(row.recordLoginActivity);
      setRecordPlayActivity(row.recordPlayActivity);
      setPublicBeanLevel(row.publicBeanLevel);
      setPublicLastOnline(row.publicLastOnline);
      setAllowPlaylistInvite(row.allowPlaylistInvite);
      setMsg("隐私设置已更新");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative w-full">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-28 sm:px-6 sm:pt-32">
        <section className="rounded-2xl border border-emerald-300/30 bg-white/75 p-5 backdrop-blur-sm">
          <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
            隐私设置
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            我们对隐私的保护是认真的。你可以自主决定是否记录登录活动和听歌活动。
            关闭后，系统将不再记录对应数据，同时这部分行为也不会计入豆值。
          </p>

          <div className="mt-4 space-y-3 rounded-xl border border-rose-100 bg-white p-3">
            <ItemSwitch
              label="记录登录活动（并计入豆值）"
              checked={recordLoginActivity}
              disabled={loading || saving}
              onToggle={(v) => void toggle("recordLoginActivity", v)}
            />
            <ItemSwitch
              label="记录听歌活动（并计入豆值）"
              checked={recordPlayActivity}
              disabled={loading || saving}
              onToggle={(v) => void toggle("recordPlayActivity", v)}
            />
            <ItemSwitch
              label="公开我的豆值与等级"
              checked={publicBeanLevel}
              disabled={loading || saving}
              onToggle={(v) => void toggle("publicBeanLevel", v)}
            />
            <ItemSwitch
              label="公开我的最近在线时间"
              checked={publicLastOnline}
              disabled={loading || saving}
              onToggle={(v) => void toggle("publicLastOnline", v)}
            />
            <ItemSwitch
              label="允许被其他用户邀请加入歌单"
              checked={allowPlaylistInvite}
              disabled={loading || saving}
              onToggle={(v) => void toggle("allowPlaylistInvite", v)}
            />
          </div>
          {msg ? (
            <p className={clsx("mt-3 text-sm", msg.includes("失败") ? "text-red-500" : "text-emerald-600")}>
              {msg}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function ItemSwitch({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-stone-700">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        className={clsx(
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-emerald-500/80" : "bg-zinc-600/80",
          disabled && "opacity-50"
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
    </label>
  );
}
