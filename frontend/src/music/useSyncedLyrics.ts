import { useEffect, useMemo, useState } from "react";
import { fetchTrackLyricsTextCached, type MusicTrackDto } from "../api/client";
import { linesFromRaw, type LyricLine } from "./lyricsUtils";
import {
  availableLyricModes,
  readLyricDisplayMode,
  resolveLyricSource,
  writeLyricDisplayMode,
  type LyricDisplayMode,
} from "./trackMeta";

type TrackLyricsFields = Pick<
  MusicTrackDto,
  | "id"
  | "durationSeconds"
  | "hasLyrics"
  | "lyricsUrl"
  | "hasTranslatedLyrics"
  | "translatedLyricsUrl"
  | "hasRomaLyrics"
  | "romaLyricsUrl"
>;

export function useSyncedLyrics(
  track: TrackLyricsFields | null,
  modeOverride?: LyricDisplayMode
): {
  lines: LyricLine[];
  loading: boolean;
  loadError: string | null;
  mode: LyricDisplayMode;
  setMode: (m: LyricDisplayMode) => void;
  availableModes: LyricDisplayMode[];
} {
  const [mode, setModeState] = useState<LyricDisplayMode>(() => modeOverride ?? readLyricDisplayMode());
  const availableModes = useMemo(() => availableLyricModes(track), [track]);

  useEffect(() => {
    if (modeOverride) {
      setModeState(modeOverride);
      return;
    }
    setModeState(readLyricDisplayMode());
  }, [track?.id, modeOverride]);

  useEffect(() => {
    if (availableModes.length === 0) return;
    if (!availableModes.includes(mode)) {
      setModeState(availableModes[0]!);
    }
  }, [availableModes, mode]);

  const setMode = (m: LyricDisplayMode) => {
    setModeState(m);
    writeLyricDisplayMode(m);
  };

  const source = track ? resolveLyricSource(track, mode) : null;
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (source == null || !source.hasLyrics) {
      setRaw(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRaw(null);
    void fetchTrackLyricsTextCached(source).then((text) => {
      if (cancelled) return;
      setLoading(false);
      if (text == null) {
        setLoadError("歌词加载失败");
        return;
      }
      setRaw(text);
    });
    return () => {
      cancelled = true;
    };
  }, [source?.id, source?.hasLyrics, source?.lyricsUrl, mode]);

  const lines = useMemo(
    () => linesFromRaw(raw, track?.durationSeconds ?? 0),
    [raw, track?.durationSeconds]
  );

  return { lines, loading, loadError, mode, setMode, availableModes };
}
