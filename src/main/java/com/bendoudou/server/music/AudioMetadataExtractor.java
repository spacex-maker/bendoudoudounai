package com.bendoudou.server.music;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Path;

/**
 * 从文件解析内嵌元数据。MP3 经 {@link Mp3agicExtractSupport} 反射调用 mp3agic，避免无 JAR 时拖入文件即 500。
 */
@Component
public class AudioMetadataExtractor {

    public ExtractionResult extractFromFile(Path file, String originalFilename) {
        if (!"mp3".equalsIgnoreCase(extensionOf(originalFilename))) {
            return ExtractionResult.fallback(filenameWithoutExt(originalFilename));
        }
        ExtractionResult fromLib = Mp3agicExtractSupport.tryExtract(file, originalFilename);
        if (fromLib != null) {
            return fromLib;
        }
        return ExtractionResult.fallback(filenameWithoutExt(originalFilename));
    }

    public static String extensionOf(String name) {
        if (name == null || !name.contains(".")) {
            return "";
        }
        return name.substring(name.lastIndexOf('.') + 1);
    }

    public static String filenameWithoutExt(String name) {
        if (name == null) {
            return "未命名";
        }
        int i = name.lastIndexOf('.');
        String base = i > 0 ? name.substring(0, i) : name;
        return StringUtils.hasText(base) ? base : "未命名";
    }

    public record ExtractionResult(
            String title,
            String artist,
            String album,
            int durationSeconds,
            /**
             * 内嵌信息或从 MP3 解析到时长
             */
            boolean embeddedOrParsed
    ) {
        public static ExtractionResult fallback(String title) {
            String t = StringUtils.hasText(title) ? title : "未命名";
            return new ExtractionResult(t, "未知歌手", "未知专辑", 0, false);
        }
    }
}
