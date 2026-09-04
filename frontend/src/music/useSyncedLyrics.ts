import { useEffect, useMemo, useState } from "react";
import { fetchTrackLyricsTextCached, type MusicTrackDto } from "../api/client";
import { linesFromRaw, pairLyricLines, type LyricDisplayLine, type LyricLine } from "./lyricsUtils";
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
  /** 主时间轴行（兼容播放条取当前句） */
  lines: LyricLine[];
  /** 展示行：原文 + 可选副行 */
  displayLines: LyricDisplayLine[];
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
      // 有双语时默认带翻译/罗马音，比纯原文更有用
      const preferred =
        availableModes.find((m) => m === "bilingual_translated") ??
        availableModes.find((m) => m === "bilingual_roma") ??
        availableModes[0]!;
      setModeState(preferred);
    }
  }, [availableModes, mode]);

  const setMode = (m: LyricDisplayMode) => {
    setModeState(m);
    writeLyricDisplayMode(m);
  };

  const primarySource = track ? resolveLyricSource(track, "original") : null;
  const secondaryKind =
    mode === "bilingual_translated" ? "translated" : mode === "bilingual_roma" ? "roma" : null;
  const secondarySource =
    track && secondaryKind ? resolveLyricSource(track, secondaryKind) : null;

  const [primaryRaw, setPrimaryRaw] = useState<string | null>(null);
  const [secondaryRaw, setSecondaryRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (primarySource == null || !primarySource.hasLyrics) {
      setPrimaryRaw(null);
      setSecondaryRaw(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setPrimaryRaw(null);
    setSecondaryRaw(null);

    const tasks: Promise<void>[] = [
      fetchTrackLyricsTextCached(primarySource).then((text) => {
        if (cancelled) return;
        if (text == null) throw new Error("primary");
        setPrimaryRaw(text);
      }),
    ];
    if (secondarySource?.hasLyrics) {
      tasks.push(
        fetchTrackLyricsTextCached(secondarySource).then((text) => {
          if (cancelled) return;
          setSecondaryRaw(text);
        })
      );
    }

    void Promise.all(tasks)
      .then(() => {
        if (cancelled) return;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadError("歌词加载失败");
      });

    return () => {
      cancelled = true;
    };
  }, [
    primarySource?.id,
    primarySource?.hasLyrics,
    primarySource?.lyricsUrl,
    secondarySource?.lyricsUrl,
    secondarySource?.hasLyrics,
    mode,
  ]);

  const primaryLines = useMemo(
    () => linesFromRaw(primaryRaw, track?.durationSeconds ?? 0),
    [primaryRaw, track?.durationSeconds]
  );
  const secondaryLines = useMemo(
    () => (secondaryKind ? linesFromRaw(secondaryRaw, track?.durationSeconds ?? 0) : []),
    [secondaryRaw, secondaryKind, track?.durationSeconds]
  );

  const displayLines = useMemo(
    () => pairLyricLines(primaryLines, secondaryKind ? secondaryLines : null),
    [primaryLines, secondaryLines, secondaryKind]
  );

  const lines = useMemo(
    () => displayLines.map((d) => ({ timeMs: d.timeMs, text: d.primary })),
    [displayLines]
  );

  return { lines, displayLines, loading, loadError, mode, setMode, availableModes };
}
