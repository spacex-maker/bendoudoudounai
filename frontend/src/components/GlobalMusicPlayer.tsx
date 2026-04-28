import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronUp, Music2, Pause, Play } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMusicPlayer } from "../music/MusicPlayerContext";
import { MusicPlayerBar } from "./MusicPlayerBar";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import { getActiveLyricText } from "../music/lyricsUtils";
import {
  coverDisplayUrl,
  fetchPlayHistoryTracks,
  type MusicTrackDto,
  updatePlaylistListeningState,
  updatePlaylistListeningStateAsync,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";

export function GlobalMusicPlayer() {
  const { t } = useTranslation();
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
  } = useMusicPlayer();

  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyTracks, setHistoryTracks] = useState<MusicTrackDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);

  const isOnMusicPage = location.pathname === "/music";
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
    a.load();
    if (playing) void a.play().catch(() => setPlaying(false));
  }, [audioObjectUrl, currentTrack?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume, audioObjectUrl, currentId]);

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

  const barMax = useMemo(() => {
    if (playDur > 0 && Number.isFinite(playDur)) return playDur;
    const d = currentTrack?.durationSeconds ?? 0;
    return d > 0 ? d : 0;
  }, [playDur, currentTrack?.durationSeconds]);

  const openHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(true);
    setHistoryLoading(true);
    setHistoryErr(null);
    void (async () => {
      try {
        setHistoryTracks(await fetchPlayHistoryTracks());
      } catch (e) {
        setHistoryErr(mapApiError(t, e));
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [t]);

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
    onOpenPlayerView: () => navigate("/music?view=player"),
  };

  return (
    <>
      <audio
        ref={audioRef}
        className="hidden"
        crossOrigin="anonymous"
        preload="auto"
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
          if (queue.length === 0 || !currentTrack) {
            setPlaying(false);
            setPlayPos(0);
            return;
          }
          if (playMode === "single") {
            const a = audioRef.current;
            if (!a) { setPlaying(false); setPlayPos(0); return; }
            a.currentTime = 0;
            setPlayPos(0);
            setPlaying(true);
            void a.play().catch(() => setPlaying(false));
            return;
          }
          seekNext();
        }}
      />

      {isOnMusicPage && (
        <MusicPlayerBar
          {...sharedBarProps}
          title={currentTrack?.title ?? t("music.pickTrack")}
          artist={currentTrack?.artist ?? t("music.unknownArtist")}
          onOpenPlayerView={() => navigate("/music?view=player")}
        />
      )}

      {/* Other pages: mini pill or expanded bar */}
      {!isOnMusicPage && hasTrack && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 sm:bottom-6">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-zinc-900/95 px-1.5 py-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur-xl">
            {/* Vinyl thumbnail */}
            <button
              type="button"
              onClick={() => navigate("/music?view=player")}
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
              onClick={() => navigate("/music?view=player")}
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
          className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-[1px]"
          onClick={() => setHistoryPanelOpen(false)}
        >
          <aside
            className="absolute right-0 top-0 h-full w-[min(88vw,360px)] border-l border-white/10 bg-zinc-950/95 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">{t("music.playHistory")}</h3>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                onClick={() => setHistoryPanelOpen(false)}
              >
                {t("common.close", { defaultValue: "关闭" })}
              </button>
            </div>
            {historyErr && <p className="mb-2 text-xs text-red-400/90">{historyErr}</p>}
            {historyLoading && <p className="text-xs text-zinc-500">{t("common.loading")}</p>}
            {!historyLoading && historyTracks.length === 0 && (
              <p className="text-xs text-zinc-500">
                {t("music.historyEmpty", { defaultValue: "暂无播放历史" })}
              </p>
            )}
            <div className="custom-scrollbar h-[calc(100%-2.25rem)] overflow-y-auto pr-1">
              <div className="space-y-1">
                {historyTracks.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-white/10"
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
                      <div className="truncate text-xs text-zinc-100">{tr.title}</div>
                      <div className="truncate text-[11px] text-zinc-500">{tr.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
