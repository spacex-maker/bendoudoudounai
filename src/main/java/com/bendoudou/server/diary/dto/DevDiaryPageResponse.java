package com.bendoudou.server.diary.dto;

import java.util.List;

public record DevDiaryPageResponse(
        List<DevDiaryEntryListItem> content,
        long totalElements,
        int totalPages,
        int number,
        int size
) {}
