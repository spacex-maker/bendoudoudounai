import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Link2, Trash2, UserMinus, X, Users, Music, PlayCircle, Calendar, ShieldCheck, MailPlus } from "lucide-react";
import clsx from "clsx";
import { useAuthedUser } from "../auth/AuthContext";
import { useDateLocale } from "../i18n/useDateLocale";
import { GuestbookUserPicker } from "./GuestbookUserPicker";
import { ConfirmModal } from "./ConfirmModal";
import { mapApiError } from "../i18n/mapApiError";
import {
  isAllowedRemoteWallpaperUrl,
  usePageAppearance,
} from "../pageAppearance/PageAppearanceContext";
import {
  type PlaylistItemDto,
  type PlaylistMemberDto,
  type UserDirectoryItemDto,
  deletePlaylist,
  fetchPlaylistMembers,
  fetchPlaylistPendingInvitations,
  fetchUserDirectoryForGuestbook,
  type InvitationItemDto,
  inviteToPlaylist,
  removePlaylistMember,
  updatePlaylistName,
  updatePlaylistWallpaperUrl,
  uploadPlaylistWallpaper,
} from "../api/client";

type Props = {
  open: boolean;
  onClose: () => void;
  playlist: PlaylistItemDto | null;
  onSuccess: () => void;
};

export function PlaylistSettingsModal({ open, onClose, playlist, onSuccess }: Props) {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const me = useAuthedUser();
  const idBase = useId();
  const fileInputId = `${idBase}-wallpaper-file`;
  const { wallpaperDisplayUrl, refreshPlaylists } = usePageAppearance();

  const [members, setMembers] = useState<PlaylistMemberDto[]>([]);
  const [pendingInvites, setPendingInvites] = useState<InvitationItemDto[]>([]);
  const [membersErr, setMembersErr] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [nameDraft, setNameDraft] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameErr, setRenameErr] = useState<string | null>(null);

  const [urlDraft, setUrlDraft] = useState("");
  const [wallHint, setWallHint] = useState<string | null>(null);
  const [wallBusy, setWallBusy] = useState(false);

  const [inviteUserId, setInviteUserId] = useState<number | "">("");
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [userDirectory, setUserDirectory] = useState<UserDirectoryItemDto[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<PlaylistMemberDto | null>(null);

  const playlistId = playlist?.id ?? null;

  const inviteCandidates = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.userId));
    const pendingIds = new Set(pendingInvites.map((i) => i.inviteeId));
    return userDirectory.filter(
      (u) => u.id !== me?.id && !memberIds.has(u.id) && !pendingIds.has(u.id)
    );
  }, [userDirectory, members, pendingInvites, me?.id]);

  useEffect(() => {
    if (!open || playlistId == null) return;
    setNameDraft(playlist?.name ?? "");
    setRenameErr(null);
    setUrlDraft("");
    setWallHint(null);
    setInviteUserId("");
    setInviteErr(null);
    setDeleteErr(null);
    setMembersErr(null);
    setMembersLoading(true);
    void Promise.all([fetchPlaylistMembers(playlistId), fetchPlaylistPendingInvitations(playlistId)])
      .then(([m, p]) => {
        setMembers(m);
        setPendingInvites(p);
      })
      .catch((e) => setMembersErr(e instanceof Error ? e.message : t("errors.loadFailed")))
      .finally(() => setMembersLoading(false));
  }, [open, playlistId, playlist?.name, t]);

  useEffect(() => {
    if (!open || !playlist?.iAmOwner) {
      setUserDirectory([]);
      setDirLoading(false);
      return;
    }
    setDirLoading(true);
    void fetchUserDirectoryForGuestbook()
      .then(setUserDirectory)
      .catch(() => setUserDirectory([]))
      .finally(() => setDirLoading(false));
  }, [open, playlist?.iAmOwner]);

  const reloadMembers = useCallback(async () => {
    if (playlistId == null) return;
    setMembersLoading(true);
    try {
      const [m, p] = await Promise.all([
        fetchPlaylistMembers(playlistId),
        fetchPlaylistPendingInvitations(playlistId),
      ]);
      setMembers(m);
      setPendingInvites(p);
    } catch (e) {
      setMembersErr(e instanceof Error ? e.message : t("errors.loadFailed"));
    } finally {
      setMembersLoading(false);
    }
  }, [playlistId, t]);

  const applyWallpaperUrl = useCallback(async () => {
    if (playlistId == null) return;
    const raw = urlDraft.trim();
    if (!raw) return setWallHint(t("playlistModal.wallUrlEmpty"));
    if (!isAllowedRemoteWallpaperUrl(raw)) return setWallHint(t("playlistModal.wallUrlHttp"));
    setWallBusy(true);
    try {
      await updatePlaylistWallpaperUrl(playlistId, raw);
      await refreshPlaylists();
      onSuccess();
      setUrlDraft("");
    } catch (e) {
      setWallHint(e instanceof Error ? e.message : t("playlistModal.wallSaveFailed"));
    } finally {
      setWallBusy(false);
    }
  }, [urlDraft, playlistId, refreshPlaylists, onSuccess, t]);

  const onPickWallpaperFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (playlistId == null) return;
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return setWallHint(t("playlistModal.wallPickImage"));
    setWallBusy(true);
    try {
      await uploadPlaylistWallpaper(playlistId, f);
      await refreshPlaylists();
      onSuccess();
    } catch (err) {
      setWallHint(err instanceof Error ? err.message : t("playlistModal.wallUploadFailed"));
    } finally {
      setWallBusy(false);
    }
  }, [playlistId, refreshPlaylists, onSuccess, t]);

  const clearWallpaper = useCallback(async () => {
    if (playlistId == null) return;
    setWallBusy(true);
    try {
      await updatePlaylistWallpaperUrl(playlistId, null);
      await refreshPlaylists();
      onSuccess();
    } catch (e) {
      setWallHint(e instanceof Error ? e.message : t("playlistModal.wallClearFailed"));
    } finally {
      setWallBusy(false);
    }
  }, [playlistId, refreshPlaylists, onSuccess, t]);

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistId == null || !playlist?.iAmOwner) return;
    const nm = nameDraft.trim();
    if (!nm) return setRenameErr(t("playlistModal.nameEmpty"));
    setRenameBusy(true);
    try {
      await updatePlaylistName(playlistId, nm);
      await refreshPlaylists();
      onSuccess();
    } catch (ex) {
      setRenameErr(ex instanceof Error ? ex.message : t("playlistModal.renameFailed"));
    } finally {
      setRenameBusy(false);
    }
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistId == null || !playlist?.iAmOwner) return;
    if (inviteUserId === "") return setInviteErr(t("playlistModal.invitePickRequired"));
    const picked = userDirectory.find((u) => u.id === inviteUserId);
    if (!picked) return setInviteErr(t("playlistModal.invitePickRequired"));
    setInviteBusy(true);
    try {
      await inviteToPlaylist(playlistId, picked.email);
      setInviteUserId("");
      onSuccess();
      await reloadMembers();
    } catch (ex) {
      setInviteErr(ex instanceof Error ? ex.message : t("playlistModal.inviteFailed"));
    } finally {
      setInviteBusy(false);
    }
  };

  const submitDeletePlaylist = useCallback(async () => {
    if (playlistId == null || !playlist?.iAmOwner || deleteBusy) return;
    const ok = window.confirm(
      t("playlistModal.deleteConfirm", {
        name: playlist.name,
        defaultValue: `确认删除歌单「${playlist.name}」？歌单内歌曲会保留并迁移到默认歌单。`,
      })
    );
    if (!ok) return;
    setDeleteErr(null);
    setDeleteBusy(true);
    try {
      await deletePlaylist(playlistId);
      await refreshPlaylists();
      onSuccess();
      onClose();
    } catch (ex) {
      setDeleteErr(ex instanceof Error ? ex.message : t("playlistModal.deleteFailed"));
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteBusy, onClose, onSuccess, playlist, playlistId, refreshPlaylists, t]);

  if (!open || playlist == null) return null;

  return (
    <>
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-md transition-all"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-xl overflow-hidden rounded-[40px] border border-white/10 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <header className="flex items-center justify-between px-8 py-6">
          <div>
            <h2 className="text-xl font-bold text-white">{t("playlistModal.title")}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{t("playlistModal.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label={t("common.cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="custom-scrollbar overflow-y-auto px-8 pb-10 pt-2" style={{ maxHeight: "calc(85vh - 100px)" }}>
          <div className="space-y-8">
            
            {/* 1. 数据概览卡片区 */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<Music className="h-4 w-4" />} label={t("playlistModal.statTracks")} value={playlist.trackCount} />
              <StatCard icon={<PlayCircle className="h-4 w-4" />} label={t("playlistModal.statPlays")} value={playlist.totalPlayCount ?? 0} />
              <StatCard icon={<Users className="h-4 w-4" />} label={t("playlistModal.statMembers")} value={playlist.memberCount ?? members.length} />
              <StatCard
                icon={<Calendar className="h-4 w-4" />}
                label={t("playlistModal.statCreated")}
                value={
                  playlist.createdAtMillis
                    ? new Date(playlist.createdAtMillis).toLocaleDateString(dateLoc, { dateStyle: "medium" })
                    : t("playlistModal.unknownDate")
                }
              />
            </section>

            {/* 2. 基本设置（仅 Owner） */}
            {playlist.iAmOwner && (
              <section className="rounded-[32px] bg-white/[0.03] p-6 ring-1 ring-white/[0.05]">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <ShieldCheck className="h-4 w-4 text-rose-500" aria-hidden />
                  {t("playlistModal.basicInfo")}
                </h3>
                <form onSubmit={submitRename} className="flex gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => { setNameDraft(e.target.value); setRenameErr(null); }}
                    disabled={renameBusy}
                    className="flex-1 rounded-full bg-zinc-950/50 px-5 py-3 text-sm text-white outline-none ring-1 ring-white/10 transition-all focus:ring-rose-500/50"
                    placeholder={t("playlistModal.namePlaceholder")}
                    aria-label={t("playlistModal.namePlaceholder")}
                  />
                  <button
                    type="submit"
                    disabled={renameBusy}
                    className="rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-95 disabled:opacity-50"
                  >
                    {renameBusy ? t("playlistModal.saving") : t("playlistModal.save")}
                  </button>
                </form>
                {renameErr && <p className="mt-2 pl-4 text-[11px] text-rose-400">{renameErr}</p>}
              </section>
            )}

            {/* 3. 背景视觉设置 */}
            <section className="rounded-[32px] bg-white/[0.03] p-6 ring-1 ring-white/[0.05]">
              <h3 className="mb-4 text-sm font-semibold text-zinc-200">{t("playlistModal.coverAndBg")}</h3>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-800 sm:w-48">
                  {wallpaperDisplayUrl ? (
                    <img src={wallpaperDisplayUrl} className="h-full w-full object-cover" alt={t("playlistModal.previewAlt")} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <ImageIcon className="h-8 w-8 opacity-20" />
                    </div>
                  )}
                  {wallBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs backdrop-blur-sm">
                      {t("playlistModal.processing")}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-3">
                  <div className="relative">
                    <Link2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="url"
                      value={urlDraft}
                      onChange={(e) => { setUrlDraft(e.target.value); setWallHint(null); }}
                      placeholder={t("playlistModal.urlPlaceholder")}
                      aria-label={t("playlistModal.urlPlaceholder")}
                      className="w-full rounded-full bg-zinc-950/50 py-2.5 pl-11 pr-4 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-rose-500/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void applyWallpaperUrl()}
                      className="flex-1 rounded-full bg-zinc-800 py-2.5 text-xs font-medium text-white transition hover:bg-zinc-700"
                    >
                      {t("playlistModal.applyUrl")}
                    </button>
                    <label
                      htmlFor={fileInputId}
                      className="flex-1 cursor-pointer rounded-full bg-rose-500/10 py-2.5 text-center text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
                    >
                      {t("playlistModal.uploadLocal")}
                    </label>
                    <input id={fileInputId} type="file" accept="image/*" className="sr-only" onChange={onPickWallpaperFile} />
                    {wallpaperDisplayUrl && (
                      <button
                        type="button"
                        onClick={() => void clearWallpaper()}
                        className="rounded-full bg-zinc-800 px-3 transition hover:bg-rose-900/30 hover:text-rose-400"
                        aria-label={t("pageAppearance.clear")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {wallHint && <p className="mt-2 text-[11px] text-rose-400">{wallHint}</p>}
            </section>

            {/* 4. 成员与协作 */}
            <section className="rounded-[32px] bg-white/[0.03] p-6 ring-1 ring-white/[0.05]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">{t("playlistModal.collaborators")}</h3>
                <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] text-zinc-400">
                  {t("playlistModal.memberCount", { count: members.length })}
                </span>
              </div>

              {membersLoading ? (
                <p className="mb-3 text-center text-[11px] text-zinc-500">{t("common.loading")}</p>
              ) : null}
              {membersErr ? <p className="mb-3 text-center text-[11px] text-rose-400">{membersErr}</p> : null}

              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex min-w-0 items-center gap-2 rounded-full bg-black/20 p-1 pl-1 pr-2 ring-1 ring-white/5 sm:gap-3 sm:pr-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-bold text-white">
                      {m.label.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{m.label}</span>
                    {playlist.iAmOwner && m.role !== "OWNER" && (
                      <button
                        type="button"
                        onClick={() => setMemberToRemove(m)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-rose-500/20 hover:text-rose-300"
                        aria-label={t("playlistModal.removeMemberTitle")}
                        title={t("playlistModal.removeMemberTitle")}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span
                      className={clsx(
                        "shrink-0 text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5",
                        m.role === "OWNER" ? "bg-rose-500/20 text-rose-400" : "bg-zinc-800 text-zinc-500"
                      )}
                    >
                      {m.role === "OWNER" ? t("playlistModal.roleOwner") : t("playlistModal.roleMember")}
                    </span>
                  </div>
                ))}
              </div>

              {pendingInvites.length > 0 ? (
                <div className="mb-4">
                  <p className="mb-2 pl-1 text-[10px] font-medium uppercase tracking-wider text-amber-200/80">
                    {t("playlistModal.pendingInvitesTitle")}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-col gap-1 rounded-2xl bg-amber-950/20 p-2 pl-3 ring-1 ring-amber-500/20 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-800/60 to-zinc-900 text-[10px] font-bold text-amber-100">
                            {inv.inviteeLabel.substring(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-zinc-200">{inv.inviteeLabel}</div>
                            <div className="truncate text-[10px] text-zinc-500">
                              {t("playlistModal.inviteBy", { name: inv.inviterLabel })}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 self-end rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[9px] font-bold text-amber-200 sm:self-center">
                          {t("playlistModal.inviteStatusPending")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {playlist.iAmOwner && (
                <form onSubmit={submitInvite} className="mt-6 border-t border-white/5 pt-6">
                  <div className="mb-3 flex items-center gap-2 text-[11px] text-zinc-500">
                    <MailPlus className="h-3 w-3 shrink-0" aria-hidden />
                    {t("playlistModal.inviteHint")}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <GuestbookUserPicker
                        variant="dark"
                        value={inviteUserId}
                        onChange={(id) => {
                          setInviteUserId(id);
                          setInviteErr(null);
                        }}
                        options={inviteCandidates}
                        disabled={inviteBusy || dirLoading}
                        placeholder={t("playlistModal.invitePickUser")}
                      />
                      {!dirLoading && inviteCandidates.length === 0 ? (
                        <p className="mt-2 pl-1 text-[11px] text-zinc-500">{t("playlistModal.inviteNoCandidates")}</p>
                      ) : null}
                    </div>
                    <button
                      type="submit"
                      disabled={inviteBusy || dirLoading || inviteUserId === "" || inviteCandidates.length === 0}
                      className="shrink-0 rounded-full bg-rose-600 px-6 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 active:scale-95 disabled:opacity-50"
                    >
                      {inviteBusy ? t("playlistModal.sendingInvite") : t("playlistModal.sendInvite")}
                    </button>
                  </div>
                  {inviteErr && <p className="mt-2 pl-4 text-[11px] text-rose-400">{inviteErr}</p>}
                </form>
              )}
            </section>
            {playlist.iAmOwner && (
              <section className="rounded-[32px] bg-rose-500/[0.06] p-6 ring-1 ring-rose-400/20">
                <h3 className="mb-3 text-sm font-semibold text-rose-200">{t("playlistModal.deleteSectionTitle")}</h3>
                <p className="mb-4 text-xs text-rose-100/80">{t("playlistModal.deleteHint")}</p>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void submitDeletePlaylist()}
                  className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleteBusy ? t("playlistModal.deleting") : t("playlistModal.deleteAction")}
                </button>
                {deleteErr && <p className="mt-2 text-[11px] text-rose-300">{deleteErr}</p>}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      open={memberToRemove != null}
      onClose={() => setMemberToRemove(null)}
      title={t("playlistModal.removeMemberTitle")}
      confirmLabel={t("playlistModal.removeMemberAction")}
      cancelLabel={t("common.cancel")}
      danger
      onConfirm={async () => {
        if (playlistId == null || memberToRemove == null) return;
        try {
          await removePlaylistMember(playlistId, memberToRemove.userId);
          setMemberToRemove(null);
          await refreshPlaylists();
          onSuccess();
          await reloadMembers();
        } catch (e) {
          alert(mapApiError(t, e));
        }
      }}
    >
      <p className="text-sm text-zinc-300">
        {memberToRemove
          ? t("playlistModal.removeMemberBody", { name: memberToRemove.label })
          : null}
      </p>
    </ConfirmModal>
    </>
  );
}

// 辅助组件：详情统计卡片
function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]">
      <div className="flex items-center gap-1.5 text-zinc-500">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-bold text-zinc-200 tabular-nums">{value}</div>
    </div>
  );
}