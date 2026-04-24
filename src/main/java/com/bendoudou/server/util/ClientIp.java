package com.bendoudou.server.util;

import jakarta.servlet.http.HttpServletRequest;

import java.util.regex.Pattern;

public final class ClientIp {

    private static final Pattern IP_SPLIT = Pattern.compile("[,;\\s]+");

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = IP_SPLIT.split(xff.trim())[0];
            if (!first.isEmpty()) {
                return first;
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
