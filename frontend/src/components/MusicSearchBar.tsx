import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, Search, X } from "lucide-react";
import clsx from "clsx";
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistoryItem,
  type SearchHistoryScope,
} from "../music/searchHistory";

type Props = {
  value: string;
  onChange: (value: string) => void;
  scope: SearchHistoryScope;
  placeholder: string;
  className?: string;
  /** 回车或点选历史时回调（发现搜索可用来立刻记历史） */
  onCommit?: (query: string) => void;
};

export function MusicSearchBar({ value, onChange, scope, placeholder, className, onCommit }: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => readSearchHistory(scope));

  useEffect(() => {
    setHistory(readSearchHistory(scope));
  }, [scope]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const refreshHistory = () => setHistory(readSearchHistory(scope));

  const commit = (raw: string) => {
    const q = raw.trim();
    if (q.length < 2) return;
    setHistory(pushSearchHistory(scope, q));
    onChange(q);
    onCommit?.(q);
    setOpen(false);
  };

  const showPanel = open && (history.length > 0 || value.trim().length > 0);

  return (
    <div ref={rootRef} className={clsx("relative min-w-0 max-w-md flex-1", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 z-[1] h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <input
        ref={inputRef}
        value={value}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          refreshHistory();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(value);
          } else if (e.key === "Escape") {
            if (value) {
              onChange("");
            } else {
              setOpen(false);
              inputRef.current?.blur();
            }
          }
        }}
        placeholder={placeholder}
        className="h-8 w-full rounded-full border border-netease-line bg-[#2a2a2a] pl-8 pr-8 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-red-900/50 focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
          aria-label={t("music.searchClear")}
          title={t("music.searchClear")}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
            setOpen(true);
            refreshHistory();
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-netease-line bg-[#1c1c1c] shadow-2xl shadow-black/50"
        >
          {history.length > 0 ? (
            <div className="border-b border-netease-line/60 px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-zinc-500">{t("music.searchHistory")}</p>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 transition hover:text-zinc-300"
                  onClick={() => {
                    clearSearchHistory(scope);
                    setHistory([]);
                  }}
                >
                  {t("music.searchHistoryClear")}
                </button>
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {history.map((item) => (
                  <li key={item} className="group flex items-center gap-1">
                    <button
                      type="button"
                      role="option"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs text-zinc-300 transition hover:bg-white/5 hover:text-zinc-100"
                      onClick={() => commit(item)}
                    >
                      <Clock3 className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      <span className="truncate">{item}</span>
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-white/10 hover:text-zinc-300 group-hover:opacity-100"
                      aria-label={t("music.searchHistoryRemove")}
                      onClick={() => setHistory(removeSearchHistoryItem(scope, item))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-3 py-3 text-[11px] text-zinc-600">{t("music.searchHistoryEmpty")}</p>
          )}
          <p className="px-3 py-2 text-[10px] leading-relaxed text-zinc-600">{t("music.searchTips")}</p>
        </div>
      ) : null}
    </div>
  );
}
