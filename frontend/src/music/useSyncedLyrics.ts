import { useEffect, useMemo, useState } from "react";
import { fetchTrackLyricsTextCached, type MusicTrackDto } from "../api/client";
import { linesFromRaw, type LyricLine } from "./lyricsUtils";

export function useSyncedLyrics(
  track: Pick<MusicTrackDto, "id" | "lyricsUrl" | "hasLyrics" | "durationSeconds"> | null
): { lines: LyricLine[]; loading: boolean; loadError: string | null } {
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (track == null || !track.hasLyrics) {
      setRaw(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRaw(null);
    void fetchTrackLyricsTextCached(track).then((text) => {
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
  }, [track?.id, track?.hasLyrics, track?.lyricsUrl]);

  const lines = useMemo(
    () => linesFromRaw(raw, track?.durationSeconds ?? 0),
    [raw, track?.durationSeconds]
  );

  return { lines, loading, loadError };
}
