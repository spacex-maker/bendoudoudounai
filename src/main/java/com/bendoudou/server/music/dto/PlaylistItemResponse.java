package com.bendoudou.server.music.dto;

public record PlaylistItemResponse(
        long id,
        String name,
        long ownerId,
        String ownerLabel,
        boolean iAmOwner,
        String myRole,
        long trackCount,
        /** 除自己外是否还有成员（被共享过） */
        boolean shared,
        /**
         * 歌单背景：https 外链或 COS 直链；仅服务端存文件时为 /api/music/playlists/{id}/wallpaper
         */
        String wallpaperUrl,
        /** 歌单内所有曲目 playCount 之和 */
        long totalPlayCount,
        long memberCount,
        long createdAtMillis,
        /** 歌单为当日创建，或当前用户为当日新加入该歌单（以 Asia/Shanghai 日切计） */
        boolean newForToday
) {}
