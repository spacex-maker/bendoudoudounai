import axios from "axios";
import COS from "cos-js-sdk-v5";

const TOKEN_KEY = "bendoudou_token";
/** 与「30 天无操作退出」搭配：有 token 时记录最后一次活动时间（时间戳 ms） */
const AUTH_LAST_ACTIVE_KEY = "bendoudou_auth_last_active_at";
/** 连续超过该时长无操作则清除本地 token（需与后端 access-token 有效期配合，JWT 过短会先于该策略失效） */
const INACTIVITY_LOGOUT_MS = 30 * 24 * 60 * 60 * 1000;

function readLastActiveAt(): number | null {
  const raw = localStorage.getItem(AUTH_LAST_ACTIVE_KEY);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 有访问令牌时更新「最后活动时间」，用于 30 天无操作才登出 */
export function touchAuthActivity() {
  if (!getStoredToken()) return;
  localStorage.setItem(AUTH_LAST_ACTIVE_KEY, String(Date.now()));
}

function clearLastActiveAt() {
  localStorage.removeItem(AUTH_LAST_ACTIVE_KEY);
}

/**
 * 仅本地策略：有 token 且已记录过活动时间，且超过 30 天未操作 → 应视为已登出。
 * 无记录时（老版本升级）不拦截，等首次 /api 成功后再写入活动时间。
 */
export function shouldLogoutDueToInactivity(): boolean {
  if (!getStoredToken()) return false;
  const last = readLastActiveAt();
  if (last == null) return false;
  return Date.now() - last > INACTIVITY_LOGOUT_MS;
}

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
/** 本地开发后端（不走 Vite 代理，直接请求） */
const DEV_API_ORIGIN = "http://127.0.0.1:8882";

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
  return DEV_API_ORIGIN;
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

api.interceptors.response.use(
  (res) => {
    if (getStoredToken()) touchAuthActivity();
    return res;
  },
  (err) => Promise.reject(err)
);

export type UserRole = "USER" | "ADMIN" | "DEVELOPER";

export interface AuthResponse {
  token: string;
  email: string;
  displayName: string | null;
  /** 主展示角色（与 roles 中最高序一致，兼容旧逻辑） */
  role: string;
  /** 全部已授予角色 */
  roles?: string[];
}

export interface MeResponse {
  id: number;
  email: string;
  displayName: string | null;
  /** 服务端是否已保存头像；为 true 时用 userAvatarDisplayUrl 拼带 token 的图片地址 */
  hasAvatar?: boolean;
  role?: string;
  /** 多角色；缺省时用 role 兜底 */
  roles?: string[];
  gender?: "UNKNOWN" | "MALE" | "FEMALE";
  beanBalance?: number;
  beanLevelCode?: string;
  beanLevelName?: string;
}

export interface UserPrivacySettingsDto {
  recordLoginActivity: boolean;
  recordPlayActivity: boolean;
  publicBeanLevel: boolean;
  publicLastOnline: boolean;
  allowPlaylistInvite: boolean;
}

function roleListOf(user: Pick<MeResponse, "role" | "roles"> | null | undefined): string[] {
  if (!user) return [];
  if (user.roles && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  return ["USER"];
}

export function userIsAdmin(user: Pick<MeResponse, "role" | "roles"> | null | undefined): boolean {
  return roleListOf(user).includes("ADMIN");
}

export function userIsDeveloper(user: Pick<MeResponse, "role" | "roles"> | null | undefined): boolean {
  return roleListOf(user).includes("DEVELOPER");
}

/**
 * 是否可撰写/改删本站的开发日记（与「管理员」身份独立，仅含 DEVELOPER 时 true）。
 */
export function userCanManageDevDiary(
  user: Pick<MeResponse, "role" | "roles"> | null | undefined
): boolean {
  return userIsDeveloper(user);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>("/api/users/me");
  const role = data.role ?? "USER";
  const roles = data.roles && data.roles.length > 0 ? data.roles : [role];
  const gender = data.gender ?? "UNKNOWN";
  return { ...data, role, roles, gender };
}

export async function fetchMyPrivacySettings(): Promise<UserPrivacySettingsDto> {
  const { data } = await api.get<UserPrivacySettingsDto>("/api/users/me/privacy");
  return data;
}

export async function updateMyPrivacySettings(
  input: Partial<UserPrivacySettingsDto>
): Promise<UserPrivacySettingsDto> {
  const { data } = await api.post<UserPrivacySettingsDto>("/api/users/me/privacy", input);
  return data;
}

export interface AdminUserRowDto {
  id: number;
  email: string;
  displayName: string | null;
  gender: "UNKNOWN" | "MALE" | "FEMALE";
  role: string;
  roles?: string[];
  hasAvatar: boolean;
  createdAtMillis: number;
  enabled: boolean;
}

export interface BeanBalanceDto {
  balance: number;
  levelCode: string;
  levelName: string;
  nextLevelMinBeans: number | null;
}

export interface BeanTransactionDto {
  id: number;
  userId: number;
  userLabel: string;
  delta: number;
  reason: string;
  actionType: string | null;
  relatedId: number | null;
  createdAtMillis: number;
}

export interface BeanTransactionPageDto {
  content: BeanTransactionDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface BeanRuleDto {
  actionType: string;
  beanDelta: number;
  enabled: boolean;
}

export interface BeanLevelDto {
  id: number;
  code: string;
  name: string;
  minBeans: number;
  sortOrder: number;
}

export async function fetchAdminUsers(): Promise<AdminUserRowDto[]> {
  const { data } = await api.get<AdminUserRowDto[]>("/api/admin/users");
  return data.map((row) => {
    const r = row.role ?? "USER";
    const roles = row.roles && row.roles.length > 0 ? row.roles : [r];
    const gender = row.gender ?? "UNKNOWN";
    return { ...row, role: r, roles, gender, enabled: row.enabled !== false };
  });
}

export async function fetchMyBeanOverview(): Promise<BeanBalanceDto> {
  const { data } = await api.get<BeanBalanceDto>("/api/beans/me");
  return data;
}

export async function fetchMyBeanTransactions(page = 0, size = 20): Promise<BeanTransactionPageDto> {
  const { data } = await api.get<BeanTransactionPageDto>(`/api/beans/me/transactions?page=${page}&size=${size}`);
  return data;
}

export async function fetchAdminBeanTransactions(page = 0, size = 30): Promise<BeanTransactionPageDto> {
  const { data } = await api.get<BeanTransactionPageDto>(`/api/admin/beans/transactions?page=${page}&size=${size}`);
  return data;
}

export async function fetchAdminBeanRules(): Promise<BeanRuleDto[]> {
  const { data } = await api.get<BeanRuleDto[]>("/api/admin/beans/rules");
  return data;
}

export async function updateAdminBeanRules(rules: BeanRuleDto[]): Promise<BeanRuleDto[]> {
  const { data } = await api.put<BeanRuleDto[]>("/api/admin/beans/rules", rules);
  return data;
}

export async function fetchAdminBeanLevels(): Promise<BeanLevelDto[]> {
  const { data } = await api.get<BeanLevelDto[]>("/api/admin/beans/levels");
  return data;
}

export async function updateAdminBeanLevels(
  levels: Array<Pick<BeanLevelDto, "id" | "code" | "name" | "minBeans" | "sortOrder">>
): Promise<BeanLevelDto[]> {
  const { data } = await api.put<BeanLevelDto[]>("/api/admin/beans/levels", levels);
  return data;
}

export type AdminUserPatchBody = {
  displayName?: string | null;
  gender?: "UNKNOWN" | "MALE" | "FEMALE";
  /** 主身份仅 USER 或 ADMIN */
  role?: "USER" | "ADMIN";
  enabled?: boolean;
  /** 为其他用户设置新密码时传入；6 位以上 */
  newPassword?: string;
};

export async function patchAdminUser(id: number, body: AdminUserPatchBody): Promise<AdminUserRowDto> {
  const { data } = await api.patch<AdminUserRowDto>(`/api/admin/users/${id}`, body);
  const r = data.role ?? "USER";
  const roles = data.roles && data.roles.length > 0 ? data.roles : [r];
  const gender = data.gender ?? "UNKNOWN";
  return { ...data, role: r, roles, gender, enabled: data.enabled !== false };
}

export async function resetAdminUserPassword(id: number): Promise<void> {
  await api.post(`/api/admin/users/${id}/reset-password`);
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  displayName?: string | null;
  gender?: "UNKNOWN" | "MALE" | "FEMALE";
  role?: "USER" | "ADMIN";
}): Promise<AdminUserRowDto> {
  const { data } = await api.post<AdminUserRowDto>("/api/admin/users", {
    email: input.email.trim(),
    password: input.password,
    displayName: input.displayName?.trim() ? input.displayName.trim() : null,
    gender: input.gender ?? "UNKNOWN",
    role: input.role ?? "USER",
  });
  const r = data.role ?? "USER";
  const roles = data.roles && data.roles.length > 0 ? data.roles : [r];
  const gender = data.gender ?? "UNKNOWN";
  return { ...data, role: r, roles, gender, enabled: data.enabled !== false };
}

// —— 开发日记（GET 可匿名，写操作需登录且为开发者/管理员）——

export interface DevDiaryListItemDto {
  id: number;
  title: string;
  authorUserId: number;
  authorLabel: string;
  createdAtMillis: number;
}

export interface DevDiaryPageDto {
  content: DevDiaryListItemDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface DevDiaryEntryDetailDto {
  id: number;
  title: string;
  bodyMd: string | null;
  authorUserId: number;
  authorLabel: string;
  createdAtMillis: number;
  updatedAtMillis: number;
}

export async function fetchDevDiaryPage(page = 0, size = 20): Promise<DevDiaryPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  const res = await fetch(apiPath(`/api/diary/entries?${q}`));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DevDiaryPageDto>;
}

export async function fetchDevDiaryEntry(id: number): Promise<DevDiaryEntryDetailDto> {
  const res = await fetch(apiPath(`/api/diary/entries/${id}`));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<DevDiaryEntryDetailDto>;
}

export async function postDevDiaryEntry(input: { title: string; bodyMd: string }): Promise<DevDiaryEntryDetailDto> {
  const res = await fetch(apiPath("/api/diary/entries"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return authJson(res);
}

export async function patchDevDiaryEntry(
  id: number,
  input: { title?: string; bodyMd?: string }
): Promise<DevDiaryEntryDetailDto> {
  const res = await fetch(apiPath(`/api/diary/entries/${id}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return authJson(res);
}

export async function deleteDevDiaryEntry(id: number): Promise<void> {
  const res = await fetch(apiPath(`/api/diary/entries/${id}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}

// —— 开发者角色申请 ——
export interface DeveloperApplicationDto {
  id: number;
  userId: number;
  userLabel: string;
  userEmail: string;
  message: string | null;
  status: string;
  createdAtMillis: number;
  resolvedAtMillis: number | null;
  resolutionNote: string | null;
}

export async function applyForDeveloperRole(message?: string): Promise<void> {
  const res = await fetch(apiPath("/api/role-applications/developer"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: message?.trim() || null }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const j = JSON.parse(text) as { message?: string; detail?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}

export async function fetchMyDeveloperApplications(): Promise<DeveloperApplicationDto[]> {
  const res = await fetch(apiPath("/api/role-applications/developer/mine"), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function fetchAdminDeveloperApplications(
  status?: "PENDING" | "APPROVED" | "REJECTED"
): Promise<DeveloperApplicationDto[]> {
  const q = status ? `?status=${status}` : "";
  const res = await fetch(apiPath(`/api/admin/role-applications${q}`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function approveDeveloperApplication(id: number): Promise<void> {
  const res = await fetch(apiPath(`/api/admin/role-applications/${id}/approve`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}

export async function rejectDeveloperApplication(id: number, note?: string): Promise<void> {
  const res = await fetch(apiPath(`/api/admin/role-applications/${id}/reject`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note: note?.trim() || null }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
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
  touchAuthActivity();
}

export function clearSession() {
  setStoredToken(null);
  setAuthToken(null);
  clearLastActiveAt();
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

export interface CosUploadTicketDto {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
  startTime: number;
  expiredTime: number;
  bucket: string;
  region: string;
  host: string;
  audioObjectKey: string;
  lyricsObjectKey: string | null;
  coverObjectKey: string | null;
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
  /** 当前用户是否已红心 */
  hearted?: boolean;
}

export interface PlaylistListeningStatusItemDto {
  trackId: number;
  userId: number;
  userLabel: string;
  updatedAtMillis: number;
}

export interface PlaylistListeningStatusDto {
  items: PlaylistListeningStatusItemDto[];
}

export interface PlaylistListeningWsEvent {
  type: "listening_update" | "listening_clear";
  playlistId: number;
  item?: PlaylistListeningStatusItemDto;
  userId?: number;
}

export interface TrackPlayUserStatDto {
  userId: number;
  userLabel: string;
  playCount: number;
}

export interface MusicTrackCommentDto {
  id: number;
  trackId: number;
  parentId: number | null;
  authorUserId: number;
  authorLabel: string;
  authorHasAvatar: boolean;
  content: string;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  createdAtMillis: number;
  updatedAtMillis: number;
  replies: MusicTrackCommentDto[];
}

export interface MusicMentionNotificationDto {
  id: number;
  playlistId: number;
  trackId: number;
  trackTitle: string;
  commentId: number;
  actorUserId: number;
  actorLabel: string;
  contentPreview: string;
  read: boolean;
  createdAtMillis: number;
}

export interface MusicTrackCommentPageDto {
  content: MusicTrackCommentDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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
  /** 当日新建，或当前用户当日新加入（与后端 Asia/Shanghai 日切一致） */
  newForToday?: boolean;
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
  const data = (await res.json()) as T;
  if (getStoredToken()) touchAuthActivity();
  return data;
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

/** 管理端：心愿列表（分页），需管理员 JWT */
export async function fetchAdminWishlistEntries(page = 0, size = 30): Promise<WishlistPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  const { data } = await api.get<WishlistPageDto>(`/api/admin/wishlist?${q}`);
  return data;
}

/** 管理端：删除一条心愿 */
export async function deleteAdminWishlistEntry(id: number): Promise<void> {
  await api.delete(`/api/admin/wishlist/${id}`);
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
  /** 留言作者用户 id；匿名或未登录发帖可能为 null */
  authorUserId?: number | null;
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
  beanBalance?: number | null;
  beanLevelCode?: string | null;
  beanLevelName?: string | null;
  lastOnlineAtMillis?: number | null;
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

/** 管理端：全站留言主楼列表（含定向帖），需管理员 JWT */
export async function fetchAdminGuestbookThreads(page = 0, size = 15): Promise<GuestbookPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  const { data } = await api.get<GuestbookPageDto>(`/api/admin/guestbook?${q}`);
  return data;
}

/** 留言板主楼列表；已登录时带 JWT 可看到「定向给自己」的帖 */
export type GuestbookScope = "all" | "public" | "about_me";

/** 留言板主楼列表；已登录时带 JWT 可看到「定向给自己」的帖 */
export async function fetchGuestbookThreads(page = 0, size = 15, scope: GuestbookScope = "all"): Promise<GuestbookPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size), scope });
  const tok = getStoredToken();
  const res = await fetch(apiPath(`/api/guestbook?${q}`), {
    cache: "no-store",
    headers: {
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
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

export async function deletePlaylist(playlistId: number): Promise<void> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}`), {
    method: "DELETE",
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

export async function fetchPlaylistMembers(playlistId: number): Promise<PlaylistMemberDto[]> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/members`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

/** 该歌单下待处理的协作者邀请（与成员列表一起在详情中展示） */
export async function fetchPlaylistPendingInvitations(playlistId: number): Promise<InvitationItemDto[]> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/invitations/pending`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function removePlaylistMember(playlistId: number, userId: number): Promise<void> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/members/${userId}`), {
    method: "DELETE",
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

export async function recordTrackPlay(trackId: number): Promise<MusicTrackDto> {
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}/record-play`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function fetchTrackPlayStats(trackId: number): Promise<TrackPlayUserStatDto[]> {
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}/play-stats`), {
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

export async function fetchPlaylistListeningStatus(playlistId: number): Promise<PlaylistListeningStatusDto> {
  const res = await fetch(apiPath(`/api/music/playlists/${playlistId}/listening-status`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function updatePlaylistListeningState(
  playlistId: number,
  input: { trackId?: number | null; playing: boolean }
): Promise<void> {
  await api.post(`/api/music/playlists/${playlistId}/listening-state`, input);
}

/**
 * 非阻塞上报「正在听」状态：
 * - 延后到下一轮事件循环，避免与点击播放同帧竞争
 * - 请求超时后直接放弃，不影响本地播放
 * - 失败静默处理，由后续状态变更继续覆盖
 */
export function updatePlaylistListeningStateAsync(
  playlistId: number,
  input: { trackId?: number | null; playing: boolean },
  timeoutMs = 1200
): void {
  window.setTimeout(() => {
    const token = getStoredToken();
    if (!token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    void fetch(apiPath(`/api/music/playlists/${playlistId}/listening-state`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
      keepalive: true,
    })
      .catch(() => {
        // no-op: intentionally non-blocking
      })
      .finally(() => {
        window.clearTimeout(timer);
      });
  }, 0);
}

export function playlistListeningWsUrl(playlistId: number): string | null {
  const token = getStoredToken();
  if (!token) return null;
  const base = getBackendBase();
  let wsOrigin: string;
  if (!base) {
    wsOrigin = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  } else if (base.startsWith("https://")) {
    wsOrigin = `wss://${base.slice("https://".length).replace(/\/$/, "")}`;
  } else if (base.startsWith("http://")) {
    wsOrigin = `ws://${base.slice("http://".length).replace(/\/$/, "")}`;
  } else {
    wsOrigin = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  }
  const params = new URLSearchParams({
    playlistId: String(playlistId),
    access_token: token,
  });
  return `${wsOrigin}/ws/playlist-listening?${params.toString()}`;
}

export async function updateMyProfile(input: {
  displayName?: string | null;
  gender?: "UNKNOWN" | "MALE" | "FEMALE";
}): Promise<MeResponse> {
  const { data } = await api.post<MeResponse>("/api/users/me/profile", {
    displayName: input.displayName,
    gender: input.gender,
  });
  return data;
}

export async function fetchHeartTracks(): Promise<MusicTrackDto[]> {
  const res = await fetch(apiPath("/api/music/hearts/tracks"), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function fetchPlayHistoryTracks(): Promise<MusicTrackDto[]> {
  const res = await fetch(apiPath("/api/music/history/tracks"), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function fetchTrackComments(
  trackId: number,
  page = 0,
  size = 20
): Promise<MusicTrackCommentPageDto> {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}/comments?${q.toString()}`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function postTrackComment(input: {
  trackId: number;
  content: string;
  parentId?: number | null;
  mentionUserIds?: number[];
}): Promise<MusicTrackCommentDto> {
  const res = await fetch(apiPath(`/api/music/tracks/${input.trackId}/comments`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.content.trim(),
      parentId: input.parentId ?? null,
      mentionUserIds: input.mentionUserIds ?? [],
    }),
  });
  return authJson(res);
}

export async function fetchMusicMentions(size = 30): Promise<MusicMentionNotificationDto[]> {
  const q = new URLSearchParams({ size: String(size) });
  const res = await fetch(apiPath(`/api/music/mentions?${q.toString()}`), {
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function markMusicMentionRead(mentionId: number): Promise<void> {
  const res = await fetch(apiPath(`/api/music/mentions/${mentionId}/read`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  if (!res.ok) {
    await authJson(res);
  }
}

export async function likeTrackComment(commentId: number): Promise<MusicTrackCommentDto> {
  const res = await fetch(apiPath(`/api/music/comments/${commentId}/like`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function unlikeTrackComment(commentId: number): Promise<MusicTrackCommentDto> {
  const res = await fetch(apiPath(`/api/music/comments/${commentId}/like`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function addHeartTrack(trackId: number): Promise<MusicTrackDto> {
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}/heart`), {
    method: "POST",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function removeHeartTrack(trackId: number): Promise<MusicTrackDto> {
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}/heart`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getStoredToken()}` },
  });
  return authJson(res);
}

export async function deleteTrackFromPlaylist(trackId: number): Promise<void> {
  const res = await fetch(apiPath(`/api/music/tracks/${trackId}`), {
    method: "DELETE",
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

export async function createCosUploadTicket(input: {
  audioSha256: string;
  audioExt: string;
  lyricsExt?: string | null;
  coverExt?: string | null;
}): Promise<CosUploadTicketDto> {
  const res = await fetch(apiPath("/api/music/tracks/upload-ticket"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audioSha256: input.audioSha256,
      audioExt: input.audioExt,
      lyricsExt: input.lyricsExt ?? null,
      coverExt: input.coverExt ?? null,
    }),
  });
  return authJson(res);
}

export function uploadObjectToCos(
  ticket: CosUploadTicketDto,
  objectKey: string,
  file: File,
  onProgress?: (percent: number | null) => void
): Promise<void> {
  const useSts = Boolean(ticket.sessionToken && ticket.sessionToken.trim());
  const cos = useSts
    ? new COS({
        getAuthorization: (_, callback) => {
          callback({
            TmpSecretId: ticket.tmpSecretId,
            TmpSecretKey: ticket.tmpSecretKey,
            SecurityToken: ticket.sessionToken,
            StartTime: ticket.startTime,
            ExpiredTime: ticket.expiredTime,
          });
        },
      })
    : new COS({
        SecretId: ticket.tmpSecretId,
        SecretKey: ticket.tmpSecretKey,
      });
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: ticket.bucket,
        Region: ticket.region,
        Key: objectKey,
        Body: file,
        onProgress: (p: { percent?: number }) => {
          if (!onProgress) return;
          const v = typeof p.percent === "number" ? Math.round(p.percent * 100) : null;
          onProgress(v);
        },
      },
      (err) => {
        if (err) {
          reject(new Error(err.message || "COS 上传失败"));
          return;
        }
        resolve();
      }
    );
  });
}

export async function createTrackFromCos(input: {
  playlistId?: number;
  audioSha256: string;
  audioExt: string;
  title?: string;
  artist?: string;
  album?: string;
  note?: string;
  durationSeconds?: number;
  originalFilename?: string;
  metadataFromFile?: boolean;
  fileSize: number;
  mimeType?: string;
  audioObjectKey: string;
  lyricsObjectKey?: string | null;
  coverObjectKey?: string | null;
}): Promise<MusicTrackDto> {
  const res = await fetch(apiPath("/api/music/tracks/from-cos"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playlistId: input.playlistId,
      audioSha256: input.audioSha256,
      audioExt: input.audioExt,
      title: input.title,
      artist: input.artist,
      album: input.album,
      note: input.note,
      durationSeconds: input.durationSeconds ?? 0,
      originalFilename: input.originalFilename ?? null,
      metadataFromFile: input.metadataFromFile === true,
      fileSize: input.fileSize,
      mimeType: input.mimeType ?? null,
      audioObjectKey: input.audioObjectKey,
      lyricsObjectKey: input.lyricsObjectKey ?? null,
      coverObjectKey: input.coverObjectKey ?? null,
    }),
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

