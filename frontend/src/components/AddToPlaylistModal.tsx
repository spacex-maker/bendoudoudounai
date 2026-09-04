import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ListMusic, Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { fetchVisiblePlaylists, type PlaylistItemDto } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";

type Props = {
  open: boolean;
  onClose: () => void;
  songLabel: string;
  /** 当前所在歌单，列表中禁用（已在该歌单） */
  excludePlaylistId?: number | null;
  onPick: (playlistId: number) => Promise<void>;
};

export function AddToPlaylistModal({
  open,
  onClose,
  songLabel,
  excludePlaylistId,
  onPick,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const [playlists, setPlaylists] = useState<PlaylistItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPickingId(null);
      setErr(null);
      setOkMsg(null);
      return;
    }
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    void (async () => {
      try {
        setPlaylists(await fetchVisiblePlaylists());
      } catch (e) {
        setErr(mapApiError(t, e));
        setPlaylists([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pickingId == null) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pickingId]);

  if (!open) return null;

  const pick = async (pl: PlaylistItemDto) => {
    if (pickingId != null) return;
    if (excludePlaylistId != null && pl.id === excludePlaylistId) return;
    setPickingId(pl.id);
    setErr(null);
    setOkMsg(null);
    try {
      await onPick(pl.id);
      setOkMsg(t("music.addToPlaylistDone", { name: pl.name }));
      window.setTimeout(() => onClose(), 650);
    } catch (e) {
      setErr(mapApiError(t, e));
      setPickingId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && pickingId == null) onClose();
      }}
    >
      <div
        className="flex max-h-[min(80dvh,32rem)] w-full flex-col overflow-hidden rounded-t-3xl border border-netease-line/80 border-b-0 bg-[#2a2a2a] text-zinc-200 shadow-2xl sm:max-w-md sm:rounded-3xl sm:border-b"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-netease-line/60 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-medium text-zinc-100">
              {t("music.addToPlaylistTitle")}
            </h2>
            {songLabel ? (
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">{songLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pickingId != null}
            className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("music.addToPlaylistLoading")}
            </div>
          ) : playlists.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">{t("music.addToPlaylistEmpty")}</p>
          ) : (
            <ul className="space-y-0.5">
              {playlists.map((pl) => {
                const excluded = excludePlaylistId != null && pl.id === excludePlaylistId;
                const busy = pickingId === pl.id;
                return (
                  <li key={pl.id}>
                    <button
                      type="button"
                      disabled={pickingId != null || excluded}
                      onClick={() => void pick(pl)}
                      className={clsx(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                        excluded
                          ? "cursor-default opacity-45"
                          : "hover:bg-white/8 disabled:opacity-60"
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 ring-1 ring-white/10">
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-300" />
                        ) : (
                          <ListMusic className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-100">{pl.name}</span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {excluded
                            ? t("music.addToPlaylistAlreadyIn")
                            : t("music.addToPlaylistMeta", {
                                count: pl.trackCount ?? 0,
                                owner: pl.iAmOwner ? t("music.myPlaylist") : pl.ownerLabel,
                              })}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {(err || okMsg) && (
          <div className="shrink-0 border-t border-netease-line/60 px-4 py-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))]">
            {err ? <p className="text-xs text-red-400/90">{err}</p> : null}
            {okMsg ? <p className="text-xs text-emerald-300/90">{okMsg}</p> : null}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
