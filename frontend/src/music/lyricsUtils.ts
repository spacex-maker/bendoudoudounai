export type LyricLine = { timeMs: number; text: string };

/** 原文 + 可选副行（翻译 / 罗马音） */
export type LyricDisplayLine = {
  timeMs: number;
  primary: string;
  secondary: string | null;
};

const META_LINE = /^\[[a-zA-Z]+:/;
const PAIR_TOLERANCE_MS = 900;

export function parseLrc(raw: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || META_LINE.test(trimmed)) continue;
    const matches = [...trimmed.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (matches.length === 0) continue;
    const text = trimmed.replace(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g, "").trim();
    if (!text) continue;
    for (const m of matches) {
      const mm = parseInt(m[1]!, 10);
      const ss = parseInt(m[2]!, 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      out.push({ timeMs: (mm * 60 + ss) * 1000 + frac, text });
    }
  }
  out.sort((a, b) => a.timeMs - b.timeMs || a.text.localeCompare(b.text));
  return out;
}

export function parsePlainLines(raw: string, durationSec: number): LyricLine[] {
  const parts = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const durMs = Math.max((Number.isFinite(durationSec) ? durationSec : 0) * 1000, parts.length * 2500);
  return parts.map((text, i) => ({
    timeMs: (i / Math.max(parts.length - 1, 1)) * durMs,
    text,
  }));
}

export function findActiveIndex(lines: { timeMs: number }[], timeMs: number): number {
  if (lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.timeMs <= timeMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function linesFromRaw(raw: string | null, durationSeconds: number): LyricLine[] {
  if (raw == null || raw.trim() === "") return [];
  const timed = parseLrc(raw);
  if (timed.length > 0) return timed;
  return parsePlainLines(raw, durationSeconds);
}

/** 按时间戳把副歌词贴到主歌词上（网易云 tlyric / romalrc 通常时间对齐） */
export function pairLyricLines(
  primary: LyricLine[],
  secondary: LyricLine[] | null | undefined
): LyricDisplayLine[] {
  if (primary.length === 0) return [];
  if (!secondary || secondary.length === 0) {
    return primary.map((p) => ({ timeMs: p.timeMs, primary: p.text, secondary: null }));
  }
  return primary.map((p) => {
    let best: LyricLine | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const s of secondary) {
      const d = Math.abs(s.timeMs - p.timeMs);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
      if (s.timeMs > p.timeMs + PAIR_TOLERANCE_MS) break;
    }
    const sec =
      best && bestDist <= PAIR_TOLERANCE_MS && best.text.trim() && best.text.trim() !== p.text.trim()
        ? best.text
        : null;
    return { timeMs: p.timeMs, primary: p.text, secondary: sec };
  });
}

/** 当前播放时间（秒）对应的一句；未到首句或无匹配返回 null */
export function getActiveLyricText(lines: LyricLine[], timeSec: number): string | null {
  if (lines.length === 0) return null;
  const idx = findActiveIndex(lines, Math.max(0, timeSec) * 1000);
  if (idx < 0) return null;
  return lines[idx]!.text;
}

/** 当前句的下一句文案；没有下一句返回 null */
export function getNextLyricText(lines: LyricLine[], timeSec: number): string | null {
  if (lines.length === 0) return null;
  const idx = findActiveIndex(lines, Math.max(0, timeSec) * 1000);
  if (idx < 0 || idx >= lines.length - 1) return null;
  const next = lines[idx + 1]!.text.trim();
  return next ? next : null;
}

export function getActiveDisplayLyric(
  lines: LyricDisplayLine[],
  timeSec: number
): LyricDisplayLine | null {
  if (lines.length === 0) return null;
  const idx = findActiveIndex(lines, Math.max(0, timeSec) * 1000);
  if (idx < 0) return null;
  return lines[idx] ?? null;
}
