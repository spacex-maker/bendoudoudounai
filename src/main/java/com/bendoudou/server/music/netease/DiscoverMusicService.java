package com.bendoudou.server.music.netease;

import com.bendoudou.server.music.CosStorageService;
import com.bendoudou.server.music.FileContentHasher;
import com.bendoudou.server.music.MusicService;
import com.bendoudou.server.music.MusicTrack;
import com.bendoudou.server.music.MusicTrackRepository;
import com.bendoudou.server.music.dto.CreateTrackFromCosRequest;
import com.bendoudou.server.music.dto.DiscoverSearchItemResponse;
import com.bendoudou.server.music.dto.DiscoverSearchPageResponse;
import com.bendoudou.server.music.dto.MusicTrackResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class DiscoverMusicService {

    private final NeteaseProperties neteaseProperties;
    private final NeteaseApiClient neteaseApiClient;
    private final MusicService musicService;
    private final MusicTrackRepository musicTrackRepository;
    private final CosStorageService cosStorageService;
    private final FileContentHasher fileContentHasher;
    private final HttpClient downloadClient;

    public DiscoverMusicService(
            NeteaseProperties neteaseProperties,
            NeteaseApiClient neteaseApiClient,
            MusicService musicService,
            MusicTrackRepository musicTrackRepository,
            CosStorageService cosStorageService,
            FileContentHasher fileContentHasher
    ) {
        this.neteaseProperties = neteaseProperties;
        this.neteaseApiClient = neteaseApiClient;
        this.musicService = musicService;
        this.musicTrackRepository = musicTrackRepository;
        this.cosStorageService = cosStorageService;
        this.fileContentHasher = fileContentHasher;
        this.downloadClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public DiscoverSearchPageResponse search(long userId, String keyword, int offset, int limit) {
        if (!StringUtils.hasText(keyword) || keyword.trim().length() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入搜索关键词");
        }
        if (!neteaseProperties.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "网易云未配置 MUSIC_U");
        }
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        int safeOffset = Math.max(offset, 0);
        try {
            JsonNode root = neteaseApiClient.searchSongs(keyword.trim(), safeLimit, safeOffset);
            int code = root.path("code").asInt(200);
            if (code != 200) {
                String msg = root.path("message").asText("网易云搜索失败");
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, msg);
            }
            JsonNode result = root.path("result");
            JsonNode songs = result.path("songs");
            int total = result.path("songCount").asInt(0);
            if (!songs.isArray()) {
                return new DiscoverSearchPageResponse(List.of(), safeOffset, safeLimit, total, false);
            }
            Set<Long> heartedNeteaseIds = loadHeartedNeteaseSongIds(userId);
            List<DiscoverSearchItemResponse> out = new ArrayList<>();
            for (JsonNode song : songs) {
                long id = song.path("id").asLong(0);
                if (id <= 0) {
                    continue;
                }
                String title = textOrDefault(song.path("name"), "未知标题");
                String artist = joinArtists(firstArtistNode(song));
                String album = firstNonBlank(
                        textOrDefault(song.path("album").path("name"), null),
                        textOrDefault(song.path("al").path("name"), null),
                        "未知专辑"
                );
                int durationSec = Math.max(0, song.path("duration").asInt(song.path("dt").asInt(0)) / 1000);
                String cover = firstNonBlank(
                        song.path("album").path("picUrl").asText(""),
                        song.path("al").path("picUrl").asText(""),
                        ""
                );
                out.add(new DiscoverSearchItemResponse(
                        id, title, artist, album, durationSec, cover, heartedNeteaseIds.contains(id)
                ));
            }
            boolean hasMore = safeOffset + out.size() < total && !out.isEmpty();
            return new DiscoverSearchPageResponse(out, safeOffset, safeLimit, total, hasMore);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "网易云搜索失败: " + e.getMessage());
        }
    }

    private Set<Long> loadHeartedNeteaseSongIds(long userId) {
        Set<Long> ids = new HashSet<>();
        for (String note : musicTrackRepository.findHeartedNeteaseNotesByUserId(userId)) {
            Long songId = parseNeteaseSongIdFromNote(note);
            if (songId != null) {
                ids.add(songId);
            }
        }
        return ids;
    }

    private static Long parseNeteaseSongIdFromNote(String note) {
        if (!StringUtils.hasText(note) || !note.startsWith("netease:")) {
            return null;
        }
        String[] parts = note.split(":");
        if (parts.length < 2) {
            return null;
        }
        try {
            return Long.parseLong(parts[1].trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public MusicTrackResponse importSong(
            long userId,
            long neteaseSongId,
            Long playlistId,
            boolean heart,
            String qualityRaw
    ) {
        if (neteaseSongId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的歌曲 ID");
        }
        if (!neteaseProperties.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "网易云未配置 MUSIC_U");
        }
        if (!cosStorageService.isUsable()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS 配置不可用");
        }

        String preferredQuality = normalizeQuality(qualityRaw);

        // 当前用户已导入过「同曲 + 任意音质」时，若恰好命中目标或更高，可在下载前先按偏好查
        Optional<MusicTrack> minePreferred = musicTrackRepository
                .findFirstByUserIdAndNoteOrderByIdAsc(userId, neteaseNote(neteaseSongId, preferredQuality));
        if (minePreferred.isPresent() && StringUtils.hasText(minePreferred.get().getAudioUrl())) {
            MusicTrackResponse existing = musicService.getAccessibleTrack(userId, minePreferred.get().getId());
            return heart ? musicService.addHeart(userId, existing.id()) : existing;
        }

        Optional<MusicTrack> cachedPreferred = musicTrackRepository
                .findFirstByNoteOrderByIdAsc(neteaseNote(neteaseSongId, preferredQuality))
                .filter(t -> StringUtils.hasText(t.getAudioUrl()) && StringUtils.hasText(t.getFileSha256()));
        if (cachedPreferred.isPresent()) {
            MusicTrackResponse cloned = cloneFromExisting(userId, playlistId, cachedPreferred.get());
            return heart ? musicService.addHeart(userId, cloned.id()) : cloned;
        }

        try {
            JsonNode detailRoot = neteaseApiClient.songDetail(neteaseSongId);
            int detailCode = detailRoot.path("code").asInt(0);
            JsonNode songs = detailRoot.path("songs");
            if (!songs.isArray() || songs.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "歌曲不存在或无法获取详情 (code=" + detailCode + ")"
                );
            }
            JsonNode song = songs.get(0);
            String title = textOrDefault(song.path("name"), "未知标题");
            JsonNode artistNode = firstArtistNode(song);
            String artist = joinArtists(artistNode);
            String album = firstNonBlank(
                    textOrDefault(song.path("al").path("name"), null),
                    textOrDefault(song.path("album").path("name"), null),
                    "未知专辑"
            );
            int durationSec = Math.max(0, song.path("dt").asInt(song.path("duration").asInt(0)) / 1000);
            String picUrl = firstNonBlank(
                    song.path("al").path("picUrl").asText(""),
                    song.path("album").path("picUrl").asText(""),
                    ""
            );
            Long albumId = firstPositiveId(
                    song.path("al").path("id").asLong(0),
                    song.path("album").path("id").asLong(0)
            );
            String artistsJson = artistsToJson(artistNode);
            String titleAlias = joinStringArray(song.path("alia"));
            if (!StringUtils.hasText(titleAlias)) {
                titleAlias = joinStringArray(song.path("alias"));
            }
            String titleTranslated = joinStringArray(song.path("tns"));
            String albumArtist = joinArtists(firstNonEmptyArray(
                    song.path("al").path("artists"),
                    song.path("al").path("ar"),
                    song.path("album").path("artists")
            ));
            if ("未知歌手".equals(albumArtist)) {
                albumArtist = artist;
            }
            Integer releaseYear = extractReleaseYear(song);
            String sourceDetailJson = song.toString();

            UrlInfo urlInfo = resolvePlayUrl(neteaseSongId, preferredQuality);
            if (urlInfo.url() == null || urlInfo.url().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无法获取播放地址，可能无版权或 Cookie 已失效");
            }

            // 以实际拿到的音质入库并去重（可能已自动降级）
            String actualQuality = StringUtils.hasText(urlInfo.quality())
                    ? normalizeQuality(urlInfo.quality())
                    : preferredQuality;
            String note = neteaseNote(neteaseSongId, actualQuality);

            Optional<MusicTrack> mineActual = musicTrackRepository.findFirstByUserIdAndNoteOrderByIdAsc(userId, note);
            if (mineActual.isPresent() && StringUtils.hasText(mineActual.get().getAudioUrl())) {
                MusicTrackResponse existing = musicService.getAccessibleTrack(userId, mineActual.get().getId());
                return heart ? musicService.addHeart(userId, existing.id()) : existing;
            }
            Optional<MusicTrack> cachedActual = musicTrackRepository.findFirstByNoteOrderByIdAsc(note)
                    .filter(t -> StringUtils.hasText(t.getAudioUrl()) && StringUtils.hasText(t.getFileSha256()));
            if (cachedActual.isPresent()) {
                MusicTrackResponse cloned = cloneFromExisting(userId, playlistId, cachedActual.get());
                return heart ? musicService.addHeart(userId, cloned.id()) : cloned;
            }

            Path audioTemp = null;
            Path coverTemp = null;
            Path lyricsTemp = null;
            Path translatedLyricsTemp = null;
            Path romaLyricsTemp = null;
            Path yrcLyricsTemp = null;
            try {
                try {
                    audioTemp = downloadToTemp(urlInfo.url(), "." + urlInfo.ext());
                } catch (IOException first) {
                    // CDN 防盗链失败时，走官网外链再跳转一次
                    String outer = "https://music.163.com/song/media/outer/url?id=" + neteaseSongId + "." + urlInfo.ext();
                    try {
                        audioTemp = downloadToTemp(outer, "." + urlInfo.ext());
                    } catch (IOException second) {
                        throw new IOException(first.getMessage() + "; outer=" + second.getMessage(), first);
                    }
                }
                String sha = fileContentHasher.sha256File(audioTemp);
                long fileSize = Files.size(audioTemp);
                String audioObjectKey = cosStorageService.buildAudioObjectKey(sha, urlInfo.ext());
                cosStorageService.uploadObject(
                        audioObjectKey,
                        audioTemp,
                        fileSize,
                        CosStorageService.guessAudioContentType(urlInfo.ext(), urlInfo.mimeType())
                );

                String coverObjectKey = null;
                if (StringUtils.hasText(picUrl)) {
                    try {
                        coverTemp = downloadCoverPreferHiRes(picUrl);
                        if (coverTemp != null && Files.size(coverTemp) > 0) {
                            coverObjectKey = cosStorageService.buildCoverObjectKey(sha, "jpg");
                            long coverSize = Files.size(coverTemp);
                            cosStorageService.uploadObject(coverObjectKey, coverTemp, coverSize, "image/jpeg");
                        }
                    } catch (IOException ignored) {
                        // 封面可选
                    }
                }

                LyricBundle lyrics = fetchLyricBundle(neteaseSongId);
                String lyricsObjectKey = null;
                String translatedLyricsObjectKey = null;
                String romaLyricsObjectKey = null;
                String yrcLyricsObjectKey = null;
                if (StringUtils.hasText(lyrics.lrc())) {
                    lyricsTemp = Files.createTempFile("netease-lrc-", ".lrc");
                    Files.writeString(lyricsTemp, lyrics.lrc(), StandardCharsets.UTF_8);
                    lyricsObjectKey = cosStorageService.buildLyricsObjectKey(sha, "lrc");
                    cosStorageService.uploadObject(
                            lyricsObjectKey,
                            lyricsTemp,
                            Files.size(lyricsTemp),
                            CosStorageService.guessLyricsContentType("lrc")
                    );
                }
                if (StringUtils.hasText(lyrics.tlyric())) {
                    translatedLyricsTemp = Files.createTempFile("netease-tlyric-", ".lrc");
                    Files.writeString(translatedLyricsTemp, lyrics.tlyric(), StandardCharsets.UTF_8);
                    translatedLyricsObjectKey = cosStorageService.buildLyricsVariantObjectKey(sha, "tlyric", "lrc");
                    cosStorageService.uploadObject(
                            translatedLyricsObjectKey,
                            translatedLyricsTemp,
                            Files.size(translatedLyricsTemp),
                            CosStorageService.guessLyricsContentType("lrc")
                    );
                }
                if (StringUtils.hasText(lyrics.roma())) {
                    romaLyricsTemp = Files.createTempFile("netease-roma-", ".lrc");
                    Files.writeString(romaLyricsTemp, lyrics.roma(), StandardCharsets.UTF_8);
                    romaLyricsObjectKey = cosStorageService.buildLyricsVariantObjectKey(sha, "roma", "lrc");
                    cosStorageService.uploadObject(
                            romaLyricsObjectKey,
                            romaLyricsTemp,
                            Files.size(romaLyricsTemp),
                            CosStorageService.guessLyricsContentType("lrc")
                    );
                }
                if (StringUtils.hasText(lyrics.yrc())) {
                    yrcLyricsTemp = Files.createTempFile("netease-yrc-", ".yrc");
                    Files.writeString(yrcLyricsTemp, lyrics.yrc(), StandardCharsets.UTF_8);
                    yrcLyricsObjectKey = cosStorageService.buildLyricsVariantObjectKey(sha, null, "yrc");
                    cosStorageService.uploadObject(
                            yrcLyricsObjectKey,
                            yrcLyricsTemp,
                            Files.size(yrcLyricsTemp),
                            "text/plain; charset=utf-8"
                    );
                }

                String filename = sanitizeFilename(artist, title, urlInfo.ext());
                CreateTrackFromCosRequest req = new CreateTrackFromCosRequest(
                        playlistId,
                        sha,
                        urlInfo.ext(),
                        title,
                        artist,
                        album,
                        note,
                        durationSec,
                        filename,
                        false,
                        fileSize,
                        CosStorageService.guessAudioContentType(urlInfo.ext(), urlInfo.mimeType()),
                        audioObjectKey,
                        lyricsObjectKey,
                        coverObjectKey,
                        translatedLyricsObjectKey,
                        romaLyricsObjectKey,
                        yrcLyricsObjectKey,
                        actualQuality,
                        neteaseSongId,
                        albumId,
                        artistsJson,
                        titleAlias,
                        titleTranslated,
                        albumArtist,
                        releaseYear,
                        sourceDetailJson
                );
                MusicTrackResponse created = musicService.createTrackFromCos(userId, req);
                return heart ? musicService.addHeart(userId, created.id()) : created;
            } finally {
                deleteQuietly(audioTemp);
                deleteQuietly(coverTemp);
                deleteQuietly(lyricsTemp);
                deleteQuietly(translatedLyricsTemp);
                deleteQuietly(romaLyricsTemp);
                deleteQuietly(yrcLyricsTemp);
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "下载或上传失败: " + e.getMessage());
        }
    }

    private MusicTrackResponse cloneFromExisting(long userId, Long playlistId, MusicTrack source) {
        String sha = source.getFileSha256();
        String audioKey = source.getStoredRelpath();
        if (!StringUtils.hasText(sha) || !StringUtils.hasText(audioKey)) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "缓存曲目缺少存储信息");
        }
        String ext = extFromObjectKey(audioKey);
        CreateTrackFromCosRequest req = new CreateTrackFromCosRequest(
                playlistId,
                sha,
                ext,
                source.getTitle(),
                source.getArtist(),
                source.getAlbum(),
                source.getNote(),
                source.getDurationSeconds(),
                source.getOriginalFilename(),
                source.isMetadataFromFile(),
                source.getFileSize(),
                source.getMimeType(),
                audioKey,
                source.getLyricsStoredRelpath(),
                source.getCoverStoredRelpath(),
                source.getTranslatedLyricsStoredRelpath(),
                source.getRomaLyricsStoredRelpath(),
                source.getYrcLyricsStoredRelpath(),
                source.getAudioQuality(),
                source.getNeteaseSongId(),
                source.getAlbumId(),
                source.getArtistsJson(),
                source.getTitleAlias(),
                source.getTitleTranslated(),
                source.getAlbumArtist(),
                source.getReleaseYear(),
                source.getSourceDetailJson()
        );
        return musicService.createTrackFromCos(userId, req);
    }

    private static String neteaseNote(long neteaseSongId, String quality) {
        return "netease:" + neteaseSongId + ":" + quality;
    }

    private static String extFromObjectKey(String objectKey) {
        int dot = objectKey.lastIndexOf('.');
        if (dot < 0 || dot == objectKey.length() - 1) {
            return "mp3";
        }
        String ext = objectKey.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!Set.of("mp3", "m4a", "flac", "wav", "ogg", "aac").contains(ext)) {
            return "mp3";
        }
        return ext;
    }

    private UrlInfo resolvePlayUrl(long songId, String preferredQuality) throws IOException {
        for (QualityOption opt : qualityFallbackChain(preferredQuality)) {
            UrlInfo info = parseUrlInfo(neteaseApiClient.songUrl(songId, opt.level, opt.encodeType), opt.level);
            if (info.url() != null && !info.url().isBlank()) {
                return info;
            }
        }
        for (int br : new int[]{999000, 320000, 192000, 128000}) {
            UrlInfo legacy = parseUrlInfo(neteaseApiClient.songUrlLegacy(songId, br), qualityFromBr(br));
            if (legacy.url() != null && !legacy.url().isBlank()) {
                return legacy;
            }
        }
        return new UrlInfo(null, "mp3", "audio/mpeg", null);
    }

    private static String qualityFromBr(int br) {
        if (br >= 900000) {
            return "lossless";
        }
        if (br >= 320000) {
            return "exhigh";
        }
        if (br >= 192000) {
            return "higher";
        }
        return "standard";
    }

    private static String normalizeQuality(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "exhigh";
        }
        String q = raw.trim().toLowerCase(Locale.ROOT);
        return switch (q) {
            case "standard", "higher", "exhigh", "lossless", "hires" -> q;
            case "sq", "flac" -> "lossless";
            case "hq", "320" -> "exhigh";
            case "192" -> "higher";
            case "128" -> "standard";
            default -> "exhigh";
        };
    }

    private static List<QualityOption> qualityFallbackChain(String preferred) {
        List<QualityOption> all = List.of(
                new QualityOption("hires", "flac"),
                new QualityOption("lossless", "flac"),
                new QualityOption("exhigh", "mp3"),
                new QualityOption("higher", "mp3"),
                new QualityOption("standard", "mp3")
        );
        int start = 0;
        for (int i = 0; i < all.size(); i++) {
            if (all.get(i).level.equals(preferred)) {
                start = i;
                break;
            }
        }
        return all.subList(start, all.size());
    }

    private record QualityOption(String level, String encodeType) {}

    private static JsonNode firstArtistNode(JsonNode song) {
        JsonNode ar = song.path("ar");
        if (ar.isArray() && !ar.isEmpty()) {
            return ar;
        }
        return song.path("artists");
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String v : values) {
            if (StringUtils.hasText(v)) {
                return v;
            }
        }
        return "";
    }

    private UrlInfo parseUrlInfo(JsonNode root, String fallbackQuality) {
        JsonNode data = root.path("data");
        if (!data.isArray() || data.isEmpty()) {
            return new UrlInfo(null, "mp3", "audio/mpeg", null);
        }
        JsonNode item = data.get(0);
        String url = item.path("url").asText("");
        if (!StringUtils.hasText(url)) {
            return new UrlInfo(null, "mp3", "audio/mpeg", null);
        }
        String type = item.path("type").asText("mp3").toLowerCase(Locale.ROOT);
        String ext = type;
        if ("mpeg".equals(ext)) {
            ext = "mp3";
        }
        if (!Set.of("mp3", "m4a", "flac").contains(ext)) {
            ext = "mp3";
        }
        String mime = CosStorageService.guessAudioContentType(ext, null);
        String levelFromApi = item.path("level").asText("");
        String quality;
        if (StringUtils.hasText(levelFromApi)) {
            quality = normalizeQuality(levelFromApi);
        } else if (item.path("br").asInt(0) > 0) {
            quality = qualityFromBr(item.path("br").asInt(0));
        } else if ("flac".equals(ext)) {
            quality = "lossless";
        } else {
            quality = fallbackQuality;
        }
        return new UrlInfo(url, ext, mime, quality);
    }

    private LyricBundle fetchLyricBundle(long songId) throws IOException {
        JsonNode root = neteaseApiClient.songLyric(songId);
        return new LyricBundle(
                textualLyric(root.path("lrc").path("lyric")),
                textualLyric(root.path("tlyric").path("lyric")),
                firstNonBlank(
                        textualLyric(root.path("romalrc").path("lyric")),
                        textualLyric(root.path("romaLrc").path("lyric"))
                ),
                textualLyric(root.path("yrc").path("lyric"))
        );
    }

    private static String textualLyric(JsonNode node) {
        if (node != null && node.isTextual() && StringUtils.hasText(node.asText())) {
            return node.asText();
        }
        return null;
    }

    private Path downloadCoverPreferHiRes(String picUrl) throws IOException {
        IOException last = null;
        for (String candidate : List.of(
                normalizePicUrl(picUrl, 1000),
                normalizePicUrl(picUrl, 800),
                normalizePicUrl(picUrl, 300),
                stripPicParam(picUrl)
        )) {
            try {
                Path p = downloadToTemp(candidate, ".jpg");
                if (p != null && Files.size(p) > 0) {
                    return p;
                }
                deleteQuietly(p);
            } catch (IOException e) {
                last = e;
            }
        }
        if (last != null) {
            throw last;
        }
        return null;
    }

    private static String stripPicParam(String picUrl) {
        if (!StringUtils.hasText(picUrl)) {
            return picUrl;
        }
        int q = picUrl.indexOf('?');
        return q > 0 ? picUrl.substring(0, q) : picUrl;
    }

    private static String normalizePicUrl(String picUrl, int size) {
        if (!StringUtils.hasText(picUrl)) {
            return picUrl;
        }
        String base = stripPicParam(picUrl);
        return base + "?param=" + size + "y" + size;
    }

    private static Long firstPositiveId(long... ids) {
        for (long id : ids) {
            if (id > 0) {
                return id;
            }
        }
        return null;
    }

    private static Integer extractReleaseYear(JsonNode song) {
        long ms = song.path("publishTime").asLong(0);
        if (ms <= 0) {
            ms = song.path("al").path("publishTime").asLong(0);
        }
        if (ms <= 0) {
            return null;
        }
        return java.time.Instant.ofEpochMilli(ms)
                .atZone(java.time.ZoneId.of("Asia/Shanghai"))
                .getYear();
    }

    private static String artistsToJson(JsonNode artists) {
        if (artists == null || !artists.isArray() || artists.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (JsonNode a : artists) {
            long id = a.path("id").asLong(0);
            String name = a.path("name").asText("");
            if (!StringUtils.hasText(name) && id <= 0) {
                continue;
            }
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append("{\"id\":").append(id)
                    .append(",\"name\":\"").append(jsonEscape(name)).append("\"}");
        }
        sb.append(']');
        return first ? null : sb.toString();
    }

    private static String joinStringArray(JsonNode arr) {
        if (arr == null || !arr.isArray() || arr.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode n : arr) {
            String s = n.isTextual() ? n.asText() : n.path("name").asText("");
            if (!StringUtils.hasText(s)) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(" / ");
            }
            sb.append(s.trim());
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    private static JsonNode firstNonEmptyArray(JsonNode... nodes) {
        for (JsonNode n : nodes) {
            if (n != null && n.isArray() && !n.isEmpty()) {
                return n;
            }
        }
        return null;
    }

    private static String jsonEscape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private Path downloadToTemp(String url, String suffix) throws IOException {
        if (!StringUtils.hasText(url)) {
            return null;
        }
        Path temp = Files.createTempFile("netease-dl-", suffix);
        IOException last = null;
        for (String candidate : buildDownloadCandidates(url)) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(candidate))
                        .timeout(Duration.ofSeconds(120))
                        .header("User-Agent", neteaseProperties.getUserAgent())
                        .header("Referer", "https://music.163.com/")
                        .header("Origin", "https://music.163.com")
                        .header("Accept", "*/*")
                        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
                        .header("Cookie", buildDownloadCookie())
                        .GET()
                        .build();
                HttpResponse<InputStream> response = downloadClient.send(
                        request,
                        HttpResponse.BodyHandlers.ofInputStream()
                );
                int code = response.statusCode();
                if (code >= 200 && code < 300) {
                    try (InputStream in = response.body()) {
                        Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
                    }
                    if (Files.size(temp) > 0) {
                        return temp;
                    }
                    last = new IOException("下载文件为空: " + candidate);
                    continue;
                }
                try (InputStream err = response.body()) {
                    if (err != null) {
                        err.readAllBytes();
                    }
                } catch (Exception ignored) {
                }
                last = new IOException("下载 HTTP " + code + " @ " + candidate);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("下载中断");
            } catch (IOException e) {
                last = e;
            }
        }
        throw last != null ? last : new IOException("下载失败");
    }

    private static List<String> buildDownloadCandidates(String url) {
        String https = url.replace("http://", "https://");
        LinkedHashSet<String> out = new LinkedHashSet<>();
        out.add(https);
        out.add(https
                .replace("m801.", "m701.")
                .replace("m804.", "m701.")
                .replace("m8.", "m7.")
                .replace("m704.", "m701."));
        out.add(https
                .replace("m701.", "m801.")
                .replace("m7.", "m8."));
        return new ArrayList<>(out);
    }

    private String buildDownloadCookie() {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(neteaseProperties.getMusicU())) {
            sb.append("MUSIC_U=").append(neteaseProperties.getMusicU());
        }
        if (StringUtils.hasText(neteaseProperties.getCsrf())) {
            if (sb.length() > 0) {
                sb.append("; ");
            }
            sb.append("__csrf=").append(neteaseProperties.getCsrf());
        }
        return sb.toString();
    }

    private static String joinArtists(JsonNode artists) {
        if (artists == null || !artists.isArray() || artists.isEmpty()) {
            return "未知歌手";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode a : artists) {
            String name = a.path("name").asText("");
            if (!StringUtils.hasText(name)) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append("/");
            }
            sb.append(name);
        }
        return sb.length() > 0 ? sb.toString() : "未知歌手";
    }

    private static String textOrDefault(JsonNode node, String fallback) {
        if (node.isTextual() && StringUtils.hasText(node.asText())) {
            return node.asText().trim();
        }
        return fallback;
    }

    private static String sanitizeFilename(String artist, String title, String ext) {
        String base = (artist + " - " + title).replaceAll("[\\\\/:*?\"<>|]", "_");
        if (base.length() > 200) {
            base = base.substring(0, 200);
        }
        return base + "." + ext;
    }

    private static void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    private record UrlInfo(String url, String ext, String mimeType, String quality) {}

    private record LyricBundle(String lrc, String tlyric, String roma, String yrc) {}
}
