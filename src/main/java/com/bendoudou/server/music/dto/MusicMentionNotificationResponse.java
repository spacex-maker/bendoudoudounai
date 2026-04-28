package com.bendoudou.server.music.dto;

public record MusicMentionNotificationResponse(
        long id,
        long playlistId,
        long trackId,
        String trackTitle,
        long commentId,
        long actorUserId,
        String actorLabel,
        String contentPreview,
        boolean read,
        long createdAtMillis
) {}
