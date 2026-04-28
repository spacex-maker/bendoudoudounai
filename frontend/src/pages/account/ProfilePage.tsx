import { useEffect, useId, useState } from "react";
import { Camera, KeyRound } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { useAuthedUser, useAuth } from "../../auth/AuthContext";
import { changeMyPassword, updateMyProfile, uploadUserAvatar } from "../../api/client";
import { UserAvatar } from "../../components/UserAvatar";

export function ProfilePage() {
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

  if (!user) return null;

  useEffect(() => {
    setDisplayName(user.displayName ?? "");
    setGender((user.gender ?? "UNKNOWN") as "UNKNOWN" | "MALE" | "FEMALE");
  }, [user.displayName, user.gender]);

  const onAvatar = async (f: File) => {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await uploadUserAvatar(f);
      await refreshMe();
      setImageVersion((v) => v + 1);
      setOk("头像已更新");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "头像更新失败");
    } finally {
      setBusy(false);
    }
  };

  const onChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (newPwd.length < 6) {
      setErr("新密码至少 6 位");
      return;
    }
    setBusy(true);
    try {
      await changeMyPassword(oldPwd, newPwd);
      setOldPwd("");
      setNewPwd("");
      setOk("密码修改成功");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "密码修改失败");
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
      setOk("个人信息已更新");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "个人信息更新失败");
    } finally {
      setBusy(false);
    }
  };

  const currentDisplayName = user.displayName ?? "";
  const currentGender = user.gender ?? "UNKNOWN";

  return (
    <div className="relative w-full bg-romantic-mesh text-stone-800">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-14 pt-28 sm:px-6 sm:pt-32">
        <section className="overflow-hidden rounded-3xl border border-white/50 bg-white/65 p-6 shadow-[0_18px_50px_rgba(244,114,182,0.16)] backdrop-blur-md sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-warm-700 sm:text-2xl">个人信息</h1>
              <p className="mt-1 text-sm text-stone-600">在这里可以设置昵称、性别、头像和登录密码。</p>
            </div>
            <span className="rounded-full border border-rose-200/70 bg-rose-50/70 px-3 py-1 text-xs font-medium text-rose-500">
              仅自己可见
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5">
              <div className="flex items-center gap-4">
                <UserAvatar user={user} className="h-20 w-20 shadow-sm ring-2 ring-rose-100" imageVersion={imageVersion} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-800">{user.displayName?.trim() || "未设置昵称"}</p>
                  <p className="mt-1 truncate text-xs text-stone-500">{user.email}</p>
                </div>
              </div>
              <div className="mt-4">
                <input
                  id={fileId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onAvatar(f);
                  }}
                />
                <label
                  htmlFor={fileId}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-500 transition hover:border-rose-300 hover:bg-rose-50"
                >
                  <Camera className="h-4 w-4" />
                  更换头像
                </label>
              </div>
            </div>

            <form className="rounded-2xl border border-white/70 bg-white/80 p-5" onSubmit={(e) => void onSaveProfile(e)}>
              <h2 className="text-base font-semibold text-warm-700">资料设置</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-stone-600">
                  昵称
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="昵称（可选）"
                    className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                  />
                </label>
                <label className="text-sm text-stone-600">
                  性别
                  <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl border border-rose-200 bg-rose-50/55 p-1">
                    {[
                      { key: "UNKNOWN", label: "保密", tone: "text-stone-600" },
                      { key: "MALE", label: "男 ♂", tone: "text-sky-600" },
                      { key: "FEMALE", label: "女 ♀", tone: "text-pink-600" },
                    ].map((item) => {
                      const active = gender === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setGender(item.key as "UNKNOWN" | "MALE" | "FEMALE")}
                          className={[
                            "rounded-lg px-2 py-2 text-xs font-medium transition",
                            active
                              ? "bg-white shadow-sm ring-1 ring-rose-200"
                              : "text-stone-500 hover:bg-white/70",
                            active ? item.tone : "",
                          ].join(" ")}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </label>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  保存个人信息
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setDisplayName(currentDisplayName);
                    setGender(currentGender as "UNKNOWN" | "MALE" | "FEMALE");
                  }}
                  className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  重置
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-white/50 bg-white/65 p-6 shadow-[0_12px_35px_rgba(251,113,133,0.12)] backdrop-blur-md sm:p-7">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-warm-700">
            <KeyRound className="h-4 w-4" />
            修改密码
          </h2>
          <p className="mt-1 text-xs text-stone-500">建议使用至少 8 位密码，并包含字母和数字。</p>
          <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={(e) => void onChangePwd(e)}>
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="当前密码"
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="新密码（至少6位）"
              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-gradient-to-r from-warm-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                保存密码
              </button>
            </div>
          </form>
        </section>

        {err ? <p className="mt-3 rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-500">{err}</p> : null}
        {ok ? <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-600">{ok}</p> : null}
      </main>
    </div>
  );
}
