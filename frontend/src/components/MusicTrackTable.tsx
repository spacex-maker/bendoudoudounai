import { useState } from "react";
import clsx from "clsx";
import { Download, Heart, Loader2, Music2, Pause, Play, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  coverDisplayUrl,
  fetchTrackPlayStats,
  getTrackFileUrl,
  type MusicTrackDto,
  type PlaylistListeningStatusItemDto,
  type TrackPlayUserStatDto,
} from "../api/client";

type Props = {
  playlistName: string;
  tracks: MusicTrackDto[];
  listLoading: boolean;
  showRemoveTrack: boolean;
  currentId: number | null;
  playing: boolean;
  activeNav: string;
  onSelectTrack: (track: MusicTrackDto, autoplay: boolean) => void;
  onSetCurrentId: (id: number) => void;
  onToggleHeart: (track: MusicTrackDto) => void | Promise<void>;
  onRequestRemoveTrack: (track: MusicTrackDto) => void;
  listeningByTrack?: Record<number, PlaylistListeningStatusItemDto[]>;
};

function formatDuration(sec: number) {
  const n = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MusicTrackTable({
  playlistName,
  tracks,
  listLoading,
  showRemoveTrack,
  currentId,
  playing,
  activeNav,
  onSelectTrack,
  onSetCurrentId,
  onToggleHeart,
  onRequestRemoveTrack,
  listeningByTrack,
}: Props) {
  const { t } = useTranslation();
  const tableCoverLabel = t("music.tableCover");
  const tableDurationLabel = t("music.tableDuration");
  const loadingPlaceholders = [1, 2, 3, 4, 5];
  const [playStatsOpenFor, setPlayStatsOpenFor] = useState<MusicTrackDto | null>(null);
  const [playStatsRows, setPlayStatsRows] = useState<TrackPlayUserStatDto[]>([]);
  const [playStatsLoading, setPlayStatsLoading] = useState(false);
  const [playStatsErr, setPlayStatsErr] = useState<string | null>(null);

  const openPlayStats = async (tr: MusicTrackDto) => {
    setPlayStatsOpenFor(tr);
    setPlayStatsRows([]);
    setPlayStatsErr(null);
    setPlayStatsLoading(true);
    try {
      setPlayStatsRows(await fetchTrackPlayStats(tr.id));
    } catch (e) {
      setPlayStatsErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setPlayStatsLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-netease-line">
      <div className="border-b border-netease-line/70 bg-[#1e1e1e]/75 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-zinc-200">{playlistName}</p>
      </div>
      <div className="divide-y divide-netease-line/60 md:hidden">
        {listLoading
          ? loadingPlaceholders.map((n) => (
              <div key={`m-skeleton-${n}`} className="bg-black/45 p-3">
                <div className="flex items-stretch gap-2">
                  <div className="min-w-0 flex flex-1 items-start gap-3">
                    <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-zinc-800/85 ring-1 ring-white/10" />
                    <div className="min-w-0 flex min-h-[3.5rem] flex-1 flex-col">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-700/65" />
                      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-zinc-800/75" />
                      <div className="mt-auto h-3 w-2/5 animate-pulse rounded bg-zinc-800/70" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-center gap-1 self-center">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800/85" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800/75" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800/75" />
                  </div>
                </div>
              </div>
            ))
          : null}
        {tracks.length === 0 && !listLoading ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">{t("music.emptyTracks")}</div>
        ) : null}
        {tracks.map((tr) => {
          const listeners = listeningByTrack?.[tr.id] ?? [];
          return (
          <div
            key={tr.id}
            onDoubleClick={() => onSelectTrack(tr, true)}
            onClick={() => onSetCurrentId(tr.id)}
            className={clsx(
              "p-3 transition",
              currentId === tr.id && playing
                ? "bg-[linear-gradient(90deg,rgba(244,63,94,0.26)_0%,rgba(244,63,94,0.12)_38%,rgba(255,255,255,0.02)_100%)]"
                : currentId === tr.id
                  ? "bg-red-900/35"
                  : "bg-black/45"
            )}
          >
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex flex-1 items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-800/80 ring-1 ring-white/10">
                  {coverDisplayUrl(tr) ? (
                    <img src={coverDisplayUrl(tr)!} alt={tr.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <Music2 className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex min-h-[3.5rem] flex-1 flex-col">
                  <div className="truncate text-sm text-zinc-200">{tr.title}</div>
                  {listeners.length > 0 ? (
                    <div className="mt-0.5 truncate text-[11px] text-emerald-300/90">
                      {listeners[0]!.userLabel}
                      {listeners.length > 1 ? ` 等 ${listeners.length} 位协作者` : ""} 正在听
                    </div>
                  ) : null}
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{tr.artist}{tr.album ? ` · ${tr.album}` : ""}</div>
                  <div className="mt-auto pt-1 text-[11px] text-zinc-500">
                    {formatDuration(tr.durationSeconds)} ·{" "}
                    <button
                      type="button"
                      className="rounded px-1 py-0.5 text-zinc-400 underline-offset-2 transition hover:bg-white/10 hover:text-zinc-200 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openPlayStats(tr);
                      }}
                    >
                      {t("music.tablePlays")}: {tr.playCount ?? 0}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-center gap-1 self-center">
                <button type="button" className="rounded-full p-2 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); onSelectTrack(tr, true); }}>
                  {currentId === tr.id && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                {showRemoveTrack ? (
                  <button
                    type="button"
                    title={activeNav === "liked" ? t("music.removeFromLikedAction") : t("music.removeFromPlaylistAction")}
                    className="rounded-full p-2 text-zinc-500 hover:bg-red-950/40 hover:text-red-300"
                    onClick={(e) => { e.stopPropagation(); onRequestRemoveTrack(tr); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
                <button type="button" title={tr.hearted ? t("music.unheartTrack") : t("music.heartTrack")} className="rounded-full p-2 text-red-500 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); void onToggleHeart(tr); }}>
                  <Heart className={clsx("h-4 w-4", tr.hearted ? "fill-red-500 text-red-500" : "fill-none text-zinc-500")} />
                </button>
                <a href={tr.audioUrl ?? getTrackFileUrl(tr.id)} download title={t("music.downloadTrack", { defaultValue: "下载歌曲" })} className="inline-flex rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200" onClick={(e) => e.stopPropagation()}>
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      <table className="hidden w-full text-left text-xs md:table">
        <thead className="bg-[#1e1e1e]/65 text-zinc-500">
          <tr>
            <th className="w-16 px-2 py-2 font-normal">
              {tableCoverLabel === "music.tableCover" ? "封面" : tableCoverLabel}
            </th>
            <th className="px-2 py-2 font-normal">{t("music.tableTitle")}</th>
            <th className="px-2 py-2 font-normal">{t("music.tableArtist")}</th>
            <th className="hidden sm:table-cell px-2 py-2 font-normal">{t("music.tableAlbum")}</th>
            <th className="w-16 px-2 py-2 text-right font-normal tabular-nums">{t("music.tablePlays")}</th>
            <th className="w-14 px-2 py-2 text-right font-normal tabular-nums">
              {tableDurationLabel === "music.tableDuration" ? "时长" : tableDurationLabel}
            </th>
            <th className="w-8 px-1 py-2" />
            {showRemoveTrack ? <th className="w-8 px-1 py-2" /> : null}
            <th className="w-8 px-1 py-2" />
            <th className="w-8 px-1 py-2" />
          </tr>
        </thead>
        <tbody className="bg-black/50">
          {listLoading
            ? loadingPlaceholders.map((n) => (
                <tr key={`d-skeleton-${n}`} className="border-t border-netease-line/50">
                  <td className="px-2 py-2">
                    <div className="h-10 w-10 animate-pulse rounded-xl bg-zinc-800/85 ring-1 ring-white/10" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-zinc-700/65" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-800/75" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-800/75" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="ml-auto h-3.5 w-8 animate-pulse rounded bg-zinc-800/75" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="ml-auto h-3.5 w-10 animate-pulse rounded bg-zinc-800/75" />
                  </td>
                  <td className="px-1 py-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-zinc-800/85" />
                  </td>
                  {showRemoveTrack ? (
                    <td className="px-1 py-2">
                      <div className="h-5 w-5 animate-pulse rounded-full bg-zinc-800/75" />
                    </td>
                  ) : null}
                  <td className="px-1 py-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-zinc-800/75" />
                  </td>
                  <td className="px-1 py-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-zinc-800/75" />
                  </td>
                </tr>
              ))
            : null}
          {tracks.length === 0 && !listLoading && (
            <tr>
              <td colSpan={showRemoveTrack ? 10 : 9} className="px-4 py-8 text-center text-zinc-500">
                {t("music.emptyTracks")}
              </td>
            </tr>
          )}
          {tracks.map((tr) => {
            const listeners = listeningByTrack?.[tr.id] ?? [];
            return (
            <tr
              key={tr.id}
              onDoubleClick={() => onSelectTrack(tr, true)}
              onClick={() => onSetCurrentId(tr.id)}
              className={clsx(
                "cursor-default border-t border-netease-line/50 transition",
                currentId === tr.id && playing
                  ? "bg-[linear-gradient(90deg,rgba(244,63,94,0.26)_0%,rgba(244,63,94,0.12)_38%,rgba(255,255,255,0.02)_100%)] animate-pulse"
                  : currentId === tr.id
                    ? "bg-red-900/45"
                    : "hover:bg-white/14"
              )}
            >
              <td className="px-2 py-2">
                <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-zinc-800/80 ring-1 ring-white/10">
                  {coverDisplayUrl(tr) ? (
                    <img
                      src={coverDisplayUrl(tr)!}
                      alt={tr.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-600">
                      <Music2 className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              </td>
              <td className="max-w-[1px] px-2 py-2 text-zinc-200">
                <div className="min-w-0">
                <span className="min-w-0 truncate block">
                  {tr.title}
                  {tr.metadataFromFile && (
                    <span className="ml-1 rounded-full bg-zinc-700/60 px-1.5 py-px text-[10px] text-zinc-400">
                      {t("music.autoTag")}
                    </span>
                  )}
                  {tr.note && <span className="ml-1 text-zinc-500">· {tr.note}</span>}
                </span>
                {listeners.length > 0 ? (
                  <div className="truncate text-[11px] text-emerald-300/90">
                    {listeners[0]!.userLabel}
                    {listeners.length > 1 ? ` 等 ${listeners.length} 位协作者` : ""} 正在听
                  </div>
                ) : null}
                </div>
              </td>
              <td className="max-w-[1px] truncate px-2 py-2 text-zinc-400">{tr.artist}</td>
              <td className="hidden max-w-[1px] truncate px-2 py-2 text-zinc-500 sm:table-cell">{tr.album}</td>
              <td className="px-2 py-2 text-right tabular-nums text-zinc-500">
                <button
                  type="button"
                  className="rounded px-1 py-0.5 underline-offset-2 transition hover:bg-white/10 hover:text-zinc-200 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openPlayStats(tr);
                  }}
                >
                  {tr.playCount ?? 0}
                </button>
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-zinc-500">{formatDuration(tr.durationSeconds)}</td>
              <td className="px-1 py-2 text-zinc-500">
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTrack(tr, true);
                  }}
                >
                  {currentId === tr.id && playing ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
              </td>
              {showRemoveTrack ? (
                <td className="px-1 py-2 text-zinc-500">
                  <button
                    type="button"
                    title={activeNav === "liked" ? t("music.removeFromLikedAction") : t("music.removeFromPlaylistAction")}
                    className="rounded-full p-1 text-zinc-500 hover:bg-red-950/40 hover:text-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestRemoveTrack(tr);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              ) : null}
              <td className="px-1 py-2 text-zinc-500">
                <button
                  type="button"
                  title={tr.hearted ? t("music.unheartTrack") : t("music.heartTrack")}
                  className="rounded-full p-0.5 text-red-500 hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleHeart(tr);
                  }}
                >
                  <Heart
                    className={clsx(
                      "h-3.5 w-3.5",
                      tr.hearted ? "fill-red-500 text-red-500" : "fill-none text-zinc-500"
                    )}
                  />
                </button>
              </td>
              <td className="px-1 py-2 text-zinc-500">
                <a
                  href={tr.audioUrl ?? getTrackFileUrl(tr.id)}
                  download
                  title={t("music.downloadTrack", { defaultValue: "下载歌曲" })}
                  className="inline-flex rounded-full p-0.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {playStatsOpenFor ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setPlayStatsOpenFor(null)}
        >
          <section
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-zinc-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">播放次数明细</h3>
                <p className="truncate text-xs text-zinc-500">《{playStatsOpenFor.title}》</p>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={() => setPlayStatsOpenFor(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {playStatsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中
              </div>
            ) : playStatsErr ? (
              <p className="py-6 text-center text-sm text-red-400">{playStatsErr}</p>
            ) : playStatsRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">暂无播放记录</p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-auto pr-1">
                {playStatsRows.map((row, idx) => (
                  <div key={`${row.userId}-${idx}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className="truncate text-sm">{row.userLabel}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-400">{row.playCount} 次</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

