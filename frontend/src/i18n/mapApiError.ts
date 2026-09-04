import type { TFunction } from "i18next";
import axios from "axios";
import { ApiHttpError, I18N_LOAD_FAILED } from "../api/client";

function axiosStatus(e: unknown): number | undefined {
  if (axios.isAxiosError(e)) return e.response?.status;
  return undefined;
}

function axiosData(e: unknown): Record<string, unknown> | undefined {
  if (!axios.isAxiosError(e)) return undefined;
  const data = e.response?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return undefined;
}

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** 从 Spring / ProblemDetail / BindingResult 里抽出可读 message */
function axiosMessage(e: unknown): string | undefined {
  const data = axiosData(e);
  if (!data) return undefined;

  const top = pickString(data.message, data.detail, data.error);
  if (top) return top;

  const errors = data.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const parts: string[] = [];
    for (const item of errors) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const msg = pickString(row.defaultMessage, row.detail, row.message);
      const field = typeof row.field === "string" ? row.field : undefined;
      if (msg) parts.push(field ? `${field}: ${msg}` : msg);
    }
    if (parts.length) return parts.join("; ");
  }
  return undefined;
}

function looksTechnical(msg: string): boolean {
  return (
    /Validation failed|Invalid request content|Field error in object|ConstraintViolation|BindingResult|org\.springframework|jakarta\.|Exception:|Request failed with status code/i.test(
      msg
    ) || msg.length > 160
  );
}

/** 将服务端/校验原文映射为用户可读文案；无法识别则返回 null */
function mapKnownMessage(t: TFunction, msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;

  if (/请填写邀请码|invite.?code.*(required|blank)|邀请码.*必填/i.test(m)) {
    return t("auth.inviteRequired");
  }
  if (/该邀请码已被使用|invite.?code.*(already.?)?used|已被使用/i.test(m) && /邀请|invite/i.test(m)) {
    return t("auth.inviteUsed");
  }
  if (
    /邀请码无效|邀请码格式|invite.?code.*(invalid|incorrect|format)|size must be between.*inviteCode|inviteCode:.*(size|Size|NotBlank)/i.test(
      m
    )
  ) {
    return t("auth.inviteInvalid");
  }
  if (/inviteCode/i.test(m) && /size must|NotBlank|must not be blank|required/i.test(m)) {
    return t("auth.inviteInvalid");
  }

  if (/邮箱验证码|验证码.*(错误|无效|过期)|email.?code|verification.?code/i.test(m) && /错误|无效|过期|invalid|expired|wrong/i.test(m)) {
    return t("auth.verifyCodeInvalid", { defaultValue: "验证码不正确或已过期" });
  }

  if (looksTechnical(m)) {
    if (/inviteCode|invite.?code|邀请码/i.test(m)) return t("auth.inviteInvalid");
    return t("auth.genericError");
  }

  return null;
}

/** 将 API / 网络错误映射为当前语言的提示（含 401/429、占位加载失败、服务端 message） */
export function mapApiError(t: TFunction, e: unknown): string {
  const status = e instanceof ApiHttpError ? e.status : axiosStatus(e);
  if (status === 429) return t("errors.tooFrequent");
  if (status === 401) return t("errors.sessionExpired");

  const raw =
    (e instanceof ApiHttpError && e.message ? e.message : undefined) ??
    axiosMessage(e) ??
    (e instanceof Error ? e.message : undefined);

  if (raw) {
    if (raw === I18N_LOAD_FAILED) return t("errors.loadFailed");
    const mapped = mapKnownMessage(t, raw);
    if (mapped) return mapped;
    if (!looksTechnical(raw)) return raw;
  }

  return t("errors.unknown");
}
