import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";

/**
 * 全视口壁纸：底层大图模糊 + 半透明磨砂层，内容区叠在上方（z-index 更高）。
 */
export function PageWallpaper() {
  const { wallpaperDisplayUrl } = usePageAppearance();
  if (!wallpaperDisplayUrl) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-stone-900">
        <img
          src={wallpaperDisplayUrl}
          alt=""
          className="h-full w-full scale-[1.02] object-cover opacity-[0.97] blur-sm saturate-100"
          draggable={false}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-stone-900/15" />
      <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-[2px]" />
    </div>
  );
}
