import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createMomentPhoto,
  createMomentUploadTicket,
  deleteMomentPhoto,
  ensureMomentsFeaturedPlaylist,
  fetchMomentsFeaturedPlaylist,
  fetchVisiblePlaylists,
  listMomentPhotos,
  patchMomentPhoto,
  setMomentsFeaturedPlaylist,
  uploadObjectToCos,
  type MomentPhotoDto,
  type PlaylistItemDto,
} from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import { extractImageColors, parsePaletteJson } from "../moments/colorExtract";
import clsx from "clsx";

type UploadItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  percent: number | null;
  error?: string;
};

function extOf(file: File): string {
  const n = file.name || "";
  const i = n.lastIndexOf(".");
  if (i >= 0 && i < n.length - 1) return n.slice(i + 1).toLowerCase();
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const q = [...items];
  const runners = Array.from({ length: Math.min(concurrency, q.length) }, async () => {
    while (q.length) {
      const item = q.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export function AdminMomentsPanel() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MomentPhotoDto[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [featured, setFeatured] = useState<PlaylistItemDto | null>(null);
  const [ownedPlaylists, setOwnedPlaylists] = useState<PlaylistItemDto[]>([]);
  const [featuredBusy, setFeaturedBusy] = useState(false);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listMomentPhotos(p, 40);
      setItems(res.content);
      setPage(res.number);
      setTotalPages(res.totalPages);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeatured = useCallback(async () => {
    try {
      const [pl, all] = await Promise.all([fetchMomentsFeaturedPlaylist(), fetchVisiblePlaylists()]);
      setFeatured(pl);
      setOwnedPlaylists(all.filter((x) => x.iAmOwner));
    } catch {
      setFeatured(null);
      setOwnedPlaylists([]);
    }
  }, []);

  useEffect(() => {
    void load(0);
    void loadFeatured();
  }, [load, loadFeatured]);

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name));
    if (!list.length) {
      setErr("请选择图片文件");
      return;
    }
    setBusy(true);
    setErr(null);
    const jobs: UploadItem[] = list.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      status: "pending",
      percent: null,
    }));
    setUploads(jobs);

    await mapPool(list.map((file, i) => ({ file, jobId: jobs[i].id })), 3, async ({ file, jobId }) => {
      const patch = (partial: Partial<UploadItem>) =>
        setUploads((prev) => prev.map((u) => (u.id === jobId ? { ...u, ...partial } : u)));
      try {
        patch({ status: "uploading", percent: 0 });
        const ticket = await createMomentUploadTicket({
          ext: extOf(file),
          contentType: file.type || undefined,
        });
        await uploadObjectToCos(ticket, ticket.objectKey, file, (percent) => {
          patch({ percent });
        });
        const size = await readImageSize(file);
        let color: Awaited<ReturnType<typeof extractImageColors>> | null = null;
        try {
          color = await extractImageColors(file);
        } catch {
          color = null;
        }
        await createMomentPhoto({
          objectKey: ticket.objectKey,
          width: size?.width ?? null,
          height: size?.height ?? null,
          dominantHue: color?.dominantHue ?? null,
          dominantSat: color?.dominantSat ?? null,
          dominantLight: color?.dominantLight ?? null,
          paletteJson: color?.paletteJson ?? null,
        });
        patch({ status: "done", percent: 100 });
      } catch (e) {
        patch({
          status: "error",
          error: e instanceof Error ? e.message : "上传失败",
        });
      }
    });

    setBusy(false);
    await load(0);
  };

  const onConfirmDelete = async () => {
    if (deleteId == null) return;
    try {
      await deleteMomentPhoto(deleteId);
      setItems((prev) => prev.filter((x) => x.id !== deleteId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("moments.deleteFailed"));
      throw e;
    }
  };

  const onSaveCaption = async (id: number, caption: string) => {
    try {
      const updated = await patchMomentPhoto(id, { caption });
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    }
  };

  const onAnalyzeColor = async (m: MomentPhotoDto) => {
    try {
      const color = await extractImageColors(m.thumbUrl || m.publicUrl);
      const updated = await patchMomentPhoto(m.id, {
        dominantHue: color.dominantHue,
        dominantSat: color.dominantSat,
        dominantLight: color.dominantLight,
        paletteJson: color.paletteJson,
      });
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "取色失败（可能是 COS 跨域）");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-700/70 bg-zinc-900/50 p-4">
        <h3 className="text-sm font-medium text-zinc-100">{t("admin.momentsFeaturedTitle")}</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{t("admin.momentsFeaturedHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {featured ? (
            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-200 ring-1 ring-rose-500/30">
              {featured.name} · {featured.trackCount} {t("admin.momentsFeaturedTracks")}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">{t("admin.momentsFeaturedNone")}</span>
          )}
          <button
            type="button"
            disabled={featuredBusy}
            onClick={() => {
              setFeaturedBusy(true);
              void ensureMomentsFeaturedPlaylist()
                .then(async (pl) => {
                  setFeatured(pl);
                  await loadFeatured();
                })
                .catch((e) => setErr(e instanceof Error ? e.message : t("admin.momentsFeaturedFailed")))
                .finally(() => setFeaturedBusy(false));
            }}
            className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {featured ? t("admin.momentsFeaturedOpen") : t("admin.momentsFeaturedCreate")}
          </button>
          {featured ? (
            <button
              type="button"
              disabled={featuredBusy}
              onClick={() => {
                setFeaturedBusy(true);
                void setMomentsFeaturedPlaylist(null)
                  .then(() => {
                    setFeatured(null);
                    return loadFeatured();
                  })
                  .catch((e) => setErr(e instanceof Error ? e.message : t("admin.momentsFeaturedFailed")))
                  .finally(() => setFeaturedBusy(false));
              }}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {t("admin.momentsFeaturedClear")}
            </button>
          ) : null}
          {featured ? (
            <Link
              to="/music"
              className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-500/10"
            >
              {t("admin.momentsFeaturedManageSongs")}
            </Link>
          ) : null}
        </div>
        {ownedPlaylists.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ownedPlaylists.map((pl) => {
              const active = featured?.id === pl.id;
              return (
                <button
                  key={pl.id}
                  type="button"
                  disabled={featuredBusy || active}
                  onClick={() => {
                    setFeaturedBusy(true);
                    void setMomentsFeaturedPlaylist(pl.id)
                      .then((next) => {
                        setFeatured(next);
                        return loadFeatured();
                      })
                      .catch((e) => setErr(e instanceof Error ? e.message : t("admin.momentsFeaturedFailed")))
                      .finally(() => setFeaturedBusy(false));
                  }}
                  className={clsx(
                    "rounded-full px-2.5 py-1 text-[11px] transition",
                    active
                      ? "bg-rose-500 text-white"
                      : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
                  )}
                >
                  {pl.name}
                  {pl.momentsFeatured ? " ★" : ""}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-300">{t("admin.momentsUploadHint")}</p>
          <Link to="/moments" className="mt-1 inline-block text-xs text-violet-300 hover:text-violet-200">
            {t("admin.momentsOpenPage")}
          </Link>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          选择图片
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic"
          multiple
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {err ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</p> : null}

      {uploads.length > 0 ? (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-xs">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 text-zinc-400">
              <span className="min-w-0 truncate">{u.name}</span>
              <span className="shrink-0 tabular-nums">
                {u.status === "done"
                  ? "完成"
                  : u.status === "error"
                    ? u.error || "失败"
                    : u.percent == null
                      ? "…"
                      : `${u.percent}%`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">还没有照片。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
              <div className="aspect-[4/3] bg-zinc-950">
                <img src={m.thumbUrl || m.publicUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="space-y-2 p-2.5">
                <input
                  defaultValue={m.caption ?? ""}
                  placeholder="备注（可选）"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === (m.caption ?? "")) return;
                    void onSaveCaption(m.id, v);
                  }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {parsePaletteJson(m.paletteJson).slice(0, 4).map((sw) => (
                    <span
                      key={sw.hex}
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20"
                      style={{ background: sw.hex }}
                      title={sw.hex}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => void onAnalyzeColor(m)}
                    className="rounded-md px-2 py-1 text-[11px] text-violet-300/90 transition hover:bg-violet-500/10"
                  >
                    取色
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(m.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-rose-300/90 transition hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("moments.delete")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button
            type="button"
            disabled={page <= 0 || loading}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-300 disabled:opacity-40"
            onClick={() => void load(page - 1)}
          >
            上一页
          </button>
          <span className="text-zinc-500">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages || loading}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-300 disabled:opacity-40"
            onClick={() => void load(page + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title={t("moments.deleteTitle")}
        confirmLabel={t("moments.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={onConfirmDelete}
      >
        <p>{t("moments.deleteConfirm")}</p>
      </ConfirmModal>
    </div>
  );
}
