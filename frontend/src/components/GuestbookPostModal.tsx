import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import clsx from "clsx";
import { fetchUserDirectoryForGuestbook, submitGuestbookMessage } from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useAuth, useAuthedUser } from "../auth/AuthContext";
import { GuestbookNicknameSection, resolveGuestbookNickname } from "./GuestbookNicknameSection";
import { GuestbookUserPicker } from "./GuestbookUserPicker";

const CONTENT_MAX = 2000;

type Props = {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
};

export function GuestbookPostModal({ open, onClose, onPosted }: Props) {
  const { t } = useTranslation();
  const { state } = useAuth();
  const authed = state.status === "authed";
  const me = useAuthedUser();
  const [anonymous, setAnonymous] = useState(!authed);

  const [nick, setNick] = useState("");
  const [content, setContent] = useState("");
  const [direct, setDirect] = useState(false);
  const [userId, setUserId] = useState<number | "">("");
  const [directory, setDirectory] = useState<UserDirectoryItemDto[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDir = useCallback(async () => {
    if (!authed) {
      setDirectory([]);
      return;
    }
    setDirLoading(true);
    try {
      setDirectory(await fetchUserDirectoryForGuestbook());
    } catch {
      setDirectory([]);
    } finally {
      setDirLoading(false);
    }
  }, [authed]);

  useEffect(() => {
    if (!open) return;
    setNick("");
    setContent("");
    setDirect(false);
    setUserId("");
    setErr(null);
    setAnonymous(!authed);
    void loadDir();
  }, [open, loadDir, authed]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = content.trim();
    if (!c) {
      setErr(t("guestbook.emptyContent"));
      return;
    }
    if (direct) {
      if (!authed) {
        setErr(t("guestbook.loginForDirect"));
        return;
      }
      if (userId === "") {
        setErr(t("guestbook.pickUserRequired"));
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      await submitGuestbookMessage({
        content: c,
        nickname: resolveGuestbookNickname(authed, anonymous, me, nick),
        parentId: null,
        visibleToUserId: direct && userId !== "" ? Number(userId) : null,
      });
      onPosted();
      onClose();
    } catch (ex) {
      setErr(mapApiError(t, ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        aria-label={t("common.cancel")}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-b from-white/95 to-rose-50/90 shadow-2xl shadow-rose-200/30"
        role="dialog"
        aria-modal
        aria-labelledby="gb-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-rose-100/80 px-5 py-4">
          <h2 id="gb-modal-title" className="font-display text-lg text-warm-600">
            {t("guestbook.modalTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-400 transition hover:bg-white/80 hover:text-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-5 pt-3 text-xs leading-relaxed text-stone-500">{t("guestbook.modalHint")}</p>
        <form onSubmit={(e) => void submit(e)} className="space-y-4 p-5 pt-3">
          <div>
            <label className="mb-1 block text-left text-xs font-medium text-warm-600/85">{t("guestbook.visibility")}</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-3 py-2 text-sm text-stone-800 shadow-sm">
                <input
                  type="radio"
                  name="vis"
                  className="text-rose-500"
                  checked={!direct}
                  onChange={() => {
                    setDirect(false);
                    setErr(null);
                  }}
                />
                {t("guestbook.visibilityPublic")}
              </label>
              <label
                className={clsx(
                  "inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm shadow-sm",
                  authed
                    ? "border-white/80 bg-white/70 text-stone-800"
                    : "cursor-not-allowed border-dashed border-stone-200 bg-stone-100/50 text-stone-400"
                )}
              >
                <input
                  type="radio"
                  name="vis"
                  className="text-rose-500"
                  disabled={!authed}
                  checked={direct}
                  onChange={() => {
                    setDirect(true);
                    setErr(null);
                  }}
                />
                {t("guestbook.visibilityDirect")}
              </label>
            </div>
            {!authed ? <p className="text-[11px] text-amber-700/90">{t("guestbook.loginForDirect")}</p> : null}
            {authed && direct ? (
              <div className="mt-2">
                {dirLoading ? (
                  <p className="flex items-center gap-2 text-xs text-stone-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("common.loading")}
                  </p>
                ) : (
                  <GuestbookUserPicker
                    value={userId}
                    onChange={(id) => {
                      setUserId(id);
                      setErr(null);
                    }}
                    options={directory}
                    disabled={false}
                    placeholder={t("guestbook.pickUser")}
                  />
                )}
              </div>
            ) : null}
          </div>

          <GuestbookNicknameSection
            authed={authed}
            user={me}
            anonymous={anonymous}
            onAnonymousChange={(v) => {
              setAnonymous(v);
              setNick("");
              setErr(null);
            }}
            nick={nick}
            onNickChange={(v) => {
              setNick(v);
              setErr(null);
            }}
            busy={busy}
          />
          <div>
            <label className="mb-1 block text-left text-xs font-medium text-warm-600/85">
              {t("guestbook.contentLabel")}
            </label>
            <textarea
              required
              rows={6}
              maxLength={CONTENT_MAX}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErr(null);
              }}
              placeholder={t("guestbook.postRootPh")}
              disabled={busy}
              className="w-full resize-y rounded-2xl border border-rose-200/50 bg-white/90 px-3 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/40"
            />
            <p className="mt-1 text-right text-[10px] text-stone-400">
              {content.length}/{CONTENT_MAX}
            </p>
          </div>
          {err ? <p className="text-center text-xs text-red-600/90">{err}</p> : null}
          <div className="flex justify-end gap-2 border-t border-rose-100/60 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-warm-300/50 bg-white/80 px-5 py-2.5 text-sm font-medium text-warm-600 transition hover:bg-white"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-w-[7rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-warm-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-300/30 transition hover:from-rose-600 hover:to-warm-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? t("guestbook.sending") : t("guestbook.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
