package com.bendoudou.server.auth.registration.dto;

/** 按邮箱查询最近一次注册申请状态（公开接口，供登录页展示） */
public record RegisterApplyStatusResponse(
        /** NONE | PENDING | REJECTED | APPROVED | REGISTERED */
        String status,
        String rejectionReason,
        String message
) {}
