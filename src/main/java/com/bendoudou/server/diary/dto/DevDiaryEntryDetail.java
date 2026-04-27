package com.bendoudou.server.diary.dto;

public record DevDiaryEntryDetail(
        long id,
        String title,
        String bodyMd,
        long authorUserId,
        String authorLabel,
        long createdAtMillis,
        long updatedAtMillis
) {}
