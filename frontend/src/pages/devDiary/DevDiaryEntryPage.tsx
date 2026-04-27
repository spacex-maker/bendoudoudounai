import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, ChevronLeft, Trash2 } from "lucide-react";
import { fetchDevDiaryEntry, deleteDevDiaryEntry, userCanManageDevDiary, type DevDiaryEntryDetailDto } from "../../api/client";
import { useAuth, useAuthedUser } from "../../auth/AuthContext";
import { SiteHeader } from "../../components/SiteHeader";
import { useDateLocale } from "../../i18n/useDateLocale";
import { mapApiError } from "../../i18n/mapApiError";
import { ConfirmModal } from "../../components/ConfirmModal";

function renderMdSimple(src: string) {
  const lines = src.split("\n");
  return lines.map((line, i) => {
    if (!line.trim()) return <p key={i} className="h-2" />;
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="mb-2 mt-4 text-lg font-semibold text-warm-600">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="mb-3 text-xl font-bold text-warm-600">
          {line.slice(2)}
        </h1>
      );
    }
    return (
      <p key={i} className="mb-2 text-sm leading-relaxed text-stone-700/95 whitespace-pre-wrap">
        {line}
      </p>
    );
  });
}

export function DevDiaryEntryPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useAuth();
  const user = useAuthedUser();
  const dateLoc = useDateLocale();
  const canManage = state.status === "authed" && userCanManageDevDiary(user);
  const [data, setData] = useState<DevDiaryEntryDetailDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [delOpen, setDelOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    const n = Number(id);
    if (!Number.isFinite(n)) {
      setErr("invalid");
      setLoading(false);
      return;
    }
    void fetchDevDiaryEntry(n)
      .then(setData)
      .catch((e) => setErr(mapApiError(t, e)))
      .finally(() => setLoading(false));
  }, [id, t]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-romantic-mesh pt-24 text-center text-stone-500">
        {t("common.loading")}
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="min-h-dvh bg-romantic-mesh px-4 pt-24 text-center text-rose-600">
        {err || t("devDiary.notFound")}
        <br />
        <Link to="/dev-diary" className="mt-3 inline-block text-sm text-rose-500 underline">
          {t("devDiary.backList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-romantic-mesh text-warm-600">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:pt-28 sm:px-6">
        {canManage ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Link
              to={`/dev-diary/entry/${data.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/50 bg-white/60 px-3 py-1.5 text-xs font-medium text-rose-800 transition hover:bg-white"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("devDiary.edit")}
            </Link>
            <button
              type="button"
              onClick={() => setDelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200/50 bg-red-50/50 px-3 py-1.5 text-xs text-red-800 transition hover:bg-red-100/80"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("devDiary.delete")}
            </button>
          </div>
        ) : null}

        <h1 className="font-display text-2xl sm:text-3xl text-warm-600">{data.title}</h1>
        <p className="mt-2 text-xs text-stone-500">
          {data.authorLabel} ·{" "}
          {new Date(data.createdAtMillis).toLocaleString(dateLoc, { dateStyle: "long", timeStyle: "short" })}
          {data.updatedAtMillis !== data.createdAtMillis
            ? ` · ${t("devDiary.updated", {
                time: new Date(data.updatedAtMillis).toLocaleString(dateLoc, { timeStyle: "short" }),
              })}`
            : null}
        </p>

        <article className="prose-article mt-8 max-w-none rounded-2xl border border-white/40 bg-white/50 p-4 sm:p-6">
          {data.bodyMd ? renderMdSimple(data.bodyMd) : <p className="text-stone-500">{t("devDiary.emptyBody")}</p>}
        </article>

        <Link
          to="/dev-diary"
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-rose-600"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("devDiary.backList")}
        </Link>
      </main>

      <ConfirmModal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title={t("devDiary.deleteTitle")}
        confirmLabel={t("devDiary.deleteConfirm")}
        cancelLabel={t("common.cancel")}
        danger
        onConfirm={async () => {
          try {
            await deleteDevDiaryEntry(data.id);
            nav("/dev-diary", { replace: true });
          } catch (e) {
            alert(mapApiError(t, e));
            throw e;
          }
        }}
      >
        <p className="text-sm text-zinc-300">{t("devDiary.deleteHint")}</p>
      </ConfirmModal>
    </div>
  );
}
