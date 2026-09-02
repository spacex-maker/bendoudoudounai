/** 网易云音质展示工具 */
export type AudioQualityCode = "standard" | "higher" | "exhigh" | "lossless" | "hires";

export function isAudioQualityCode(v: string | null | undefined): v is AudioQualityCode {
  return (
    v === "standard" ||
    v === "higher" ||
    v === "exhigh" ||
    v === "lossless" ||
    v === "hires"
  );
}

export function qualityRank(q: string | null | undefined): number {
  switch (q) {
    case "hires":
      return 5;
    case "lossless":
      return 4;
    case "exhigh":
      return 3;
    case "higher":
      return 2;
    case "standard":
      return 1;
    default:
      return 0;
  }
}
