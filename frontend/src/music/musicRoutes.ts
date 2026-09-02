/** 音乐页分区路由：刷新后可回到发现 / FM / 喜欢 / 历史 / 具体歌单 */

export type MusicNavKind = "discover" | "fm" | "liked" | "history" | "playlist";

export type MusicRoute =
  | { kind: "index" }
  | { kind: "discover" }
  | { kind: "fm" }
  | { kind: "liked" }
  | { kind: "history" }
  | { kind: "playlist"; playlistId: number };

export function isMusicPath(pathname: string): boolean {
  return pathname === "/music" || pathname.startsWith("/music/");
}

export function parseMusicPathname(pathname: string): MusicRoute {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/music") return { kind: "index" };
  if (p === "/music/discover") return { kind: "discover" };
  if (p === "/music/fm") return { kind: "fm" };
  if (p === "/music/liked") return { kind: "liked" };
  if (p === "/music/history") return { kind: "history" };
  const m = /^\/music\/playlist\/(\d+)$/.exec(p);
  if (m) return { kind: "playlist", playlistId: Number(m[1]) };
  return { kind: "index" };
}

export function musicPathFor(
  kind: Exclude<MusicRoute["kind"], "index">,
  playlistId?: number
): string {
  switch (kind) {
    case "discover":
      return "/music/discover";
    case "fm":
      return "/music/fm";
    case "liked":
      return "/music/liked";
    case "history":
      return "/music/history";
    case "playlist":
      return `/music/playlist/${playlistId ?? 0}`;
  }
}

export function navKindFromRoute(route: MusicRoute): MusicNavKind {
  if (route.kind === "index" || route.kind === "playlist") return "playlist";
  return route.kind;
}
