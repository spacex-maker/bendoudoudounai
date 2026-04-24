import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { mapApiError } from "../i18n/mapApiError";
import { X, ImageIcon, Link2, UserPlus, ListMusic } from "lucide-react";
import { isAllowedRemoteWallpaperUrl } from "../pageAppearance/PageAppearanceContext";
import {
  createPlaylist,
  inviteToPlaylist,
  updatePlaylistWallpaperUrl,
  uploadPlaylistWallpaper,
} from "../api/client";

type WallpaperMode = "none" | "upload" | "url";

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** 创建成功并已保存壁纸/邀请处理完后调用，参数为新歌单 id */
  onCreated: (playlistId: number) => void | Promise<void>;
  currentUserEmail: string;
};

export function CreatePlaylistModal({ open, onClose, onCreated, currentUserEmail }: Props) {
  const { t } = useTranslation();
  const fileInputId = useId();
  const [name, setName] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");
  const [wallpaperMode, setWallpaperMode] = useState<WallpaperMode>("none");
  const [wallpaperFile, setWallpaperFile] = useState<File | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(t("createPlaylist.defaultName"));
    setInvitees([]);
    setInviteDraft("");
    setWallpaperMode("none");
    setWallpaperFile(null);
    setWallpaperUrl("");
    setErr(null);
    setSubmitting(false);
  }, [open, t]);

  if (!open) return null;

  const selfLower = currentUserEmail.trim().toLowerCase();

  const addInvitee = () => {
    const raw = inviteDraft.trim().toLowerCase();
    if (!raw) return;
    if (!isEmail(raw)) {
      setErr(t("createPlaylist.errEmail"));
      return;
    }
    if (selfLower && raw === selfLower) {
      setErr(t("createPlaylist.errSelf"));
      return;
    }
    if (invitees.includes(raw)) {
      setInviteDraft("");
      setErr(null);
      return;
    }
    if (invitees.length >= 24) {
      setErr(t("createPlaylist.errMax"));
      return;
    }
    setInvitees((prev) => [...prev, raw]);
    setInviteDraft("");
    setErr(null);
  };

  const removeInvitee = (email: string) => {
    setInvitees((prev) => prev.filter((e) => e !== email));
  };

  const onWallpaperFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr(t("createPlaylist.errImage"));
      return;
    }
    setWallpaperFile(f);
    setErr(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = name.trim();
    if (!nameTrim) {
      setErr(t("createPlaylist.errName"));
      return;
    }
    if (wallpaperMode === "url") {
      const u = wallpaperUrl.trim();
      if (u && !isAllowedRemoteWallpaperUrl(u)) {
        setErr(t("createPlaylist.errBgUrl"));
        return;
      }
    }

    setErr(null);
    setSubmitting(true);
    const inviteWarnings: string[] = [];

    try {
      const created = await createPlaylist(nameTrim);
      const id = created.id;

      if (wallpaperMode === "upload" && wallpaperFile) {
        await uploadPlaylistWallpaper(id, wallpaperFile);
      } else if (wallpaperMode === "url" && wallpaperUrl.trim()) {
        await updatePlaylistWallpaperUrl(id, wallpaperUrl.trim());
      }

      for (const em of invitees) {
        try {
          await inviteToPlaylist(id, em);
        } catch (ex) {
          inviteWarnings.push(`${em}：${mapApiError(t, ex)}`);
        }
      }

      await onCreated(id);
      onClose();
      if (inviteWarnings.length > 0) {
        window.alert(t("createPlaylist.invitePartFail", { detail: inviteWarnings.join("\n") }));
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t("createPlaylist.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-md"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-900/72 text-zinc-200 shadow-[0_24px_64px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.06] backdrop-blur-2xl backdrop-saturate-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-pl-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h2 id="create-pl-title" className="flex items-center gap-2 text-sm font-medium">
            <ListMusic className="h-4 w-4 text-red-400/90" />
            {t("createPlaylist.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => void submit(e)}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs"
        >
          <div>
            <label htmlFor="create-pl-name" className="mb-1 block text-zinc-500">
              {t("createPlaylist.nameLabel")} <span className="text-red-400/80">*</span>
            </label>
            <input
              id="create-pl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder={t("createPlaylist.namePh")}
              className="w-full rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-red-900/40"
            />
          </div>

          <div>
            <span className="mb-1 block text-zinc-500">{t("createPlaylist.shareLabel")}</span>
            <p className="mb-2 text-[11px] leading-snug text-zinc-600">
              {t("createPlaylist.shareHint")}
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteDraft}
                onChange={(e) => {
                  setInviteDraft(e.target.value);
                  setErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInvitee();
                  }
                }}
                placeholder={t("createPlaylist.emailPh")}
                disabled={submitting}
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-red-900/40"
              />
              <button
                type="button"
                onClick={addInvitee}
                disabled={submitting}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-zinc-300 transition hover:bg-white/15 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t("createPlaylist.add")}
              </button>
            </div>
            {invitees.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {invitees.map((em) => (
                  <li
                    key={em}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-red-950/50 py-1 pl-2.5 pr-1 text-[11px] text-red-100/95 ring-1 ring-red-900/40"
                  >
                    <span className="truncate">{em}</span>
                    <button
                      type="button"
                      onClick={() => removeInvitee(em)}
                      disabled={submitting}
                      className="rounded-full p-0.5 text-red-200/80 hover:bg-red-900/60 hover:text-white disabled:opacity-50"
                      aria-label={`移除 ${em}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <span className="mb-2 block text-zinc-500">{t("createPlaylist.background")}</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "none" as const, labelKey: "createPlaylist.bgDefault" as const },
                  { id: "upload" as const, labelKey: "createPlaylist.bgUpload" as const },
                  { id: "url" as const, labelKey: "createPlaylist.bgUrl" as const },
                ] as const
              ).map(({ id, labelKey: lk }) => (
                <button
                  key={id}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setWallpaperMode(id);
                    if (id !== "upload") setWallpaperFile(null);
                    if (id !== "url") setWallpaperUrl("");
                    setErr(null);
                  }}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-[11px] transition",
                    wallpaperMode === id
                      ? "bg-red-900/70 text-white ring-1 ring-red-700/50"
                      : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
                  )}
                >
                  {t(lk)}
                </button>
              ))}
            </div>

            {wallpaperMode === "upload" ? (
              <div className="mt-3">
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={submitting}
                  onChange={onWallpaperFile}
                />
                <label
                  htmlFor={fileInputId}
                  className={clsx(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-zinc-300 transition hover:bg-white/10",
                    submitting && "pointer-events-none opacity-50"
                  )}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {wallpaperFile ? wallpaperFile.name : t("createPlaylist.chooseImage")}
                </label>
              </div>
            ) : null}

            {wallpaperMode === "url" ? (
              <div className="relative mt-3">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="url"
                  value={wallpaperUrl}
                  onChange={(e) => {
                    setWallpaperUrl(e.target.value);
                    setErr(null);
                  }}
                  placeholder="https://…"
                  disabled={submitting}
                  className="w-full rounded-full border border-white/10 bg-white/[0.06] py-2 pl-8 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-red-900/40"
                />
              </div>
            ) : null}
          </div>

          {err ? <p className="text-[11px] text-red-400/90">{err}</p> : null}

          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-white/10 px-4 py-2 text-zinc-400 transition hover:bg-white/5 disabled:opacity-50"
            >
              {t("createPlaylist.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-red-900/80 px-4 py-2 text-white transition hover:bg-red-800 disabled:opacity-50"
            >
              {submitting ? t("createPlaylist.creating") : t("createPlaylist.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
