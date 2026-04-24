package com.bendoudou.server.music.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * {@code wallpaperUrl} 为 null 或空白表示清除歌单背景。
 */
public record UpdatePlaylistWallpaperRequest(
        @JsonProperty("wallpaperUrl")
        String wallpaperUrl
) {}
