import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { userDirectoryAvatarUrl, userIsAdmin, type UserDirectoryItemDto } from "../api/client";

function PickerAvatar({ user, className }: { user: UserDirectoryItemDto; className?: string }) {
  const url = userDirectoryAvatarUrl({
    id: user.id,
    hasAvatar: user.hasAvatar ?? false,
  });
  const initial = (user.label || user.email || "?").slice(0, 1).toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={clsx("shrink-0 rounded-full object-cover", className ?? "h-8 w-8")}
        draggable={false}
      />
    );
  }
  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-600 to-red-900 text-xs font-semibold text-white",
        className ?? "h-8 w-8"
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}

type Props = {
  value: number | "";
  onChange: (id: number | "") => void;
  options: UserDirectoryItemDto[];
  disabled?: boolean;
  placeholder: string;
  /** dark：深色面板内（如歌单设置模态框） */
  variant?: "light" | "dark";
};

/**
 * 站内用户选择：全圆角触发器 + 带头像的自定义列表（留言板可见范围、歌单邀请等）
 */
export function GuestbookUserPicker({ value, onChange, options, disabled, placeholder, variant = "light" }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value === "" ? null : options.find((o) => o.id === value) ?? null;
  const dark = variant === "dark";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex w-full min-h-[2.75rem] items-center gap-2.5 rounded-full border pl-2 pr-3 py-1.5 text-left text-sm shadow-sm transition focus:outline-none focus:ring-2",
          dark
            ? "border-white/15 bg-zinc-800/90 text-zinc-100 hover:border-white/25 hover:bg-zinc-800 focus:border-rose-500/50 focus:ring-rose-500/30"
            : "border-rose-200/60 bg-white/90 text-stone-800 hover:border-rose-300/80 hover:bg-white focus:border-rose-400 focus:ring-rose-200/50",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {selected ? (
          <>
            <PickerAvatar user={selected} className="h-9 w-9" />
            <div className="min-w-0 flex-1 text-left">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate font-medium leading-tight">{selected.label}</p>
                {userIsAdmin(selected) ? (
                  <span
                    className={clsx(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      dark ? "bg-violet-500/25 text-violet-300" : "bg-violet-500/15 text-violet-800"
                    )}
                  >
                    {t("common.roleAdmin")}
                  </span>
                ) : null}
              </div>
              <p className={clsx("truncate text-[11px]", dark ? "text-zinc-400" : "text-stone-500")}>{selected.email}</p>
            </div>
          </>
        ) : (
          <>
            <div
              className={clsx(
                "ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed text-[10px]",
                dark
                  ? "border-zinc-600 bg-zinc-900/50 text-zinc-500"
                  : "border-rose-200/60 bg-rose-50/50 text-rose-400/90"
              )}
            >
              —
            </div>
            <span className={clsx("min-w-0 flex-1 truncate", dark ? "text-zinc-400" : "text-stone-500")}>{placeholder}</span>
          </>
        )}
        <ChevronDown
          className={clsx("h-4 w-4 shrink-0 transition", dark ? "text-zinc-500" : "text-stone-400", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && !disabled ? (
        <ul
          className={clsx(
            "absolute left-0 right-0 top-full z-[110] mt-1.5 max-h-64 list-none space-y-0.5 overflow-y-auto overflow-x-hidden rounded-3xl border p-1.5 shadow-xl backdrop-blur-md",
            dark
              ? "border-white/10 bg-zinc-900/98 shadow-black/50"
              : "border-rose-200/50 bg-white/95 shadow-rose-200/25"
          )}
          role="listbox"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={clsx(
                "flex w-full min-w-0 items-center gap-2 rounded-full border border-transparent px-2.5 py-2 text-left text-sm transition",
                dark ? "text-zinc-400 hover:bg-white/10" : "text-stone-500 hover:border-rose-100/80 hover:bg-rose-50/80"
              )}
            >
              <div
                className={clsx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed",
                  dark ? "border-zinc-600 bg-zinc-800/80 text-zinc-500" : "border-stone-200 bg-stone-50/80 text-stone-400"
                )}
              >
                ·
              </div>
              <span className="min-w-0 flex-1 truncate">{placeholder}</span>
            </button>
          </li>
          {options.map((u) => {
            const isActive = value !== "" && value === u.id;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full min-w-0 items-center gap-2.5 rounded-full border px-2.5 py-2 text-left transition",
                    dark
                      ? isActive
                        ? "border-rose-500/40 bg-rose-500/15"
                        : "border-transparent hover:bg-white/10"
                      : isActive
                        ? "border-rose-200/80 bg-rose-50/90"
                        : "border-transparent hover:border-rose-100/80 hover:bg-rose-50/60"
                  )}
                >
                  <PickerAvatar user={u} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className={clsx("truncate text-sm font-medium", dark ? "text-zinc-100" : "text-stone-800")}>
                        {u.label}
                      </p>
                      {userIsAdmin(u) ? (
                        <span
                          className={clsx(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                            dark ? "bg-violet-500/25 text-violet-300" : "bg-violet-500/15 text-violet-800"
                          )}
                        >
                          {t("common.roleAdmin")}
                        </span>
                      ) : null}
                    </div>
                    <p className={clsx("truncate text-[11px]", dark ? "text-zinc-400" : "text-stone-500")}>{u.email}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
