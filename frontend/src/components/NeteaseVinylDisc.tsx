import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Music2 } from "lucide-react";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export type NeteaseVinylDiscProps = {
  /** 用于检测切歌并触发换碟动画 */
  trackId: number | string;
  coverSrc: string | null;
  /** 用于 img alt */
  title: string;
  /** 播放中则黑胶匀速旋转 */
  playing: boolean;
  /** 0–1，随播放 / 拖动进度移动唱针（外圈 → 内圈） */
  playProgress?: number;
  /** 点击唱针：切换播放 / 暂停 */
  onTogglePlay?: () => void;
  /** 不可交互时禁用唱针按钮 */
  canToggle?: boolean;
  className?: string;
};

/**
 * 唱针角度标定：中心标贴为 `inset-[20%]`，针尖只应在黑色沟槽环内移动
 * （内缘 ≈ 标贴外沿，对应归一化半径 1 − 2×0.2 = 0.6）。
 * 勿把 GROOVE_DEG_AT_R_INNER 取过大，否则视觉上会扫进封面。
 */
const GROOVE_DEG_AT_R_OUTER = 15.5;
const GROOVE_DEG_AT_R_INNER = 24;
/** 相对压碟姿态再逆时针抬起（暂停 / 切歌抬起） */
const LIFT_DELTA_DEG = -48;

/**
 * 网易云式黑胶：外圈沟槽 + 中心圆形封面 + 中心轴孔；播放时整体旋转。
 * 切歌时唱针先抬起，唱片缩放模糊换碟；播放中唱针随进度沿圆弧滑动。
 */
export function NeteaseVinylDisc({
  trackId,
  coverSrc,
  title,
  playing,
  playProgress = 0,
  onTogglePlay,
  canToggle = true,
  className,
}: NeteaseVinylDiscProps) {
  const { t: tr } = useTranslation();
  const armInteractive = Boolean(onTogglePlay) && canToggle;
  const p = clamp01(playProgress);

  const prevTrackIdRef = useRef(trackId);
  const bootRef = useRef(true);
  const [swapLift, setSwapLift] = useState(false);
  /** >0 时换碟用 key 重挂载以重播一次 CSS 动画；0 表示首次展示不播换碟 */
  const [vinylMountKey, setVinylMountKey] = useState(0);
  const [visualCover, setVisualCover] = useState(coverSrc);
  const [visualTitle, setVisualTitle] = useState(title);

  useEffect(() => {
    if (bootRef.current) {
      bootRef.current = false;
      prevTrackIdRef.current = trackId;
      setVisualCover(coverSrc);
      setVisualTitle(title);
      return;
    }
    if (prevTrackIdRef.current === trackId) {
      setVisualCover(coverSrc);
      setVisualTitle(title);
      return;
    }
    prevTrackIdRef.current = trackId;

    setSwapLift(true);
    setVinylMountKey((k) => k + 1);

    const tCover = window.setTimeout(() => {
      setVisualCover(coverSrc);
      setVisualTitle(title);
    }, 340);

    const tDone = window.setTimeout(() => {
      setSwapLift(false);
    }, 720);

    return () => {
      window.clearTimeout(tCover);
      window.clearTimeout(tDone);
    };
  }, [trackId, coverSrc, title]);

  // p：0→最外圈沟槽，1→最内圈沟槽（标贴外沿，与 inset-[20%] 一致）
  const grooveDeg =
    GROOVE_DEG_AT_R_OUTER + (GROOVE_DEG_AT_R_INNER - GROOVE_DEG_AT_R_OUTER) * p;
  const liftDeg = playing && !swapLift ? 0 : LIFT_DELTA_DEG;

  return (
    <div className={clsx("relative mx-auto w-full max-w-[380px]", className)}>
      {/* 唱针臂：可点击；外层抬起带过渡，内层沟槽角随进度即时变化 */}
      <button
        type="button"
        disabled={!armInteractive}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay?.();
        }}
        title={playing ? tr("vinyl.pause") : tr("vinyl.play")}
        aria-label={playing ? tr("vinyl.pause") : tr("vinyl.play")}
        className={clsx(
          "absolute -right-1 top-1 z-30 flex h-[48%] min-h-[7rem] w-14 justify-end pt-2 sm:right-0 sm:top-2",
          "touch-manipulation rounded-md bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/75 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950/0",
          armInteractive && "cursor-pointer",
          !armInteractive && "cursor-default opacity-90"
        )}
      >
        <span
          className={clsx(
            "relative block h-full w-[11px] will-change-transform",
            "transition-transform duration-[620ms] ease-[cubic-bezier(0.34,1.15,0.64,1)]",
            "motion-reduce:transition-none motion-reduce:duration-0"
          )}
          style={{
            transformOrigin: "92% 10px",
            transform: `rotate(${liftDeg}deg)`,
          }}
          aria-hidden
        >
          <span
            className="relative block h-full w-[11px] will-change-transform motion-reduce:transition-none"
            style={{
              transformOrigin: "92% 10px",
              transform: `rotate(${grooveDeg}deg)`,
              transition: "none",
            }}
          >
            <span className="pointer-events-none absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-gradient-to-br from-zinc-500 to-zinc-700 shadow-md ring-1 ring-zinc-900/80" />
            <span className="pointer-events-none absolute left-1/2 top-3 h-[calc(100%-14px)] w-[7px] -translate-x-1/2 rounded-full bg-gradient-to-b from-zinc-400 via-zinc-500 to-zinc-800 shadow-[2px_0_6px_rgba(0,0,0,0.45)]" />
            <span className="pointer-events-none absolute bottom-0.5 left-1/2 h-2.5 w-5 -translate-x-1/2 rounded-sm bg-gradient-to-b from-zinc-600 to-zinc-900 shadow-md" />
          </span>
        </span>
      </button>

      <div
        key={`${trackId}-${vinylMountKey}`}
        className={clsx(
          "relative aspect-square w-full rounded-full motion-reduce:!animate-none",
          vinylMountKey > 0 && "animate-vinyl-swap"
        )}
      >
        <div
          className={clsx(
            "relative h-full w-full rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
            "animate-[spin_26s_linear_infinite]"
          )}
          style={{ animationPlayState: playing ? "running" : "paused" }}
        >
          {/* 黑胶沟槽 */}
          <div
            className="absolute inset-0 rounded-full bg-zinc-950"
            style={{
              backgroundImage: `repeating-radial-gradient(
                circle at center,
                #0a0a0c 0px,
                #0a0a0c 2px,
                #141418 2px,
                #141418 3px
              )`,
            }}
          />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/[0.07] via-transparent to-black/50" />

          {/* 中心封面（略小于盘心，仿唱片标贴） */}
          <div className="absolute inset-[20%] overflow-hidden rounded-full bg-zinc-900 ring-[3px] ring-black/50 shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]">
            {visualCover ? (
              <img
                src={visualCover}
                alt={visualTitle}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600">
                <Music2 className="h-14 w-14 opacity-45 md:h-16 md:w-16" />
              </div>
            )}
          </div>

          {/* 中心轴孔 */}
          <div className="absolute inset-0 z-10 m-auto flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950 ring-2 ring-zinc-800/90 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]">
            <span className="h-2 w-2 rounded-full bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
