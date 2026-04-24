export type LyricLine = { timeMs: number; text: string };

const META_LINE = /^\[[a-zA-Z]+:/;

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

export function findActiveIndex(lines: LyricLine[], timeMs: number): number {
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

/** 当前播放时间（秒）对应的一句；未到首句或无匹配返回 null */
export function getActiveLyricText(lines: LyricLine[], timeSec: number): string | null {
  if (lines.length === 0) return null;
  const idx = findActiveIndex(lines, Math.max(0, timeSec) * 1000);
  if (idx < 0) return null;
  return lines[idx]!.text;
}
