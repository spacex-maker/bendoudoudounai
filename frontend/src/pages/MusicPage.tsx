import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ListMusic, Search, Heart, Radio, Music2, ChevronRight, Settings2, LayoutDashboard, History } from "lucide-react";
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
import { ConfirmModal } from "../components/ConfirmModal";
import { MusicTrackTable } from "../components/MusicTrackTable";
import { FOR_NAME } from "../siteMeta";
import { getActiveLyricText } from "../music/lyricsUtils";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import {
  type MusicTrackDto,
  type PlaylistItemDto,
  type InvitationItemDto,
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
  fetchHeartTracks,
  fetchPlayHistoryTracks,
  addHeartTrack,
  removeHeartTrack,
  deleteTrackFromPlaylist,
} from "../api/client";

type PlayMode = "single" | "list" | "shuffle";
const PLAY_MODE_KEY = "bendoudou_play_mode";

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
  const [removeTrackDialog, setRemoveTrackDialog] = useState<{
    kind: "liked" | "playlist";
    track: MusicTrackDto;
  } | null>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrackDto | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0);
  const [playDur, setPlayDur] = useState(0);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyTracks, setHistoryTracks] = useState<MusicTrackDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>(() => {
    try {
      const v = localStorage.getItem(PLAY_MODE_KEY);
      if (v === "single" || v === "list" || v === "shuffle") return v;
    } catch {
      /* ignore */
    }
    return "list";
  });
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
    if (activeNav === "liked" || activeNav === "history") {
      setWallpaperTargetPlaylistId(null);
      return;
    }
    setWallpaperTargetPlaylistId(currentPlaylistId);
  }, [activeNav, currentPlaylistId, setWallpaperTargetPlaylistId]);

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
            x.id === updated.id
              ? {
                  ...x,
                  playCount: updated.playCount ?? x.playCount ?? 0,
                  hearted: updated.hearted ?? x.hearted,
                }
              : x
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
    if (activeNav === "liked" || activeNav === "history") {
      setWallpaperDisplayUrl(null);
      return;
    }
    setWallpaperDisplayUrl(playlistWallpaperDisplayUrl(currentPl));
  }, [activeNav, currentPl, setWallpaperDisplayUrl]);

  const playlistName =
    activeNav === "liked"
      ? t("music.likedPlaylist", { defaultValue: "我喜欢的音乐" })
      : activeNav === "history"
        ? t("music.playHistory", { defaultValue: "播放历史" })
        : (currentPl?.name ?? t("music.myPlaylist"));

  const showRemoveTrack =
    activeNav === "liked" || (activeNav === "discover" && Boolean(currentPl?.iAmOwner));

  const onPickLiked = useCallback(async () => {
    setActiveNav("liked");
    setListLoading(true);
    setListErr(null);
    try {
      const list = await fetchHeartTracks();
      setTracks(list);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  const onPickHistory = useCallback(async () => {
    setActiveNav("history");
    setListLoading(true);
    setListErr(null);
    try {
      const list = await fetchPlayHistoryTracks();
      setTracks(list);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [t]);

  const openHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(true);
    setHistoryLoading(true);
    setHistoryErr(null);
    void (async () => {
      try {
        const rows = await fetchPlayHistoryTracks();
        setHistoryTracks(rows);
      } catch (e) {
        setHistoryErr(mapApiError(t, e));
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [t]);

  const onToggleHeart = useCallback(
    async (tr: MusicTrackDto) => {
      try {
        if (tr.hearted) {
          const updated = await removeHeartTrack(tr.id);
          setTracks((prev) => {
            if (activeNav === "liked") return prev.filter((x) => x.id !== tr.id);
            return prev.map((x) => (x.id === tr.id ? { ...x, ...updated } : x));
          });
        } else {
          const updated = await addHeartTrack(tr.id);
          setTracks((prev) => prev.map((x) => (x.id === tr.id ? { ...x, ...updated } : x)));
        }
      } catch (e) {
        alert(mapApiError(t, e));
      }
    },
    [t, activeNav]
  );

  const requestRemoveTrack = useCallback(
    (tr: MusicTrackDto) => {
      if (activeNav === "liked") {
        setRemoveTrackDialog({ kind: "liked", track: tr });
        return;
      }
      if (currentPl?.iAmOwner) {
        setRemoveTrackDialog({ kind: "playlist", track: tr });
      }
    },
    [activeNav, currentPl?.iAmOwner]
  );

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

  const current = useMemo(() => currentTrack, [currentTrack]);
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

  useEffect(() => {
    if (currentId == null) return;
    const matched = tracks.find((x) => x.id === currentId);
    if (!matched) return;
    setCurrentTrack((prev) => (prev?.id === matched.id ? { ...prev, ...matched } : matched));
  }, [tracks, currentId]);

  // COS-only：只使用后端返回的公网直链
  useEffect(() => {
    if (current == null) {
      setAudioObjectUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setAudioObjectUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return current.audioUrl ?? null;
    });
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
    try {
      localStorage.setItem(PLAY_MODE_KEY, playMode);
    } catch {
      /* ignore */
    }
  }, [playMode]);

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
    const isSameTrack = currentId === t.id;
    setCurrentTrack(t);
    setCurrentId(t.id);
    setPlayPos(0);
    setPlayDur(0);
    if (autoplay) {
      setPlaying(true);
      // 双击时强制触发播放，避免仅靠状态流转导致偶发“不自动播”
      requestAnimationFrame(() => {
        const a = audioRef.current;
        if (!a) return;
        if (isSameTrack) {
          a.currentTime = 0;
        }
        void a.play().catch(() => setPlaying(false));
      });
    }
  }, [currentId]);

  const seekPrev = useCallback(() => {
    if (!current || filtered.length === 0) return;
    if (playMode === "shuffle") {
      if (filtered.length === 1) {
        selectTrack(filtered[0]!, true);
        return;
      }
      const choices = filtered.filter((t) => t.id !== current.id);
      const next = choices[Math.floor(Math.random() * choices.length)] ?? filtered[0]!;
      selectTrack(next, true);
      return;
    }
    const idx = filtered.findIndex((t) => t.id === current.id);
    if (idx <= 0) {
      const last = filtered[filtered.length - 1]!;
      selectTrack(last, true);
    } else {
      selectTrack(filtered[idx - 1]!, true);
    }
  }, [current, filtered, playMode, selectTrack]);

  const seekNext = useCallback(() => {
    if (!current || filtered.length === 0) return;
    if (playMode === "shuffle") {
      if (filtered.length === 1) {
        selectTrack(filtered[0]!, true);
        return;
      }
      const choices = filtered.filter((t) => t.id !== current.id);
      const next = choices[Math.floor(Math.random() * choices.length)] ?? filtered[0]!;
      selectTrack(next, true);
      return;
    }
    const idx = filtered.findIndex((t) => t.id === current.id);
    if (idx < 0 || idx >= filtered.length - 1) {
      selectTrack(filtered[0]!, true);
    } else {
      selectTrack(filtered[idx + 1]!, true);
    }
  }, [current, filtered, playMode, selectTrack]);

  const barMax =
    playDur > 0 && Number.isFinite(playDur) ? playDur : listDuration > 0 ? listDuration : 0;
  const vinylProgress = barMax > 0 ? Math.min(1, Math.max(0, playPos / barMax)) : 0;

  return (
    <div
      className={clsx(
        "relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden text-zinc-200 font-semibold",
        wallpaperActive ? "bg-netease-bg/68 backdrop-blur-sm" : "bg-netease-bg"
      )}
    >
      <audio
        ref={audioRef}
        className="hidden"
        crossOrigin="anonymous"
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
          if (filtered.length === 0 || !current) {
            setPlaying(false);
            setPlayPos(0);
            return;
          }
          if (playMode === "single") {
            const a = audioRef.current;
            if (!a) {
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
          seekNext();
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
            <button
              type="button"
              onClick={() => void onPickLiked()}
              className={clsx(
                "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition",
                activeNav === "liked" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
              )}
            >
              <Heart
                className={clsx(
                  "h-4 w-4 shrink-0",
                  activeNav === "liked" ? "fill-red-500 text-red-500" : "text-red-400/80"
                )}
              />
              {t("music.likedPlaylist", { defaultValue: "我喜欢的音乐" })}
            </button>
            <button
              type="button"
              onClick={() => void onPickHistory()}
              className={clsx(
                "flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition",
                activeNav === "history" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
              )}
            >
              <History className="h-4 w-4 shrink-0" />
              {t("music.playHistory", { defaultValue: "播放历史" })}
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
                  currentPlaylistId === p.id && activeNav === "discover"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5"
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
              {activeNav === "discover" && currentPl != null && currentPlaylistId != null ? (
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
                {activeNav === "discover" && currentPlaylistId == null && (
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

                <div
                  className={clsx(
                    "mb-4 grid w-full h-[min(54vh,600px)] grid-cols-1 grid-rows-[auto_1fr] gap-4 overflow-hidden rounded-2xl p-4",
                    "md:h-[min(44vh,420px)] md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-1 md:items-stretch md:gap-0"
                  )}
                >
                  {/* 左栏：黑胶 + 歌曲信息；桌面端在格内垂直居中 */}
                  <div className="flex flex-col items-center gap-4 md:h-full md:justify-center md:pr-4">
                    <div className="w-full max-w-[min(90vw,380px)] shrink-0 md:w-[336px] md:max-w-[336px]">
                      {current ? (
                        <NeteaseVinylDisc
                          trackId={current.id}
                          coverSrc={playerCoverSrc}
                          title={current.title}
                          playing={playing}
                          playProgress={vinylProgress}
                          onTogglePlay={() => setPlaying((p) => !p)}
                          className="!max-w-none w-full"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-zinc-600">
                          <Music2 className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="w-full max-w-[min(90vw,380px)] text-center md:w-[336px] md:max-w-[336px]">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
                        {current?.title ?? t("music.pickTrack")}
                      </div>
                      <div className="mt-1 truncate text-xs text-zinc-500">
                        {current?.artist ?? t("music.unknownArtist")}
                      </div>
                      {current?.album ? (
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

                {listErr && <p className="mb-2 text-xs text-red-400/90">{listErr}</p>}
                {listLoading && <p className="text-xs text-zinc-500">{t("common.loading")}</p>}
                <MusicTrackTable
                  tracks={filtered}
                  listLoading={listLoading}
                  showRemoveTrack={showRemoveTrack}
                  currentId={currentId}
                  playing={playing}
                  activeNav={activeNav}
                  onSelectTrack={selectTrack}
                  onSetCurrentId={setCurrentId}
                  onToggleHeart={onToggleHeart}
                  onRequestRemoveTrack={requestRemoveTrack}
                />
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
        currentTrackId={currentId}
        playMode={playMode}
        onCyclePlayMode={() => {
          setPlayMode((prev) => (prev === "list" ? "single" : prev === "single" ? "shuffle" : "list"));
        }}
        onOpenHistoryPanel={openHistoryPanel}
      />

      {historyPanelOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-[1px]" onClick={() => setHistoryPanelOpen(false)}>
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
            {historyErr ? <p className="mb-2 text-xs text-red-400/90">{historyErr}</p> : null}
            {historyLoading ? <p className="text-xs text-zinc-500">{t("common.loading")}</p> : null}
            {!historyLoading && historyTracks.length === 0 ? (
              <p className="text-xs text-zinc-500">{t("music.historyEmpty", { defaultValue: "暂无播放历史" })}</p>
            ) : null}
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
                        <img src={coverDisplayUrl(tr)!} alt={tr.title} className="h-full w-full object-cover" />
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
      ) : null}

      <ConfirmModal
        open={removeTrackDialog != null}
        onClose={() => setRemoveTrackDialog(null)}
        title={
          removeTrackDialog?.kind === "liked"
            ? t("music.removeDialogLikedTitle")
            : t("music.removeDialogPlaylistTitle")
        }
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={async () => {
          const ctx = removeTrackDialog;
          if (!ctx) return;
          const { kind, track } = ctx;
          try {
            if (kind === "liked") {
              await removeHeartTrack(track.id);
            } else {
              await deleteTrackFromPlaylist(track.id);
            }
          } catch (e) {
            alert(mapApiError(t, e));
            throw e;
          }
          setTracks((prev) => prev.filter((x) => x.id !== track.id));
          if (kind === "playlist") {
            setPlaylists((pls) =>
              pls.map((p) =>
                p.id === track.playlistId ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p
              )
            );
          }
          if (currentId === track.id) {
            setCurrentId(null);
            setCurrentTrack(null);
          }
        }}
      >
        {removeTrackDialog ? (
          <>
            <p className="mb-2 line-clamp-2 font-medium text-zinc-100">「{removeTrackDialog.track.title}」</p>
            <p className="text-xs text-zinc-500">
              {removeTrackDialog.kind === "liked"
                ? t("music.confirmRemoveFromLiked")
                : t("music.confirmRemoveFromPlaylist")}
            </p>
          </>
        ) : null}
      </ConfirmModal>

      <UploadTrackModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          void (async () => {
            try {
              const [pls, inv] = await Promise.all([fetchVisiblePlaylists(), fetchIncomingInvitations()]);
              setPlaylists(pls);
              setIncomingInv(inv);
              if (activeNav === "liked") {
                setTracks(await fetchHeartTracks());
              } else if (activeNav === "history") {
                setTracks(await fetchPlayHistoryTracks());
              } else if (currentPlaylistId != null) {
                setTracks(await fetchMusicTracks(currentPlaylistId));
              }
            } catch {
              await loadList();
            }
          })();
        }}
        playlistId={
          (activeNav === "liked"
            ? (currentPlaylistId ?? playlists[0]?.id)
            : currentPlaylistId) ?? undefined
        }
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
