package com.bendoudou.server.music.dto;

import java.util.List;

public record MusicTrackCommentResponse(
        long id,
        long trackId,
        Long parentId,
        long authorUserId,
        String authorLabel,
        boolean authorHasAvatar,
        String content,
        long likeCount,
        long replyCount,
        boolean likedByMe,
        long createdAtMillis,
        long updatedAtMillis,
        List<MusicTrackCommentResponse> replies
) {}
