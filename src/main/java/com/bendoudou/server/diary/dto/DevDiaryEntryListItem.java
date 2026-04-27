package com.bendoudou.server.diary.dto;

public record DevDiaryEntryListItem(
        long id,
        String title,
        long authorUserId,
        String authorLabel,
        long createdAtMillis
) {}
