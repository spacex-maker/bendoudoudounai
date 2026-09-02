package com.bendoudou.server.user.dto;

import java.util.List;

public record MyInvitesResponse(
        long totalCount,
        long unusedCount,
        List<InviteCodeItemResponse> codes,
        List<InviteCodeItemResponse> records
) {}
