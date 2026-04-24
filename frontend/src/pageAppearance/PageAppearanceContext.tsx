import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** 设置里粘贴的链接：仅 http(s)，服务端保存 */
export function isAllowedRemoteWallpaperUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type PageAppearanceValue = {
  /** 已解析、可直接用于 <img src> 的地址 */
  wallpaperDisplayUrl: string | null;
  setWallpaperDisplayUrl: (url: string | null) => void;
  wallpaperActive: boolean;
  /** 当前可编辑的歌单（仅音乐页选中的歌单）；为 null 时不显示设置入口 */
  wallpaperTargetPlaylistId: number | null;
  setWallpaperTargetPlaylistId: (id: number | null) => void;
  registerPlaylistsRefresh: (fn: (() => Promise<void>) | null) => void;
  refreshPlaylists: () => Promise<void>;
};

const PageAppearanceContext = createContext<PageAppearanceValue | null>(null);

export function PageAppearanceProvider({ children }: { children: ReactNode }) {
  const [wallpaperDisplayUrl, setWallpaperDisplayUrl] = useState<string | null>(null);
  const [wallpaperTargetPlaylistId, setWallpaperTargetPlaylistId] = useState<number | null>(null);
  const playlistsRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const registerPlaylistsRefresh = useCallback((fn: (() => Promise<void>) | null) => {
    playlistsRefreshRef.current = fn;
  }, []);

  const refreshPlaylists = useCallback(async () => {
    await playlistsRefreshRef.current?.();
  }, []);

  const value = useMemo<PageAppearanceValue>(
    () => ({
      wallpaperDisplayUrl,
      setWallpaperDisplayUrl,
      wallpaperActive: Boolean(wallpaperDisplayUrl),
      wallpaperTargetPlaylistId,
      setWallpaperTargetPlaylistId,
      registerPlaylistsRefresh,
      refreshPlaylists,
    }),
    [
      wallpaperDisplayUrl,
      wallpaperTargetPlaylistId,
      registerPlaylistsRefresh,
      refreshPlaylists,
    ]
  );

  return (
    <PageAppearanceContext.Provider value={value}>{children}</PageAppearanceContext.Provider>
  );
}

export function usePageAppearance(): PageAppearanceValue {
  const ctx = useContext(PageAppearanceContext);
  if (!ctx) {
    throw new Error("usePageAppearance must be used within PageAppearanceProvider");
  }
  return ctx;
}

export function usePageAppearanceOptional(): PageAppearanceValue | null {
  return useContext(PageAppearanceContext);
}
