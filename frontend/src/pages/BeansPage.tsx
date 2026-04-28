import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Gem, Home, Sparkles, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { fetchMyBeanOverview, fetchMyBeanTransactions, type BeanTransactionDto } from "../api/client";
import { SiteHeader } from "../components/SiteHeader";
import { usePageAppearance } from "../pageAppearance/PageAppearanceContext";

export function BeansPage() {
  const { wallpaperActive } = usePageAppearance();
  const [balance, setBalance] = useState(0);
  const [levelName, setLevelName] = useState("");
  const [nextMin, setNextMin] = useState<number | null>(null);
  const [rows, setRows] = useState<BeanTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [overview, tx] = await Promise.all([
          fetchMyBeanOverview(),
          fetchMyBeanTransactions(0, 30),
        ]);
        setBalance(overview.balance);
        setLevelName(overview.levelName);
        setNextMin(overview.nextLevelMinBeans);
        setRows(tx.content);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative w-full">
      <SiteHeader />
      <div className={clsx("relative overflow-x-clip overflow-y-clip", wallpaperActive ? "" : "bg-romantic-mesh")}>
        <main className="relative z-10 mx-auto min-h-dvh max-w-4xl px-4 pb-12 pt-28 sm:px-6 sm:pt-32">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-3 py-1 text-xs font-medium text-amber-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    激励体系
                  </p>
                  <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-warm-700">
                    <Coins className="h-6 w-6 text-amber-500" />
                    豆值系统
                  </h1>
                  <p className="mt-2 text-sm text-stone-600">
                    每天使用、听歌互动、留言建单都能成长，等级会展示在头像旁边。
                  </p>
                </div>
                <Link to="/" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warm-300/40 bg-white/70 px-3 py-1 text-sm text-warm-700">
                  <Home className="h-4 w-4" />
                  返回首页
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <section className="rounded-2xl border border-white/45 bg-white/65 p-4 backdrop-blur-sm sm:col-span-2">
                <p className="text-sm text-stone-500">当前豆值</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-amber-600">{balance}</p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-100/70 px-2.5 py-1 text-xs text-violet-700">
                  <Gem className="h-3.5 w-3.5" />
                  当前等级：{levelName || "-"}
                </div>
                {nextMin != null ? (
                  <p className="mt-2 text-xs text-stone-500">下一级需要 {nextMin} 豆</p>
                ) : (
                  <p className="mt-2 text-xs text-emerald-600">已达最高等级</p>
                )}
              </section>
              <section className="rounded-2xl border border-white/45 bg-gradient-to-br from-rose-100/70 to-amber-100/60 p-4 backdrop-blur-sm">
                <p className="text-xs font-medium text-rose-700">成长提示</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-700">
                  保持每日活跃，再配合听歌互动，豆值增长会更快。
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-rose-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  持续活跃更容易升阶
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-white/45 bg-white/65 p-4 backdrop-blur-sm">
              <h2 className="mb-3 font-semibold text-warm-700">规则说明</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "每日活跃（每天一次）：+1",
                  "听一首歌：+1",
                  "给歌曲红心：+1",
                  "发表评论：+2",
                  "留言板留言：+5",
                  "创建歌单：+1",
                ].map((rule) => (
                  <div key={rule} className="rounded-xl border border-rose-100 bg-white/70 px-3 py-2 text-sm text-stone-700">
                    {rule}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-stone-500">以上数值可由管理员在后台调整。</p>
            </section>

            <section className="rounded-2xl border border-white/45 bg-white/65 p-4 backdrop-blur-sm">
              <h2 className="mb-2 font-semibold text-warm-700">最近豆值流水</h2>
              {loading ? <p className="text-sm text-stone-500">加载中...</p> : null}
              {err ? <p className="text-sm text-red-500">{err}</p> : null}
              {!loading && !err ? (
                <div className="space-y-2">
                  {rows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-rose-100 bg-white/70 px-3 py-2 text-sm">
                      <span className="text-stone-700">{row.actionType ?? row.reason}</span>
                      <span className={row.delta >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>
                        {row.delta >= 0 ? `+${row.delta}` : row.delta}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
