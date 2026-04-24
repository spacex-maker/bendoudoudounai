import clsx from "clsx";
import type { MeResponse } from "../api/client";
import { userAvatarDisplayUrl } from "../api/client";

type Props = {
  user: MeResponse;
  className?: string;
  /** 更换头像后递增，避免浏览器沿用旧图缓存 */
  imageVersion?: number;
};

export function UserAvatar({ user, className, imageVersion = 0 }: Props) {
  const base = userAvatarDisplayUrl(user);
  const url = base
    ? `${base}${base.includes("?") ? "&" : "?"}_v=${imageVersion}`
    : null;
  const initial = (user.displayName?.trim() || user.email || "?").slice(0, 1).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={clsx("rounded-full object-cover", className)}
        draggable={false}
      />
    );
  }

  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-red-900 font-semibold text-white",
        className
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
