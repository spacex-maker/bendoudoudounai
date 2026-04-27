/** 表头「操作」列：横向滚动时贴滚动容器右缘，纵向与表头同步置顶 */
export const adminTableActionTh =
  "sticky right-0 top-0 z-[38] whitespace-nowrap border-l border-zinc-700/70 bg-zinc-900/95 py-2.5 pl-3 pr-3 text-right shadow-[-8px_0_18px_-6px_rgba(0,0,0,0.55)] backdrop-blur sm:pl-4 sm:pr-4";

/** 表体「操作」列：同上；依赖 tr.group 以实现悬停背景 */
export const adminTableActionTd =
  "sticky right-0 z-[28] border-l border-zinc-700/50 bg-zinc-900/50 py-2.5 pl-2 pr-2 align-middle shadow-[-8px_0_18px_-6px_rgba(0,0,0,0.5)] sm:pl-3 sm:pr-3 group-hover:bg-zinc-800/40";

/** 心愿单表体：背景与页面一致 */
export const adminTableActionTdWishlist =
  "sticky right-0 z-[28] border-l border-zinc-700/50 bg-zinc-950 py-2.5 pl-2 pr-2 align-top text-right shadow-[-8px_0_18px_-6px_rgba(0,0,0,0.5)] group-hover:bg-zinc-900/80";

/** 心愿单表头操作列 */
export const adminTableActionThWishlist =
  "sticky right-0 top-0 z-[38] w-24 border-l border-zinc-700/70 bg-zinc-950 py-2 pl-2 text-right shadow-[-8px_0_18px_-6px_rgba(0,0,0,0.55)]";
