import { useTranslation } from "react-i18next";

/** 与当前界面语言一致地格式化日期时间 */
export function useDateLocale() {
  const { i18n } = useTranslation();
  return i18n.language === "ja" ? "ja-JP" : "zh-CN";
}
