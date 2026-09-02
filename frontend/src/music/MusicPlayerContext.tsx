import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { coverDisplayUrl, type MusicTrackDto } from "../api/client";

export type PlayMode = "single" | "list" | "shuffle";

const PLAY_MODE_KEY = "bendoudou_play_mode";
const VOLUME_KEY = "bendoudou_volume";

function readStoredPlayMode(): PlayMode {
  try {
    const v = localStorage.getItem(PLAY_MODE_KEY);
    if (v === "single" || v === "list" || v === "shuffle") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

type MusicPlayerContextValue = {
  audioRef: RefObject<HTMLAudioElement>;
  currentTrack: MusicTrackDto | null;
  setCurrentTrack: Dispatch<SetStateAction<MusicTrackDto | null>>;
  currentId: number | null;
  setCurrentId: Dispatch<SetStateAction<number | null>>;
  playing: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  playPos: number;
  setPlayPos: (pos: number) => void;
  playDur: number;
  setPlayDur: (dur: number) => void;
  volume: number;
  setVolume: (vol: number) => void;
  playMode: PlayMode;
  setPlayMode: Dispatch<SetStateAction<PlayMode>>;
  scrubbing: boolean;
  setScrubbing: (s: boolean) => void;
  queue: MusicTrackDto[];
  setQueue: (tracks: MusicTrackDto[]) => void;
  selectTrack: (track: MusicTrackDto, autoplay: boolean) => void;
  /** 列表播放钮：当前曲切换暂停/继续，其他曲切歌并播放 */
  playPauseTrack: (track: MusicTrackDto) => void;
  seekNext: () => void;
  seekPrev: () => void;
  playerBarExpanded: boolean;
  setPlayerBarExpanded: (expanded: boolean) => void;
  coverSrc: string | null;
  immersiveLyricsOpen: boolean;
  setImmersiveLyricsOpen: (open: boolean) => void;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState<MusicTrackDto | null>(null);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0);
  const [playDur, setPlayDur] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [queue, setQueueState] = useState<MusicTrackDto[]>([]);
  const [playerBarExpanded, setPlayerBarExpanded] = useState(false);
  const [immersiveLyricsOpen, setImmersiveLyricsOpen] = useState(false);

  const [volume, setVolume] = useState(() => {
    try {
      const s = localStorage.getItem(VOLUME_KEY);
      if (s == null) return 1;
      const v = parseFloat(s);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    } catch {
      return 1;
    }
  });

  const [playMode, setPlayMode] = useState<PlayMode>(() => readStoredPlayMode());

  useEffect(() => {
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* ignore */ }
  }, [volume]);

  useEffect(() => {
    try { localStorage.setItem(PLAY_MODE_KEY, playMode); } catch { /* ignore */ }
  }, [playMode]);

  // Refs for stable callbacks that need current values without deps
  const currentIdRef = useRef<number | null>(null);
  const currentTrackRef = useRef<MusicTrackDto | null>(null);
  const queueRef = useRef<MusicTrackDto[]>([]);
  // 与 state 同步初始化，避免首屏 ended/seek 仍读到默认 list
  const playModeRef = useRef<PlayMode>(readStoredPlayMode());

  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { playModeRef.current = playMode; }, [playMode]);

  const setQueue = useCallback((tracks: MusicTrackDto[]) => setQueueState(tracks), []);

  const selectTrack = useCallback((track: MusicTrackDto, autoplay: boolean) => {
    const isSameTrack = currentIdRef.current === track.id;
    setCurrentTrack(track);
    setCurrentId(track.id);
    setPlayPos(0);
    setPlayDur(0);
    if (autoplay) {
      setPlaying(true);
      requestAnimationFrame(() => {
        const a = audioRef.current;
        if (!a) return;
        if (isSameTrack) a.currentTime = 0;
        void a.play().catch(() => setPlaying(false));
      });
    }
  }, []);

  const playPauseTrack = useCallback(
    (track: MusicTrackDto) => {
      if (currentIdRef.current === track.id) {
        setPlaying((p) => !p);
        return;
      }
      selectTrack(track, true);
    },
    [selectTrack]
  );

  const seekNext = useCallback(() => {
    const q = queueRef.current;
    const ct = currentTrackRef.current;
    const pm = playModeRef.current;
    if (!ct) return;
    // 发现页/空队列：没有可切曲目时重播当前，避免播完直接停
    if (q.length === 0) {
      selectTrack(ct, true);
      return;
    }
    if (pm === "shuffle") {
      if (q.length === 1) {
        selectTrack(q[0]!, true);
        return;
      }
      const choices = q.filter((t) => t.id !== ct.id);
      selectTrack(choices[Math.floor(Math.random() * choices.length)] ?? q[0]!, true);
      return;
    }
    const idx = q.findIndex((t) => t.id === ct.id);
    // 当前曲不在队列（从发现/历史点播）：列表循环落到队列第一首
    if (idx < 0) {
      selectTrack(q[0]!, true);
      return;
    }
    selectTrack(idx >= q.length - 1 ? q[0]! : q[idx + 1]!, true);
  }, [selectTrack]);

  const seekPrev = useCallback(() => {
    const q = queueRef.current;
    const ct = currentTrackRef.current;
    const pm = playModeRef.current;
    if (!ct) return;
    if (q.length === 0) {
      selectTrack(ct, true);
      return;
    }
    if (pm === "shuffle") {
      if (q.length === 1) {
        selectTrack(q[0]!, true);
        return;
      }
      const choices = q.filter((t) => t.id !== ct.id);
      selectTrack(choices[Math.floor(Math.random() * choices.length)] ?? q[0]!, true);
      return;
    }
    const idx = q.findIndex((t) => t.id === ct.id);
    if (idx < 0) {
      selectTrack(q[q.length - 1]!, true);
      return;
    }
    selectTrack(idx <= 0 ? q[q.length - 1]! : q[idx - 1]!, true);
  }, [selectTrack]);

  const coverSrc = useMemo(
    () => coverDisplayUrl(currentTrack),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentTrack?.id, currentTrack?.coverUrl, currentTrack?.hasCover]
  );

  const value: MusicPlayerContextValue = {
    audioRef,
    currentTrack,
    setCurrentTrack,
    currentId,
    setCurrentId,
    playing,
    setPlaying,
    playPos,
    setPlayPos,
    playDur,
    setPlayDur,
    volume,
    setVolume,
    playMode,
    setPlayMode,
    scrubbing,
    setScrubbing,
    queue,
    setQueue,
    selectTrack,
    playPauseTrack,
    seekNext,
    seekPrev,
    playerBarExpanded,
    setPlayerBarExpanded,
    coverSrc,
    immersiveLyricsOpen,
    setImmersiveLyricsOpen,
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}
