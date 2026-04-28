import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, ListMusic, Search, Heart, Radio, Music2, ChevronRight, Settings2, LayoutDashboard, History, Menu, X, ArrowLeft, Bell } from "lucide-react";
import clsx from "clsx";
import { mapApiError } from "../i18n/mapApiError";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { useAuthedUser } from "../auth/AuthContext";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";
import { TrackLyricsScroll } from "../components/TrackLyricsScroll";
import { NeteaseVinylDisc } from "../components/NeteaseVinylDisc";
import { UploadTrackModal } from "../components/UploadTrackModal";
import { PlaylistSettingsModal } from "../components/PlaylistSettingsModal";
import { CreatePlaylistModal } from "../components/CreatePlaylistModal";
import { UserAvatar } from "../components/UserAvatar";
import { UserProfileModal } from "../components/UserProfileModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { MusicTrackTable } from "../components/MusicTrackTable";
import { MusicTrackComments } from "../components/MusicTrackComments";
import { MusicMentionList } from "../components/MusicMentionList";
import { FOR_NAME } from "../siteMeta";
import { useSyncedLyrics } from "../music/useSyncedLyrics";
import { useMusicPlayer } from "../music/MusicPlayerContext";
import {
  type MusicTrackDto,
  type PlaylistItemDto,
  type PlaylistListeningStatusItemDto,
  type PlaylistListeningWsEvent,
  type MusicMentionNotificationDto,
  type InvitationItemDto,
  fetchMusicTracks,
  recordTrackPlay,
  fetchVisiblePlaylists,
  fetchIncomingInvitations,
  fetchPlaylistListeningStatus,
  playlistListeningWsUrl,
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

export function MusicPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthedUser();
  const {
    wallpaperActive,
    setWallpaperDisplayUrl,
    setWallpaperTargetPlaylistId,
    registerPlaylistsRefresh,
  } = usePageAppearance();
  const {
    currentTrack,
    setCurrentTrack,
    currentId,
    setCurrentId,
    playing,
    setPlaying,
    playPos,
    playDur,
    selectTrack,
    coverSrc: playerCoverSrc,
    setQueue,
  } = useMusicPlayer();
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
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [removeTrackDialog, setRemoveTrackDialog] = useState<{
    kind: "liked" | "playlist";
    track: MusicTrackDto;
  } | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "player">("list");
  const [listeningByTrack, setListeningByTrack] = useState<Record<number, PlaylistListeningStatusItemDto[]>>({});
  const recordedPlayForTrackRef = useRef<number | null>(null);

  const setMusicView = useCallback(
    (nextView: "list" | "player") => {
      setMobileView(nextView);
      const params = new URLSearchParams(window.location.search);
      if (nextView === "player") params.set("view", "player");
      else params.delete("view");
      const searchText = params.toString();
      navigate({ pathname: "/music", search: searchText ? `?${searchText}` : "" }, { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    const view = new URLSearchParams(location.search).get("view");
    setMobileView(view === "player" ? "player" : "list");
  }, [location.search]);

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
    setMusicView("list");
    setListLoading(true);
    setListErr(null);
    setTracks([]);
    try {
      const list = await fetchHeartTracks();
      setTracks(list);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [setMusicView, t]);

  const onPickHistory = useCallback(async () => {
    setActiveNav("history");
    setMusicView("list");
    setListLoading(true);
    setListErr(null);
    setTracks([]);
    try {
      const list = await fetchPlayHistoryTracks();
      setTracks(list);
    } catch (e) {
      setListErr(mapApiError(t, e));
    } finally {
      setListLoading(false);
    }
  }, [setMusicView, t]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeNav, currentPlaylistId]);

  useEffect(() => {
    setMusicView("list");
  }, [activeNav, currentPlaylistId, search, setMusicView]);

  useEffect(() => {
    if (activeNav !== "discover" || currentPlaylistId == null) {
      setListeningByTrack({});
      return;
    }
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    const pull = async () => {
      try {
        const data = await fetchPlaylistListeningStatus(currentPlaylistId);
        if (cancelled) return;
        const grouped: Record<number, PlaylistListeningStatusItemDto[]> = {};
        for (const item of data.items ?? []) {
          if (!grouped[item.trackId]) grouped[item.trackId] = [];
          grouped[item.trackId]!.push(item);
        }
        setListeningByTrack(grouped);
      } catch {
        if (!cancelled) setListeningByTrack({});
      }
    };
    void pull();
    const connect = () => {
      if (cancelled) return;
      const url = playlistListeningWsUrl(currentPlaylistId);
      if (!url) return;
      ws = new WebSocket(url);
      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(ev.data) as PlaylistListeningWsEvent;
          if (data.type === "listening_clear") {
            const clearedUserId = data.userId;
            if (typeof clearedUserId !== "number") return;
            setListeningByTrack((prev) => {
              const next: Record<number, PlaylistListeningStatusItemDto[]> = {};
              for (const [trackKey, arr] of Object.entries(prev)) {
                const kept = arr.filter((x) => x.userId !== clearedUserId);
                if (kept.length > 0) next[Number(trackKey)] = kept;
              }
              return next;
            });
            return;
          }
          if (data.type !== "listening_update" || !data.item) return;
          setListeningByTrack((prev) => {
            const next: Record<number, PlaylistListeningStatusItemDto[]> = {};
            for (const [trackKey, arr] of Object.entries(prev)) {
              next[Number(trackKey)] = arr.filter((x) => x.userId !== data.item!.userId);
            }
            if (!next[data.item.trackId]) next[data.item.trackId] = [];
            next[data.item.trackId]!.push(data.item);
            return next;
          });
        } catch {
          // ignore malformed ws payload
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    };
    connect();
    const pruneTimer = window.setInterval(() => {
      const now = Date.now();
      setListeningByTrack((prev) => {
        const next: Record<number, PlaylistListeningStatusItemDto[]> = {};
        for (const [trackKey, arr] of Object.entries(prev)) {
          const kept = arr.filter((x) => now - x.updatedAtMillis <= 120_000);
          if (kept.length > 0) next[Number(trackKey)] = kept;
        }
        return next;
      });
    }, 5000);
    return () => {
      cancelled = true;
      if (ws) ws.close();
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      window.clearInterval(pruneTimer);
    };
  }, [activeNav, currentPlaylistId]);

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

  const onPickPlaylist = useCallback(async (id: number): Promise<MusicTrackDto[]> => {
    setCurrentPlaylistId(id);
    setMusicView("list");
    setStoredPlaylistId(id);
    setListLoading(true);
    setListErr(null);
    setTracks([]);
    try {
      const trackList = await fetchMusicTracks(id);
      setTracks(trackList);
      return trackList;
    } catch (e) {
      setListErr(mapApiError(t, e));
      return [];
    } finally {
      setListLoading(false);
    }
  }, [setMusicView, t]);

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

  const syncedLyrics = useSyncedLyrics(current);

  const setCurrentTrackIdFromList = useCallback((id: number) => {
    setCurrentId(id);
    const matched = filtered.find((x) => x.id === id);
    if (matched) {
      setCurrentTrack((prev) => (prev?.id === matched.id ? { ...prev, ...matched } : matched));
    }
  }, [filtered]);

  const barMax =
    playDur > 0 && Number.isFinite(playDur) ? playDur : listDuration > 0 ? listDuration : 0;
  const vinylProgress = barMax > 0 ? Math.min(1, Math.max(0, playPos / barMax)) : 0;
  const showPlayerModule = activeNav !== "fm" && mobileView === "player";
  const showListModule = activeNav !== "fm" && mobileView === "list";

  useEffect(() => {
    setQueue(filtered);
  }, [filtered, setQueue]);

  return (
    <div
      className={clsx(
        "relative flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden text-zinc-200 font-semibold",
        wallpaperActive ? "bg-netease-bg/68 backdrop-blur-sm" : "bg-netease-bg"
      )}
    >
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[200px] shrink-0 flex-col border-r border-netease-line bg-[#1f1f1f] md:flex">
          <div className="flex h-12 items-center gap-2 border-b border-netease-line px-4 text-sm text-zinc-400">
            <Heart className="h-4 w-4 text-red-500/90" fill="currentColor" />
            <span className="min-w-0 flex-1 truncate">{t("music.forNameCloud", { name: FOR_NAME })}</span>
          </div>
          <nav className="custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 pb-2 text-[13px]">
            <button
              type="button"
              onClick={() => {
                setActiveNav("discover");
                setMusicView("list");
              }}
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
              onClick={() => {
                setActiveNav("fm");
                setMusicView("list");
              }}
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
                {p.newForToday ? (
                  <span
                    className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold tabular-nums text-amber-200 ring-1 ring-amber-400/35 bg-amber-500/15"
                    title={t("music.newPlaylistTooltip")}
                  >
                    {t("music.newPlaylistBadge", { defaultValue: "新" })}
                  </span>
                ) : null}
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
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-netease-line bg-zinc-800 py-2.5 text-[13px] text-zinc-200 transition hover:bg-zinc-700"
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
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-netease-line bg-[#252525] py-2.5 text-[13px] text-zinc-300 transition hover:bg-[#2a2a2a] hover:text-zinc-100"
            >
              <Home className="h-3.5 w-3.5 shrink-0 opacity-90" />
              {t("music.backToSite")}
            </Link>
            {user && userIsAdmin(user) ? (
              <Link
                to="/admin"
                className="flex w-full items-center justify-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 py-2.5 text-[13px] text-violet-200 transition hover:bg-violet-500/20"
              >
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t("admin.consoleLink")}</span>
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
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-netease-line bg-netease-panel px-3 sm:gap-3 sm:px-4">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-netease-line bg-[#2a2a2a] text-zinc-300 md:hidden"
              aria-label={t("nav.menuAria")}
            >
              <Menu className="h-4 w-4" />
            </button>
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
              <button
                type="button"
                onClick={() => setMentionsOpen(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-netease-line bg-[#2a2a2a] px-3 py-1.5 text-[11px] text-zinc-300 transition hover:bg-[#333] hover:text-zinc-100"
                title={t("music.mentionsTitle", { defaultValue: "消息列表" })}
              >
                <Bell className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("music.mentionsTitle", { defaultValue: "消息列表" })}</span>
              </button>
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

          {mobileNavOpen ? (
            <div className="fixed inset-0 z-[75] md:hidden">
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMobileNavOpen(false)}
                className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              />
              <aside className="custom-scrollbar absolute left-0 top-0 h-full w-[min(88vw,22rem)] overflow-y-auto border-r border-netease-line bg-[#1f1f1f] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <Heart className="h-4 w-4 text-red-500/90" fill="currentColor" />
                    <span className="truncate">{t("music.forNameCloud", { name: FOR_NAME })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-netease-line bg-[#2a2a2a] text-zinc-300"
                    aria-label={t("common.close", { defaultValue: "关闭" })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1 text-[13px]">
                  <button type="button" onClick={() => { setActiveNav("discover"); setMusicView("list"); }} className={clsx("flex w-full items-center gap-2 rounded-full px-3 py-2 text-left", activeNav === "discover" ? "bg-white/10 text-white" : "text-zinc-400")}>
                    <Home className="h-4 w-4 shrink-0" />{t("music.discover")}
                  </button>
                  <button type="button" onClick={() => { setActiveNav("fm"); setMusicView("list"); }} className={clsx("flex w-full items-center gap-2 rounded-full px-3 py-2 text-left", activeNav === "fm" ? "bg-white/10 text-white" : "text-zinc-400")}>
                    <Radio className="h-4 w-4 shrink-0" />{t("music.privateFm")}
                  </button>
                  <button type="button" onClick={() => void onPickLiked()} className={clsx("flex w-full items-center gap-2 rounded-full px-3 py-2 text-left", activeNav === "liked" ? "bg-white/10 text-white" : "text-zinc-400")}>
                    <Heart className={clsx("h-4 w-4 shrink-0", activeNav === "liked" ? "fill-red-500 text-red-500" : "text-red-400/80")} />
                    {t("music.likedPlaylist", { defaultValue: "我喜欢的音乐" })}
                  </button>
                  <button type="button" onClick={() => void onPickHistory()} className={clsx("flex w-full items-center gap-2 rounded-full px-3 py-2 text-left", activeNav === "history" ? "bg-white/10 text-white" : "text-zinc-400")}>
                    <History className="h-4 w-4 shrink-0" />{t("music.playHistory", { defaultValue: "播放历史" })}
                  </button>
                </div>
                <div className="my-3 border-t border-netease-line/70" />
                <h2 className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-zinc-500">{t("music.myPlaylist")}</h2>
                <div className="space-y-1">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setActiveNav("discover");
                        void onPickPlaylist(p.id);
                      }}
                      className={clsx("flex w-full items-center gap-2 rounded-full px-3 py-2 text-left transition", currentPlaylistId === p.id && activeNav === "discover" ? "bg-white/10 text-white" : "text-zinc-400")}
                    >
                      <ListMusic className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="min-w-0 flex-1 truncate text-[12px]">{p.name}</span>
                      <span className="shrink-0 tabular-nums text-[11px] text-zinc-500">{p.trackCount}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-2 border-t border-netease-line pt-3">
                  <button type="button" onClick={() => setCreatePlaylistOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-800 py-2.5 text-[13px] text-zinc-200">
                    <ListMusic className="h-3.5 w-3.5 opacity-90" />{t("music.newPlaylist")}
                  </button>
                  <button type="button" onClick={() => setUploadOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-red-900/40 bg-[#252525] py-2.5 text-[13px] text-red-200/90">
                    <Music2 className="h-3.5 w-3.5" />{t("music.uploadNew")}
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          <div className="custom-scrollbar scrollbar-no-gutter min-h-0 flex-1 overflow-y-auto p-3 pb-48 sm:p-4 sm:pb-48">
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
                {showPlayerModule ? (
                  <div className="mx-auto mb-2 flex w-full max-w-6xl justify-start">
                    <button
                      type="button"
                      onClick={() => setMusicView("list")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-netease-line/80 bg-[#262626]/95 px-2.5 text-[12px] font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-[#303030] hover:text-zinc-100"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                      返回歌单
                    </button>
                  </div>
                ) : null}
                <section
                  className={clsx(
                    "mx-auto mt-4 mb-4 grid w-full max-w-6xl grid-cols-1 grid-rows-[auto_1fr] gap-4 overflow-hidden p-2",
                    "h-[min(74dvh,820px)] md:mt-8",
                    "md:h-[min(56vh,560px)] md:grid-cols-[380px_minmax(0,1fr)] md:grid-rows-1 md:items-stretch md:gap-0 md:p-6",
                    showPlayerModule ? "grid" : "hidden"
                  )}
                  aria-label="Player Module"
                >
                  {/* 左栏：黑胶 + 歌曲信息；桌面端在格内垂直居中 */}
                  <div className="flex flex-col items-center justify-center gap-3 md:h-full md:gap-5 md:pr-6">
                    <div
                      className={clsx(
                        "w-full shrink-0 md:w-[336px] md:max-w-[336px]",
                        mobileView === "player" ? "max-w-[min(64vw,300px)]" : "max-w-[min(90vw,380px)]"
                      )}
                    >
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
                    <div
                      className={clsx(
                        "w-full text-center md:w-[336px] md:max-w-[336px]",
                        mobileView === "player" ? "max-w-[min(64vw,300px)]" : "max-w-[min(90vw,380px)]"
                      )}
                    >
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
                      "flex w-full min-w-0 flex-col pt-4",
                      "min-h-0 md:h-full md:min-h-0 md:pl-7 md:pt-1"
                    )}
                  >
                    <TrackLyricsScroll
                      track={current}
                      currentTimeSec={playPos}
                      className="min-h-0 min-w-0 w-full flex-1"
                    />
                  </div>
                </section>

                {showPlayerModule && currentId != null ? (
                  <MusicTrackComments trackId={currentId} />
                ) : null}

                <section className={clsx(showListModule ? "block" : "hidden")} aria-label="List Module">
                  {listErr && <p className="mb-2 text-xs text-red-400/90">{listErr}</p>}
                  <MusicTrackTable
                    playlistName={playlistName}
                    tracks={filtered}
                    listLoading={listLoading}
                    showRemoveTrack={showRemoveTrack}
                    currentId={currentId}
                    playing={playing}
                    activeNav={activeNav}
                    onSelectTrack={selectTrack}
                    onSetCurrentId={setCurrentTrackIdFromList}
                    onToggleHeart={onToggleHeart}
                    onRequestRemoveTrack={requestRemoveTrack}
                    listeningByTrack={listeningByTrack}
                  />
                  <p className="mt-3 hidden text-center text-[11px] text-zinc-600 md:block">{t("music.rowHint")}</p>
                </section>
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

      {mentionsOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setMentionsOpen(false)}
        >
          <section
            className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                {t("music.mentionsTitle", { defaultValue: "消息列表" })}
              </h3>
              <button
                type="button"
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setMentionsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <MusicMentionList
                embedded
                hideHeader
                onOpenMention={async (item: MusicMentionNotificationDto) => {
                  let playlistTracks = tracks;
                  if (activeNav !== "discover") {
                    setActiveNav("discover");
                  }
                  if (currentPlaylistId !== item.playlistId) {
                    playlistTracks = await onPickPlaylist(item.playlistId);
                  }
                  const target = playlistTracks.find((x) => x.id === item.trackId);
                  if (target) {
                    setCurrentTrackIdFromList(item.trackId);
                    selectTrack(target);
                  } else {
                    setCurrentId(item.trackId);
                  }
                  setMusicView("player");
                  setMentionsOpen(false);
                }}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
