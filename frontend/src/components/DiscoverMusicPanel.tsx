import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, ListPlus, Loader2, Music2, Play } from "lucide-react";
import clsx from "clsx";
import { mapApiError } from "../i18n/mapApiError";
import {
  type DiscoverSearchItemDto,
  type MusicTrackDto,
  discoverSearchNetease,
  importNeteaseTrack,
} from "../api/client";
import { isAudioQualityCode, qualityRank, type AudioQualityCode } from "../music/audioQuality";
import { AddToPlaylistModal } from "./AddToPlaylistModal";

const QUALITY_KEY = "bendoudou_discover_quality";
const QUALITY_OPTIONS: AudioQualityCode[] = ["standard", "higher", "exhigh", "lossless", "hires"];
const PAGE_SIZE = 20;

function readStoredQuality(): AudioQualityCode {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (isAudioQualityCode(v)) return v;
  } catch {
    // ignore
  }
  return "exhigh";
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type DiscoverMusicPanelProps = {
  query: string;
  onPlayTrack: (track: MusicTrackDto) => void;
  onHeartTrack: (track: MusicTrackDto) => void;
  /** 首次入库云端时回调（用于刷新歌单曲目数） */
  onTrackSynced?: (track: MusicTrackDto) => void;
};

export function DiscoverMusicPanel({
  query,
  onPlayTrack,
  onHeartTrack,
  onTrackSynced,
}: DiscoverMusicPanelProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<DiscoverSearchItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyKind, setBusyKind] = useState<"play" | "heart" | null>(null);
  const [heartedIds, setHeartedIds] = useState<Set<number>>(() => new Set());
  const [quality, setQuality] = useState<AudioQualityCode>(() => readStoredQuality());
  const [qualityBySong, setQualityBySong] = useState<Record<number, string>>({});
  const [downgradeHint, setDowngradeHint] = useState<string | null>(null);
  const [addToPlaylistItem, setAddToPlaylistItem] = useState<DiscoverSearchItemDto | null>(null);
  const trackCacheRef = useRef<Map<string, MusicTrackDto>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    try {
      localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      // ignore
    }
    trackCacheRef.current.clear();
  }, [quality]);

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (q.length < 2) {
      setResults([]);
      setHeartedIds(new Set());
      setHasMore(false);
      setTotal(0);
      setErr(null);
      setLoading(false);
      setLoadingMore(false);
      lastQueryRef.current = q;
      return;
    }
    setLoading(true);
    setErr(null);
    setHasMore(false);
    debounceRef.current = setTimeout(() => {
      lastQueryRef.current = q;
      void (async () => {
        try {
          const page = await discoverSearchNetease(q, 0, PAGE_SIZE);
          if (lastQueryRef.current !== q) return;
          setResults(page.items);
          setHasMore(page.hasMore);
          setTotal(page.total);
          setHeartedIds(new Set((page.items ?? []).filter((x) => x.hearted).map((x) => x.neteaseSongId)));
        } catch (e) {
          if (lastQueryRef.current !== q) return;
          setErr(mapApiError(t, e));
          setResults([]);
          setHeartedIds(new Set());
          setHasMore(false);
          setTotal(0);
        } finally {
          if (lastQueryRef.current === q) {
            setLoading(false);
          }
        }
      })();
    }, 400);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, t]);

  const loadMore = async () => {
    const q = query.trim();
    if (q.length < 2 || loading || loadingMore || !hasMore || busyId != null) return;
    setLoadingMore(true);
    setErr(null);
    try {
      const page = await discoverSearchNetease(q, results.length, PAGE_SIZE);
      if (lastQueryRef.current !== q) return;
      setResults((prev) => {
        const seen = new Set(prev.map((x) => x.neteaseSongId));
        const merged = [...prev];
        for (const item of page.items ?? []) {
          if (!seen.has(item.neteaseSongId)) {
            merged.push(item);
            seen.add(item.neteaseSongId);
          }
        }
        return merged;
      });
      setHasMore(page.hasMore);
      setTotal(page.total);
      setHeartedIds((prev) => {
        const next = new Set(prev);
        for (const item of page.items ?? []) {
          if (item.hearted) next.add(item.neteaseSongId);
        }
        return next;
      });
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setLoadingMore(false);
    }
  };

  const cacheKey = (neteaseSongId: number) => `${neteaseSongId}:${quality}`;

  const ensureImported = async (
    item: DiscoverSearchItemDto,
    heart: boolean
  ): Promise<MusicTrackDto> => {
    const key = cacheKey(item.neteaseSongId);
    const cached = trackCacheRef.current.get(key);
    if (cached && (!heart || cached.hearted)) {
      return cached;
    }
    const wasCached = trackCacheRef.current.has(key);
    const track = await importNeteaseTrack({
      neteaseSongId: item.neteaseSongId,
      heart,
      quality,
    });
    trackCacheRef.current.set(key, track);
    if (track.hearted) {
      setHeartedIds((prev) => new Set(prev).add(item.neteaseSongId));
    }
    if (track.audioQuality) {
      setQualityBySong((prev) => ({ ...prev, [item.neteaseSongId]: track.audioQuality! }));
      if (qualityRank(track.audioQuality) < qualityRank(quality)) {
        setDowngradeHint(
          t("music.discoverQualityDowngraded", {
            requested: t(`music.quality.${quality}`),
            actual: t(`music.quality.${track.audioQuality}`, {
              defaultValue: track.audioQuality,
            }),
          })
        );
      } else {
        setDowngradeHint(null);
      }
    }
    if (!wasCached) {
      onTrackSynced?.(track);
    }
    return track;
  };

  const onPlay = async (item: DiscoverSearchItemDto) => {
    if (busyId != null) return;
    setBusyId(item.neteaseSongId);
    setBusyKind("play");
    setErr(null);
    try {
      const track = await ensureImported(item, false);
      onPlayTrack(track);
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const onHeart = async (item: DiscoverSearchItemDto) => {
    if (busyId != null) return;
    if (heartedIds.has(item.neteaseSongId)) return;
    setBusyId(item.neteaseSongId);
    setBusyKind("heart");
    setErr(null);
    try {
      const track = await ensureImported(item, true);
      onHeartTrack(track);
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  const onAddToPlaylistPick = async (playlistId: number) => {
    const item = addToPlaylistItem;
    if (!item) return;
    const track = await importNeteaseTrack({
      neteaseSongId: item.neteaseSongId,
      playlistId,
      heart: false,
      quality,
    });
    trackCacheRef.current.set(cacheKey(item.neteaseSongId), track);
    if (track.hearted) {
      setHeartedIds((prev) => new Set(prev).add(item.neteaseSongId));
    }
    if (track.audioQuality) {
      setQualityBySong((prev) => ({ ...prev, [item.neteaseSongId]: track.audioQuality! }));
    }
    onTrackSynced?.(track);
  };

  const q = query.trim();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 rounded-2xl border border-netease-line/70 bg-zinc-900/30 px-4 py-3">
        <p className="text-sm font-medium text-zinc-200">{t("music.discoverTitle")}</p>
        <p className="mt-1 text-xs text-zinc-500">{t("music.discoverSub")}</p>
        <label className="mt-3 flex flex-col gap-1.5 text-[11px] text-zinc-500">
          {t("music.discoverQuality")}
          <div className="flex flex-wrap gap-1.5">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={busyId != null}
                onClick={() => setQuality(opt)}
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-[11px] transition",
                  quality === opt
                    ? "border-red-800/60 bg-red-900/35 text-red-100"
                    : "border-netease-line bg-[#2a2a2a] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                )}
              >
                {t(`music.quality.${opt}`)}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-zinc-600">{t("music.discoverQualityHint")}</span>
        </label>
        {downgradeHint ? (
          <p className="mt-2 text-[11px] text-amber-300/90">{downgradeHint}</p>
        ) : null}
      </div>

      {err ? <p className="mb-3 text-xs text-red-400/90">{err}</p> : null}

      {q.length < 2 ? (
        <div
          className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-netease-line/60 px-4 py-10 text-center"
          role="status"
        >
          <Music2 className="h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">{t("music.discoverHint")}</p>
        </div>
      ) : loading ? (
        <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("music.discoverSearching")}
        </div>
      ) : results.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center text-sm text-zinc-500">
          {t("music.discoverNoResults")}
        </div>
      ) : (
        <div className="space-y-3">
          {total > 0 ? (
            <p className="text-[11px] text-zinc-500">
              {t("music.discoverResultCount", { shown: results.length, total })}
            </p>
          ) : null}
          <ul className="divide-y divide-netease-line/50 overflow-hidden rounded-2xl border border-netease-line">
          {results.map((item) => {
            const busy = busyId === item.neteaseSongId;
            const hearted = heartedIds.has(item.neteaseSongId);
            const actualQ = qualityBySong[item.neteaseSongId];
            return (
              <li
                key={item.neteaseSongId}
                className={clsx(
                  "flex items-center gap-3 bg-[#1e1e1e]/60 px-3 py-2.5 transition",
                  busyId != null && !busy ? "opacity-60" : "hover:bg-[#252525]/80"
                )}
              >
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={() => void onPlay(item)}
                  className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-800"
                  title={t("music.discoverPlay")}
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:brightness-75"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <Music2 className="h-5 w-5" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                    {busy && busyKind === "play" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Play className="h-4 w-4 fill-white text-white" />
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={() => void onPlay(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-zinc-100">{item.title}</span>
                    {actualQ ? (
                      <span
                        className={clsx(
                          "shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                          qualityRank(actualQ) < qualityRank(quality)
                            ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30"
                            : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                        )}
                        title={t("music.discoverActualQuality")}
                      >
                        {isAudioQualityCode(actualQ)
                          ? t(`music.quality.${actualQ}`)
                          : actualQ}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {item.artist}
                    {item.album ? ` · ${item.album}` : ""}
                  </div>
                  {busy && busyKind === "play" ? (
                    <div className="mt-0.5 text-[10px] text-zinc-500">{t("music.discoverImporting")}</div>
                  ) : null}
                </button>
                <div className="shrink-0 tabular-nums text-[11px] text-zinc-600">
                  {formatDuration(item.durationSeconds)}
                </div>
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddToPlaylistItem(item);
                  }}
                  title={t("music.addToPlaylist")}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200 disabled:opacity-50"
                >
                  <ListPlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busyId != null || hearted}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onHeart(item);
                  }}
                  title={hearted ? t("music.discoverHearted") : t("music.discoverHeart")}
                  className={clsx(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
                    hearted
                      ? "text-red-500"
                      : "text-zinc-500 hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
                  )}
                >
                  {busy && busyKind === "heart" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart className={clsx("h-4 w-4", hearted && "fill-red-500")} />
                  )}
                </button>
              </li>
            );
          })}
          </ul>
          {hasMore ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                disabled={loadingMore || busyId != null}
                onClick={() => void loadMore()}
                className="inline-flex items-center gap-2 rounded-full border border-netease-line bg-[#2a2a2a] px-4 py-2 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {loadingMore ? t("music.discoverLoadingMore") : t("music.discoverLoadMore")}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <AddToPlaylistModal
        open={addToPlaylistItem != null}
        onClose={() => setAddToPlaylistItem(null)}
        songLabel={
          addToPlaylistItem
            ? `${addToPlaylistItem.title}${addToPlaylistItem.artist ? ` · ${addToPlaylistItem.artist}` : ""}`
            : ""
        }
        onPick={onAddToPlaylistPick}
      />
    </div>
  );
}
