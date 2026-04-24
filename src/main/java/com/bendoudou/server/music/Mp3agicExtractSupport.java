package com.bendoudou.server.music;

import org.springframework.util.StringUtils;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.file.Path;

/**
 * 通过反射使用 mp3agic，避免在 Spring Bean 中直接 import {@code com.mpatric}：
 * 若运行类路径未加入 mp3agic，懒加载时回落为「仅文件名」而非整请求失败；若 JAR 存在则正常读标签与时长。
 */
public final class Mp3agicExtractSupport {

    private static final String MP3FILE = "com.mpatric.mp3agic.Mp3File";

    private Mp3agicExtractSupport() {
    }

    public static boolean mp3agicPresent() {
        try {
            Class.forName(MP3FILE, false, Thread.currentThread().getContextClassLoader());
            return true;
        } catch (ClassNotFoundException | NoClassDefFoundError e) {
            return false;
        }
    }

    /**
     * 解析成功返回结果；JAR 缺失或异常时返回 null，由调用方做 fallback。
     */
    public static AudioMetadataExtractor.ExtractionResult tryExtract(Path file, String originalFilename) {
        if (!mp3agicPresent()) {
            return null;
        }
        try {
            ClassLoader cl = Thread.currentThread().getContextClassLoader();
            Class<?> mp3FileClass = Class.forName(MP3FILE, true, cl);
            Constructor<?> ctor = mp3FileClass.getConstructor(String.class);
            Object mp3 = ctor.newInstance(file.toString());

            int duration = 0;
            Method getLen = mp3FileClass.getMethod("getLengthInSeconds");
            Object lenVal = getLen.invoke(mp3);
            if (lenVal instanceof Number n) {
                long s = n.longValue();
                if (s > 0) {
                    duration = (int) Math.min(86400, s);
                }
            }

            String title = null;
            String artist = null;
            String album = null;
            Method hasV2 = mp3FileClass.getMethod("hasId3v2Tag");
            if (Boolean.TRUE.equals(hasV2.invoke(mp3))) {
                Object tag = mp3FileClass.getMethod("getId3v2Tag").invoke(mp3);
                if (tag != null) {
                    title = firstNonBlank(getters(tag, "getTitle"));
                    artist = firstNonBlank(getters(tag, "getArtist"));
                    album = firstNonBlank(getters(tag, "getAlbum"));
                }
            } else {
                Method hasV1 = mp3FileClass.getMethod("hasId3v1Tag");
                if (Boolean.TRUE.equals(hasV1.invoke(mp3))) {
                    Object tag = mp3FileClass.getMethod("getId3v1Tag").invoke(mp3);
                    if (tag != null) {
                        title = firstNonBlank(getters(tag, "getTitle"));
                        artist = firstNonBlank(getters(tag, "getArtist"));
                        album = firstNonBlank(getters(tag, "getAlbum"));
                    }
                }
            }
            boolean embedded = StringUtils.hasText(title) || StringUtils.hasText(artist) || StringUtils.hasText(album) || duration > 0;
            if (!StringUtils.hasText(title)) {
                title = AudioMetadataExtractor.filenameWithoutExt(originalFilename);
            }
            if (!StringUtils.hasText(artist)) {
                artist = "未知歌手";
            }
            if (!StringUtils.hasText(album)) {
                album = "未知专辑";
            }
            return new AudioMetadataExtractor.ExtractionResult(
                    title,
                    artist,
                    album,
                    duration,
                    embedded
            );
        } catch (ClassNotFoundException | NoClassDefFoundError t) {
            return null;
        } catch (Throwable t) {
            return null;
        }
    }

    private static String getters(Object tag, String name) throws Exception {
        Method m = tag.getClass().getMethod(name);
        Object v = m.invoke(tag);
        return v == null ? null : String.valueOf(v);
    }

    private static String firstNonBlank(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return s.trim();
    }
}
