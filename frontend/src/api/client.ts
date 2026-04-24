import axios from "axios";

const TOKEN_KEY = "bendoudou_token";

/** 用于区分 HTTP 状态（如 429 限流、401 登录过期），便于前端做多语言提示 */
export class ApiHttpError extends Error {
  constructor(
    public readonly status: number,
    message?: string
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = "ApiHttpError";
  }
}

/** 供前端在 catch 中替换为多语言的「加载失败」占位 */
export const I18N_LOAD_FAILED = "__I18N_LOAD_FAILED__";

/** 产线 API 域名（浏览器走 443/80，无端口；服务端反代到后端由运维配置） */
const PROD_API_ORIGIN = "https://api.bendoudoudounai.com";

/**
 * 后端 API 根地址。
 * - 若设置 `VITE_BACKEND_BASE`，则始终使用该值（可覆盖下述默认）
 * - 生产构建：默认 `PROD_API_ORIGIN`
 * - 本地开发：空字符串，走 Vite 代理的相对路径 `/api/...`（见 vite.config 的 proxy）
 */
export function getBackendBase(): string {
  if (import.meta.env.VITE_BACKEND_BASE) {
    return import.meta.env.VITE_BACKEND_BASE;
  }
  if (import.meta.env.PROD) {
    return PROD_API_ORIGIN;
  }
  return "";
}

export const api = axios.create({
  baseURL: getBackendBase(),
  headers: { "Content-Type": "application/json" },
});

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

const initial = getStoredToken();
if (initial) {
  setAuthToken(initial);
}

export type UserRole = "USER" | "ADMIN";

export interface AuthResponse {
  token: string;
  email: string;
  displayName: string | null;
  /** USER：普通用户；ADMIN：管理员 */
  role: UserRole;
}

export interface MeResponse {
  id: number;
  email: string;
  displayName: string | null;
  /** 服务端是否已保存头像；为 true 时用 userAvatarDisplayUrl 拼带 token 的图片地址 */
  hasAvatar?: boolean;
  /** USER | ADMIN；旧数据缺省时前端按 USER 处理 */
  role?: UserRole;
}

export function userIsAdmin(user: Pick<MeResponse, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN";
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>("/api/users/me");
  return { ...data, role: data.role ?? "USER" };
}

export interface AdminUserRowDto {
  id: number;
  email: string;
  displayName: string | null;
  role: UserRole;
  hasAvatar: boolean;
  createdAtMillis: number;
  enabled: boolean;
}

export async function fetchAdminUsers(): Promise<AdminUserRowDto[]> {
  const { data } = await api.get<AdminUserRowDto[]>("/api/admin/users");
  return data.map((row) => ({ ...row, role: row.role ?? "USER", enabled: row.enabled !== false }));
}

export type AdminUserPatchBody = {
  displayName?: string | null;
  role?: UserRole;
  enabled?: boolean;
  /** 为其他用户设置新密码时传入；6 位以上 */
  newPassword?: string;
};

export async function patchAdminUser(id: number, body: AdminUserPatchBody): Promise<AdminUserRowDto> {
  const { data } = await api.patch<AdminUserRowDto>(`/api/admin/users/${id}`, body);
  return { ...data, role: data.role ?? "USER", enabled: data.enabled !== false };
}

export async function resetAdminUserPassword(id: number): Promise<void> {
  await api.post(`/api/admin/users/${id}/reset-password`);
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  displayName?: string | null;
  role?: UserRole;
}): Promise<AdminUserRowDto> {
  const { data } = await api.post<AdminUserRowDto>("/api/admin/users", {
    email: input.email.trim(),
    password: input.password,
    displayName: input.displayName?.trim() ? input.displayName.trim() : null,
    role: input.role ?? "USER",
  });
  return { ...data, role: data.role ?? "USER", enabled: data.enabled !== false };
}

export async function changeMyPassword(oldPassword: string, newPassword: string): Promise<void> {
  await api.post("/api/users/me/password", { oldPassword, newPassword });
}

/** 当前登录用户头像 URL（供 `<img src>`）；无自定义头像时返回 null，应用首字母占位 */
export function userAvatarDisplayUrl(user: Pick<MeResponse, "hasAvatar">): string | null {
  if (!user.hasAvatar) return null;
  const tok = getStoredToken();
  if (!tok) return null;
  const url = apiPath("/api/users/me/avatar");
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(tok)}`;
}

export async function uploadUserAvatar(file: File): Promise<MeResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const tok = getStoredToken();
  const res = await fetch(apiPath("/api/users/me/avatar"), {
    method: "POST",
    headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    body: fd,
  });
  return authJson(res);
}

export function persistSession(token: string) {
  setStoredToken(token);
  setAuthToken(token);
}

export function clearSession() {
  setStoredToken(null);
  setAuthToken(null);
}

// —— 音乐（multipart 用 fetch，避免 axios 默认 JSON Content-Type）——

export interface MusicPreviewResponse {
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  originalFilename: string;
  fileHadEmbeddedOrParsed: boolean;
}

export interface MusicTrackDto {
  id: number;
  playlistId: number;
  title: string;
  artist: string;
  album: string;
  note: string | null;
  durationSeconds: number;
  originalFilename: string;
  metadataFromFile: boolean;
  createdAtMillis: number;
  /** 对象存储公网直链，有则优先用于播放 */
  audioUrl: string | null;
  lyricsUrl: string | null;
  /** 含 COS URL 或本地歌词文件（走 GET /tracks/{id}/lyrics） */
  hasLyrics: boolean;
  /**
   * 封面地址：对象存储时为 https 公网直链；仅服务端存文件时为 `/api/music/tracks/{id}/cover`（前端用 coverDisplayUrl 拼 token）
   */
  coverUrl: string | null;
  hasCover: boolean;
  /** 累计播放次数（全站该曲目） */
  playCount?: number;
}

export interface PlaylistItemDto {
  id: number;
  name: string;
  ownerId: number;
  ownerLabel: string;
  iAmOwner: boolean;
  myRole: string;
  trackCount: number;
  /** 是否与他人共享 */
  shared: boolean;
  /** 歌单背景：https / COS 直链，或需带 token 的 /api/.../wallpaper */
  wallpaperUrl: string | null;
  /** 歌单内所有曲目 playCount 之和 */
  totalPlayCount?: number;
  memberCount?: number;
  createdAtMillis?: number;
}

export interface PlaylistMemberDto {
  userId: number;
  label: string;
  role: string;
}

export interface InvitationItemDto {
  id: number;
  playlistId: number;
  playlistName: string;
  inviterId: number;
  inviterLabel: string;
  inviteeId: number;
  inviteeLabel: string;
  status: string;
  createdAtMillis: number;
}

export function apiPath(path: string) {
  const b = getBackendBase();
  return b ? `${b.replace(/\/$/, "")}${path}` : path;
}

/** 播放器封面地址：COS 等 https 直链原样；服务端磁盘封面为 /api/.../cover，需带 access_token 供 img 使用 */
/** 歌单壁纸：与封面类似，外链直用；仅服务端存储时为 /api/... 需拼 token */
export function playlistWallpaperDisplayUrl(
  pl: Pick<PlaylistItemDto, "wallpaperUrl"> | null
): string | null {
  if (!pl?.wallpaperUrl) return null;
  const w = pl.wallpaperUrl;
  if (w.startsWith("http://") || w.startsWith("https://")) return w;
  const tok = getStoredToken();
  if (!tok) return null;
  const path = w.startsWith("/api/") ? w : null;
  if (!path) return null;
  const url = apiPath(path);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(tok)}`;
}

export function coverDisplayUrl(
  track: Pick<MusicTrackDto, "id" | "coverUrl" | "hasCover"> | null
): string | null {
  if (!track) return null;
  const cu = track.coverUrl;
  if (cu && (cu.startsWith("http://") || cu.startsWith("https://"))) return cu;
  const tok = getStoredToken();
  if (!tok) return null;
  let path: string;
  if (cu && cu.startsWith("/api/")) {
    path = cu;
  } else if (track.hasCover) {
    path = `/api/music/tracks/${track.id}/cover`;
  } else {
    return null;
  }
  const url = apiPath(path);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(tok)}`;
}

async function authJson<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    throw new ApiHttpError(401);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      const serverMsg = j.message ?? j.detail;
      if (serverMsg) msg = serverMsg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const PLAYLIST_STORAGE_KEY = "bendoudou_playlist_id";

export interface WishlistEntryDto {
  id: number;
  nickname: string | null;
  content: string;
  createdAtMillis: number;
}

export interface WishlistPageDto {
  content: WishlistEntryDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** 公开：心愿列表（分页） */
export async function fetchWishlistEntries(page = 0, size = 30): Promise<WishlistPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  const res = await fetch(apiPath(`/api/wishlist?${q.toString()}`));
  if (!res.ok) {
    const text = await res.text();
    let msg = I18N_LOAD_FAILED;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<WishlistPageDto>;
}

/** 公开：匿名提交心愿（无需登录；服务端按 IP 限流） */
export async function submitWishlistEntry(input: { content: string; nickname?: string | null }): Promise<WishlistEntryDto> {
  const body: { content: string; nickname?: string } = {
    content: input.content.trim(),
  };
  const nn = input.nickname?.trim();
  if (nn) body.nickname = nn;
  const res = await fetch(apiPath("/api/wishlist"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    throw new ApiHttpError(429);
  }
  if (res.status === 401) {
    throw new ApiHttpError(401);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      const serverMsg = j.message ?? j.detail;
      if (serverMsg) msg = serverMsg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<WishlistEntryDto>;
}

export interface GuestbookMessageDto {
  id: number;
  nickname: string | null;
  content: string;
  parentId: number | null;
  createdAtMillis: number;
  /** 定向可见：仅该用户 id；与 targetDisplayName 同时有值 */
  visibleToUserId: number | null;
  /** 服务端解析的展示名，公开帖为 null */
  targetDisplayName: string | null;
  replies: GuestbookMessageDto[];
}

export interface UserDirectoryItemDto {
  id: number;
  label: string;
  email: string;
  hasAvatar: boolean;
  /** 旧服务端可能缺省，按 USER */
  role?: UserRole;
}

/** 站内用户头像直链（供 img；需已登录，对方无头像时返回 null） */
export function userDirectoryAvatarUrl(user: Pick<UserDirectoryItemDto, "id" | "hasAvatar">): string | null {
  if (!user.hasAvatar) return null;
  const tok = getStoredToken();
  if (!tok) return null;
  const url = apiPath(`/api/users/${user.id}/avatar`);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(tok)}`;
}

export interface GuestbookPageDto {
  content: GuestbookMessageDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

async function publicJsonOrThrow(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  let msg = res.statusText;
  try {
    const j = JSON.parse(text) as { message?: string; detail?: string };
    const serverMsg = j.message ?? j.detail;
    if (serverMsg) msg = serverMsg;
  } catch {
    if (text) msg = text;
  }
  throw new Error(msg);
}

/** 留言板主楼列表；已登录时带 JWT 可看到「定向给自己」的帖 */
export async function fetchGuestbookThreads(page = 0, size = 15): Promise<GuestbookPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  const tok = getStoredToken();
  const res = await fetch(apiPath(`/api/guestbook?${q}`), {
    headers: tok ? { Authorization: `Bearer ${tok}` } : {},
  });
  if (!res.ok) {
    await publicJsonOrThrow(res);
  }
  return res.json() as Promise<GuestbookPageDto>;
}

/** 登录后：站内用户列表，用于留言选择可见对象 */
export async function fetchUserDirectoryForGuestbook(): Promise<UserDirectoryItemDto[]> {
  const res = await fetch(apiPath("/api/users/directory"), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  const rows = await authJson(res) as UserDirectoryItemDto[];
  return rows.map((u) => ({ ...u, role: u.role ?? "USER" }));
}

/** 发帖或回复主楼。定向 visibleToUserId 非空时须已登录。parentId 为回复主楼。 */
export async function submitGuestbookMessage(input: {
  content: string;
  nickname?: string | null;
  parentId?: number | null;
  visibleToUserId?: number | null;
}): Promise<GuestbookMessageDto> {
  const body: { content: string; nickname?: string; parentId?: number; visibleToUserId?: number } = {
    content: input.content.trim(),
  };
  const nn = input.nickname?.trim();
  if (nn) body.nickname = nn;
  if (input.parentId != null) body.parentId = input.parentId;
  if (input.parentId == null && input.visibleToUserId != null) body.visibleToUserId = input.visibleToUserId;
  const tok = getStoredToken();
  const res = await fetch(apiPath("/api/guestbook"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    throw new ApiHttpError(429);
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      const serverMsg = j.message ?? j.detail;
      if (serverMsg) msg = serverMsg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<GuestbookMessageDto>;
}

export function getStoredPlaylistId(): string | null {
  return localStorage.getItem(PLAYLIST_STORAGE_KEY);
}

export function setStoredPlaylistId(id: number | null) {
  if (id == null) localStorage.removeItem(PLAYLIST_STORAGE_KEY);
  else localStorage.setItem(PLAYLIST_STORAGE_KEY, String(id));
}

export async function fetchVisiblePlaylists(): Promise<PlaylistItemDto[]> {
  const res = await fetch(apiPath("/api/music/playlists"), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function createPlaylist(name: string): Promise<PlaylistItemDto> {
  const res = await fetch(apiPath("/api/music/playlists"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  return authJson(res);
}

export async function updatePlaylistWallpaperUrl(
  playlistId: number,
  wallpaperUrl: string | null
): Promise<PlaylistItemDto> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/wallpaper`), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wallpaperUrl }),
  });
  return authJson(res);
}

export async function updatePlaylistName(playlistId: number, name: string): Promise<PlaylistItemDto> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name.trim() }),
  });
  return authJson(res);
}

export async function fetchPlaylistMembers(playlistId: number): Promise<PlaylistMemberDto[]> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/members`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function recordTrackPlay(trackId: number): Promise<MusicTrackDto> {
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}/record-play`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function uploadPlaylistWallpaper(
  playlistId: number,
  file: File
): Promise<PlaylistItemDto> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/wallpaper`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
    body: fd,
  });
  return authJson(res);
}

export async function fetchMusicTracks(playlistId: number): Promise<MusicTrackDto[]> {
  const q = new URLSearchParams({ playlistId: String(playlistId) });
  const res = await fetch(apiPath(`/api/music/tracks?${q.toString()}`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function fetchIncomingInvitations(): Promise<InvitationItemDto[]> {
  const res = await fetch(apiPath("/api/music/invitations/incoming"), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function acceptInvitation(id: number): Promise<void> {
  const res = await fetch(apiPath(`/api/music/invitations/${id}/accept`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      const serverMsg = j.message ?? j.detail;
      if (serverMsg) msg = serverMsg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}

export async function declineInvitation(id: number): Promise<void> {
  const res = await fetch(apiPath(`/api/music/invitations/${id}/decline`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      const serverMsg = j.message ?? j.detail;
      if (serverMsg) msg = serverMsg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}

export async function inviteToPlaylist(playlistId: number, inviteeEmail: string): Promise<InvitationItemDto> {
  const res = await fetch(apiPath("/api/music/invitations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ playlistId, inviteeEmail: inviteeEmail.trim() }),
  });
  return authJson(res);
}

export async function previewMusicFile(file: File): Promise<MusicPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(apiPath("/api/music/preview"), {
    method: "POST",
    body: form,
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

function errorFromXhr(xhr: XMLHttpRequest): Error {
  if (xhr.status === 401) {
    return new ApiHttpError(401);
  }
  const text = xhr.responseText || "";
  let msg = xhr.statusText || "上传失败";
  try {
    const j = JSON.parse(text) as { message?: string; detail?: string };
    const serverMsg = j.message ?? j.detail;
    if (serverMsg) msg = serverMsg;
  } catch {
    if (text) msg = text;
  }
  return new Error(msg);
}

/**
 * 使用 XHR 以便 xhr.upload 上报发送进度。percent 为 0–100；部分浏览器在 FormData 下 total 不可知时回调 null（不确定进度）。
 */
export function uploadMusicTrack(
  file: File,
  fields: {
    playlistId?: number;
    title?: string;
    artist?: string;
    album?: string;
    note?: string;
    lyricsFile?: File | null;
  },
  options?: { onProgress?: (percent: number | null) => void }
): Promise<MusicTrackDto> {
  const form = new FormData();
  form.append("file", file);
  if (fields.lyricsFile) {
    form.append("lyricsFile", fields.lyricsFile);
  }
  if (fields.playlistId != null) {
    form.append("playlistId", String(fields.playlistId));
  }
  if (fields.title?.trim()) form.append("title", fields.title.trim());
  if (fields.artist?.trim()) form.append("artist", fields.artist.trim());
  if (fields.album?.trim()) form.append("album", fields.album.trim());
  if (fields.note?.trim()) form.append("note", fields.note.trim());

  const url = apiPath("/api/music/tracks");
  const token = getStoredToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.upload.onprogress = (ev) => {
      if (!options?.onProgress) return;
      if (ev.lengthComputable && ev.total > 0) {
        options.onProgress(Math.min(100, Math.round((100 * ev.loaded) / ev.total)));
      } else {
        options.onProgress(null);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MusicTrackDto);
        } catch {
          reject(new Error("无法解析服务器响应"));
        }
      } else {
        reject(errorFromXhr(xhr));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误，请检查连接"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.send(form);
  });
}

export function getTrackFileUrl(id: number) {
  return apiPath(`/api/music/tracks/${id}/file`);
}

export function getTrackLyricsUrl(id: number) {
  return apiPath(`/api/music/tracks/${id}/lyrics`);
}

/** 拉取歌词正文：COS 直链无鉴权；走本站 /api 时用 Bearer */
export async function fetchTrackLyricsText(
  track: Pick<MusicTrackDto, "id" | "lyricsUrl" | "hasLyrics">
): Promise<string | null> {
  if (!track.hasLyrics) return null;
  const lu = track.lyricsUrl;
  let url: string;
  const headers: Record<string, string> = {};
  if (lu != null && (lu.startsWith("http://") || lu.startsWith("https://"))) {
    url = lu;
  } else {
    const tok = getStoredToken();
    if (!tok) return null;
    const path =
      lu != null && lu.startsWith("/api/") ? lu : `/api/music/tracks/${track.id}/lyrics`;
    url = apiPath(path);
    headers.Authorization = `Bearer ${tok}`;
  }
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const lyricsFetchCache = new Map<string, Promise<string | null>>();

/** 同一首歌多处以相同参数拉歌词时复用 Promise，避免重复请求 */
export function fetchTrackLyricsTextCached(
  track: Pick<MusicTrackDto, "id" | "lyricsUrl" | "hasLyrics">
): Promise<string | null> {
  if (!track.hasLyrics) return Promise.resolve(null);
  const key = `${track.id}::${track.lyricsUrl ?? ""}`;
  let p = lyricsFetchCache.get(key);
  if (!p) {
    p = fetchTrackLyricsText(track);
    lyricsFetchCache.set(key, p);
  }
  return p;
}

