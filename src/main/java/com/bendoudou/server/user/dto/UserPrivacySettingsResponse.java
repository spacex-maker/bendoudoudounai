package com.bendoudou.server.user.dto;

public record UserPrivacySettingsResponse(
        boolean recordLoginActivity,
        boolean recordPlayActivity,
        boolean publicBeanLevel,
        boolean publicLastOnline,
        boolean allowPlaylistInvite
) {
}
