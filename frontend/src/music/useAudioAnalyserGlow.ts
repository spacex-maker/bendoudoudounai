import { useEffect, useRef, type RefObject } from "react";

type AudioGraph = {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
};

const graphByElement = new WeakMap<HTMLMediaElement, AudioGraph>();

function ensureGraph(audio: HTMLMediaElement): AudioGraph {
  let g = graphByElement.get(audio);
  if (g) return g;
  const ctx = new AudioContext();
  const source = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.65;
  source.connect(analyser);
  analyser.connect(ctx.destination);
  g = { ctx, source, analyser };
  graphByElement.set(audio, g);
  return g;
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h % 360}, ${s}%, ${l}%, ${a})`;
}

const IDLE_BOX_SHADOW =
  "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset";

/**
 * 根据音频频谱驱动底部播放器 footer 的 box-shadow / filter（极光光晕）。
 */
export function useAudioAnalyserGlow(
  audioRef: RefObject<HTMLAudioElement | null>,
  footerRef: RefObject<HTMLElement | null>,
  opts: { playing: boolean; hasTrack: boolean; volume: number }
): void {
  const { playing, hasTrack, volume } = opts;
  const smoothRef = useRef({
    intensity: 0,
    bass: 0,
    mid: 0,
    high: 0,
    hue: 280,
  });
  const rafRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !hasTrack) return;

    const resumeCtx = () => {
      try {
        const g = ensureGraph(audio);
        if (g.ctx.state === "suspended") {
          void g.ctx.resume();
        }
      } catch {
        /* ignore */
      }
    };

    const onPlay = () => resumeCtx();
    audio.addEventListener("play", onPlay);
    if (audio.src || audio.currentSrc) {
      try {
        resumeCtx();
      } catch {
        /* ignore */
      }
    }

    return () => {
      audio.removeEventListener("play", onPlay);
    };
  }, [audioRef, hasTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    const footer = footerRef.current;

    const resetFooter = () => {
      const el = footerRef.current;
      if (el) {
        el.style.boxShadow = IDLE_BOX_SHADOW;
        el.style.removeProperty("filter");
      }
    };

    if (!audio || !footer || !hasTrack) {
      resetFooter();
      return;
    }

    const data = new Uint8Array(256);

    const tick = () => {
      const foot = footerRef.current;
      const a = audioRef.current;
      if (!foot || !a) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const vol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
      const sm = smoothRef.current;

      if (playing) {
        try {
          const g = graphByElement.get(a) ?? ensureGraph(a);
          if (g.ctx.state === "suspended") {
            void g.ctx.resume();
          }
          const ac = g.analyser.frequencyBinCount;
          if (data.length !== ac) {
            /* resize view — reuse buffer */
          }
          g.analyser.getByteFrequencyData(data);

          const n = g.analyser.frequencyBinCount;
          const bEnd = Math.max(2, Math.floor(n * 0.08));
          const mEnd = Math.max(bEnd + 1, Math.floor(n * 0.35));
          let sum = 0;
          let bSum = 0;
          let mSum = 0;
          let hSum = 0;
          for (let i = 0; i < n; i++) {
            const v = data[i]! / 255;
            sum += v;
            if (i < bEnd) bSum += v;
            else if (i < mEnd) mSum += v;
            else hSum += v;
          }
          const overall = sum / n;
          const bass = bSum / bEnd;
          const mid = mSum / (mEnd - bEnd);
          const high = hSum / Math.max(1, n - mEnd);

          const targetI = overall * (0.5 + 0.5 * vol);
          sm.intensity = sm.intensity * 0.72 + targetI * 0.28;
          sm.bass = sm.bass * 0.75 + bass * 0.25;
          sm.mid = sm.mid * 0.75 + mid * 0.25;
          sm.high = sm.high * 0.75 + high * 0.25;

          const hueTarget = 175 + sm.bass * 95 - sm.high * 75 + sm.mid * 35;
          sm.hue = sm.hue * 0.88 + hueTarget * 0.12;
        } catch {
          sm.intensity *= 0.9;
          sm.bass *= 0.9;
          sm.mid *= 0.9;
          sm.high *= 0.9;
        }
      } else {
        sm.intensity *= 0.9;
        sm.bass *= 0.88;
        sm.mid *= 0.88;
        sm.high *= 0.88;
      }

      const tilt = Math.min(1, sm.bass * 0.45 + sm.mid * 0.35 + sm.high * 0.2);
      const int = Math.max(0, Math.min(1, sm.intensity * (0.82 + tilt * 0.18)));

      if (int < 0.018) {
        foot.style.boxShadow = IDLE_BOX_SHADOW;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const spread = 26 + int * 105;
      const spread2 = spread * 1.5;
      const a1 = int * 0.4;
      const a2 = int * 0.3;
      const a3 = int * 0.2;
      const h1 = sm.hue;
      const h2 = (sm.hue + 48) % 360;
      const h3 = (sm.hue - 42 + 360) % 360;

      foot.style.boxShadow = [
        `0 16px 48px rgba(0,0,0,0.55)`,
        `0 0 0 1px rgba(255,255,255,0.08) inset`,
        `0 0 ${spread}px ${Math.round(spread * 0.35)}px ${hsla(h1, 88, 58, a1)}`,
        `0 0 ${spread2}px ${Math.round(spread2 * 0.28)}px ${hsla(h2, 82, 52, a2)}`,
        `0 -${Math.round(spread * 0.22)}px ${Math.round(spread * 1.15)}px ${Math.round(spread * 0.38)}px ${hsla(h3, 90, 55, a3)}`,
      ].join(", ");

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      resetFooter();
    };
  }, [audioRef, footerRef, playing, hasTrack, volume]);
}
