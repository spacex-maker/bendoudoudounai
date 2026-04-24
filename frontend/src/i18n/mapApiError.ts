import type { TFunction } from "i18next";
import { ApiHttpError, I18N_LOAD_FAILED } from "../api/client";

/** 将 API / 网络错误映射为当前语言的提示（含 401/429、占位加载失败、服务端 message） */
export function mapApiError(t: TFunction, e: unknown): string {
  if (e instanceof ApiHttpError) {
    if (e.status === 429) return t("errors.tooFrequent");
    if (e.status === 401) return t("errors.sessionExpired");
  }
  if (e instanceof Error) {
    if (e.message === I18N_LOAD_FAILED) return t("errors.loadFailed");
    return e.message;
  }
  return t("errors.unknown");
}
