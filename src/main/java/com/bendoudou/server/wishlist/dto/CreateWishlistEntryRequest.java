package com.bendoudou.server.wishlist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWishlistEntryRequest(
        /** 选填，展示名 */
        @Size(max = 32) String nickname,
        @NotBlank @Size(max = 500) String content
) {}
