package com.bendoudou.server.moments.dto;

/**
 * playlistId 为 null 时取消片刻精选。
 */
public record SetMomentsFeaturedPlaylistRequest(Long playlistId) {}
