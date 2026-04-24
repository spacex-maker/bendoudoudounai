import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImageIcon, Link2, Settings2, Trash2, X } from "lucide-react";
import clsx from "clsx";
import {
  isAllowedRemoteWallpaperUrl,
  usePageAppearance,
} from "../pageAppearance/PageAppearanceContext";
import {
  updatePlaylistWallpaperUrl,
  uploadPlaylistWallpaper,
} from "../api/client";

export function PageAppearanceSettings() {
  const idBase = useId();
  const fileInputId = `${idBase}-wallpaper-file`;
  const {
    wallpaperDisplayUrl,
    wallpaperTargetPlaylistId,
    refreshPlaylists,
  } = usePageAppearance();
  const [open, setOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setUrlDraft("");
      setHint(null);
    }
  }, [open]);

  const playlistId = wallpaperTargetPlaylistId;

  const applyUrl = useCallback(async () => {
    if (playlistId == null) return;
    const raw = urlDraft.trim();
    if (!raw) {
      setHint("请输入图片链接");
      return;
    }
    if (!isAllowedRemoteWallpaperUrl(raw)) {
      setHint("仅支持 http(s) 图片链接");
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      await updatePlaylistWallpaperUrl(playlistId, raw);
      await refreshPlaylists();
      setOpen(false);
    } catch (e) {
      setHint(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }, [urlDraft, playlistId, refreshPlaylists]);

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (playlistId == null) return;
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f || !f.type.startsWith("image/")) {
        setHint("请选择图片文件");
        return;
      }
      setBusy(true);
      setHint(null);
      try {
        await uploadPlaylistWallpaper(playlistId, f);
        await refreshPlaylists();
        setOpen(false);
      } catch (err) {
        setHint(err instanceof Error ? err.message : "上传失败");
      } finally {
        setBusy(false);
      }
    },
    [playlistId, refreshPlaylists]
  );

  const clearWallpaper = useCallback(async () => {
    if (playlistId == null) return;
    setBusy(true);
    setHint(null);
    try {
      await updatePlaylistWallpaperUrl(playlistId, null);
      await refreshPlaylists();
      setOpen(false);
    } catch (e) {
      setHint(e instanceof Error ? e.message : "清除失败");
    } finally {
      setBusy(false);
    }
  }, [playlistId, refreshPlaylists]);

  if (playlistId == null) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[200] sm:right-6 sm:top-5">
      <div className="pointer-events-auto relative flex flex-col items-end gap-2">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition sm:h-11 sm:w-11",
            "border border-white/25 bg-white/75 text-stone-700 backdrop-blur-xl",
            "hover:bg-white/90 hover:text-stone-900 active:scale-95 disabled:opacity-50",
            open && "ring-2 ring-rose-300/60"
          )}
          title="歌单背景（成员可见）"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Settings2 className="h-5 w-5" strokeWidth={2} />
        </button>

        {open ? (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="歌单背景设置"
            className={clsx(
              "w-[min(100vw-2rem,20rem)] rounded-2xl border border-white/40 p-4 shadow-2xl",
              "bg-white/80 text-stone-800 backdrop-blur-2xl"
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-stone-800">歌单背景</p>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                  保存在当前歌单，共享成员都会看到
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-700"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {wallpaperDisplayUrl ? (
              <div className="mb-3 overflow-hidden rounded-xl border border-stone-200/80 bg-stone-100/80">
                <img
                  src={wallpaperDisplayUrl}
                  alt="当前壁纸预览"
                  className="h-20 w-full object-cover"
                />
              </div>
            ) : null}

            <label className="mb-2 block text-[11px] font-medium text-stone-500">
              图片链接
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && void applyUrl()}
                  placeholder="https://…"
                  disabled={busy}
                  className="w-full rounded-xl border border-stone-200/90 bg-white/90 py-2 pl-8 pr-2 text-xs text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/50 disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={() => void applyUrl()}
                disabled={busy}
                className="shrink-0 rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
              >
                {busy ? "…" : "应用"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy}
                onChange={(e) => void onPickFile(e)}
              />
              <label
                htmlFor={fileInputId}
                className={clsx(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white/70 px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-white",
                  busy && "pointer-events-none opacity-50"
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                从本地上传
              </label>
              {wallpaperDisplayUrl ? (
                <button
                  type="button"
                  onClick={() => void clearWallpaper()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清除壁纸
                </button>
              ) : null}
            </div>

            {hint ? <p className="mt-2 text-[11px] text-rose-600">{hint}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
