import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { fetchDevDiaryEntry, patchDevDiaryEntry, postDevDiaryEntry } from "../../api/client";
import { SiteHeader } from "../../components/SiteHeader";
import { mapApiError } from "../../i18n/mapApiError";

type Props = { mode: "new" | "edit" };

export function DevDiaryEditorPage({ mode }: Props) {
  const { t } = useTranslation();
  const { id: idParam } = useParams();
  const nav = useNavigate();
  const entryId = mode === "edit" && idParam ? Number(idParam) : null;

  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (entryId == null || !Number.isFinite(entryId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await fetchDevDiaryEntry(entryId);
      setTitle(d.title);
      setBodyMd(d.bodyMd || "");
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setLoading(false);
    }
  }, [entryId, t]);

  useEffect(() => {
    if (mode === "edit") void load();
  }, [mode, load]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErr(t("devDiary.titleRequired"));
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (mode === "new") {
        const d = await postDevDiaryEntry({ title: title.trim(), bodyMd: bodyMd.trim() });
        nav(`/dev-diary/entry/${d.id}`, { replace: true });
      } else if (entryId != null) {
        await patchDevDiaryEntry(entryId, { title: title.trim(), bodyMd: bodyMd });
        nav(`/dev-diary/entry/${entryId}`, { replace: true });
      }
    } catch (e) {
      setErr(mapApiError(t, e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-romantic-mesh pt-24 text-center text-stone-500">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-romantic-mesh text-warm-600">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:pt-28 sm:px-6">
        <h1 className="font-display text-xl sm:text-2xl text-warm-600">
          {mode === "new" ? t("devDiary.writeNew") : t("devDiary.editEntry")}
        </h1>
        {err ? <p className="mt-2 text-sm text-rose-600">{err}</p> : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-stone-500">{t("devDiary.fieldTitle")}</label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErr(null);
              }}
              className="w-full rounded-2xl border border-white/50 bg-white/70 px-4 py-2.5 text-sm outline-none ring-rose-400/30 focus:ring-2"
              maxLength={200}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">{t("devDiary.fieldBody")}</label>
            <textarea
              value={bodyMd}
              onChange={(e) => {
                setBodyMd(e.target.value);
                setErr(null);
              }}
              rows={18}
              className="w-full rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm font-mono leading-relaxed outline-none focus:ring-2 focus:ring-rose-400/30"
              placeholder={t("devDiary.bodyPlaceholder")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-rose-500 px-6 py-2.5 text-sm font-medium text-white shadow transition hover:bg-rose-600 disabled:opacity-50"
            >
              {saving ? t("devDiary.saving") : t("devDiary.save")}
            </button>
            <Link
              to={mode === "edit" && entryId != null ? `/dev-diary/entry/${entryId}` : "/dev-diary"}
              className="text-sm text-stone-500 hover:text-rose-600"
            >
              {t("common.cancel")}
            </Link>
          </div>
        </form>
        <Link to="/dev-diary" className="mt-10 inline-flex items-center gap-1.5 text-sm text-stone-500">
          <ChevronLeft className="h-4 w-4" />
          {t("devDiary.backList")}
        </Link>
      </main>
    </div>
  );
}
