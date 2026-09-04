package com.bendoudou.server.activity;

/**
 * 用户行为埋点类型（字符串入库，便于扩展；后台可按 action 筛选）。
 */
public final class UserActivityActions {

    private UserActivityActions() {
    }

    /** 发现音乐搜索 */
    public static final String SEARCH_DISCOVER = "SEARCH_DISCOVER";
    /** 歌单/曲库本地筛选 */
    public static final String SEARCH_LIBRARY = "SEARCH_LIBRARY";
    /** 开始播放曲目 */
    public static final String PLAY_TRACK = "PLAY_TRACK";
    /** 网易云导入 */
    public static final String IMPORT_NETEASE = "IMPORT_NETEASE";
    /** 红心 */
    public static final String HEART_TRACK = "HEART_TRACK";
    /** 取消红心 */
    public static final String UNHEART_TRACK = "UNHEART_TRACK";
    /** 加入歌单 */
    public static final String ADD_TO_PLAYLIST = "ADD_TO_PLAYLIST";
}
