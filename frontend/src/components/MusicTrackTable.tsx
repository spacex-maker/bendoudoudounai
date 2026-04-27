import clsx from "clsx";
import { Download, Heart, Music2, Pause, Play, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { coverDisplayUrl, getTrackFileUrl, type MusicTrackDto } from "../api/client";

type Props = {
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
};

function formatDuration(sec: number) {
  const n = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MusicTrackTable({
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
}: Props) {
  const { t } = useTranslation();
  const tableCoverLabel = t("music.tableCover");
  const tableDurationLabel = t("music.tableDuration");
  const loadingPlaceholders = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-hidden rounded-2xl border border-netease-line">
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
        {tracks.map((tr) => (
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
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{tr.artist}{tr.album ? ` · ${tr.album}` : ""}</div>
                  <div className="mt-auto pt-1 text-[11px] text-zinc-500">
                    {formatDuration(tr.durationSeconds)} · {t("music.tablePlays")}: {tr.playCount ?? 0}
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
        ))}
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
          {tracks.map((tr) => (
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
                <span className="min-w-0 truncate">
                  {tr.title}
                  {tr.metadataFromFile && (
                    <span className="ml-1 rounded-full bg-zinc-700/60 px-1.5 py-px text-[10px] text-zinc-400">
                      {t("music.autoTag")}
                    </span>
                  )}
                  {tr.note && <span className="ml-1 text-zinc-500">· {tr.note}</span>}
                </span>
              </td>
              <td className="max-w-[1px] truncate px-2 py-2 text-zinc-400">{tr.artist}</td>
              <td className="hidden max-w-[1px] truncate px-2 py-2 text-zinc-500 sm:table-cell">{tr.album}</td>
              <td className="px-2 py-2 text-right tabular-nums text-zinc-500">{tr.playCount ?? 0}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

