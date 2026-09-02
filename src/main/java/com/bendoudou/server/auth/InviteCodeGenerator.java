package com.bendoudou.server.auth;

import java.security.SecureRandom;

/** 用户邀请码：随机大写字母（不含数字）。 */
public final class InviteCodeGenerator {
    private static final char[] LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int LENGTH = 8;

    private InviteCodeGenerator() {}

    public static String generate() {
        char[] out = new char[LENGTH];
        for (int i = 0; i < LENGTH; i++) {
            out[i] = LETTERS[RANDOM.nextInt(LETTERS.length)];
        }
        return new String(out);
    }

    public static String normalize(String raw) {
        if (raw == null) return "";
        return raw.trim().replace("-", "").replace(" ", "").toUpperCase();
    }
}
