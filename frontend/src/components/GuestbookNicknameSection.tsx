import { useId } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import type { MeResponse } from "../api/client";
import { UserAvatar } from "./UserAvatar";

const NICK_MAX = 32;

export function resolveGuestbookNickname(
  authed: boolean,
  anonymous: boolean,
  user: MeResponse | null,
  nick: string
): string | null {
  if (authed && user && !anonymous) {
    const s = (user.displayName?.trim() || user.email || "").trim();
    return s ? s.slice(0, NICK_MAX) : null;
  }
  const t = nick.trim();
  return t || null;
}

type Props = {
  authed: boolean;
  user: MeResponse | null;
  anonymous: boolean;
  onAnonymousChange: (next: boolean) => void;
  nick: string;
  onNickChange: (v: string) => void;
  busy: boolean;
};

/**
 * 留言板称呼行：选填 + 已登录时右侧「匿名」开关；关匿名时展示当前账号头像与名称，开匿名时显示称呼输入
 */
export function GuestbookNicknameSection({
  authed,
  user,
  anonymous,
  onAnonymousChange,
  nick,
  onNickChange,
  busy,
}: Props) {
  const { t } = useTranslation();
  const anonLabelId = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-left text-xs font-medium text-warm-600/85">
          {t("guestbook.nickLabelOptional")}
        </span>
        {authed ? (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-stone-500" id={anonLabelId}>
              {t("guestbook.anonSwitchLabel")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={anonymous}
              aria-labelledby={anonLabelId}
              onClick={() => onAnonymousChange(!anonymous)}
              disabled={busy}
              className={clsx(
                "relative h-6 w-11 shrink-0 rounded-full border transition",
                anonymous ? "border-rose-300 bg-rose-500/90" : "border-stone-200/80 bg-stone-200/90"
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                  anonymous ? "right-0.5" : "left-0.5"
                )}
                aria-hidden
              />
            </button>
          </div>
        ) : null}
      </div>
      {authed && !anonymous && user ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200/50 bg-white/80 px-3 py-2.5">
          <UserAvatar user={user} className="h-9 w-9 shrink-0 border border-rose-100" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-stone-800">{user.displayName?.trim() || user.email}</p>
            <p className="text-[11px] text-stone-500">{t("guestbook.usingAccountDisplay")}</p>
          </div>
        </div>
      ) : (
        <input
          type="text"
          maxLength={NICK_MAX}
          value={nick}
          onChange={(e) => onNickChange(e.target.value)}
          placeholder={t("guestbook.nickPh")}
          disabled={busy}
          className="w-full rounded-2xl border border-rose-200/50 bg-white/90 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/40"
        />
      )}
    </div>
  );
}
