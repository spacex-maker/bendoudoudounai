import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Crop, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createMomentUploadTicket,
  replaceMomentPhoto,
  uploadObjectToCos,
  type MomentPhotoDto,
} from "../api/client";
import { extractImageColors } from "../moments/colorExtract";

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  photo: MomentPhotoDto;
  onClose: () => void;
  onReplaced: (next: MomentPhotoDto) => void;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function loadCorsImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败（可能是 COS 跨域）"));
    // 原图，避免缩略图二次压缩；加 t 降低缓存干扰
    const base = url.split("?")[0];
    img.src = `${base}?t=${Date.now()}`;
  });
}

export function MomentsCropModal({ photo, onClose, onReplaced }: Props) {
  const { t } = useTranslation();
  const stageRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [drag, setDrag] = useState<null | { mode: "move" | "br"; ox: number; oy: number; start: Rect }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    void loadCorsImage(photo.publicUrl)
      .then((el) => {
        if (cancelled) return;
        setImg(el);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : t("moments.cropLoadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [photo.publicUrl, t]);

  useEffect(() => {
    if (!img || !stageRef.current) return;
    const layout = () => {
      const box = stageRef.current;
      if (!box) return;
      const maxW = box.clientWidth;
      const maxH = box.clientHeight;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      setDisp({
        w: Math.max(1, Math.round(img.naturalWidth * scale)),
        h: Math.max(1, Math.round(img.naturalHeight * scale)),
      });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [img]);

  const onPointerDown = (mode: "move" | "br") => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ mode, ox: e.clientX, oy: e.clientY, start: crop });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      if (!disp.w || !disp.h) return;
      const dx = (e.clientX - drag.ox) / disp.w;
      const dy = (e.clientY - drag.oy) / disp.h;
      if (drag.mode === "move") {
        const w = drag.start.w;
        const h = drag.start.h;
        setCrop({
          x: clamp(drag.start.x + dx, 0, 1 - w),
          y: clamp(drag.start.y + dy, 0, 1 - h),
          w,
          h,
        });
      } else {
        const w = clamp(drag.start.w + dx, 0.08, 1 - drag.start.x);
        const h = clamp(drag.start.h + dy, 0.08, 1 - drag.start.y);
        setCrop({ ...drag.start, w, h });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, disp.h, disp.w]);

  const applyCrop = async () => {
    if (!img || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const sx = Math.round(crop.x * img.naturalWidth);
      const sy = Math.round(crop.y * img.naturalHeight);
      const sw = Math.max(1, Math.round(crop.w * img.naturalWidth));
      const sh = Math.max(1, Math.round(crop.h * img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 不可用");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("导出失败"))), "image/jpeg", 0.92);
      });
      const file = new File([blob], `moment-${photo.id}-crop.jpg`, { type: "image/jpeg" });
      const ticket = await createMomentUploadTicket({ ext: "jpg", contentType: "image/jpeg" });
      await uploadObjectToCos(ticket, ticket.objectKey, file);
      let color: Awaited<ReturnType<typeof extractImageColors>> | null = null;
      try {
        color = await extractImageColors(file);
      } catch {
        color = null;
      }
      const next = await replaceMomentPhoto(photo.id, {
        objectKey: ticket.objectKey,
        width: sw,
        height: sh,
        dominantHue: color?.dominantHue ?? null,
        dominantSat: color?.dominantSat ?? null,
        dominantLight: color?.dominantLight ?? null,
        paletteJson: color?.paletteJson ?? null,
      });
      onReplaced(next);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("moments.cropFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-stone-950/90 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-900/90 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-stone-200">
            <Crop className="h-4 w-4 text-rose-300" />
            {t("moments.cropTitle")}
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-stone-400 transition hover:bg-white/10 hover:text-white"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center bg-black/40 p-3">
          {!img && !err ? (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : null}
          {img ? (
            <div className="relative" style={{ width: disp.w, height: disp.h }}>
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
              <div
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
                onPointerDown={onPointerDown("move")}
              >
                <button
                  type="button"
                  aria-label={t("moments.cropResize")}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-sm border border-white bg-rose-500"
                  onPointerDown={onPointerDown("br")}
                />
              </div>
            </div>
          ) : null}
        </div>

        {err ? <p className="px-4 py-2 text-center text-xs text-rose-300">{err}</p> : null}

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <p className="mr-auto hidden text-xs text-stone-500 sm:block">{t("moments.cropHint")}</p>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm text-stone-300 transition hover:bg-white/10"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={busy || !img}
            onClick={() => void applyCrop()}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
            {t("moments.cropApply")}
          </button>
        </footer>
      </div>
    </div>
  );
}
