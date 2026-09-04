import type { MusicTrackDto } from "../api/client";

/** original=仅原文；bilingual_*=原文+副行上下贴合 */
export type LyricDisplayMode = "original" | "bilingual_translated" | "bilingual_roma";

const LYRIC_MODE_KEY = "aimatex_lyric_mode";

export function readLyricDisplayMode(): LyricDisplayMode {
  try {
    const raw = localStorage.getItem(LYRIC_MODE_KEY);
    if (raw === "bilingual_translated" || raw === "bilingual_roma" || raw === "original") return raw;
    // 兼容旧单行模式
    if (raw === "translated") return "bilingual_translated";
    if (raw === "roma") return "bilingual_roma";
  } catch {
    /* ignore */
  }
  // 有翻译时会更有用；不可用时由 availableModes 回退
  return "bilingual_translated";
}

export function writeLyricDisplayMode(mode: LyricDisplayMode) {
  try {
    localStorage.setItem(LYRIC_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** 标题下方的副标题：译名 / 别名 */
export function trackTitleSecondary(tr: Pick<MusicTrackDto, "titleTranslated" | "titleAlias">): string | null {
  const translated = tr.titleTranslated?.trim();
  if (translated) return translated;
  const alias = tr.titleAlias?.trim();
  if (alias) return alias;
  return null;
}

/** 专辑行：专辑名 · 年份 · 专辑艺人（与演唱不同时） */
export function trackAlbumLine(
  tr: Pick<MusicTrackDto, "album" | "releaseYear" | "albumArtist" | "artist">
): string | null {
  const parts: string[] = [];
  const album = tr.album?.trim();
  if (album && album !== "未知专辑") parts.push(album);
  if (tr.releaseYear != null && tr.releaseYear > 0) parts.push(String(tr.releaseYear));
  const aa = tr.albumArtist?.trim();
  if (aa && aa !== tr.artist?.trim() && aa !== "未知歌手") {
    parts.push(aa);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** 列表用：歌手 · 专辑（含年） */
export function trackArtistAlbumLine(
  tr: Pick<MusicTrackDto, "artist" | "album" | "releaseYear">
): string {
  const bits: string[] = [];
  if (tr.artist?.trim()) bits.push(tr.artist.trim());
  const album = tr.album?.trim();
  if (album && album !== "未知专辑") {
    bits.push(tr.releaseYear != null && tr.releaseYear > 0 ? `${album} (${tr.releaseYear})` : album);
  } else if (tr.releaseYear != null && tr.releaseYear > 0) {
    bits.push(String(tr.releaseYear));
  }
  return bits.join(" · ");
}

export function availableLyricModes(
  track: Pick<
    MusicTrackDto,
    "hasLyrics" | "hasTranslatedLyrics" | "hasRomaLyrics" | "lyricsUrl" | "translatedLyricsUrl" | "romaLyricsUrl"
  > | null
): LyricDisplayMode[] {
  if (track == null) return [];
  const hasOriginal = Boolean(track.hasLyrics && track.lyricsUrl);
  if (!hasOriginal) return [];
  const modes: LyricDisplayMode[] = ["original"];
  if (track.hasTranslatedLyrics && track.translatedLyricsUrl) modes.push("bilingual_translated");
  if (track.hasRomaLyrics && track.romaLyricsUrl) modes.push("bilingual_roma");
  return modes;
}

export function resolveLyricSource(
  track: Pick<
    MusicTrackDto,
    | "id"
    | "hasLyrics"
    | "lyricsUrl"
    | "hasTranslatedLyrics"
    | "translatedLyricsUrl"
    | "hasRomaLyrics"
    | "romaLyricsUrl"
  >,
  kind: "original" | "translated" | "roma"
): { id: number; lyricsUrl: string | null; hasLyrics: boolean } {
  if (kind === "translated" && track.hasTranslatedLyrics && track.translatedLyricsUrl) {
    return { id: track.id, lyricsUrl: track.translatedLyricsUrl, hasLyrics: true };
  }
  if (kind === "roma" && track.hasRomaLyrics && track.romaLyricsUrl) {
    return { id: track.id, lyricsUrl: track.romaLyricsUrl, hasLyrics: true };
  }
  return {
    id: track.id,
    lyricsUrl: track.lyricsUrl,
    hasLyrics: Boolean(track.hasLyrics && track.lyricsUrl),
  };
}
