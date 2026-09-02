import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, Music2, Pause, Play } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMusicPlayer } from "../music/MusicPlayerContext";
import { isMusicPath } from "../music/musicRoutes";
import { MusicPlayerBar } from "./MusicPlayerBar";
import { ImmersiveLyricsStage } from "./ImmersiveLyricsStage";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import { getActiveLyricText } from "../music/lyricsUtils";
import {
  coverDisplayUrl,
  fetchPlayHistoryPlays,
  type PlayHistoryItemDto,
  updatePlaylistListeningState,
  updatePlaylistListeningStateAsync,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";

const HISTORY_PAGE_SIZE = 30;

function formatHistoryPlayedAt(ms: number, locale: string, now = Date.now()): string {
  const d = new Date(ms);
  const n = new Date(now);
  const sameDay = d.toDateString() === n.toDateString();
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = d.toDateString() === y.toDateString();
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  if (yesterday) {
    return locale.startsWith("ja") ? `昨日 ${time}` : `昨天 ${time}`;
  }
  const sameYear = d.getFullYear() === n.getFullYear();
  const date = d.toLocaleDateString(locale, sameYear
    ? { month: "numeric", day: "numeric" }
    : { year: "numeric", month: "numeric", day: "numeric" });
  return `${date} ${time}`;
}

export function GlobalMusicPlayer() {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    audioRef,
    currentTrack,
    currentId,
    playing,
    setPlaying,
    playPos,
    setPlayPos,
    playDur,
    setPlayDur,
    volume,
    setVolume,
    playMode,
    setPlayMode,
    scrubbing,
    setScrubbing,
    queue,
    seekNext,
    seekPrev,
    coverSrc,
    selectTrack,
    setImmersiveLyricsOpen,
  } = useMusicPlayer();

  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<PlayHistoryItemDto[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [musicMobileNavOpen, setMusicMobileNavOpen] = useState(false);
  const historyLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const isOnMusicPage = isMusicPath(location.pathname);
  const openMusicPlayerView = useCallback(() => {
    if (isOnMusicPage) {
      const params = new URLSearchParams(location.search);
      params.set("view", "player");
      navigate({ pathname: location.pathname, search: `?${params.toString()}` });
      return;
    }
    navigate("/music?view=player");
  }, [isOnMusicPage, location.pathname, location.search, navigate]);
  const hasTrack = currentTrack != null;
  const playlistEmpty = queue.length === 0;
  const audioObjectUrl = currentTrack?.audioUrl ?? null;
  const listeningStateRef = useRef<string>("");
  const lastListeningTrackRef = useRef<{ playlistId: number; trackId: number } | null>(null);

  // Sync audio source when track changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!audioObjectUrl) {
      a.removeAttribute("src");
      a.load();
      return;
    }
    a.src = audioObjectUrl;
    a.loop = playMode === "single";
    a.load();
    if (playing) void a.play().catch(() => setPlaying(false));
  }, [audioObjectUrl, currentTrack?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume, audioObjectUrl, currentId]);

  // 单曲循环用原生 loop，比 ended 里手动 seek 更稳（且不受 queue 为空影响）
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.loop = playMode === "single";
  }, [playMode, audioRef]);

  // Keep playlist listening state synced globally (not only /music page).
  useEffect(() => {
    const playlistId = currentTrack?.playlistId ?? lastListeningTrackRef.current?.playlistId ?? null;
    const trackId = currentTrack?.id ?? lastListeningTrackRef.current?.trackId ?? null;
    if (playlistId == null) return;
    if (playing && trackId != null) {
      lastListeningTrackRef.current = { playlistId, trackId };
    }
    const key = `${playlistId}:${trackId ?? "none"}:${playing ? "1" : "0"}`;
    if (listeningStateRef.current === key) return;
    listeningStateRef.current = key;
    // Play: fire-and-forget so audio start is never blocked.
    // Pause: use reliable request (still non-blocking for UI because we do not await).
    if (playing) {
      updatePlaylistListeningStateAsync(playlistId, { trackId, playing: true });
    } else {
      void updatePlaylistListeningState(playlistId, { trackId, playing: false }).catch(() => {
        listeningStateRef.current = "";
      });
    }
  }, [currentTrack?.playlistId, currentTrack?.id, playing]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing]);

  const syncedLyrics = useSyncedLyrics(currentTrack);
  const barLyricLine = useMemo(() => {
    if (!currentTrack?.hasLyrics || syncedLyrics.lines.length === 0) return null;
    return getActiveLyricText(syncedLyrics.lines, playPos);
  }, [currentTrack?.hasLyrics, syncedLyrics.lines, playPos]);

  useEffect(() => {
    const onMenuToggle = (ev: Event) => {
      const custom = ev as CustomEvent<{ open?: boolean }>;
      setMusicMobileNavOpen(Boolean(custom.detail?.open));
    };
    window.addEventListener("music-mobile-nav-toggle", onMenuToggle as EventListener);
    return () => window.removeEventListener("music-mobile-nav-toggle", onMenuToggle as EventListener);
  }, []);

  const barMax = useMemo(() => {
    if (playDur > 0 && Number.isFinite(playDur)) return playDur;
    const d = currentTrack?.durationSeconds ?? 0;
    return d > 0 ? d : 0;
  }, [playDur, currentTrack?.durationSeconds]);

  const openHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(true);
    setHistoryLoading(true);
    setHistoryErr(null);
    setHistoryItems([]);
    setHistoryPage(0);
    setHistoryTotalPages(0);
    setHistoryTotal(0);
    void (async () => {
      try {
        const data = await fetchPlayHistoryPlays(0, HISTORY_PAGE_SIZE);
        setHistoryItems(data.content ?? []);
        setHistoryPage(data.number ?? 0);
        setHistoryTotalPages(data.totalPages ?? 0);
        setHistoryTotal(data.totalElements ?? 0);
      } catch (e) {
        setHistoryErr(mapApiError(t, e));
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [t]);

  const loadMoreHistory = useCallback(async () => {
    if (historyLoading || historyLoadingMore) return;
    if (historyPage >= historyTotalPages - 1) return;
    setHistoryLoadingMore(true);
    try {
      const next = historyPage + 1;
      const data = await fetchPlayHistoryPlays(next, HISTORY_PAGE_SIZE);
      setHistoryItems((prev) => [...prev, ...(data.content ?? [])]);
      setHistoryPage(data.number ?? next);
      setHistoryTotalPages(data.totalPages ?? historyTotalPages);
      setHistoryTotal(data.totalElements ?? historyTotal);
    } catch (e) {
      setHistoryErr(mapApiError(t, e));
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [historyLoading, historyLoadingMore, historyPage, historyTotal, historyTotalPages, t]);

  useEffect(() => {
    if (!historyPanelOpen) return;
    const target = historyLoadMoreRef.current;
    if (!target) return;
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        void loadMoreHistory();
      },
      { root: target.parentElement, rootMargin: "120px 0px" }
    );
    io.observe(target);
    return () => io.disconnect();
  }, [historyPanelOpen, loadMoreHistory, historyItems.length]);

  const handleCyclePlayMode = useCallback(() => {
    setPlayMode((prev) => (prev === "list" ? "single" : prev === "single" ? "shuffle" : "list"));
  }, [setPlayMode]);

  const handleTogglePlay = useCallback(() => {
    if (hasTrack) setPlaying((p) => !p);
  }, [hasTrack, setPlaying]);

  const sharedBarProps = {
    audioRef,
    coverSrc,
    playPos,
    barMax,
    scrubbing,
    onScrubbingChange: setScrubbing,
    onPlayPosChange: setPlayPos,
    playing,
    onTogglePlay: handleTogglePlay,
    onPrev: seekPrev,
    onNext: seekNext,
    playlistEmpty,
    hasTrack,
    volume,
    onVolumeChange: setVolume,
    barLyricLine,
    currentTrackId: currentId,
    playMode,
    onCyclePlayMode: handleCyclePlayMode,
    onOpenHistoryPanel: openHistoryPanel,
    onOpenPlayerView: openMusicPlayerView,
    onOpenImmersiveLyrics: () => setImmersiveLyricsOpen(true),
  };

  return (
    <>
      <audio
        ref={audioRef}
        className="hidden"
        crossOrigin="anonymous"
        preload="auto"
        loop={playMode === "single"}
        onTimeUpdate={(e) => {
          if (!scrubbing) setPlayPos(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setPlayDur(Number.isFinite(d) && d > 0 ? d : 0);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setPlayDur(d);
        }}
        onEnded={() => {
          // loop=true 时通常不触发 ended；此处兜底单曲重播，并处理列表/随机
          if (playMode === "single") {
            const a = audioRef.current;
            if (!a || !currentTrack) {
              setPlaying(false);
              setPlayPos(0);
              return;
            }
            a.currentTime = 0;
            setPlayPos(0);
            setPlaying(true);
            void a.play().catch(() => setPlaying(false));
            return;
          }
          if (!currentTrack) {
            setPlaying(false);
            setPlayPos(0);
            return;
          }
          // 队列空或当前曲不在队列时，seekNext 会重播当前 / 落到队列头
          seekNext();
        }}
      />

      {isOnMusicPage && !musicMobileNavOpen && (
        <MusicPlayerBar
          {...sharedBarProps}
          title={currentTrack?.title ?? t("music.pickTrack")}
          artist={currentTrack?.artist ?? t("music.unknownArtist")}
          onOpenPlayerView={openMusicPlayerView}
        />
      )}

      {/* Other pages: mini pill or expanded bar */}
      {!isOnMusicPage && hasTrack && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 sm:bottom-6">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-zinc-900/95 px-1.5 py-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur-xl">
            {/* Vinyl thumbnail */}
            <button
              type="button"
              onClick={openMusicPlayerView}
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-0 bg-zinc-800 p-0 ring-1 ring-white/10 appearance-none"
            >
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt=""
                  className="h-full w-full animate-[spin_12s_linear_infinite] object-cover"
                  style={{ animationPlayState: playing ? "running" : "paused" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                  <Music2 className="h-4 w-4" />
                </div>
              )}
              <div className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full border border-zinc-700/40 bg-zinc-900" />
            </button>

            {/* Track info */}
            <button
              type="button"
              onClick={openMusicPlayerView}
              className="min-w-0 max-w-[110px] border-0 bg-transparent p-0 px-1 text-left appearance-none"
            >
              <div className="truncate text-xs font-semibold leading-tight text-zinc-100">
                {currentTrack.title}
              </div>
              <div className="truncate text-[10px] text-zinc-500">{currentTrack.artist}</div>
            </button>

            {/* Play/pause */}
            <button
              type="button"
              onClick={handleTogglePlay}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-200 transition hover:bg-white/20"
            >
              {playing ? (
                <Pause className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      {historyPanelOpen && (
        <div
          className="fixed inset-0 z-[220] bg-black/45 backdrop-blur-[1px]"
          onClick={() => setHistoryPanelOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 flex h-full w-[min(88vw,380px)] flex-col border-l border-white/10 bg-zinc-950/95 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100">{t("music.playHistory")}</h3>
                {!historyLoading && historyTotal > 0 ? (
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {t("music.historyTotal", { count: historyTotal })}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                onClick={() => setHistoryPanelOpen(false)}
              >
                {t("common.close", { defaultValue: "关闭" })}
              </button>
            </div>
            {historyErr && <p className="mb-2 shrink-0 text-xs text-red-400/90">{historyErr}</p>}
            {historyLoading && <p className="text-xs text-zinc-500">{t("common.loading")}</p>}
            {!historyLoading && historyItems.length === 0 && (
              <p className="text-xs text-zinc-500">
                {t("music.historyEmpty", { defaultValue: "暂无播放历史" })}
              </p>
            )}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-1">
                {historyItems.map((item) => {
                  const tr = item.track;
                  return (
                    <button
                      key={item.historyId}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-white/10"
                      onClick={() => {
                        selectTrack(tr, true);
                        setHistoryPanelOpen(false);
                      }}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {coverDisplayUrl(tr) ? (
                          <img
                            src={coverDisplayUrl(tr)!}
                            alt={tr.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-600">
                            <Music2 className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-zinc-100">{tr.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                          {tr.artist}
                          {tr.album ? ` · ${tr.album}` : ""}
                        </div>
                        <div className="mt-0.5 text-[10px] tabular-nums text-zinc-600">
                          {formatHistoryPlayedAt(item.playedAtMillis, dateLoc)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div ref={historyLoadMoreRef} className="h-8" />
              {historyLoadingMore ? (
                <p className="py-2 text-center text-[11px] text-zinc-500">{t("common.loading")}</p>
              ) : null}
              {!historyLoading &&
              !historyLoadingMore &&
              historyItems.length > 0 &&
              historyPage < historyTotalPages - 1 ? (
                <button
                  type="button"
                  className="mt-1 w-full rounded-xl py-2 text-[11px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
                  onClick={() => void loadMoreHistory()}
                >
                  {t("music.historyLoadMore")}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      <ImmersiveLyricsStage onOpenHistoryPanel={openHistoryPanel} />
    </>
  );
}
