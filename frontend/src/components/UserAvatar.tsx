import clsx from "clsx";
import type { MeResponse } from "../api/client";
import { userAvatarDisplayUrl } from "../api/client";

type Props = {
  user: MeResponse;
  className?: string;
  /** 更换头像后递增，避免浏览器沿用旧图缓存 */
  imageVersion?: number;
  /** 顶栏等紧凑场景可关掉豆值角标 */
  showLevelBadge?: boolean;
};

export function UserAvatar({
  user,
  className,
  imageVersion = 0,
  showLevelBadge = true,
}: Props) {
  const base = userAvatarDisplayUrl(user);
  const url = base
    ? `${base}${base.includes("?") ? "&" : "?"}_v=${imageVersion}`
    : null;
  const initial = (user.displayName?.trim() || user.email || "?").slice(0, 1).toUpperCase();

  const badge = showLevelBadge ? user.beanLevelCode ?? null : null;

  if (url) {
    return (
      <div className="relative inline-flex">
        <img
          src={url}
          alt=""
          className={clsx("rounded-full object-cover", className)}
          draggable={false}
        />
        {badge ? (
          <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-amber-400/95 px-1 py-0.5 text-[8px] font-bold leading-none text-ink-900 ring-2 ring-white">
            {badge}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative inline-flex">
      <div
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d64545] to-[#8f1c1c] text-[0.7em] font-semibold text-white",
          className
        )}
        aria-hidden
      >
        {initial}
      </div>
      {badge ? (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-amber-400/95 px-1 py-0.5 text-[8px] font-bold leading-none text-ink-900 ring-2 ring-white">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
