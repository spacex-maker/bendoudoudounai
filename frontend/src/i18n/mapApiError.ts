import type { TFunction } from "i18next";
import axios from "axios";
import { ApiHttpError, I18N_LOAD_FAILED } from "../api/client";

function axiosStatus(e: unknown): number | undefined {
  if (axios.isAxiosError(e)) return e.response?.status;
  return undefined;
}

function axiosMessage(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined;
  const data = e.response?.data;
  if (data && typeof data === "object") {
    const msg = (data as { message?: unknown; detail?: unknown }).message
      ?? (data as { detail?: unknown }).detail;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return undefined;
}

/** 将 API / 网络错误映射为当前语言的提示（含 401/429、占位加载失败、服务端 message） */
export function mapApiError(t: TFunction, e: unknown): string {
  const status = e instanceof ApiHttpError ? e.status : axiosStatus(e);
  if (status === 429) return t("errors.tooFrequent");
  if (status === 401) return t("errors.sessionExpired");
  if (e instanceof ApiHttpError) {
    if (e.message) return e.message;
  }
  const fromAxios = axiosMessage(e);
  if (fromAxios) return fromAxios;
  if (e instanceof Error) {
    if (e.message === I18N_LOAD_FAILED) return t("errors.loadFailed");
    return e.message;
  }
  return t("errors.unknown");
}
