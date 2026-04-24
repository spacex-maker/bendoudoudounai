package com.bendoudou.server.music.dto;

public record InvitationItemResponse(
        long id,
        long playlistId,
        String playlistName,
        long inviterId,
        String inviterLabel,
        long inviteeId,
        String inviteeLabel,
        String status,
        long createdAtMillis
) {}
