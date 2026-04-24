package com.bendoudou.server.music;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * 配置与 URL 拼接。实际上传在 {@link CosV5UploadHelper}，其类在首次上传时才会加载 COS SDK，避免无 SDK 时 Spring 仍无法启动。
 */
@Service
public class CosStorageService {

    private static final Map<String, String> EXT_TO_AUDIO_TYPE = new HashMap<>();

    static {
        EXT_TO_AUDIO_TYPE.put("mp3", "audio/mpeg");
        EXT_TO_AUDIO_TYPE.put("m4a", "audio/mp4");
        EXT_TO_AUDIO_TYPE.put("aac", "audio/mp4");
        EXT_TO_AUDIO_TYPE.put("flac", "audio/flac");
        EXT_TO_AUDIO_TYPE.put("wav", "audio/wav");
        EXT_TO_AUDIO_TYPE.put("ogg", "audio/ogg");
        EXT_TO_AUDIO_TYPE.put("rc", "application/octet-stream");
    }

    private final CosProperties props;

    public CosStorageService(CosProperties props) {
        this.props = props;
    }

    public boolean isUsable() {
        return props.isEnabled()
                && StringUtils.hasText(props.getSecretId())
                && StringUtils.hasText(props.getSecretKey())
                && StringUtils.hasText(props.getBucket())
                && StringUtils.hasText(props.getRegion());
    }

    public String buildAudioObjectKey(String sha256Hex, String ext) {
        String p = props.getPathPrefix() == null ? "" : props.getPathPrefix();
        if (!p.isEmpty() && !p.endsWith("/")) {
            p = p + "/";
        }
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        String e = ext.startsWith(".") ? ext.substring(1) : ext;
        return p + "songs/" + sha256Hex.substring(0, 2) + "/" + sha256Hex + "." + e;
    }

    public String publicObjectUrl(String objectKey) {
        if (objectKey == null) {
            return null;
        }
        String b = props.getBucket();
        String r = props.getRegion();
        return "https://" + b + ".cos." + r + ".myqcloud.com/" + objectKey;
    }

    public String buildLyricsObjectKey(String songContentSha256Hex, String extWithoutDot) {
        String p = props.getPathPrefix() == null ? "" : props.getPathPrefix();
        if (!p.isEmpty() && !p.endsWith("/")) {
            p = p + "/";
        }
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        String e = extWithoutDot;
        if (e != null && e.startsWith(".")) {
            e = e.substring(1);
        }
        if (e == null || e.isEmpty()) {
            e = "lrc";
        }
        return p + "lyrics/" + songContentSha256Hex.substring(0, 2) + "/"
                + songContentSha256Hex + "." + e.toLowerCase();
    }

    /**
     * 封面与音频同 file_sha256，便于去重复用：covers/{sha[0:2]}/{sha}.{ext}
     */
    public String buildCoverObjectKey(String songContentSha256Hex, String extWithoutDot) {
        String p = props.getPathPrefix() == null ? "" : props.getPathPrefix();
        if (!p.isEmpty() && !p.endsWith("/")) {
            p = p + "/";
        }
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        String e = extWithoutDot;
        if (e != null && e.startsWith(".")) {
            e = e.substring(1);
        }
        if (e == null || e.isEmpty()) {
            e = "jpg";
        }
        return p + "covers/" + songContentSha256Hex.substring(0, 2) + "/"
                + songContentSha256Hex + "." + e.toLowerCase();
    }

    /** 每歌单一张壁纸，路径固定便于覆盖更新 */
    public String buildPlaylistWallpaperObjectKey(long playlistId, String extWithoutDot) {
        String p = props.getPathPrefix() == null ? "" : props.getPathPrefix();
        if (!p.isEmpty() && !p.endsWith("/")) {
            p = p + "/";
        }
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        String e = extWithoutDot;
        if (e != null && e.startsWith(".")) {
            e = e.substring(1);
        }
        if (e == null || e.isEmpty()) {
            e = "jpg";
        }
        return p + "playlist-wallpapers/" + playlistId + "." + e.toLowerCase();
    }

    public void uploadObject(String objectKey, Path file, long contentLength, String contentType) throws IOException {
        if (!isUsable()) {
            throw new IllegalStateException("COS 未正确配置，无法上传");
        }
        String ct = StringUtils.hasText(contentType) ? contentType : "application/octet-stream";
        try {
            CosV5UploadHelper.putObject(
                    props.getSecretId(),
                    props.getSecretKey(),
                    props.getRegion(),
                    props.getBucket(),
                    objectKey,
                    file,
                    contentLength,
                    ct
            );
        } catch (NoClassDefFoundError e) {
            throw new IllegalStateException("未找到腾讯云 COS 依赖，请在 pom 中增加 com.qcloud:cos_api 并执行 Maven Reimport 后重试", e);
        } catch (Throwable t) {
            if (t instanceof IOException) {
                throw (IOException) t;
            }
            if (t instanceof Error) {
                throw t;
            }
            throw new IOException("COS 上传失败: " + t.getMessage(), t);
        }
    }

    public static String guessLyricsContentType(String extWithoutDot) {
        if (extWithoutDot == null) {
            return "text/plain; charset=utf-8";
        }
        String e = extWithoutDot.startsWith(".") ? extWithoutDot.substring(1) : extWithoutDot;
        e = e.toLowerCase();
        if ("lrc".equals(e) || "txt".equals(e) || "krc".equals(e) || "srt".equals(e)) {
            return "text/plain; charset=utf-8";
        }
        return "application/octet-stream";
    }

    public static String guessAudioContentType(String ext, String fromUpload) {
        if (StringUtils.hasText(fromUpload) && !fromUpload.contains("application/octet-stream")) {
            return fromUpload;
        }
        String e = (ext == null ? "" : ext).toLowerCase();
        if (e.startsWith(".")) {
            e = e.substring(1);
        }
        return EXT_TO_AUDIO_TYPE.getOrDefault(e, "application/octet-stream");
    }
}
