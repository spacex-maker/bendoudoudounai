import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronLeft,
  Heart,
  History,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import {
  addTrackToPlaylist,
  coverDisplayUrl,
  discoverSearchNetease,
  fetchHeartTracks,
  fetchMusicTracksPage,
  fetchPlayHistoryTracks,
  fetchVisiblePlaylists,
  importNeteaseTrack,
  type DiscoverSearchItemDto,
  type MusicTrackDto,
  type PlaylistItemDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { isAudioQualityCode, type AudioQualityCode } from "../music/audioQuality";
import { useMusicPlayer } from "../music/MusicPlayerContext";

const QUALITY_KEY = "bendoudou_discover_quality";
const QUALITY_OPTIONS: AudioQualityCode[] = ["standard", "higher", "exhigh", "lossless", "hires"];

type SourceTab = "playlists" | "liked" | "history" | "discover";

type QueueStatus = "pending" | "running" | "done" | "error" | "skipped";

type QueueItem = {
  key: string;
  title: string;
  artist: string;
  coverUrl?: string | null;
  kind: "local" | "netease";
  trackId?: number;
  neteaseSongId?: number;
  status: QueueStatus;
  detail?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  targetPlaylistId: number;
  targetPlaylistName: string;
  /** 目标歌单已有曲目，用于前端去重提示 */
  existingTracks?: MusicTrackDto[];
  onTracksAdded?: (tracks: MusicTrackDto[]) => void;
};

function readStoredQuality(): AudioQualityCode {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (isAudioQualityCode(v)) return v;
  } catch {
    /* ignore */
  }
  return "exhigh";
}

function formatDuration(sec: number) {
  const n = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function trackSelectKey(tr: MusicTrackDto): string {
  if (tr.neteaseSongId != null && tr.neteaseSongId > 0) {
    return `ne:${tr.neteaseSongId}`;
  }
  return `id:${tr.id}`;
}

function discoverSelectKey(item: DiscoverSearchItemDto): string {
  return `ne:${item.neteaseSongId}`;
}

export function AddTracksToPlaylistModal({
  open,
  onClose,
  targetPlaylistId,
  targetPlaylistName,
  existingTracks = [],
  onTracksAdded,
}: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const { currentId, playing, playPauseTrack, selectTrack } = useMusicPlayer();
  const [tab, setTab] = useState<SourceTab>("liked");
  const [playlists, setPlaylists] = useState<PlaylistItemDto[]>([]);
  const [sourcePlaylistId, setSourcePlaylistId] = useState<number | null>(null);
  const [sourceTracks, setSourceTracks] = useState<MusicTrackDto[]>([]);
  const [sourcePage, setSourcePage] = useState(0);
  const [sourceHasMore, setSourceHasMore] = useState(false);
  const [sourceLoadingMore, setSourceLoadingMore] = useState(false);
  const SOURCE_PAGE_SIZE = 40;
  const [discoverItems, setDiscoverItems] = useState<DiscoverSearchItemDto[]>([]);
  const [discoverQ, setDiscoverQ] = useState("");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [quality, setQuality] = useState<AudioQualityCode>(() => readStoredQuality());
  const [playBusyKey, setPlayBusyKey] = useState<string | null>(null);
  const [playErr, setPlayErr] = useState<string | null>(null);
  const abortRef = useRef(false);
  const qualityRef = useRef(quality);
  const selectionCatalog = useRef<Map<string, QueueItem>>(new Map());
  const importedByKeyRef = useRef<Map<string, MusicTrackDto>>(new Map());
  const [importedKeysTick, setImportedKeysTick] = useState(0);
  const sourceListScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    qualityRef.current = quality;
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      /* ignore */
    }
  }, [quality]);

  useEffect(() => {
    if (!open) return;
    setQuality(readStoredQuality());
  }, [open]);

  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const tr of existingTracks) {
      keys.add(trackSelectKey(tr));
      keys.add(`id:${tr.id}`);
      if (tr.note) keys.add(`note:${tr.note}`);
    }
    for (const key of importedByKeyRef.current.keys()) {
      keys.add(key);
    }
    return keys;
    // importedKeysTick forces refresh after play-import
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTracks, importedKeysTick]);

  const resetPicker = useCallback(() => {
    setSelected(new Set());
    setSourceTracks([]);
    setDiscoverItems([]);
    setDiscoverQ("");
    setDiscoverQuery("");
    setSourcePlaylistId(null);
    setListErr(null);
    setPlayErr(null);
    setPlayBusyKey(null);
    selectionCatalog.current.clear();
    importedByKeyRef.current.clear();
    setImportedKeysTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!open) {
      abortRef.current = true;
      setRunning(false);
      setQueue([]);
      setTab("liked");
      resetPicker();
      return;
    }
    abortRef.current = false;
    setLoading(true);
    setListErr(null);
    void (async () => {
      try {
        setPlaylists(await fetchVisiblePlaylists());
      } catch (e) {
        setListErr(mapApiError(t, e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, resetPicker, t]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !running) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, running]);

  const loadSourceList = useCallback(
    async (nextTab: SourceTab, playlistId?: number | null) => {
      setLoading(true);
      setListErr(null);
      setSourceTracks([]);
      setDiscoverItems([]);
      setSourcePage(0);
      setSourceHasMore(false);
      try {
        if (nextTab === "liked") {
          setSourceTracks(await fetchHeartTracks());
        } else if (nextTab === "history") {
          setSourceTracks(await fetchPlayHistoryTracks());
        } else if (nextTab === "playlists") {
          if (playlistId == null) {
            setSourceTracks([]);
          } else {
            const page = await fetchMusicTracksPage(playlistId, {
              page: 0,
              size: SOURCE_PAGE_SIZE,
            });
            setSourceTracks(page.items);
            setSourceHasMore(page.hasMore);
            setSourcePage(page.page);
          }
        }
      } catch (e) {
        setListErr(mapApiError(t, e));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const loadMoreSourceTracks = async () => {
    if (tab !== "playlists" || sourcePlaylistId == null) return;
    if (!sourceHasMore || sourceLoadingMore || loading) return;
    setSourceLoadingMore(true);
    setListErr(null);
    try {
      const page = await fetchMusicTracksPage(sourcePlaylistId, {
        page: sourcePage + 1,
        size: SOURCE_PAGE_SIZE,
      });
      setSourceTracks((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const tr of page.items) {
          if (seen.has(tr.id)) continue;
          merged.push(tr);
          seen.add(tr.id);
        }
        return merged;
      });
      setSourceHasMore(page.hasMore);
      setSourcePage(page.page);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setSourceLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (tab === "discover") return;
    if (tab === "playlists" && sourcePlaylistId == null) {
      setSourceTracks([]);
      return;
    }
    void loadSourceList(tab, sourcePlaylistId);
  }, [open, tab, sourcePlaylistId, loadSourceList]);

  useEffect(() => {
    if (!(tab === "playlists" && sourceHasMore && sourcePlaylistId != null)) return;
    const root = sourceListScrollRef.current;
    const el = sourceLoadMoreSentinelRef.current;
    if (!root || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (sourceLoadingMore || loading || running) return;
        void loadMoreSourceTracks();
      },
      { root, rootMargin: "120px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    tab,
    sourceHasMore,
    sourcePlaylistId,
    sourceLoadingMore,
    loading,
    running,
    sourceTracks.length,
    sourcePage,
  ]);

  const runDiscoverSearch = async (raw: string) => {
    const q = raw.trim();
    setDiscoverQuery(q);
    if (q.length < 2) {
      setDiscoverItems([]);
      return;
    }
    setLoading(true);
    setListErr(null);
    try {
      const page = await discoverSearchNetease(q, 0, 40);
      setDiscoverItems(page.items);
    } catch (e) {
      setListErr(mapApiError(t, e));
      setDiscoverItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleKey = (key: string, item: QueueItem) => {
    selectionCatalog.current.set(key, item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (tab === "discover") {
      const next = new Set(selected);
      for (const item of discoverItems) {
        const key = discoverSelectKey(item);
        if (existingKeys.has(key)) continue;
        next.add(key);
        selectionCatalog.current.set(key, {
          key,
          title: item.title,
          artist: item.artist,
          coverUrl: item.coverUrl,
          kind: "netease",
          neteaseSongId: item.neteaseSongId,
          status: "pending",
        });
      }
      setSelected(next);
      return;
    }
    const next = new Set(selected);
    for (const tr of sourceTracks) {
      const key = trackSelectKey(tr);
      if (existingKeys.has(key) || existingKeys.has(`id:${tr.id}`)) continue;
      next.add(key);
      selectionCatalog.current.set(key, {
        key,
        title: tr.title,
        artist: tr.artist,
        coverUrl: tr.coverUrl,
        kind: "local",
        trackId: tr.id,
        neteaseSongId: tr.neteaseSongId ?? undefined,
        status: "pending",
      });
    }
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const enqueueSelected = () => {
    if (selected.size === 0 || running) return;
    const items: QueueItem[] = [];
    for (const key of selected) {
      const base = selectionCatalog.current.get(key);
      if (!base) continue;
      if (existingKeys.has(key)) {
        items.push({ ...base, status: "skipped", detail: t("music.addTracksAlreadyIn") });
      } else {
        items.push({ ...base, status: "pending", detail: null });
      }
    }
    if (items.length === 0) return;
    setQueue((prev) => {
      const seen = new Set(prev.map((x) => x.key));
      const merged = [...prev];
      for (const it of items) {
        if (seen.has(it.key)) continue;
        merged.push(it);
        seen.add(it.key);
      }
      return merged;
    });
    clearSelection();
  };

  const processQueue = useCallback(async () => {
    if (running) return;
    setRunning(true);
    abortRef.current = false;
    const added: MusicTrackDto[] = [];

    const snapshot = () =>
      new Promise<QueueItem[]>((resolve) => {
        setQueue((prev) => {
          resolve(prev);
          return prev;
        });
      });

    try {
      for (;;) {
        if (abortRef.current) break;
        const current = await snapshot();
        const idx = current.findIndex((x) => x.status === "pending");
        if (idx < 0) break;
        const item = current[idx]!;
        const importQuality = qualityRef.current;
        setQueue((prev) =>
          prev.map((x, i) =>
            i === idx
              ? {
                  ...x,
                  status: "running",
                  detail:
                    item.kind === "netease"
                      ? t("music.addTracksStatusUploadingQuality", {
                          quality: t(`music.quality.${importQuality}`),
                        })
                      : t("music.addTracksStatusRunning"),
                }
              : x
          )
        );
        try {
          let track: MusicTrackDto;
          if (item.kind === "local" && item.trackId != null) {
            track = await addTrackToPlaylist(item.trackId, targetPlaylistId);
            setQueue((prev) =>
              prev.map((x, i) =>
                i === idx
                  ? { ...x, status: "done", detail: t("music.addTracksStatusCloned") }
                  : x
              )
            );
          } else if (item.kind === "netease" && item.neteaseSongId != null) {
            track = await importNeteaseTrack({
              neteaseSongId: item.neteaseSongId,
              playlistId: targetPlaylistId,
              quality: importQuality,
            });
            setQueue((prev) =>
              prev.map((x, i) =>
                i === idx
                  ? { ...x, status: "done", detail: t("music.addTracksStatusImported") }
                  : x
              )
            );
          } else {
            throw new Error(t("music.addTracksInvalidItem"));
          }
          added.push(track);
        } catch (e) {
          setQueue((prev) =>
            prev.map((x, i) =>
              i === idx ? { ...x, status: "error", detail: mapApiError(t, e) } : x
            )
          );
        }
      }
      if (added.length > 0) onTracksAdded?.(added);
    } finally {
      setRunning(false);
    }
  }, [running, targetPlaylistId, t, onTracksAdded]);

  useEffect(() => {
    if (!open || running) return;
    if (queue.some((x) => x.status === "pending")) {
      void processQueue();
    }
  }, [queue, open, running, processQueue]);

  const otherPlaylists = useMemo(
    () => playlists.filter((p) => p.id !== targetPlaylistId),
    [playlists, targetPlaylistId]
  );

  const queueStats = useMemo(() => {
    let pending = 0;
    let runningCount = 0;
    let done = 0;
    let error = 0;
    let skipped = 0;
    for (const q of queue) {
      if (q.status === "pending") pending += 1;
      else if (q.status === "running") runningCount += 1;
      else if (q.status === "done") done += 1;
      else if (q.status === "error") error += 1;
      else if (q.status === "skipped") skipped += 1;
    }
    return { pending, runningCount, done, error, skipped, total: queue.length };
  }, [queue]);

  if (!open) return null;

  const tabs: { id: SourceTab; label: string; icon: typeof Heart }[] = [
    { id: "liked", label: t("music.addTracksTabLiked"), icon: Heart },
    { id: "history", label: t("music.addTracksTabHistory"), icon: History },
    { id: "playlists", label: t("music.addTracksTabPlaylists"), icon: ListMusic },
    { id: "discover", label: t("music.addTracksTabDiscover"), icon: Search },
  ];

  const markImported = (key: string, track: MusicTrackDto) => {
    importedByKeyRef.current.set(key, track);
    setImportedKeysTick((n) => n + 1);
    setSelected((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setQueue((prev) =>
      prev.map((x) =>
        x.key === key && (x.status === "pending" || x.status === "error")
          ? { ...x, status: "done", detail: t("music.addTracksStatusImported") }
          : x
      )
    );
    onTracksAdded?.([track]);
  };

  const onPlayLocal = (tr: MusicTrackDto) => {
    setPlayErr(null);
    playPauseTrack(tr);
  };

  const onPlayDiscover = async (item: DiscoverSearchItemDto) => {
    if (playBusyKey != null || running) return;
    const key = discoverSelectKey(item);
    setPlayErr(null);

    const known =
      importedByKeyRef.current.get(key) ??
      existingTracks.find((tr) => tr.neteaseSongId === item.neteaseSongId) ??
      null;
    if (known) {
      playPauseTrack(known);
      return;
    }

    setPlayBusyKey(key);
    try {
      const track = await importNeteaseTrack({
        neteaseSongId: item.neteaseSongId,
        playlistId: targetPlaylistId,
        quality: qualityRef.current,
      });
      markImported(key, track);
      selectTrack(track, true);
    } catch (e) {
      setPlayErr(mapApiError(t, e));
    } finally {
      setPlayBusyKey(null);
    }
  };

  const renderTrackRow = (tr: MusicTrackDto) => {
    const key = trackSelectKey(tr);
    const already = existingKeys.has(key) || existingKeys.has(`id:${tr.id}`);
    const checked = selected.has(key);
    const cover = coverDisplayUrl(tr);
    const isCurrent = currentId === tr.id;
    const isPlayingHere = isCurrent && playing;
    return (
      <li
        key={`local-${tr.id}`}
        className={clsx(
          "flex items-center gap-2 rounded-xl px-2 py-1.5 transition",
          checked && !already && "bg-white/10",
          already && "opacity-70"
        )}
      >
        <button
          type="button"
          disabled={already || running}
          onClick={() =>
            toggleKey(key, {
              key,
              title: tr.title,
              artist: tr.artist,
              coverUrl: tr.coverUrl,
              kind: "local",
              trackId: tr.id,
              neteaseSongId: tr.neteaseSongId ?? undefined,
              status: "pending",
            })
          }
          className={clsx(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            checked && !already
              ? "border-emerald-400/80 bg-emerald-500/30 text-emerald-100"
              : "border-white/25 text-transparent",
            (already || running) && "opacity-40"
          )}
          aria-label={t("music.addTracksSelectHint")}
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={playBusyKey != null}
          onClick={() => onPlayLocal(tr)}
          className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10"
          title={t("music.addTracksPlay")}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition group-hover:brightness-75"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-zinc-500">
              <ListMusic className="h-4 w-4" />
            </span>
          )}
          <span
            className={clsx(
              "absolute inset-0 flex items-center justify-center bg-black/40 transition",
              isPlayingHere ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {isPlayingHere ? (
              <Pause className="h-3.5 w-3.5 fill-white text-white" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            )}
          </span>
        </button>
        <button
          type="button"
          disabled={already || running}
          onClick={() =>
            toggleKey(key, {
              key,
              title: tr.title,
              artist: tr.artist,
              coverUrl: tr.coverUrl,
              kind: "local",
              trackId: tr.id,
              neteaseSongId: tr.neteaseSongId ?? undefined,
              status: "pending",
            })
          }
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <span className="block truncate text-sm text-zinc-100">{tr.title}</span>
          <span className="block truncate text-[11px] text-zinc-500">
            {tr.artist || "—"}
            {already ? ` · ${t("music.addTracksAlreadyIn")}` : ""}
          </span>
        </button>
        <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
          {formatDuration(tr.durationSeconds)}
        </span>
      </li>
    );
  };

  const renderDiscoverRow = (item: DiscoverSearchItemDto) => {
    const key = discoverSelectKey(item);
    const already = existingKeys.has(key);
    const checked = selected.has(key);
    const busy = playBusyKey === key;
    const known =
      importedByKeyRef.current.get(key) ??
      existingTracks.find((tr) => tr.neteaseSongId === item.neteaseSongId) ??
      null;
    const isCurrent = known != null && currentId === known.id;
    const isPlayingHere = isCurrent && playing;
    return (
      <li
        key={key}
        className={clsx(
          "flex items-center gap-2 rounded-xl px-2 py-1.5 transition",
          checked && !already && "bg-white/10",
          already && "opacity-70"
        )}
      >
        <button
          type="button"
          disabled={already || running || playBusyKey != null}
          onClick={() =>
            toggleKey(key, {
              key,
              title: item.title,
              artist: item.artist,
              coverUrl: item.coverUrl,
              kind: "netease",
              neteaseSongId: item.neteaseSongId,
              status: "pending",
            })
          }
          className={clsx(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            checked && !already
              ? "border-emerald-400/80 bg-emerald-500/30 text-emerald-100"
              : "border-white/25 text-transparent",
            (already || running) && "opacity-40"
          )}
          aria-label={t("music.addTracksSelectHint")}
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={playBusyKey != null && !busy}
          onClick={() => void onPlayDiscover(item)}
          className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10"
          title={
            already || known
              ? t("music.addTracksPlay")
              : t("music.discoverPlay")
          }
        >
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt=""
              className="h-full w-full object-cover transition group-hover:brightness-75"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
          )}
          <span
            className={clsx(
              "absolute inset-0 flex items-center justify-center bg-black/40 transition",
              busy || isPlayingHere ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            ) : isPlayingHere ? (
              <Pause className="h-3.5 w-3.5 fill-white text-white" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-white text-white" />
            )}
          </span>
        </button>
        <button
          type="button"
          disabled={already || running || playBusyKey != null}
          onClick={() =>
            toggleKey(key, {
              key,
              title: item.title,
              artist: item.artist,
              coverUrl: item.coverUrl,
              kind: "netease",
              neteaseSongId: item.neteaseSongId,
              status: "pending",
            })
          }
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <span className="block truncate text-sm text-zinc-100">{item.title}</span>
          <span className="block truncate text-[11px] text-zinc-500">
            {item.artist || "—"}
            {already
              ? ` · ${t("music.addTracksAlreadyIn")}`
              : ` · ${t("music.addTracksNeedsUpload")}`}
          </span>
        </button>
        <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
          {formatDuration(item.durationSeconds)}
        </span>
      </li>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92dvh,44rem)] w-full flex-col overflow-hidden rounded-t-3xl border border-netease-line/80 border-b-0 bg-[#2a2a2a] text-zinc-200 shadow-2xl sm:max-w-3xl sm:rounded-3xl sm:border-b"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-netease-line/60 px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-medium text-zinc-100">
              {t("music.addTracksTitle")}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
              {t("music.addTracksSubtitle", { name: targetPlaylistName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-netease-line/60 sm:border-b-0 sm:border-r">
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-netease-line/50 px-2 py-2">
              {tabs.map((tb) => {
                const Icon = tb.icon;
                const active = tab === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    disabled={running}
                    onClick={() => {
                      setTab(tb.id);
                      setSelected(new Set());
                      if (tb.id !== "playlists") setSourcePlaylistId(null);
                    }}
                    className={clsx(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition",
                      active
                        ? "bg-white/15 text-zinc-50"
                        : "text-zinc-400 hover:bg-white/8 hover:text-zinc-200"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tb.label}
                  </button>
                );
              })}
            </div>

            <div className="shrink-0 border-b border-netease-line/40 px-3 py-2">
              <label className="flex flex-col gap-1.5 text-[11px] text-zinc-500">
                {t("music.discoverQuality")}
                <div className="flex flex-wrap gap-1.5">
                  {QUALITY_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={running}
                      onClick={() => setQuality(opt)}
                      className={clsx(
                        "rounded-full border px-2.5 py-1 text-[11px] transition",
                        quality === opt
                          ? "border-red-800/60 bg-red-900/35 text-red-100"
                          : "border-netease-line bg-[#1f1f1f] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      )}
                    >
                      {t(`music.quality.${opt}`)}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-zinc-600">{t("music.discoverQualityHint")}</span>
              </label>
            </div>

            {tab === "playlists" && sourcePlaylistId != null ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-netease-line/40 px-3 py-2">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setSourcePlaylistId(null);
                    setSelected(new Set());
                    setSourceTracks([]);
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-netease-line bg-[#1f1f1f] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40"
                  title={t("music.addTracksChangePlaylist")}
                  aria-label={t("music.addTracksChangePlaylist")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">
                    {otherPlaylists.find((p) => p.id === sourcePlaylistId)?.name ??
                      t("music.addTracksPickPlaylist")}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500">
                    {t("music.addTracksFromPlaylistHint")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setSourcePlaylistId(null);
                    setSelected(new Set());
                    setSourceTracks([]);
                  }}
                  className="shrink-0 rounded-full border border-netease-line px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                >
                  {t("music.addTracksChangePlaylist")}
                </button>
              </div>
            ) : null}

            {tab === "discover" ? (
              <form
                className="flex shrink-0 gap-2 border-b border-netease-line/40 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runDiscoverSearch(discoverQ);
                }}
              >
                <input
                  value={discoverQ}
                  onChange={(e) => setDiscoverQ(e.target.value)}
                  disabled={running}
                  placeholder={t("music.discoverSearchPh")}
                  className="min-w-0 flex-1 rounded-xl border border-netease-line bg-[#1f1f1f] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={running || discoverQ.trim().length < 2}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-zinc-100 hover:bg-white/15 disabled:opacity-40"
                >
                  <Search className="h-3.5 w-3.5" />
                  {t("music.addTracksSearch")}
                </button>
              </form>
            ) : null}

            {!(tab === "playlists" && sourcePlaylistId == null) ? (
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-zinc-500">
              <span>
                {selected.size > 0
                  ? t("music.addTracksSelected", { count: selected.size })
                  : t("music.addTracksSelectHint")}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={running}
                  onClick={selectAllVisible}
                  className="hover:text-zinc-300 disabled:opacity-40"
                >
                  {t("music.addTracksSelectAll")}
                </button>
                <button
                  type="button"
                  disabled={running || selected.size === 0}
                  onClick={clearSelection}
                  className="hover:text-zinc-300 disabled:opacity-40"
                >
                  {t("music.addTracksClearSelection")}
                </button>
              </span>
            </div>
            ) : null}

            <div
              ref={sourceListScrollRef}
              className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("music.addTracksLoading")}
                </div>
              ) : listErr ? (
                <p className="px-3 py-8 text-center text-sm text-red-400/90">{listErr}</p>
              ) : tab === "discover" ? (
                <>
                  {playErr ? (
                    <p className="mb-2 px-3 text-xs text-red-400/90">{playErr}</p>
                  ) : null}
                  {discoverItems.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-zinc-500">
                      {discoverQuery
                        ? t("music.discoverNoResults")
                        : t("music.discoverHint")}
                    </p>
                  ) : (
                    <ul className="space-y-0.5">{discoverItems.map(renderDiscoverRow)}</ul>
                  )}
                </>
              ) : tab === "playlists" && sourcePlaylistId == null ? (
                otherPlaylists.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-zinc-500">
                    {t("music.addTracksNoOtherPlaylists")}
                  </p>
                ) : (
                  <ul className="space-y-0.5 px-0.5">
                    <li className="px-3 pb-1 pt-1 text-[11px] text-zinc-500">
                      {t("music.addTracksPickPlaylist")}
                    </li>
                    {otherPlaylists.map((pl) => (
                      <li key={pl.id}>
                        <button
                          type="button"
                          disabled={running}
                          onClick={() => {
                            setSourcePlaylistId(pl.id);
                            setSelected(new Set());
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/8 disabled:opacity-60"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 ring-1 ring-white/10">
                            <ListMusic className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-zinc-100">{pl.name}</span>
                            <span className="block truncate text-[11px] text-zinc-500">
                              {t("music.addToPlaylistMeta", {
                                count: pl.trackCount ?? 0,
                                owner: pl.iAmOwner
                                  ? t("music.myPlaylist")
                                  : pl.ownerLabel,
                              })}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : sourceTracks.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-zinc-500">
                  {t("music.addTracksEmptySource")}
                </p>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-0.5">{sourceTracks.map(renderTrackRow)}</ul>
                  {tab === "playlists" && sourceHasMore ? (
                    <div
                      ref={sourceLoadMoreSentinelRef}
                      className="flex items-center justify-center gap-2 py-3 text-[11px] text-zinc-500"
                    >
                      {sourceLoadingMore ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t("music.discoverLoadingMore")}
                        </>
                      ) : (
                        <span className="h-1 w-1" />
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-netease-line/60 px-3 py-2.5 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))] sm:pb-2.5">
              <button
                type="button"
                disabled={running || selected.size === 0}
                onClick={enqueueSelected}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                {t("music.addTracksEnqueue", { count: selected.size })}
              </button>
            </div>
          </div>

          <div className="flex max-h-[38%] min-h-[9rem] w-full shrink-0 flex-col sm:max-h-none sm:w-[15.5rem]">
            <div className="shrink-0 border-b border-netease-line/50 px-3 py-2">
              <p className="text-xs font-medium text-zinc-200">{t("music.addTracksQueueTitle")}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {queueStats.total === 0
                  ? t("music.addTracksQueueEmpty")
                  : t("music.addTracksQueueStats", {
                      done: queueStats.done,
                      total: queueStats.total,
                      running: queueStats.runningCount,
                      error: queueStats.error,
                    })}
              </p>
            </div>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {queue.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-zinc-600">
                  {t("music.addTracksQueueHint")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {queue.map((item) => (
                    <li
                      key={`q-${item.key}`}
                      className="rounded-xl border border-white/5 bg-black/25 px-2.5 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0">
                          {item.status === "running" || item.status === "pending" ? (
                            <Loader2
                              className={clsx(
                                "h-3.5 w-3.5 text-amber-300/90",
                                item.status === "running" && "animate-spin"
                              )}
                            />
                          ) : item.status === "done" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : item.status === "skipped" ? (
                            <Check className="h-3.5 w-3.5 text-zinc-500" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-red-400" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] text-zinc-200">{item.title}</span>
                          <span className="block truncate text-[10px] text-zinc-500">
                            {item.detail ||
                              (item.status === "pending"
                                ? t("music.addTracksStatusPending")
                                : item.status === "running"
                                  ? t("music.addTracksStatusRunning")
                                  : item.artist)}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
