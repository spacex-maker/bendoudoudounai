package com.bendoudou.server.music.dto;

import java.util.List;

public record DiscoverSearchPageResponse(
        List<DiscoverSearchItemResponse> items,
        int offset,
        int limit,
        int total,
        boolean hasMore
) {}
