import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { inviteToPlaylist } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 当前要共享的歌单 */
  playlistId: number;
  playlistName: string;
  onSuccess: () => void;
};

export function SharePlaylistModal({ open, onClose, playlistId, playlistName, onSuccess }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setErr(null);
    setSubmitting(false);
  }, [open, playlistId]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim();
    if (!to) {
      setErr(t("shareModal.emailEmpty"));
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await inviteToPlaylist(playlistId, to);
      onSuccess();
      onClose();
    } catch (ex) {
      setErr(mapApiError(t, ex));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-netease-line bg-[#2a2a2a] text-zinc-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-playlist-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-netease-line px-4 py-3">
          <h2 id="share-playlist-title" className="text-sm font-medium">
            {t("shareModal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-3 p-4 text-xs">
          <p className="text-zinc-500">
            {t("shareModal.body", { name: playlistName })}
          </p>
          <div>
            <label htmlFor="share-invite-email" className="mb-1 block text-zinc-500">
              {t("shareModal.emailLabel")}
            </label>
            <input
              id="share-invite-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr(null);
              }}
              placeholder="name@example.com"
              disabled={submitting}
              className="w-full rounded-lg border border-netease-line bg-[#1a1a1a] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-red-900/50"
            />
          </div>
          {err ? <p className="text-[11px] text-red-400/90">{err}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-netease-line px-4 py-2 text-zinc-400 transition hover:bg-white/5 disabled:opacity-50"
            >
              {t("shareModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-red-900/80 px-4 py-2 text-white transition hover:bg-red-800 disabled:opacity-50"
            >
              {submitting ? t("shareModal.sending") : t("shareModal.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
