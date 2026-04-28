import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { X, Upload, Sparkles, Loader2 } from "lucide-react";
import { parseBlob } from "music-metadata-browser";
import {
  createCosUploadTicket,
  createTrackFromCos,
  previewMusicFile,
  uploadObjectToCos,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";

const AUDIO_NAME = /\.(mp3|m4a|flac|wav|ogg|aac|rc)$/i;
const LYRICS_NAME = /\.(lrc|txt|krc|srt)$/i;

function isAudioFile(f: File): boolean {
  return AUDIO_NAME.test(f.name) || f.type.startsWith("audio/");
}

function isLyricsFileName(f: File): boolean {
  return LYRICS_NAME.test(f.name);
}

function extOfFileName(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i < 0 || i >= name.length - 1) return null;
  return name.substring(i + 1).toLowerCase();
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

type ExtractedCover = {
  file: File;
  ext: "jpg" | "jpeg" | "png" | "webp";
};

function coverExtFromMime(mime?: string | null): ExtractedCover["ext"] | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return null;
}

async function extractCoverFromAudio(file: File): Promise<ExtractedCover | null> {
  try {
    const metadata = await parseBlob(file, { skipCovers: false, duration: false });
    const pic = metadata.common.picture?.[0];
    if (!pic?.data || pic.data.length === 0) {
      return null;
    }
    const ext = coverExtFromMime(pic.format);
    if (!ext) return null;
    const blob = new Blob([pic.data], { type: pic.format || "image/jpeg" });
    const coverFile = new File([blob], `cover.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
    return { file: coverFile, ext };
  } catch {
    return null;
  }
}

function splitAudioAndLyricsFromDataTransfer(dt: DataTransfer | null): { audio: File | null; lyrics: File | null } {
  let audio: File | null = null;
  let lyrics: File | null = null;
  if (!dt?.files?.length) {
    return { audio, lyrics };
  }
  for (let i = 0; i < dt.files.length; i++) {
    const f = dt.files[i]!;
    if (!audio && isAudioFile(f)) {
      audio = f;
    } else if (!lyrics && isLyricsFileName(f)) {
      lyrics = f;
    }
  }
  return { audio, lyrics };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** 不传则由后端创建「我的歌单」并加入（仅第一次） */
  playlistId?: number;
};

export function UploadTrackModal({ open, onClose, onSuccess, playlistId }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [note, setNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** null=未上传；number=0–100；indeterminate=浏览器未提供总量 */
  const [uploadProgress, setUploadProgress] = useState<number | "indeterminate" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [recognized, setRecognized] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const [lyricsDragOver, setLyricsDragOver] = useState(false);
  const lyricsDragDepth = useRef(0);

  const reset = useCallback(() => {
    setFile(null);
    setLyricsFile(null);
    setTitle("");
    setArtist("");
    setAlbum("");
    setDurationSeconds(0);
    setNote("");
    setErr(null);
    setRecognized(false);
    setDragOver(false);
    dragDepth.current = 0;
    setLyricsDragOver(false);
    lyricsDragDepth.current = 0;
    setUploadProgress(null);
  }, []);

  const runScan = useCallback(async (f: File) => {
    setScanning(true);
    setErr(null);
    try {
      const p = await previewMusicFile(f);
      setTitle(p.title);
      setArtist(p.artist);
      setAlbum(p.album);
      setDurationSeconds(p.durationSeconds);
      setRecognized(p.fileHadEmbeddedOrParsed);
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setScanning(false);
    }
  }, [t]);

  const onPickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setErr(null);
    void runScan(f);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    const { audio, lyrics } = splitAudioAndLyricsFromDataTransfer(e.dataTransfer);
    if (lyrics) {
      setErr(null);
      setLyricsFile(lyrics);
    }
    if (audio) {
      onPickFile(audio);
    } else if (!lyrics) {
      setErr(t("uploadTrack.dragAudio"));
    } else {
      setErr(t("uploadTrack.addLyricsFirst"));
    }
  };

  const onLyricsDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lyricsDragDepth.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setLyricsDragOver(true);
    }
  };

  const onLyricsDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lyricsDragDepth.current -= 1;
    if (lyricsDragDepth.current <= 0) {
      lyricsDragDepth.current = 0;
      setLyricsDragOver(false);
    }
  };

  const onLyricsDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDropLyrics = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lyricsDragDepth.current = 0;
    setLyricsDragOver(false);
    if (!e.dataTransfer.files?.length) {
      return;
    }
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const f = e.dataTransfer.files[i]!;
      if (isLyricsFileName(f)) {
        setErr(null);
        setLyricsFile(f);
        return;
      }
    }
    setErr(t("uploadTrack.lyricsOnly"));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErr(t("uploadTrack.pickAudio"));
      return;
    }
    setUploading(true);
    setErr(null);
    setUploadProgress(0);
    try {
      const audioExt = extOfFileName(file.name);
      if (!audioExt) {
        throw new Error(t("uploadTrack.pickAudio"));
      }
      const lyricsExt = lyricsFile ? extOfFileName(lyricsFile.name) : null;
      const cover = await extractCoverFromAudio(file);
      const audioSha = await sha256Hex(file);
      const ticket = await createCosUploadTicket({
        audioSha256: audioSha,
        audioExt,
        lyricsExt,
        coverExt: cover?.ext ?? null,
      });
      await uploadObjectToCos(ticket, ticket.audioObjectKey, file, (p) => {
        if (p == null) {
          setUploadProgress("indeterminate");
        } else {
          setUploadProgress(Math.max(1, Math.min(98, Math.round(p * 0.9))));
        }
      });
      if (lyricsFile && ticket.lyricsObjectKey) {
        await uploadObjectToCos(ticket, ticket.lyricsObjectKey, lyricsFile, (p) => {
          if (p == null) return;
          setUploadProgress(Math.max(90, Math.min(99, 90 + Math.round(p * 0.1))));
        });
      }
      if (cover && ticket.coverObjectKey) {
        await uploadObjectToCos(ticket, ticket.coverObjectKey, cover.file);
      }
      setUploadProgress(100);
      await createTrackFromCos({
        playlistId,
        audioSha256: audioSha,
        audioExt,
        title,
        artist,
        album,
        note,
        durationSeconds,
        originalFilename: file.name,
        metadataFromFile: recognized,
        fileSize: file.size,
        mimeType: file.type || undefined,
        audioObjectKey: ticket.audioObjectKey,
        lyricsObjectKey: ticket.lyricsObjectKey,
        coverObjectKey: ticket.coverObjectKey,
      });
      reset();
      onSuccess();
      onClose();
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  if (!open) return null;

  const fieldClass =
    "w-full rounded-full border border-netease-line/90 bg-[#1e1e1e] px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) {
          reset();
          onClose();
        }
      }}
    >
      <div
        className="w-full overflow-hidden rounded-t-3xl border border-netease-line/80 border-b-0 bg-[#2a2a2a] text-zinc-200 shadow-2xl max-sm:max-h-[92dvh] sm:max-w-md sm:rounded-3xl sm:border-b"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-track-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-netease-line/60 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id="upload-track-title" className="text-sm font-medium tracking-tight text-zinc-100">
            {t("uploadTrack.title")}
          </h2>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="custom-scrollbar space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-xs max-sm:max-h-[calc(92dvh-60px)] sm:p-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">{t("uploadTrack.file")}</label>
            <div
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              className={clsx(
                "relative min-h-[8.5rem] rounded-3xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                dragOver
                  ? "border-red-500/80 bg-red-950/30"
                  : "border-zinc-600/90 bg-[#1a1a1a] hover:border-zinc-500"
              )}
            >
              <Upload
                className={clsx("mx-auto mb-2 h-7 w-7", dragOver ? "text-red-300" : "text-zinc-500")}
                aria-hidden
              />
              <p className="text-zinc-400">
                <span className="text-zinc-300">{t("uploadTrack.dropAudio")}</span>
                <span className="text-zinc-500">{t("uploadTrack.dropLyricsNote")}</span>
                <span className="text-zinc-600"> · </span>
                {t("uploadTrack.or")}
                <label className="ml-1 cursor-pointer rounded-full bg-red-500/15 px-2 py-0.5 text-red-200/90 transition hover:bg-red-500/25">
                  {t("uploadTrack.clickPick")}
                  <input
                    type="file"
                    className="hidden"
                    accept=".mp3,.m4a,.flac,.wav,.ogg,.aac,.rc"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">{t("uploadTrack.formats")}</p>
            </div>
            {file && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="max-w-full truncate rounded-full bg-zinc-800/80 px-3 py-1 text-[11px] text-zinc-300">
                  {t("uploadTrack.selected", { name: file.name })}
                </span>
                <button
                  type="button"
                  onClick={() => void runScan(file)}
                  disabled={scanning}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-200/95 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {t("uploadTrack.autoScan")}
                </button>
              </div>
            )}
            {recognized && (
              <p className="mt-2 text-[11px] text-emerald-400/90">{t("uploadTrack.recognized")}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-500">{t("uploadTrack.lyricsLabel")}</label>
            <p className="mb-2 text-[10px] leading-relaxed text-zinc-600">{t("uploadTrack.lyricsSub")}</p>
            <div
              onDragEnter={onLyricsDragEnter}
              onDragLeave={onLyricsDragLeave}
              onDragOver={onLyricsDragOver}
              onDrop={onDropLyrics}
              className={clsx(
                "rounded-3xl border-2 border-dashed px-4 py-3 transition-colors",
                lyricsDragOver
                  ? "border-amber-500/80 bg-amber-950/25"
                  : "border-zinc-600/80 bg-[#1a1a1a] hover:border-zinc-500"
              )}
            >
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 text-zinc-400 transition hover:text-zinc-200">
                <input
                  type="file"
                  className="hidden"
                  accept=".lrc,.txt,.krc,.srt"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && !LYRICS_NAME.test(f.name)) {
                      setErr(t("uploadTrack.lyricsType"));
                      setLyricsFile(null);
                      e.target.value = "";
                      return;
                    }
                    setErr(null);
                    setLyricsFile(f);
                  }}
                />
                <span className="text-center text-[12px] leading-snug">
                  {lyricsFile ? t("uploadTrack.selected", { name: lyricsFile.name }) : t("uploadTrack.lyricsOrDrop")}
                </span>
              </label>
            </div>
            {lyricsFile ? (
              <button
                type="button"
                onClick={() => setLyricsFile(null)}
                className="mt-2 rounded-full px-2.5 py-1 text-[11px] text-zinc-500 underline decoration-zinc-600 underline-offset-2 transition hover:text-zinc-300"
              >
                {t("uploadTrack.clear")}
              </button>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-500">{t("uploadTrack.fieldTitle")}</label>
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("uploadTrack.fieldTitlePh")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-500">{t("uploadTrack.fieldArtist")}</label>
            <input className={fieldClass} value={artist} onChange={(e) => setArtist(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-500">{t("uploadTrack.fieldAlbum")}</label>
            <input className={fieldClass} value={album} onChange={(e) => setAlbum(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-500">{t("uploadTrack.fieldNote")}</label>
            <input
              className={fieldClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("uploadTrack.fieldNotePh")}
            />
          </div>
          {err ? <p className="text-[11px] text-red-400/90">{err}</p> : null}
          {uploading && (
            <div className="space-y-2 rounded-3xl border border-netease-line/60 bg-[#1e1e1e] px-4 py-3">
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>{t("uploadTrack.uploading")}</span>
                <span>
                  {uploadProgress === "indeterminate"
                    ? t("uploadTrack.processing")
                    : uploadProgress !== null
                      ? `${uploadProgress}%`
                      : t("uploadTrack.progressWait")}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
                {uploadProgress === "indeterminate" ? (
                  <div className="h-full w-full rounded-full bg-red-500/45 animate-pulse" />
                ) : (
                  <div
                    className="h-full rounded-full bg-netease-accent transition-[width] duration-150"
                    style={{ width: `${typeof uploadProgress === "number" ? uploadProgress : 0}%` }}
                  />
                )}
              </div>
            </div>
          )}
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap justify-end gap-2 border-t border-netease-line/60 bg-[#2a2a2a]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-1 sm:pb-0">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="rounded-full px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="rounded-full bg-netease-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
            >
              {uploading ? t("uploadTrack.uploadingSubmit") : t("uploadTrack.join")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
