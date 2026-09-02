import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Link2, Trash2, UserMinus, X, Users, Music, PlayCircle, Calendar, ShieldCheck, MailPlus } from "lucide-react";
import clsx from "clsx";
import { useAuthedUser } from "../auth/AuthContext";
import { useDateLocale } from "../i18n/useDateLocale";
import { ConfirmModal } from "./ConfirmModal";
import { mapApiError } from "../i18n/mapApiError";
import {
  isAllowedRemoteWallpaperUrl,
  usePageAppearance,
} from "../pageAppearance/PageAppearanceContext";
import {
  type PlaylistItemDto,
  type PlaylistMemberDto,
  type UserEmailLookupDto,
  deletePlaylist,
  fetchPlaylistMembers,
  fetchPlaylistPendingInvitations,
  type InvitationItemDto,
  inviteToPlaylist,
  lookupUserByEmail,
  removePlaylistMember,
  updatePlaylistName,
  updatePlaylistWallpaperUrl,
  uploadPlaylistWallpaper,
} from "../api/client";

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLookup, setInviteLookup] = useState<UserEmailLookupDto | null>(null);
  const [inviteLookupBusy, setInviteLookupBusy] = useState(false);
  const inviteLookupSeq = useRef(0);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<PlaylistMemberDto | null>(null);

  const playlistId = playlist?.id ?? null;

  useEffect(() => {
    if (!open || playlistId == null) return;
    setNameDraft(playlist?.name ?? "");
    setRenameErr(null);
    setUrlDraft("");
    setWallHint(null);
    setInviteEmail("");
    setInviteErr(null);
    setInviteLookup(null);
    setInviteLookupBusy(false);
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
      setInviteLookup(null);
      setInviteLookupBusy(false);
      return;
    }
    const email = inviteEmail.trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      setInviteLookup(null);
      setInviteLookupBusy(false);
      return;
    }
    const seq = ++inviteLookupSeq.current;
    setInviteLookupBusy(true);
    const timer = window.setTimeout(() => {
      void lookupUserByEmail(email)
        .then((r) => {
          if (seq !== inviteLookupSeq.current) return;
          setInviteLookup(r);
        })
        .catch(() => {
          if (seq !== inviteLookupSeq.current) return;
          setInviteLookup(null);
        })
        .finally(() => {
          if (seq !== inviteLookupSeq.current) return;
          setInviteLookupBusy(false);
        });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [inviteEmail, open, playlist?.iAmOwner]);

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
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return setInviteErr(t("playlistModal.inviteEmailRequired"));
    if (!looksLikeEmail(email)) return setInviteErr(t("playlistModal.inviteEmailInvalid"));
    const selfEmail = me?.email?.trim().toLowerCase();
    if (selfEmail && email === selfEmail) return setInviteErr(t("playlistModal.inviteEmailSelf"));
    if (inviteLookupBusy) return setInviteErr(t("playlistModal.inviteLookupChecking"));
    if (inviteLookup && !inviteLookup.exists) {
      return setInviteErr(t("playlistModal.inviteEmailNotFound"));
    }
    setInviteBusy(true);
    try {
      await inviteToPlaylist(playlistId, email);
      setInviteEmail("");
      setInviteLookup(null);
      onSuccess();
      await reloadMembers();
    } catch (ex) {
      setInviteErr(mapApiError(t, ex));
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

  const createdLabel = playlist.createdAtMillis
    ? new Date(playlist.createdAtMillis).toLocaleDateString(dateLoc, { dateStyle: "medium" })
    : t("playlistModal.unknownDate");

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/65 p-0 backdrop-blur-md sm:items-center sm:p-5"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="relative flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border-0 bg-[#141416] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] sm:h-auto sm:max-h-[min(90dvh,100dvh-2.5rem)] sm:rounded-3xl sm:border sm:border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="relative shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 70% 120% at 0% 0%, rgba(244,63,94,0.16), transparent 55%), radial-gradient(ellipse 50% 80% at 100% 0%, rgba(255,255,255,0.04), transparent 50%)",
              }}
            />
            <div className="relative flex items-start justify-between gap-4 px-4 py-4 sm:px-7 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                  {t("playlistModal.title")}
                </p>
                <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {playlist.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">{t("playlistModal.subtitle")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatChip icon={<Music className="h-3.5 w-3.5" />} label={t("playlistModal.statTracks")} value={playlist.trackCount} />
                  <StatChip icon={<PlayCircle className="h-3.5 w-3.5" />} label={t("playlistModal.statPlays")} value={playlist.totalPlayCount ?? 0} />
                  <StatChip
                    icon={<Users className="h-3.5 w-3.5" />}
                    label={t("playlistModal.statMembers")}
                    value={playlist.memberCount ?? members.length}
                  />
                  <StatChip icon={<Calendar className="h-3.5 w-3.5" />} label={t("playlistModal.statCreated")} value={createdLabel} />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label={t("common.cancel")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="custom-scrollbar scrollbar-overlay min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-5 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:px-7 sm:py-6 sm:pb-8">
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 lg:gap-6">
                <div className="space-y-5">
                  {playlist.iAmOwner ? (
                    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
                        <ShieldCheck className="h-4 w-4 text-rose-400" aria-hidden />
                        {t("playlistModal.basicInfo")}
                      </h3>
                      <form onSubmit={submitRename} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={nameDraft}
                          onChange={(e) => {
                            setNameDraft(e.target.value);
                            setRenameErr(null);
                          }}
                          disabled={renameBusy}
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20"
                          placeholder={t("playlistModal.namePlaceholder")}
                          aria-label={t("playlistModal.namePlaceholder")}
                        />
                        <button
                          type="submit"
                          disabled={renameBusy}
                          className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
                        >
                          {renameBusy ? t("playlistModal.saving") : t("playlistModal.save")}
                        </button>
                      </form>
                      {renameErr ? <p className="mt-2 text-[11px] text-rose-400">{renameErr}</p> : null}
                    </section>
                  ) : null}

                  <section className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
                    <h3 className="mb-3 text-sm font-semibold text-zinc-100">{t("playlistModal.coverAndBg")}</h3>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60">
                      <div className="relative aspect-[16/9] w-full bg-zinc-900">
                        {wallpaperDisplayUrl ? (
                          <img
                            src={wallpaperDisplayUrl}
                            className="h-full w-full object-cover"
                            alt={t("playlistModal.previewAlt")}
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-600">
                            <ImageIcon className="h-9 w-9 opacity-30" />
                            <span className="text-[11px] text-zinc-600">{t("playlistModal.previewAlt")}</span>
                          </div>
                        )}
                        {wallBusy ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs text-white backdrop-blur-[2px]">
                            {t("playlistModal.processing")}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2.5 border-t border-white/[0.06] p-3 sm:p-4">
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                          <input
                            type="url"
                            value={urlDraft}
                            onChange={(e) => {
                              setUrlDraft(e.target.value);
                              setWallHint(null);
                            }}
                            placeholder={t("playlistModal.urlPlaceholder")}
                            aria-label={t("playlistModal.urlPlaceholder")}
                            className="w-full rounded-lg border border-white/10 bg-black/25 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-rose-500/40"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void applyWallpaperUrl()}
                            className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
                          >
                            {t("playlistModal.applyUrl")}
                          </button>
                          <label
                            htmlFor={fileInputId}
                            className="cursor-pointer rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/25"
                          >
                            {t("playlistModal.uploadLocal")}
                          </label>
                          <input
                            id={fileInputId}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={onPickWallpaperFile}
                          />
                          {wallpaperDisplayUrl ? (
                            <button
                              type="button"
                              onClick={() => void clearWallpaper()}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:border-rose-400/30 hover:text-rose-300"
                              aria-label={t("pageAppearance.clear")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("pageAppearance.clear")}
                            </button>
                          ) : null}
                        </div>
                        {wallHint ? <p className="text-[11px] text-rose-400">{wallHint}</p> : null}
                      </div>
                    </div>
                  </section>
                </div>

                <section className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5 lg:min-h-[22rem]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                      <Users className="h-4 w-4 text-rose-400" aria-hidden />
                      {t("playlistModal.collaborators")}
                    </h3>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] tabular-nums text-zinc-400">
                      {t("playlistModal.memberCount", { count: members.length })}
                    </span>
                  </div>

                  {membersLoading ? <p className="mb-3 text-[11px] text-zinc-500">{t("common.loading")}</p> : null}
                  {membersErr ? <p className="mb-3 text-[11px] text-rose-400">{membersErr}</p> : null}

                  <ul className="space-y-1.5">
                    {members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.04] bg-black/25 px-2.5 py-2"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-900 text-xs font-bold text-white ring-1 ring-white/10">
                          {m.label.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-100">{m.label}</p>
                          <p className="text-[10px] text-zinc-500">
                            {m.role === "OWNER" ? t("playlistModal.roleOwner") : t("playlistModal.roleMember")}
                          </p>
                        </div>
                        {playlist.iAmOwner && m.role !== "OWNER" ? (
                          <button
                            type="button"
                            onClick={() => setMemberToRemove(m)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                            aria-label={t("playlistModal.removeMemberTitle")}
                            title={t("playlistModal.removeMemberTitle")}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span
                            className={clsx(
                              "shrink-0 rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                              m.role === "OWNER" ? "bg-rose-500/15 text-rose-300" : "bg-white/5 text-zinc-500"
                            )}
                          >
                            {m.role === "OWNER" ? t("playlistModal.roleOwner") : t("playlistModal.roleMember")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {pendingInvites.length > 0 ? (
                    <div className="mt-4 border-t border-white/[0.06] pt-4">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200/70">
                        {t("playlistModal.pendingInvitesTitle")}
                      </p>
                      <ul className="space-y-1.5">
                        {pendingInvites.map((inv) => (
                          <li
                            key={inv.id}
                            className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-950/20 px-2.5 py-2"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-700/70 to-zinc-900 text-xs font-bold text-amber-50">
                              {inv.inviteeLabel.substring(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-100">{inv.inviteeLabel}</p>
                              <p className="truncate text-[10px] text-zinc-500">
                                {t("playlistModal.inviteBy", { name: inv.inviterLabel })}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
                              {t("playlistModal.inviteStatusPending")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {playlist.iAmOwner ? (
                    <form onSubmit={(e) => void submitInvite(e)} className="mt-auto border-t border-white/[0.06] pt-4">
                      <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
                        <MailPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t("playlistModal.inviteHint")}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`${idBase}-invite-email`} className="sr-only">
                            {t("playlistModal.inviteEmailLabel")}
                          </label>
                          <input
                            id={`${idBase}-invite-email`}
                            type="email"
                            autoComplete="email"
                            value={inviteEmail}
                            onChange={(e) => {
                              setInviteEmail(e.target.value);
                              setInviteErr(null);
                            }}
                            disabled={inviteBusy}
                            placeholder={t("playlistModal.inviteEmailPlaceholder")}
                            className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
                          />
                          {looksLikeEmail(inviteEmail.trim()) ? (
                            <p
                              className={clsx(
                                "mt-1.5 text-[11px]",
                                inviteLookupBusy
                                  ? "text-zinc-500"
                                  : inviteLookup?.exists
                                    ? "text-emerald-400/90"
                                    : inviteLookup
                                      ? "text-amber-300/90"
                                      : "text-zinc-500"
                              )}
                            >
                              {inviteLookupBusy
                                ? t("playlistModal.inviteLookupChecking")
                                : inviteLookup?.exists
                                  ? t("playlistModal.inviteEmailFound", {
                                      name: inviteLookup.label || inviteLookup.email || inviteEmail.trim(),
                                    })
                                  : inviteLookup
                                    ? t("playlistModal.inviteEmailNotFound")
                                    : null}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="submit"
                          disabled={
                            inviteBusy ||
                            inviteLookupBusy ||
                            !inviteEmail.trim() ||
                            (inviteLookup != null && !inviteLookup.exists)
                          }
                          className="shrink-0 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50 sm:self-start"
                        >
                          {inviteBusy ? t("playlistModal.sendingInvite") : t("playlistModal.sendInvite")}
                        </button>
                      </div>
                      {inviteErr ? <p className="mt-1.5 text-[11px] text-rose-400">{inviteErr}</p> : null}
                    </form>
                  ) : null}
                </section>
              </div>

              {playlist.iAmOwner ? (
                <section className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-rose-200">{t("playlistModal.deleteSectionTitle")}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-rose-100/65">{t("playlistModal.deleteHint")}</p>
                    {deleteErr ? <p className="mt-2 text-[11px] text-rose-300">{deleteErr}</p> : null}
                  </div>
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => void submitDeletePlaylist()}
                    className="mt-3 inline-flex shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50 sm:mt-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleteBusy ? t("playlistModal.deleting") : t("playlistModal.deleteAction")}
                  </button>
                </section>
              ) : null}
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
          {memberToRemove ? t("playlistModal.removeMemberBody", { name: memberToRemove.label }) : null}
        </p>
      </ConfirmModal>
    </>
  );
}

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="truncate text-xs font-semibold tabular-nums text-zinc-100">{value}</span>
    </div>
  );
}
