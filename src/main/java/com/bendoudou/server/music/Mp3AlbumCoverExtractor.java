package com.bendoudou.server.music;

import com.mpatric.mp3agic.ID3v2;
import com.mpatric.mp3agic.Mp3File;

import java.nio.file.Path;

/**
 * 读取 MP3 ID3v2 内嵌封面（APIC），与系统播放器看到的为同一来源。
 */
public final class Mp3AlbumCoverExtractor {

    public record Cover(byte[] data, String mimeType) {
    }

    private Mp3AlbumCoverExtractor() {
    }

    public static Cover tryExtract(Path mp3Path) {
        try {
            Mp3File mp3 = new Mp3File(mp3Path);
            if (!mp3.hasId3v2Tag()) {
                return null;
            }
            ID3v2 tag = mp3.getId3v2Tag();
            byte[] data = tag.getAlbumImage();
            if (data == null || data.length == 0) {
                return null;
            }
            String mime = tag.getAlbumImageMimeType();
            if (mime == null || mime.isBlank()) {
                mime = "image/jpeg";
            }
            return new Cover(data, mime.trim());
        } catch (Throwable ignored) {
            return null;
        }
    }
}
