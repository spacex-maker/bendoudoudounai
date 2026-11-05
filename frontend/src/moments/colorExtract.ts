/** 浏览器端主色 / 色板提取（缩小采样 + 色相桶），上传时写入后端。 */

export type PaletteSwatch = {
  hex: string;
  h: number;
  s: number;
  l: number;
  weight: number;
};

export type ImageColorProfile = {
  dominantHue: number | null;
  dominantSat: number;
  dominantLight: number;
  palette: PaletteSwatch[];
  paletteJson: string;
};

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

async function loadImageElement(src: string | File): Promise<HTMLImageElement> {
  const objectUrl = typeof src === "string" ? null : URL.createObjectURL(src);
  const url = objectUrl ?? src;
  const img = new Image();
  img.decoding = "async";
  if (typeof src === "string") img.crossOrigin = "anonymous";
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片加载失败，无法取色"));
      img.src = url;
    });
    return img;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function sampleCanvas(img: HTMLImageElement, maxSide = 120): ImageData {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** 从本地 File 或（需 CORS）图片 URL 提取主色与色板 */
export async function extractImageColors(src: string | File): Promise<ImageColorProfile> {
  const img = await loadImageElement(src);
  const { data, width, height } = sampleCanvas(img);
  const buckets = new Map<number, { w: number; s: number; l: number }>();
  let totalSat = 0;
  let totalLight = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // 跳过近白 / 近黑
    if (r > 248 && g > 248 && b > 248) continue;
    if (r < 8 && g < 8 && b < 8) continue;
    const hsl = rgbToHsl(r, g, b);
    totalSat += hsl.s;
    totalLight += hsl.l;
    samples += 1;
    if (hsl.s < 10 || hsl.l < 8 || hsl.l > 92) continue;
    const bin = Math.round(hsl.h / 15) % 24;
    const cur = buckets.get(bin) || { w: 0, s: 0, l: 0 };
    cur.w += 1;
    cur.s += hsl.s;
    cur.l += hsl.l;
    buckets.set(bin, cur);
  }

  const avgSat = samples ? totalSat / samples : 0;
  const avgLight = samples ? totalLight / samples : 50;

  const ranked = [...buckets.entries()]
    .map(([bin, v]) => {
      const h = (bin * 15) % 360;
      const s = v.s / v.w;
      const l = v.l / v.w;
      return {
        hex: hslToHex(h, s, l),
        h,
        s: Math.round(s),
        l: Math.round(l),
        weight: v.w,
      } satisfies PaletteSwatch;
    })
    .sort((a, b) => b.weight - a.weight);

  const palette = ranked.slice(0, 5);
  const dominant = palette[0];
  const dominantHue =
    !dominant || avgSat < 12 || dominant.s < 12 ? null : Math.round(dominant.h) % 360;

  const profile: ImageColorProfile = {
    dominantHue,
    dominantSat: Math.round(avgSat),
    dominantLight: Math.round(avgLight),
    palette,
    paletteJson: JSON.stringify(
      palette.map(({ hex, h, s, l, weight }) => ({ hex, h, s, l, w: weight }))
    ).slice(0, 1000),
  };

  // 用不到的宽高避免 unused lint（保留采样真实性）
  void width;
  void height;
  return profile;
}

export function parsePaletteJson(raw: string | null | undefined): PaletteSwatch[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Array<{ hex?: string; h?: number; s?: number; l?: number; w?: number }>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => typeof x?.hex === "string")
      .map((x) => ({
        hex: x.hex!,
        h: Number(x.h) || 0,
        s: Number(x.s) || 0,
        l: Number(x.l) || 50,
        weight: Number(x.w) || 0,
      }));
  } catch {
    return [];
  }
}
