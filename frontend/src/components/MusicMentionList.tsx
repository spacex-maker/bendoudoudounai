import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, MessageCircle, Music2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  fetchMusicMentions,
  markMusicMentionRead,
  type MusicMentionNotificationDto,
} from "../api/client";
import { mapApiError } from "../i18n/mapApiError";
import { useDateLocale } from "../i18n/useDateLocale";

type Props = {
  onOpenMention: (item: MusicMentionNotificationDto) => Promise<void> | void;
  embedded?: boolean;
  hideHeader?: boolean;
};

export function MusicMentionList({ onOpenMention, embedded = false, hideHeader = false }: Props) {
  const { t } = useTranslation();
  const dateLoc = useDateLocale();
  const [rows, setRows] = useState<MusicMentionNotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchMusicMentions(30);
      setRows(data);
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => rows.filter((x) => !x.read).length, [rows]);

  return (
    <section
      className={
        embedded
          ? "w-full rounded-xl border border-white/[0.08] bg-zinc-900/35 p-3 sm:p-4"
          : "mx-auto mb-4 w-full max-w-6xl rounded-2xl border border-white/[0.08] bg-zinc-900/35 p-3 sm:p-4"
      }
    >
      {!hideHeader ? (
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800/80">
            <Bell className="h-3.5 w-3.5 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">{t("music.mentionsTitle", { defaultValue: "消息列表" })}</h3>
          <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
            {unreadCount}
          </span>
        </div>
      ) : null}
      {err ? <p className="mb-2 text-xs text-red-400/90">{err}</p> : null}
      {loading ? (
        <p className="text-xs text-zinc-500">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("music.mentionsEmpty", { defaultValue: "还没有新的艾特消息" })}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                void (async () => {
                  if (!item.read) {
                    try {
                      await markMusicMentionRead(item.id);
                    } catch {
                      // ignore read-mark failure
                    }
                  }
                  setRows((prev) => prev.map((x) => (x.id === item.id ? { ...x, read: true } : x)));
                  await onOpenMention(item);
                })();
              }}
              className="block w-full rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-left transition hover:border-white/[0.14] hover:bg-black/30"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{item.actorLabel}</span>
                <span>@</span>
                <Music2 className="h-3.5 w-3.5" />
                <span className="truncate">{item.trackTitle}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-300">{item.contentPreview}</p>
              <time className="mt-1 block text-[10px] text-zinc-600">
                {new Date(item.createdAtMillis).toLocaleString(dateLoc, { dateStyle: "short", timeStyle: "short" })}
              </time>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
