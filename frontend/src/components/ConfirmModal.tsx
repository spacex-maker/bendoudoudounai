import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 正文，可含曲目名、说明等 */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** 为 true 时主按钮为红（危险操作） */
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * 通用确认模态；用于替代 `window.confirm`，与音乐页/网易云深色风格一致。
 */
export function ConfirmModal({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
}: Props) {
  const titleId = useId();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const run = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onConfirm());
      onClose();
    } catch {
      // 由调用方处理提示；不自动关闭
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-netease-line/80 bg-[#2a2a2a] text-zinc-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-netease-line/60 px-5 py-4">
          <h2 id={titleId} className="text-sm font-medium tracking-tight text-zinc-100">
            {title}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
            aria-label={cancelLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm leading-relaxed text-zinc-300">{children}</div>
        <div className="flex justify-end gap-2 border-t border-netease-line/60 bg-[#262626] px-5 py-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-full border border-netease-line bg-[#1e1e1e] px-4 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void run()}
            className={clsx(
              "inline-flex min-w-[5rem] items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition disabled:opacity-60",
              danger
                ? "bg-red-800/90 text-white hover:bg-red-700"
                : "bg-zinc-100 text-zinc-900 hover:bg-white"
            )}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
