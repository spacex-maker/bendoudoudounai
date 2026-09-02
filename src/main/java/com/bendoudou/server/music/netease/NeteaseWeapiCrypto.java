package com.bendoudou.server.music.netease;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 网易云 weapi 参数加密（与 NeteaseCloudMusicApi / 网页端 asrsea 一致）。
 */
public final class NeteaseWeapiCrypto {

    private static final String IV = "0102030405060708";
    /** weapi 第一层 AES 固定密钥（注意：不是 eapi 的 e82ckenh8dichen8） */
    private static final String PRESET_KEY = "0CoJUm6Qyw8W8jud";
    private static final String MODULUS_HEX =
            "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725"
                    + "152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312"
                    + "ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424"
                    + "d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
    private static final BigInteger MODULUS = new BigInteger(MODULUS_HEX, 16);
    private static final BigInteger EXPONENT = new BigInteger("010001", 16);
    private static final String RANDOM_CHARS =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private NeteaseWeapiCrypto() {
    }

    public static Map<String, String> encrypt(String plainText) {
        String secretKey = randomString(16);
        String params = aesEncrypt(plainText, PRESET_KEY);
        params = aesEncrypt(params, secretKey);
        String encSecKey = rsaEncrypt(secretKey);
        return Map.of("params", params, "encSecKey", encSecKey);
    }

    private static String aesEncrypt(String text, String key) {
        try {
            SecretKeySpec keySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
            IvParameterSpec ivSpec = new IvParameterSpec(IV.getBytes(StandardCharsets.UTF_8));
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
            return Base64.getEncoder().encodeToString(
                    cipher.doFinal(text.getBytes(StandardCharsets.UTF_8))
            );
        } catch (Exception e) {
            throw new IllegalStateException("AES encrypt failed", e);
        }
    }

    /**
     * 网易云 weapi 的 RSA 为无 padding 的 textbook RSA：
     * reverse(secret) → 按字节转大整数 → pow(m, e, n) → 左侧补零到 256 位 hex。
     */
    private static String rsaEncrypt(String text) {
        try {
            String reversed = new StringBuilder(text).reverse().toString();
            byte[] raw = reversed.getBytes(StandardCharsets.UTF_8);
            BigInteger message = new BigInteger(1, raw);
            BigInteger encrypted = message.modPow(EXPONENT, MODULUS);
            String hex = encrypted.toString(16);
            if (hex.length() >= 256) {
                return hex;
            }
            return "0".repeat(256 - hex.length()) + hex;
        } catch (Exception e) {
            throw new IllegalStateException("RSA encrypt failed", e);
        }
    }

    private static String randomString(int len) {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(RANDOM_CHARS.charAt(r.nextInt(RANDOM_CHARS.length())));
        }
        return sb.toString();
    }
}
