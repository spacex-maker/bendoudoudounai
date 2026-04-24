package com.bendoudou.server.wishlist.dto;

public record WishlistEntryResponse(
        long id,
        /** 为 null 时前端显示「匿名」 */
        String nickname,
        String content,
        long createdAtMillis
) {}
