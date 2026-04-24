import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ListMusic, Play, Pause, Search, Heart, Radio, Music2, ChevronRight, Settings2, LayoutDashboard } from "lucide-react";
import clsx from "clsx";
import { mapApiError } from "../i18n/mapApiError";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useAuthedUser } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";
import { MusicPlayerBar } from "../components/MusicPlayerBar";
import { TrackLyricsScroll } from "../components/TrackLyricsScroll";
import { NeteaseVinylDisc } from "../components/NeteaseVinylDisc";
import { UploadTrackModal } from "../components/UploadTrackModal";
import { PlaylistSettingsModal } from "../components/PlaylistSettingsModal";
import { CreatePlaylistModal } from "../components/CreatePlaylistModal";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfileModal } from "../components/UserProfileModal";
import { FOR_NAME } from "../siteMeta";
import { getActiveLyricText } from "../music/lyricsUtils";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import {
  type MusicTrackDto,
  type PlaylistItemDto,
  type InvitationItemDto,
  getStoredToken,
  getTrackFileUrl,
  coverDisplayUrl,
  fetchMusicTracks,
  recordTrackPlay,
  fetchVisiblePlaylists,
  fetchIncomingInvitations,
  acceptInvitation,
  declineInvitation,
  getStoredPlaylistId,
  setStoredPlaylistId,
  playlistWallpaperDisplayUrl,
  userIsAdmin,
} from "../api/client";

export function MusicPage() {
  const { t } = useTranslation();
  const user = useAuthedUser();
  const {
    wallpaperActive,
    setWallpaperDisplayUrl,
    setWallpaperTargetPlaylistId,
    registerPlaylistsRefresh,
  } = usePageAppearance();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeNav, setActiveNav] = useState("discover");
  const [search, setSearch] = useState("");
  const [tracks, setTracks] = useState<MusicTrackDto[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItemDto[]>([]);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<number | null>(null);
  const [incomingInv, setIncomingInv] = useState<InvitationItemDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playlistSettingsOpen, setPlaylistSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0);
  const [playDur, setPlayDur] = useState(0);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const recordedPlayForTrackRef = useRef<number | null>(null);

  const [volume, setVolume] = useState(() => {
    try {
      const s = localStorage.getItem("bendoudou_volume");
      if (s == null) return 1;
      const v = parseFloat(s);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    } catch {
      return 1;
    }
  });

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const [pls, inv] = await Promise.all([fetchVisiblePlaylists(), fetchIncomingInvitations()]);
      setPlaylists(pls);
      setIncomingInv(inv);
      if (pls.length === 0) {
        setCurrentPlaylistId(null);
        setTracks([]);
        return;
      }
      const saved = getStoredPlaylistId();
      const pick =
        saved && pls.some((p) => p.id === Number(saved)) ? Number(saved) : pls[0]!.id;
      setCurrentPlaylistId(pick);
      setStoredPlaylistId(pick);
      const trackList = await fetchMusicTracks(pick);
      setTracks(trackList);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    registerPlaylistsRefresh(() => loadList());
    return () => registerPlaylistsRefresh(null);
  }, [loadList, registerPlaylistsRefresh]);

  useEffect(() => {
    if (currentPlaylistId == null) setPlaylistSettingsOpen(false);
  }, [currentPlaylistId]);

  useEffect(() => {
    setWallpaperTargetPlaylistId(currentPlaylistId);
  }, [currentPlaylistId, setWallpaperTargetPlaylistId]);

  useEffect(() => {
    recordedPlayForTrackRef.current = null;
  }, [currentId]);

  useEffect(() => {
    if (!playing || currentId == null) return;
    if (recordedPlayForTrackRef.current === currentId) return;
    recordedPlayForTrackRef.current = currentId;
    void (async () => {
      try {
        const updated = await recordTrackPlay(currentId);
        setTracks((prev) =>
          prev.map((x) =>
            x.id === updated.id ? { ...x, playCount: updated.playCount ?? x.playCount ?? 0 } : x
          )
        );
        setPlaylists((pls) =>
          pls.map((p) =>
            p.id === updated.playlistId
              ? { ...p, totalPlayCount: (p.totalPlayCount ?? 0) + 1 }
              : p
          )
        );
      } catch {
        recordedPlayForTrackRef.current = null;
      }
    })();
  }, [playing, currentId]);

  const currentPl = useMemo(
    () => (currentPlaylistId == null ? null : playlists.find((p) => p.id === currentPlaylistId) ?? null),
    [playlists, currentPlaylistId]
  );

  useEffect(() => {
    setWallpaperDisplayUrl(playlistWallpaperDisplayUrl(currentPl));
  }, [currentPl, setWallpaperDisplayUrl]);

  const playlistName = currentPl?.name ?? t("music.myPlaylist");

  const onPickPlaylist = useCallback(async (id: number) => {
    setCurrentPlaylistId(id);
    setStoredPlaylistId(id);
    setListLoading(true);
    setListErr(null);
    try {
      const trackList = await fetchMusicTracks(id);
      setTracks(trackList);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  const onCreatedPlaylist = useCallback(
    async (id: number) => {
      setStoredPlaylistId(id);
      setCurrentPlaylistId(id);
      await loadList();
    },
    [loadList]
  );

  const current = useMemo(
    () => (currentId == null ? null : tracks.find((t) => t.id === currentId) ?? null),
    [currentId, tracks]
  );
  const listDuration = current?.durationSeconds ?? 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q))
    );
  }, [search, tracks]);

  // 有对象存储直链则直连；否则拉取 /file 为 blob 并带 Authorization
  useEffect(() => {
    if (current == null) {
      setAudioObjectUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (current.audioUrl) {
      setAudioObjectUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return current.audioUrl;
      });
      return;
    }
    const aborter = new AbortController();
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch(getTrackFileUrl(current.id), {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
          signal: aborter.signal,
        });
        if (!res.ok) return;
        const b = await res.blob();
        objectUrl = URL.createObjectURL(b);
        setAudioObjectUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();
    return () => {
      aborter.abort();
    };
  }, [current?.id, current?.audioUrl]);

  /** 封面：公网直链或「你们服务器」上的 /cover URL + token（不是用户电脑里的文件） */
  const playerCoverSrc = useMemo(
    () => coverDisplayUrl(current),
    [current?.id, current?.coverUrl, current?.hasCover]
  );

  const syncedLyrics = useSyncedLyrics(current);
  const playerBarLyricLine = useMemo(() => {
    if (!current?.hasLyrics || syncedLyrics.lines.length === 0) return null;
    return getActiveLyricText(syncedLyrics.lines, playPos);
  }, [current?.hasLyrics, syncedLyrics.lines, playPos]);

  // 将 blob URL 交给 audio 并同步播放/暂停
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
    if (playing) {
      void a.play().catch(() => setPlaying(false));
    }
  }, [audioObjectUrl, current?.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.volume = volume;
    }
  }, [volume, audioObjectUrl, current?.id]);

  useEffect(() => {
    try {
      localStorage.setItem("bendoudou_volume", String(volume));
    } catch {
      /* ignore */
    }
  }, [volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      void a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }, [playing]);

  const selectTrack = useCallback((t: MusicTrackDto, autoplay: boolean) => {
    setCurrentId(t.id);
    setPlayPos(0);
    setPlayDur(0);
    if (autoplay) {
      setPlaying(true);
    }
  }, []);

  const seekPrev = () => {
    if (!current || filtered.length === 0) return;
    const idx = filtered.findIndex((t) => t.id === current.id);
    if (idx <= 0) {
      const last = filtered[filtered.length - 1]!;
      selectTrack(last, true);
    } else {
      selectTrack(filtered[idx - 1]!, true);
    }
  };

  const seekNext = () => {
    if (!current || filtered.length === 0) return;
    const idx = filtered.findIndex((t) => t.id === current.id);
    if (idx < 0 || idx >= filtered.length - 1) {
      selectTrack(filtered[0]!, true);
    } else {
      selectTrack(filtered[idx + 1]!, true);
    }
  };

  const barMax =
    playDur > 0 && Number.isFinite(playDur) ? playDur : listDuration > 0 ? listDuration : 0;
  const vinylProgress = barMax > 0 ? Math.min(1, Math.max(0, playPos / barMax)) : 0;

  return (
    <div
      className={clsx(
        "relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden text-zinc-200",
        wallpaperActive ? "bg-netease-bg/68 backdrop-blur-sm" : "bg-netease-bg"
      )}
    >
      <audio
        ref={audioRef}
        className="hidden"
        preload="auto"
        onTimeUpdate={(e) => {
          if (!scrubbing) {
            setPlayPos(e.currentTarget.currentTime);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setPlayDur(Number.isFinite(d) && d > 0 ? d : 0);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setPlayDur(d);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setPlayPos(0);
        }}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-netease-line bg-[#1f1f1f]">
          <div className="flex h-12 items-center gap-2 border-b border-netease-line px-4 text-sm text-zinc-400">
            <Heart className="h-4 w-4 text-red-500/90" fill="currentColor" />
            <span className="min-w-0 flex-1 truncate">{t("music.forNameCloud", { name: FOR_NAME })}</span>
          </div>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 pb-2 text-[13px]">
            <button
              type="button"
              onClick={() => setActiveNav("discover")}
              className={clsx(
                "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition",
                activeNav === "discover" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
              )}
            >
              <Home className="h-4 w-4 shrink-0" />
              {t("music.discover")}
            </button>
            <button
              type="button"
              onClick={() => setActiveNav("fm")}
              className={clsx(
                "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition",
                activeNav === "fm" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
              )}
            >
              <Radio className="h-4 w-4 shrink-0" />
              {t("music.privateFm")}
            </button>
            <div className="my-2 border-t border-netease-line/70" aria-hidden />
            <h2 className="mb-1.5 px-2 pt-0.5 text-[11px] font-semibold tracking-wide text-zinc-500">
              {t("music.myPlaylist")}
            </h2>
            {playlists.length === 0 && !listLoading ? (
              <p className="px-2 py-1.5 text-[11px] leading-snug text-zinc-500">{t("music.noPlaylists")}</p>
            ) : null}
            {playlists.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveNav("discover");
                  void onPickPlaylist(p.id);
                }}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition",
                  currentPlaylistId === p.id ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
                )}
              >
                <ListMusic className="h-4 w-4 shrink-0 opacity-80" />
                <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
                <span className="shrink-0 tabular-nums text-[11px] text-zinc-500">{p.trackCount}</span>
              </button>
            ))}
          </nav>

          {incomingInv.length > 0 && (
            <div className="border-t border-netease-line px-2 py-2 text-[11px] text-zinc-400">
              <div className="mb-1 font-medium text-amber-200/90">{t("music.invitesTitle")}</div>
              {incomingInv.map((inv) => (
                <div
                  key={inv.id}
                  className="mb-2 rounded-2xl border border-netease-line/80 bg-zinc-900/40 p-2"
                >
                  <p className="text-zinc-300">
                    「{inv.playlistName}」
                    <br />
                    {t("music.inviteFrom", { name: inv.inviterLabel })}
                  </p>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      className="flex-1 rounded-full bg-red-900/50 py-1.5 text-white hover:bg-red-800/50"
                      onClick={() => {
                        void (async () => {
                          try {
                            await acceptInvitation(inv.id);
                            await loadList();
                          } catch (e) {
                            alert(mapApiError(t, e));
                          }
                        })();
                      }}
                    >
                      {t("music.accept")}
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-full border border-zinc-600 py-1.5 hover:bg-zinc-800"
                      onClick={() => {
                        void (async () => {
                          try {
                            await declineInvitation(inv.id);
                            await loadList();
                          } catch (e) {
                            alert(mapApiError(t, e));
                          }
                        })();
                      }}
                    >
                      {t("music.decline")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="shrink-0 space-y-2 border-t border-netease-line p-2 text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => setCreatePlaylistOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-800 py-2.5 text-[13px] text-zinc-200 transition hover:bg-zinc-700"
            >
              <ListMusic className="h-3.5 w-3.5 opacity-90" />
              {t("music.newPlaylist")}
            </button>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-red-900/40 bg-[#252525] py-2.5 text-[13px] text-red-200/90 transition hover:border-red-800/50 hover:bg-[#2a2a2a]"
            >
              <Music2 className="h-3.5 w-3.5" />
              {t("music.uploadNew")}
            </button>
            <Link
              to="/"
              className="block truncate rounded-full px-3 py-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-300"
            >
              {t("music.backToSite")}
            </Link>
            {user && userIsAdmin(user) ? (
              <Link
                to="/admin"
                className="flex w-full items-center gap-2 rounded-full px-2 py-1.5 text-left text-violet-300/90 transition hover:bg-violet-500/10"
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{t("admin.consoleLink")}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-violet-500/60" aria-hidden />
              </Link>
            ) : null}
            {user ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="flex w-full items-center gap-2 rounded-full px-2 py-1.5 text-left text-zinc-300 transition hover:bg-white/5"
              >
                <UserAvatar user={user} className="h-9 w-9 text-xs" />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                  {user.displayName?.trim() || user.email}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
              </button>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-netease-line bg-netease-panel px-4">
            <div className="relative min-w-0 max-w-md flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("music.searchPh")}
                className="h-8 w-full rounded-full border border-netease-line bg-[#2a2a2a] pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-red-900/50 focus:outline-none"
              />
            </div>
            <div className="hidden shrink-0 text-xs text-zinc-500 sm:block">{t("music.uploadHint")}</div>
            <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
              <LanguageSwitch
                compact
                className="border border-netease-line bg-[#2a2a2a] p-0.5 text-[10px] text-zinc-300"
              />
              {currentPl != null && currentPlaylistId != null ? (
                <button
                  type="button"
                  onClick={() => setPlaylistSettingsOpen(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-netease-line bg-[#2a2a2a] px-3 py-1.5 text-[11px] text-zinc-300 transition hover:bg-[#333] hover:text-zinc-100"
                  title={t("music.playlistSettings")}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("music.playlistSettings")}</span>
                </button>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-40">
            {activeNav !== "fm" && (
              <>
                {activeNav === "discover" && (
                  <div
                    className="mb-4 flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-netease-line/70 bg-zinc-900/25 px-4 py-10 text-center"
                    role="status"
                    aria-label={t("music.discoverWip")}
                  >
                    <p className="text-sm font-medium text-zinc-400">{t("music.discoverWip")}</p>
                    <p className="text-xs text-zinc-600">{t("music.discoverWipSub")}</p>
                  </div>
                )}
                <h2 className="mb-2 text-sm font-medium text-zinc-300">{playlistName}</h2>

                {current != null && (
                  <div
                    className={clsx(
                      "mb-4 grid w-full max-h-[min(54vh,600px)] min-h-[min(40vh,320px)] grid-cols-1 grid-rows-[auto_1fr] gap-4 overflow-hidden rounded-2xl bg-[#141414]/60 p-4",
                      "md:min-h-[min(44vh,420px)] md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-1 md:items-stretch md:gap-0"
                    )}
                  >
                    {/* 左栏：黑胶 + 歌曲信息；桌面端在格内垂直居中 */}
                    <div className="flex flex-col items-center gap-4 md:h-full md:justify-center md:pr-4">
                      <div className="w-full max-w-[min(90vw,380px)] shrink-0 md:w-[336px] md:max-w-[336px]">
                        <NeteaseVinylDisc
                          trackId={current.id}
                          coverSrc={playerCoverSrc}
                          title={current.title}
                          playing={playing}
                          playProgress={vinylProgress}
                          onTogglePlay={() => setPlaying((p) => !p)}
                          className="!max-w-none w-full"
                        />
                      </div>
                      <div className="w-full max-w-[min(90vw,380px)] text-center md:w-[336px] md:max-w-[336px]">
                        <div className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
                          {current.title}
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{current.artist}</div>
                        {current.album ? (
                          <div className="mt-1 truncate text-[11px] text-zinc-600">{current.album}</div>
                        ) : null}
                      </div>
                    </div>

                    {/* 右栏：歌词（与左栏顶对齐，竖线分隔） */}
                    <div
                      className={clsx(
                        "flex w-full min-w-0 flex-col border-t border-white/[0.07] pt-4",
                        "min-h-[min(32vh,260px)] md:h-full md:min-h-0 md:border-l md:border-t-0 md:pl-6 md:pt-0"
                      )}
                    >
                      <TrackLyricsScroll
                        track={current}
                        currentTimeSec={playPos}
                        className="min-h-0 min-w-0 w-full flex-1 md:min-h-0"
                      />
                    </div>
                  </div>
                )}

                {listErr && <p className="mb-2 text-xs text-red-400/90">{listErr}</p>}
                {listLoading && <p className="text-xs text-zinc-500">{t("common.loading")}</p>}
                <div className="overflow-hidden rounded-2xl border border-netease-line">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1e1e1e] text-zinc-500">
                      <tr>
                        <th className="w-10 px-2 py-2 font-normal">{t("music.tableIndex")}</th>
                        <th className="px-2 py-2 font-normal">{t("music.tableTitle")}</th>
                        <th className="px-2 py-2 font-normal">{t("music.tableArtist")}</th>
                        <th className="hidden sm:table-cell px-2 py-2 font-normal">{t("music.tableAlbum")}</th>
                        <th className="w-16 px-2 py-2 text-right font-normal tabular-nums">{t("music.tablePlays")}</th>
                        <th className="w-8 px-1 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && !listLoading && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                            {t("music.emptyTracks")}
                          </td>
                        </tr>
                      )}
                      {filtered.map((tr, i) => (
                        <tr
                          key={tr.id}
                          onDoubleClick={() => selectTrack(tr, true)}
                          onClick={() => setCurrentId(tr.id)}
                          className={clsx(
                            "cursor-default border-t border-netease-line/50 transition",
                            currentId === tr.id ? "bg-red-900/20" : "hover:bg-white/5"
                          )}
                        >
                          <td className="px-2 py-2 text-zinc-500">{i + 1}</td>
                          <td className="max-w-[1px] truncate px-2 py-2 text-zinc-200">
                            {tr.title}
                            {tr.metadataFromFile && (
                              <span className="ml-1 rounded-full bg-zinc-700/60 px-1.5 py-px text-[10px] text-zinc-400">{t("music.autoTag")}</span>
                            )}
                            {tr.note && <span className="ml-1 text-zinc-500">· {tr.note}</span>}
                          </td>
                          <td className="max-w-[1px] truncate px-2 py-2 text-zinc-400">{tr.artist}</td>
                          <td className="hidden max-w-[1px] truncate px-2 py-2 text-zinc-500 sm:table-cell">
                            {tr.album}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-zinc-500">{tr.playCount ?? 0}</td>
                          <td className="px-1 py-2 text-zinc-500">
                            <button
                              type="button"
                              className="rounded-full p-1 hover:bg-white/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectTrack(tr, true);
                              }}
                            >
                              {currentId === tr.id && playing ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-center text-[11px] text-zinc-600">{t("music.rowHint")}</p>
              </>
            )}

            {activeNav === "fm" && (
              <div className="flex h-64 flex-col items-center justify-center text-sm text-zinc-400">
                {t("music.fmStub")}
                <span className="mt-1 text-xs text-zinc-600">{t("music.fmStubSub", { name: playlistName })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <MusicPlayerBar
        audioRef={audioRef}
        coverSrc={playerCoverSrc}
        title={current?.title ?? t("music.pickTrack")}
        artist={current?.artist ?? t("music.unknownArtist")}
        playPos={playPos}
        barMax={barMax}
        scrubbing={scrubbing}
        onScrubbingChange={setScrubbing}
        onPlayPosChange={setPlayPos}
        playing={playing}
        onTogglePlay={() => {
          if (!current) return;
          setPlaying((p) => !p);
        }}
        onPrev={seekPrev}
        onNext={seekNext}
        playlistEmpty={filtered.length === 0}
        hasTrack={current != null}
        volume={volume}
        onVolumeChange={setVolume}
        barLyricLine={playerBarLyricLine}
      />

      <UploadTrackModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => void loadList()}
        playlistId={currentPlaylistId ?? undefined}
      />

      <PlaylistSettingsModal
        open={playlistSettingsOpen}
        onClose={() => setPlaylistSettingsOpen(false)}
        playlist={currentPl}
        onSuccess={() => void loadList()}
      />

      {user ? (
        <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={user} />
      ) : null}

      <CreatePlaylistModal
        open={createPlaylistOpen}
        onClose={() => setCreatePlaylistOpen(false)}
        currentUserEmail={user?.email ?? ""}
        onCreated={(id) => void onCreatedPlaylist(id)}
      />
    </div>
  );
}
