package com.bendoudou.server.auth;

import java.security.SecureRandom;

/** 邮箱注册验证码：6 位数字。 */
public final class EmailCodeGenerator {
    private static final SecureRandom RANDOM = new SecureRandom();

    private EmailCodeGenerator() {}

    public static String sixDigits() {
        int n = RANDOM.nextInt(1_000_000);
        return String.format("%06d", n);
    }
}
