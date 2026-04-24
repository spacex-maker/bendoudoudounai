import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";

const STORAGE_KEY = "bendoudou_locale";

function getInitial(): string {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "zh" || s === "ja") return s;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ja")) {
    return "ja";
  }
  return "zh";
}

function setDocumentLang(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng === "ja" ? "ja" : "zh-CN";
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: getInitial(),
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

setDocumentLang(i18n.language);
i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
  setDocumentLang(lng);
});

export default i18n;
