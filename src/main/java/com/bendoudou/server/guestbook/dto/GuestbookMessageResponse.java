package com.bendoudou.server.guestbook.dto;

import java.util.List;

public record GuestbookMessageResponse(
        long id,
        String nickname,
        String content,
        Long parentId,
        long createdAtMillis,
        /** 为 null 表示公开；非 null 时仅该用户可看到此条在列表中（登录态） */
        Long visibleToUserId,
        /** 定向时展示用，如显示名或邮箱；公开时为 null */
        String targetDisplayName,
        List<GuestbookMessageResponse> replies
) {
    public static GuestbookMessageResponse flat(
            long id,
            String nickname,
            String content,
            Long parentId,
            long createdAtMillis,
            Long visibleToUserId,
            String targetDisplayName
    ) {
        return new GuestbookMessageResponse(
                id, nickname, content, parentId, createdAtMillis, visibleToUserId, targetDisplayName, List.of()
        );
    }
}
