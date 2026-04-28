import { useEffect, useState } from "react";
import { ArrowUpDown, CheckCircle2, Coins, XCircle } from "lucide-react";
import clsx from "clsx";
import {
  fetchAdminBeanLevels,
  fetchAdminBeanRules,
  fetchAdminBeanTransactions,
  updateAdminBeanLevels,
  updateAdminBeanRules,
  type BeanLevelDto,
  type BeanRuleDto,
  type BeanTransactionDto,
} from "../api/client";

const ACTION_LABELS: Record<string, string> = {
  DAILY_USAGE: "每日活跃",
  TRACK_PLAY: "听歌",
  TRACK_HEART: "红心",
  TRACK_COMMENT: "评论",
  GUESTBOOK_POST: "留言板",
  PLAYLIST_CREATE: "创建歌单",
};

export function AdminBeanPanel() {
  const [tab, setTab] = useState<"rules" | "levels" | "records">("rules");
  const [rules, setRules] = useState<BeanRuleDto[]>([]);
  const [levels, setLevels] = useState<BeanLevelDto[]>([]);
  const [tx, setTx] = useState<BeanTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [r, l, t] = await Promise.all([
          fetchAdminBeanRules(),
          fetchAdminBeanLevels(),
          fetchAdminBeanTransactions(0, 40),
        ]);
        setRules(r);
        setLevels(l);
        setTx(t.content);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await Promise.all([
        updateAdminBeanRules(rules),
        updateAdminBeanLevels(levels),
      ]);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <Coins className="mr-2 h-5 w-5 animate-pulse" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
        {[
          { key: "rules" as const, label: "规则配置" },
          { key: "levels" as const, label: "等级配置" },
          { key: "records" as const, label: "豆值记录" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm transition",
              tab === item.key
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {tab === "rules" ? (
      <section className="overflow-hidden rounded-lg border border-zinc-800/90 bg-zinc-900/40">
        <div className="border-b border-zinc-800/80 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Coins className="h-4 w-4 text-amber-400" />
            豆值规则配置
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">修改后需点击下方保存按钮生效</p>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="pb-2 pr-3 text-left font-medium text-zinc-400">动作类型</th>
                  <th className="pb-2 px-3 text-left font-medium text-zinc-400">豆值增量</th>
                  <th className="pb-2 pl-3 text-left font-medium text-zinc-400">启用状态</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, idx) => (
                  <tr key={r.actionType} className="border-b border-zinc-800/40 last:border-0">
                    <td className="py-3 pr-3 text-zinc-200">
                      {ACTION_LABELS[r.actionType] || r.actionType}
                      <span className="ml-2 text-xs text-zinc-600">({r.actionType})</span>
                    </td>
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        value={r.beanDelta}
                        onChange={(e) =>
                          setRules((prev) => prev.map((it, i) => (i === idx ? { ...it, beanDelta: Number(e.target.value) } : it)))
                        }
                        className="w-24 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-3 py-1.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                      />
                    </td>
                    <td className="py-3 pl-3">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) =>
                            setRules((prev) => prev.map((it, i) => (i === idx ? { ...it, enabled: e.target.checked } : it)))
                          }
                          className="peer sr-only"
                        />
                        <span className="relative h-6 w-11 rounded-full bg-zinc-700/80 transition peer-checked:bg-emerald-500/80 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/40">
                          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                        </span>
                        <span className={clsx("text-sm", r.enabled ? "text-emerald-400" : "text-zinc-500")}>
                          {r.enabled ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              已启用
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              已禁用
                            </span>
                          )}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      ) : null}

      {tab === "levels" ? (
      <section className="overflow-hidden rounded-lg border border-zinc-800/90 bg-zinc-900/40">
        <div className="border-b border-zinc-800/80 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <ArrowUpDown className="h-4 w-4 text-violet-400" />
            等级配置
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">按最小豆值阈值升序排列，sortOrder 用于同值排序</p>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th className="pb-2 pr-2 text-left font-medium text-zinc-400">等级代码</th>
                  <th className="pb-2 px-2 text-left font-medium text-zinc-400">等级名称</th>
                  <th className="pb-2 px-2 text-left font-medium text-zinc-400">最小豆值</th>
                  <th className="pb-2 pl-2 text-left font-medium text-zinc-400">排序</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((lv, idx) => (
                  <tr key={lv.id ?? idx} className="border-b border-zinc-800/40 last:border-0">
                    <td className="py-3 pr-2">
                      <input
                        value={lv.code}
                        onChange={(e) => setLevels((prev) => prev.map((x, i) => (i === idx ? { ...x, code: e.target.value } : x)))}
                        placeholder="L1"
                        className="w-20 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-2 py-1.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        value={lv.name}
                        onChange={(e) => setLevels((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                        placeholder="Lv.1 新芽豆友"
                        className="w-full max-w-xs rounded-md border border-zinc-700/80 bg-zinc-950/60 px-2 py-1.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        value={lv.minBeans}
                        onChange={(e) => setLevels((prev) => prev.map((x, i) => (i === idx ? { ...x, minBeans: Number(e.target.value) } : x)))}
                        className="w-28 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-2 py-1.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                      />
                    </td>
                    <td className="py-3 pl-2">
                      <input
                        type="number"
                        value={lv.sortOrder}
                        onChange={(e) => setLevels((prev) => prev.map((x, i) => (i === idx ? { ...x, sortOrder: Number(e.target.value) } : x)))}
                        className="w-20 rounded-md border border-zinc-700/80 bg-zinc-950/60 px-2 py-1.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      ) : null}

      {tab !== "records" ? (
      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <Coins className="h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              保存豆值配置
            </>
          )}
        </button>
        {!saving && !err && rules.length > 0 && (
          <span className="text-xs text-zinc-500">修改后需点击保存才会生效</span>
        )}
      </div>
      ) : null}

      {tab === "records" ? (
      <section className="overflow-hidden rounded-lg border border-zinc-800/90 bg-zinc-900/40">
        <div className="border-b border-zinc-800/80 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">最新豆值流水（最近 40 条）</h2>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
              <tr className="border-b border-zinc-800/60">
                <th className="px-4 py-2 text-left font-medium text-zinc-400">ID</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">用户</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">动作类型</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-400">变化量</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-400">关联 ID</th>
              </tr>
            </thead>
            <tbody>
              {tx.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                    暂无流水记录
                  </td>
                </tr>
              ) : (
                tx.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5 text-zinc-400">#{row.id}</td>
                    <td className="px-4 py-2.5 text-zinc-300">
                      <div className="flex flex-col">
                        <span>{row.userLabel || `#${row.userId}`}</span>
                        <span className="text-xs text-zinc-500">UID: {row.userId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-200">
                      {ACTION_LABELS[row.actionType ?? ""] || row.actionType || row.reason}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                          row.delta >= 0
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        )}
                      >
                        {row.delta >= 0 ? `+${row.delta}` : row.delta}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {row.relatedId != null ? `#${row.relatedId}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  );
}
