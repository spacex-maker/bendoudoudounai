package com.bendoudou.server.guestbook.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateGuestbookMessageRequest(
        @Size(max = 32) String nickname,
        @NotBlank @Size(max = 2000) String content,
        /** 回复某主楼时填写主楼 id；新发主楼为 null */
        Long parentId,
        /**
         * 仅某站内用户可见；为 null 表示全员。非 null 时须已登录，且会校验用户存在。回复时由后端继承主楼，忽略此字段。
         */
        Long visibleToUserId
) {}
