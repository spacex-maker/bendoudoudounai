package com.bendoudou.server.music;

import com.bendoudou.server.music.AudioMetadataExtractor.ExtractionResult;
import com.bendoudou.server.music.dto.CreatePlaylistRequest;
import com.bendoudou.server.music.dto.InvitationItemResponse;
import com.bendoudou.server.music.dto.InviteToPlaylistRequest;
import com.bendoudou.server.music.dto.MusicPreviewResponse;
import com.bendoudou.server.music.dto.MusicTrackResponse;
import com.bendoudou.server.music.dto.PlaylistMemberItemResponse;
import com.bendoudou.server.music.dto.PlaylistItemResponse;
import com.bendoudou.server.music.dto.UpdateMusicTrackRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistNameRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistWallpaperRequest;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MusicService {

    private static final Set<String> ALLOWED_EXT = Set.of("mp3", "m4a", "flac", "wav", "ogg", "aac", "rc");
    private static final Set<String> ALLOWED_LYRICS_EXT = Set.of("lrc", "txt", "krc", "srt");
    private static final long MAX_LYRICS_BYTES = 2 * 1024 * 1024;
    private static final long MAX_COVER_BYTES = 600 * 1024;
    private static final Set<String> ALLOWED_WALLPAPER_EXT = Set.of("jpg", "jpeg", "png", "webp", "gif");
    private static final long MAX_WALLPAPER_BYTES = 3 * 1024 * 1024;
    private static final String DEFAULT_PLAYLIST_NAME = "我的歌单";

    private final Path uploadBase;
    private final PlaylistRepository playlistRepository;
    private final MusicTrackRepository musicTrackRepository;
    private final PlaylistMemberRepository playlistMemberRepository;
    private final PlaylistInvitationRepository playlistInvitationRepository;
    private final UserRepository userRepository;
    private final AudioMetadataExtractor audioMetadataExtractor;
    private final CosStorageService cosStorageService;
    private final FileContentHasher fileContentHasher;

    public MusicService(
            @Value("${bendoudou.music-upload-dir}") String musicUploadDir,
            PlaylistRepository playlistRepository,
            MusicTrackRepository musicTrackRepository,
            PlaylistMemberRepository playlistMemberRepository,
            PlaylistInvitationRepository playlistInvitationRepository,
            UserRepository userRepository,
            AudioMetadataExtractor audioMetadataExtractor,
            CosStorageService cosStorageService,
            FileContentHasher fileContentHasher
    ) {
        this.uploadBase = Path.of(musicUploadDir).toAbsolutePath().normalize();
        this.playlistRepository = playlistRepository;
        this.musicTrackRepository = musicTrackRepository;
        this.playlistMemberRepository = playlistMemberRepository;
        this.playlistInvitationRepository = playlistInvitationRepository;
        this.userRepository = userRepository;
        this.audioMetadataExtractor = audioMetadataExtractor;
        this.cosStorageService = cosStorageService;
        this.fileContentHasher = fileContentHasher;
    }

    @Transactional(readOnly = true)
    public List<PlaylistItemResponse> listVisiblePlaylists(long userId) {
        List<PlaylistMember> mine = playlistMemberRepository.findByUserIdOrderByPlaylistIdDesc(userId);
        return mine.stream()
                .map(row -> toPlaylistItem(row, userId))
                .filter(Objects::nonNull)
                .sorted(
                        Comparator.comparing((PlaylistItemResponse p) -> p.iAmOwner() ? 0 : 1)
                                .thenComparing(p -> DEFAULT_PLAYLIST_NAME.equals(p.name()) && p.iAmOwner() ? 0 : 1)
                                .thenComparing(PlaylistItemResponse::id, Comparator.reverseOrder())
                )
                .collect(Collectors.toList());
    }

    @Transactional
    public PlaylistItemResponse createPlaylist(long userId, CreatePlaylistRequest req) {
        String name = req.name().trim();
        if (!StringUtils.hasText(name)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "歌单名称不能为空");
        }
        Playlist p = new Playlist();
        p.setUserId(userId);
        p.setName(name);
        p.setDefaultPlaylist(false);
        p = playlistRepository.save(p);
        addMember(p.getId(), userId, PlaylistMemberRole.OWNER);
        return toPlaylistItem(playlistMemberRepository.findByPlaylistIdAndUserId(p.getId(), userId).orElseThrow(), userId);
    }

    @Transactional
    public InvitationItemResponse inviteToPlaylist(long inviterId, InviteToPlaylistRequest req) {
        Playlist pl = playlistRepository.findById(req.playlistId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        if (pl.getUserId() != inviterId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只有歌单创建者可以发邀请");
        }
        assertMember(pl.getId(), inviterId);
        User invitee = userRepository.findByEmail(req.inviteeEmail().trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "该邮箱尚未注册"));
        if (invitee.getId() == inviterId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能邀请自己");
        }
        if (playlistMemberRepository.existsByPlaylistIdAndUserId(pl.getId(), invitee.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "对方已在该歌单中");
        }
        var dup = playlistInvitationRepository.findByPlaylistIdAndInviteeIdAndStatus(
                pl.getId(), invitee.getId(), PlaylistInvitationStatus.PENDING);
        if (dup.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已有一条待处理的邀请");
        }
        PlaylistInvitation inv = new PlaylistInvitation();
        inv.setPlaylistId(pl.getId());
        inv.setInviterId(inviterId);
        inv.setInviteeId(invitee.getId());
        inv.setStatus(PlaylistInvitationStatus.PENDING);
        inv = playlistInvitationRepository.save(inv);
        return toInvitationItem(inv);
    }

    @Transactional(readOnly = true)
    public List<InvitationItemResponse> listIncomingInvitations(long userId) {
        return playlistInvitationRepository
                .findByInviteeIdAndStatusOrderByCreatedAtDesc(userId, PlaylistInvitationStatus.PENDING)
                .stream()
                .map(this::toInvitationItem)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InvitationItemResponse> listSentInvitations(long userId) {
        return playlistInvitationRepository.findByInviterIdOrderByCreatedAtDesc(userId).stream()
                .filter(i -> i.getStatus() == PlaylistInvitationStatus.PENDING)
                .map(this::toInvitationItem)
                .collect(Collectors.toList());
    }

    @Transactional
    public void acceptInvitation(long userId, long invitationId) {
        PlaylistInvitation inv = playlistInvitationRepository.findByIdAndInviteeId(invitationId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "邀请不存在"));
        if (inv.getStatus() != PlaylistInvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邀请已处理");
        }
        if (playlistMemberRepository.existsByPlaylistIdAndUserId(inv.getPlaylistId(), userId)) {
            inv.setStatus(PlaylistInvitationStatus.ACCEPTED);
            inv.setResolvedAt(java.time.Instant.now());
            playlistInvitationRepository.save(inv);
            return;
        }
        addMember(inv.getPlaylistId(), userId, PlaylistMemberRole.MEMBER);
        inv.setStatus(PlaylistInvitationStatus.ACCEPTED);
        inv.setResolvedAt(java.time.Instant.now());
        playlistInvitationRepository.save(inv);
    }

    @Transactional
    public void declineInvitation(long userId, long invitationId) {
        PlaylistInvitation inv = playlistInvitationRepository.findByIdAndInviteeId(invitationId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "邀请不存在"));
        if (inv.getStatus() != PlaylistInvitationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邀请已处理");
        }
        inv.setStatus(PlaylistInvitationStatus.DECLINED);
        inv.setResolvedAt(java.time.Instant.now());
        playlistInvitationRepository.save(inv);
    }

    @Transactional
    public PlaylistItemResponse updatePlaylistWallpaperFromRemote(
            long userId,
            long playlistId,
            UpdatePlaylistWallpaperRequest req
    ) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        assertMember(playlistId, userId);
        String raw = req == null ? null : req.wallpaperUrl();
        String trimmed = raw == null ? "" : raw.trim();
        if (!StringUtils.hasText(trimmed)) {
            clearPlaylistWallpaper(p);
        } else {
            validateRemoteWallpaperUrl(trimmed);
            clearPlaylistWallpaper(p);
            p.setWallpaperRemoteUrl(trimmed);
        }
        playlistRepository.save(p);
        return toPlaylistItem(
                playlistMemberRepository.findByPlaylistIdAndUserId(playlistId, userId).orElseThrow(),
                userId
        );
    }

    @Transactional
    public PlaylistItemResponse uploadPlaylistWallpaperFile(long userId, long playlistId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择图片文件");
        }
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        assertMember(playlistId, userId);
        if (file.getSize() > MAX_WALLPAPER_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "图片过大，请小于 3MB");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String contentType = file.getContentType();
        if (StringUtils.hasText(contentType) && !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "请上传图片");
        }
        String ext = resolveWallpaperExt(original, contentType);
        clearPlaylistWallpaper(p);
        try {
            if (cosStorageService.isUsable()) {
                Path temp = Files.createTempFile("pl-wall-", "." + ext);
                try {
                    file.transferTo(temp.toFile());
                    long len = Files.size(temp);
                    String key = cosStorageService.buildPlaylistWallpaperObjectKey(playlistId, ext);
                    String mime = wallpaperMimeForExt(ext);
                    cosStorageService.uploadObject(key, temp, len, mime);
                    p.setWallpaperRemoteUrl(cosStorageService.publicObjectUrl(key));
                    p.setWallpaperStoredRelpath(null);
                } finally {
                    Files.deleteIfExists(temp);
                }
            } else {
                String rel = "playlist-wallpapers/" + playlistId + "." + ext;
                Path dest = uploadBase.resolve(rel).normalize();
                if (!dest.startsWith(uploadBase)) {
                    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "路径无效");
                }
                Files.createDirectories(dest.getParent());
                file.transferTo(dest.toFile());
                p.setWallpaperRemoteUrl(null);
                p.setWallpaperStoredRelpath(rel);
            }
            playlistRepository.save(p);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "保存壁纸失败: " + e.getMessage());
        }
        return toPlaylistItem(
                playlistMemberRepository.findByPlaylistIdAndUserId(playlistId, userId).orElseThrow(),
                userId
        );
    }

    @Transactional(readOnly = true)
    public String publicWallpaperUrlForUser(long userId, long playlistId) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        assertMember(playlistId, userId);
        if (StringUtils.hasText(p.getWallpaperRemoteUrl())) {
            return p.getWallpaperRemoteUrl();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public Resource wallpaperResourceForUser(long userId, long playlistId) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        assertMember(playlistId, userId);
        if (StringUtils.hasText(p.getWallpaperRemoteUrl())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "壁纸为外链或对象存储直链，请使用歌单接口返回的地址"
            );
        }
        if (!StringUtils.hasText(p.getWallpaperStoredRelpath())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "该歌单未设置壁纸");
        }
        Path file = uploadBase.resolve(p.getWallpaperStoredRelpath()).normalize();
        if (!file.startsWith(uploadBase) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "壁纸文件已丢失");
        }
        return new FileSystemResource(file);
    }

    @Transactional(readOnly = true)
    public String mimeForPlaylistWallpaper(long userId, long playlistId) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        assertMember(playlistId, userId);
        if (StringUtils.hasText(p.getWallpaperStoredRelpath())) {
            String name = p.getWallpaperStoredRelpath();
            int i = name.lastIndexOf('.');
            String ext = i > 0 ? name.substring(i + 1).toLowerCase(Locale.ROOT) : "jpg";
            return wallpaperMimeForExt(ext);
        }
        return "image/jpeg";
    }

    @Transactional
    public MusicPreviewResponse preview(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择有效的音频文件");
        }
        String orig = file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio";
        String ext = validateExt(orig);
        Path temp = null;
        try {
            temp = Files.createTempFile("music-preview-", "." + ext);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, temp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            ExtractionResult ex = audioMetadataExtractor.extractFromFile(temp, orig);
            return new MusicPreviewResponse(
                    ex.title(),
                    ex.artist(),
                    ex.album(),
                    ex.durationSeconds(),
                    orig,
                    ex.embeddedOrParsed()
            );
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "无法读取文件");
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                }
            }
        }
    }

    @Transactional
    public MusicTrackResponse upload(
            long userId,
            Long playlistId,
            MultipartFile file,
            MultipartFile lyricsFile,
            String title,
            String artist,
            String album,
            String note
    ) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择有效的音频文件");
        }
        Playlist pl;
        if (playlistId == null) {
            pl = getOrCreateDefaultPlaylist(userId);
        } else {
            pl = playlistRepository.findById(playlistId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
            assertMember(pl.getId(), userId);
        }
        String orig = file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio";
        String ext = validateExt(orig);
        Path temp = null;
        try {
            temp = Files.createTempFile("music-up-", "." + ext);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, temp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            String sha = fileContentHasher.sha256File(temp);
            ExtractionResult ex = audioMetadataExtractor.extractFromFile(temp, orig);
            long size = Files.size(temp);

            String t = firstNonBlank(title) != null ? firstNonBlank(title) : ex.title();
            String a = firstNonBlank(artist) != null ? firstNonBlank(artist) : ex.artist();
            String b = firstNonBlank(album) != null ? firstNonBlank(album) : ex.album();
            String n = firstNonBlank(note);
            String mime = guessMime(ext, file.getContentType());

            MusicTrack track = new MusicTrack();
            track.setUserId(userId);
            track.setPlaylistId(pl.getId());
            track.setTitle(t);
            track.setArtist(a);
            track.setAlbum(b);
            track.setNote(n);
            track.setDurationSeconds(ex.durationSeconds());
            track.setOriginalFilename(orig);
            track.setFileSize(size);
            track.setMimeType(mime);
            track.setMetadataFromFile(ex.embeddedOrParsed());
            track.setFileSha256(sha);

            boolean hasLyricsUpload = lyricsFile != null && !lyricsFile.isEmpty();
            boolean storageReused = applyStorageDeduplication(track, size, hasLyricsUpload);

            if (!storageReused) {
                if (cosStorageService.isUsable()) {
                    String key = cosStorageService.buildAudioObjectKey(sha, ext);
                    String ct = CosStorageService.guessAudioContentType(ext, file.getContentType());
                    try {
                        cosStorageService.uploadObject(key, temp, size, ct);
                    } catch (Exception e) {
                        throw new ResponseStatusException(
                                HttpStatus.INTERNAL_SERVER_ERROR, "对象存储上传失败: " + e.getMessage()
                        );
                    }
                    track.setStoredRelpath(key);
                    track.setAudioUrl(cosStorageService.publicObjectUrl(key));
                } else {
                    String rel = buildRelativePath(userId, ext);
                    Path abs = uploadBase.resolve(rel).normalize();
                    if (!abs.startsWith(uploadBase)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "非法路径");
                    }
                    try {
                        Files.createDirectories(abs.getParent());
                        Files.copy(temp, abs, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    } catch (IOException e) {
                        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "文件保存失败");
                    }
                    track.setStoredRelpath(rel.replace("\\", "/"));
                }
            }

            processEmbeddedCover(temp, ext, track, storageReused);

            processLyricsUpload(lyricsFile, track);

            track = musicTrackRepository.save(track);
            backfillCoverToSiblingTracks(track);
            return toResponse(track);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "无法处理上传文件");
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                }
            }
        }
    }

    /**
     * 若库中已有相同内容摘要，复用其存储位置（COS URL 或本地路径）；返回是否已复用且无需新上传/落盘。
     */
    private boolean applyStorageDeduplication(MusicTrack track, long size, boolean hasLyricsUpload) {
        String hash = track.getFileSha256();
        if (!StringUtils.hasText(hash)) {
            return false;
        }
        Optional<MusicTrack> opt = musicTrackRepository.findFirstByFileSha256OrderByIdAsc(hash);
        if (opt.isEmpty()) {
            return false;
        }
        MusicTrack previous = opt.get();
        if (StringUtils.hasText(previous.getAudioUrl()) && StringUtils.hasText(previous.getStoredRelpath())) {
            track.setAudioUrl(previous.getAudioUrl());
            track.setStoredRelpath(previous.getStoredRelpath());
            track.setCoverUrl(previous.getCoverUrl());
            track.setCoverStoredRelpath(previous.getCoverStoredRelpath());
            if (!hasLyricsUpload) {
                track.setLyricsUrl(previous.getLyricsUrl());
                track.setLyricsStoredRelpath(previous.getLyricsStoredRelpath());
            }
            return true;
        }
        if (StringUtils.hasText(previous.getStoredRelpath()) && !StringUtils.hasText(previous.getAudioUrl())) {
            Path existing = uploadBase.resolve(previous.getStoredRelpath()).normalize();
            if (existing.startsWith(uploadBase) && Files.isRegularFile(existing)) {
                long actual;
                try {
                    actual = Files.size(existing);
                } catch (IOException e) {
                    return false;
                }
                if (actual != size) {
                    return false;
                }
                track.setStoredRelpath(previous.getStoredRelpath());
                track.setCoverUrl(previous.getCoverUrl());
                track.setCoverStoredRelpath(previous.getCoverStoredRelpath());
                if (!hasLyricsUpload) {
                    track.setLyricsUrl(previous.getLyricsUrl());
                    track.setLyricsStoredRelpath(previous.getLyricsStoredRelpath());
                }
                return true;
            }
        }
        return false;
    }

    /**
     * 从 MP3 内嵌 ID3v2 封面写入 COS 或本地；与音频同 file_sha256 去重。
     * 去重时若首条记录未抽到封面，仍会用手头临时文件再试（避免「同文件再传永远没有封面」）。
     */
    private void processEmbeddedCover(Path tempMp3, String ext, MusicTrack track, boolean storageReused) {
        if (storageReused) {
            boolean inheritedCover = StringUtils.hasText(track.getCoverUrl())
                    || StringUtils.hasText(track.getCoverStoredRelpath());
            if (inheritedCover) {
                return;
            }
        }
        if (!"mp3".equalsIgnoreCase(ext)) {
            return;
        }
        String songSha = track.getFileSha256();
        if (!StringUtils.hasText(songSha)) {
            return;
        }
        Mp3AlbumCoverExtractor.Cover cover = Mp3AlbumCoverExtractor.tryExtract(tempMp3);
        if (cover == null || cover.data().length == 0 || cover.data().length > MAX_COVER_BYTES) {
            return;
        }
        String imgExt = imageExtensionForMime(cover.mimeType());
        Path ctemp = null;
        try {
            ctemp = Files.createTempFile("cover-", "." + imgExt);
            Files.write(ctemp, cover.data(), java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
            long clen = Files.size(ctemp);
            if (cosStorageService.isUsable()) {
                String key = cosStorageService.buildCoverObjectKey(songSha, imgExt);
                try {
                    cosStorageService.uploadObject(key, ctemp, clen, cover.mimeType());
                    track.setCoverUrl(cosStorageService.publicObjectUrl(key));
                    track.setCoverStoredRelpath(null);
                } catch (Exception e) {
                    storeCoverOnLocalDisk(track, songSha, imgExt, ctemp);
                }
            } else {
                storeCoverOnLocalDisk(track, songSha, imgExt, ctemp);
            }
        } catch (IOException e) {
            // 忽略封面
        } finally {
            if (ctemp != null) {
                try {
                    Files.deleteIfExists(ctemp);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private void storeCoverOnLocalDisk(MusicTrack track, String songSha, String imgExt, Path imageFile) throws IOException {
        String rel = "covers/" + songSha.substring(0, 2) + "/" + songSha + "." + imgExt;
        Path abs = uploadBase.resolve(rel).normalize();
        if (!abs.startsWith(uploadBase)) {
            return;
        }
        Files.createDirectories(abs.getParent());
        Files.copy(imageFile, abs, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        track.setCoverUrl(null);
        track.setCoverStoredRelpath(rel.replace("\\", "/"));
    }

    /**
     * 同一音频多次入库时，旧行可能无封面；新行抽到封面后把 COS URL / 本地路径同步给同 hash 且仍为空的行。
     */
    private void backfillCoverToSiblingTracks(MusicTrack saved) {
        String sha = saved.getFileSha256();
        if (!StringUtils.hasText(sha)) {
            return;
        }
        boolean has = StringUtils.hasText(saved.getCoverUrl()) || StringUtils.hasText(saved.getCoverStoredRelpath());
        if (!has) {
            return;
        }
        for (MusicTrack s : musicTrackRepository.findByFileSha256(sha)) {
            if (Objects.equals(s.getId(), saved.getId())) {
                continue;
            }
            if (StringUtils.hasText(s.getCoverUrl()) || StringUtils.hasText(s.getCoverStoredRelpath())) {
                continue;
            }
            s.setCoverUrl(saved.getCoverUrl());
            s.setCoverStoredRelpath(saved.getCoverStoredRelpath());
            musicTrackRepository.save(s);
        }
    }

    private static String imageExtensionForMime(String mime) {
        if (mime == null) {
            return "jpg";
        }
        String m = mime.toLowerCase(Locale.ROOT).trim();
        if (m.contains("png")) {
            return "png";
        }
        if (m.contains("webp")) {
            return "webp";
        }
        if (m.contains("jpeg") || m.contains("jpg")) {
            return "jpg";
        }
        return "jpg";
    }

    /**
     * 同一 multipart 中附带歌词时写入 COS 或本地上传目录；与音频同 file_sha256 关联，覆盖或新建。
     */
    private void processLyricsUpload(MultipartFile lyricsFile, MusicTrack track) {
        if (lyricsFile == null || lyricsFile.isEmpty()) {
            return;
        }
        String songSha = track.getFileSha256();
        if (!StringUtils.hasText(songSha)) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "内部错误");
        }
        if (lyricsFile.getSize() > MAX_LYRICS_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "歌词文件过大（最大 2MB）");
        }
        String lorig = lyricsFile.getOriginalFilename() != null ? lyricsFile.getOriginalFilename() : "lyrics.lrc";
        String lext = validateLyricsExt(lorig);
        Path ltemp = null;
        try {
            ltemp = Files.createTempFile("lyrics-up-", "." + lext);
            try (InputStream in = lyricsFile.getInputStream()) {
                Files.copy(in, ltemp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            long lsize = Files.size(ltemp);
            if (cosStorageService.isUsable()) {
                String key = cosStorageService.buildLyricsObjectKey(songSha, lext);
                String ct = CosStorageService.guessLyricsContentType(lext);
                try {
                    cosStorageService.uploadObject(key, ltemp, lsize, ct);
                } catch (Exception e) {
                    throw new ResponseStatusException(
                            HttpStatus.INTERNAL_SERVER_ERROR, "歌词上传到对象存储失败: " + e.getMessage()
                    );
                }
                track.setLyricsUrl(cosStorageService.publicObjectUrl(key));
                track.setLyricsStoredRelpath(null);
            } else {
                String rel = "lyrics/" + songSha.substring(0, 2) + "/" + songSha + "." + lext;
                Path abs = uploadBase.resolve(rel).normalize();
                if (!abs.startsWith(uploadBase)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "非法路径");
                }
                try {
                    Files.createDirectories(abs.getParent());
                    Files.copy(ltemp, abs, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException e) {
                    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "歌词文件保存失败");
                }
                track.setLyricsUrl(null);
                track.setLyricsStoredRelpath(rel.replace("\\", "/"));
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "无法处理歌词文件");
        } finally {
            if (ltemp != null) {
                try {
                    Files.deleteIfExists(ltemp);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private String validateLyricsExt(String original) {
        String ext = AudioMetadataExtractor.extensionOf(original).toLowerCase(Locale.ROOT);
        if (!ALLOWED_LYRICS_EXT.contains(ext)) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "歌词格式仅支持: " + String.join(", ", ALLOWED_LYRICS_EXT)
            );
        }
        return ext;
    }

    @Transactional(readOnly = true)
    public List<MusicTrackResponse> listTracksForPlaylist(long userId, long playlistId) {
        assertMember(playlistId, userId);
        return musicTrackRepository.findByPlaylistIdOrderByCreatedAtDesc(playlistId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public MusicTrackResponse recordTrackPlay(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        t.setPlayCount(t.getPlayCount() + 1);
        musicTrackRepository.save(t);
        return toResponse(t);
    }

    @Transactional(readOnly = true)
    public List<PlaylistMemberItemResponse> listPlaylistMembers(long userId, long playlistId) {
        assertMember(playlistId, userId);
        List<PlaylistMember> rows = new java.util.ArrayList<>(
                playlistMemberRepository.findByPlaylistId(playlistId)
        );
        rows.sort(
                Comparator.comparing((PlaylistMember m) -> m.getRole() == PlaylistMemberRole.OWNER ? 0 : 1)
                        .thenComparing(PlaylistMember::getUserId)
        );
        return rows.stream()
                .map(m -> {
                    User u = userRepository.findById(m.getUserId()).orElse(null);
                    String label = u == null ? "?" : userLabel(u);
                    return new PlaylistMemberItemResponse(m.getUserId(), label, m.getRole().name());
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public PlaylistItemResponse updatePlaylistName(long userId, long playlistId, UpdatePlaylistNameRequest req) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        if (p.getUserId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只有创建者可以修改歌单名称");
        }
        assertMember(playlistId, userId);
        String nm = req.name().trim();
        if (!StringUtils.hasText(nm)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "名称不能为空");
        }
        p.setName(nm);
        playlistRepository.save(p);
        return toPlaylistItem(
                playlistMemberRepository.findByPlaylistIdAndUserId(playlistId, userId).orElseThrow(),
                userId
        );
    }

    @Transactional
    public MusicTrackResponse updateTrack(long userId, long trackId, UpdateMusicTrackRequest req) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(req.title())) {
            t.setTitle(req.title().trim());
        }
        if (StringUtils.hasText(req.artist())) {
            t.setArtist(req.artist().trim());
        }
        if (StringUtils.hasText(req.album())) {
            t.setAlbum(req.album().trim());
        }
        if (req.note() != null) {
            t.setNote(StringUtils.hasText(req.note().trim()) ? req.note().trim() : null);
        }
        t.setMetadataFromFile(false);
        musicTrackRepository.save(t);
        return toResponse(t);
    }

    @Transactional(readOnly = true)
    public String publicLyricsUrlForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getLyricsUrl())) {
            return t.getLyricsUrl();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public Resource lyricsResourceForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getLyricsUrl())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "此歌词在对象存储，请使用歌单中的 lyricsUrl 公网直链"
            );
        }
        if (!StringUtils.hasText(t.getLyricsStoredRelpath())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未上传歌词");
        }
        Path file = uploadBase.resolve(t.getLyricsStoredRelpath()).normalize();
        if (!file.startsWith(uploadBase) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "歌词文件已丢失");
        }
        return new FileSystemResource(file);
    }

    @Transactional(readOnly = true)
    public String publicAudioUrlForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getAudioUrl())) {
            return t.getAudioUrl();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public Resource fileResourceForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getAudioUrl())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "此曲目在对象存储，请使用歌单中的 audioUrl 公网直链"
            );
        }
        if (!StringUtils.hasText(t.getStoredRelpath())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件已丢失");
        }
        Path file = uploadBase.resolve(t.getStoredRelpath()).normalize();
        if (!file.startsWith(uploadBase) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "文件已丢失");
        }
        return new FileSystemResource(file);
    }

    @Transactional(readOnly = true)
    public String mimeForTrack(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getMimeType())) {
            return t.getMimeType();
        }
        return "application/octet-stream";
    }

    @Transactional(readOnly = true)
    public String downloadFilename(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        return t.getOriginalFilename() != null ? t.getOriginalFilename() : "audio";
    }

    @Transactional(readOnly = true)
    public String lyricsDownloadFilename(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getLyricsStoredRelpath())) {
            Path p = Path.of(t.getLyricsStoredRelpath());
            String name = p.getFileName().toString();
            if (StringUtils.hasText(name)) {
                return name;
            }
        }
        return "lyrics.lrc";
    }

    @Transactional(readOnly = true)
    public String mimeForLyricsTrack(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getLyricsStoredRelpath())) {
            String name = t.getLyricsStoredRelpath();
            int i = name.lastIndexOf('.');
            String ext = i > 0 ? name.substring(i + 1) : "lrc";
            return CosStorageService.guessLyricsContentType(ext);
        }
        return "text/plain; charset=utf-8";
    }

    @Transactional(readOnly = true)
    public String publicCoverUrlForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getCoverUrl())) {
            return t.getCoverUrl();
        }
        return null;
    }

    @Transactional(readOnly = true)
    public Resource coverResourceForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getCoverUrl())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "封面在对象存储，请使用 coverUrl 公网直链"
            );
        }
        if (!StringUtils.hasText(t.getCoverStoredRelpath())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "无封面");
        }
        Path file = uploadBase.resolve(t.getCoverStoredRelpath()).normalize();
        if (!file.startsWith(uploadBase) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "封面文件已丢失");
        }
        return new FileSystemResource(file);
    }

    @Transactional(readOnly = true)
    public String mimeForCoverTrack(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (StringUtils.hasText(t.getCoverStoredRelpath())) {
            String name = t.getCoverStoredRelpath();
            int i = name.lastIndexOf('.');
            String ext = i > 0 ? name.substring(i + 1).toLowerCase(Locale.ROOT) : "jpg";
            return switch (ext) {
                case "png" -> "image/png";
                case "webp" -> "image/webp";
                default -> "image/jpeg";
            };
        }
        return "image/jpeg";
    }

    private void assertMember(long playlistId, long userId) {
        if (!playlistMemberRepository.existsByPlaylistIdAndUserId(playlistId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "你不在这个歌单中，需要对方邀请加入后才能一起听");
        }
    }

    private void addMember(long playlistId, long userId, PlaylistMemberRole role) {
        if (playlistMemberRepository.existsByPlaylistIdAndUserId(playlistId, userId)) {
            return;
        }
        PlaylistMember m = new PlaylistMember();
        m.setPlaylistId(playlistId);
        m.setUserId(userId);
        m.setRole(role);
        playlistMemberRepository.save(m);
    }

    private PlaylistItemResponse toPlaylistItem(PlaylistMember row, long currentUserId) {
        return playlistRepository.findById(row.getPlaylistId())
                .map(p -> {
                    long trackCount = musicTrackRepository.countByPlaylistId(p.getId());
                    long memCount = playlistMemberRepository.countByPlaylistId(p.getId());
                    long totalPlayCount = musicTrackRepository.sumPlayCountByPlaylistId(p.getId());
                    boolean iAmOwner = p.getUserId() == currentUserId;
                    User owner = userRepository.findById(p.getUserId()).orElse(null);
                    String ownerLabel = owner == null ? "?" : userLabel(owner);
                    boolean shared = memCount > 1;
                    return new PlaylistItemResponse(
                            p.getId(),
                            p.getName(),
                            p.getUserId(),
                            ownerLabel,
                            iAmOwner,
                            row.getRole().name(),
                            trackCount,
                            shared,
                            playlistWallpaperClientUrl(p),
                            totalPlayCount,
                            memCount,
                            p.getCreatedAt().toEpochMilli()
                    );
                })
                .orElse(null);
    }

    private static String playlistWallpaperClientUrl(Playlist p) {
        if (StringUtils.hasText(p.getWallpaperRemoteUrl())) {
            return p.getWallpaperRemoteUrl();
        }
        if (StringUtils.hasText(p.getWallpaperStoredRelpath())) {
            return "/api/music/playlists/" + p.getId() + "/wallpaper";
        }
        return null;
    }

    private void clearPlaylistWallpaper(Playlist p) {
        if (StringUtils.hasText(p.getWallpaperStoredRelpath())) {
            try {
                Path f = uploadBase.resolve(p.getWallpaperStoredRelpath()).normalize();
                if (f.startsWith(uploadBase)) {
                    Files.deleteIfExists(f);
                }
            } catch (IOException ignored) {
            }
        }
        p.setWallpaperRemoteUrl(null);
        p.setWallpaperStoredRelpath(null);
    }

    private static void validateRemoteWallpaperUrl(String url) {
        if (!StringUtils.hasText(url) || url.length() > 2048) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "链接无效或过长");
        }
        try {
            URI u = URI.create(url.trim());
            String scheme = u.getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持 http(s) 图片链接");
            }
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "链接格式无效");
        }
    }

    private static String wallpaperExtFromFilename(String original) {
        if (!StringUtils.hasText(original)) {
            return "";
        }
        int i = original.lastIndexOf('.');
        if (i < 0 || i >= original.length() - 1) {
            return "";
        }
        return original.substring(i + 1).toLowerCase(Locale.ROOT);
    }

    /**
     * 优先用文件名扩展名；无扩展名或非常规名时用 Content-Type 推断（避免部分系统上传名为 blob、无后缀导致失败）。
     */
    private static String resolveWallpaperExt(String originalFilename, String contentType) {
        String fromName = wallpaperExtFromFilename(originalFilename);
        if (ALLOWED_WALLPAPER_EXT.contains(fromName)) {
            return fromName;
        }
        if (StringUtils.hasText(contentType)) {
            String base = contentType.toLowerCase(Locale.ROOT).split(";")[0].trim();
            String fromCt = switch (base) {
                case "image/jpeg", "image/jpg", "image/pjpeg" -> "jpg";
                case "image/png", "image/x-png" -> "png";
                case "image/webp" -> "webp";
                case "image/gif" -> "gif";
                default -> "";
            };
            if (ALLOWED_WALLPAPER_EXT.contains(fromCt)) {
                return fromCt;
            }
            if (StringUtils.hasText(fromCt)) {
                throw new ResponseStatusException(
                        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "不支持的图片类型: " + base + "，请使用 jpg / png / webp / gif"
                );
            }
        }
        throw new ResponseStatusException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "无法识别图片格式，请使用 jpg/png/webp/gif，或带扩展名的文件"
        );
    }

    private static String wallpaperMimeForExt(String ext) {
        return switch (ext.toLowerCase(Locale.ROOT)) {
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            default -> "image/jpeg";
        };
    }

    private InvitationItemResponse toInvitationItem(PlaylistInvitation inv) {
        Playlist pl = playlistRepository.findById(inv.getPlaylistId()).orElse(null);
        String plName = pl == null ? "（已删）" : pl.getName();
        User inviter = userRepository.findById(inv.getInviterId()).orElse(null);
        User invitee = userRepository.findById(inv.getInviteeId()).orElse(null);
        return new InvitationItemResponse(
                inv.getId(),
                inv.getPlaylistId(),
                plName,
                inv.getInviterId(),
                inviter == null ? "?" : userLabel(inviter),
                inv.getInviteeId(),
                invitee == null ? "?" : userLabel(invitee),
                inv.getStatus().name(),
                inv.getCreatedAt().toEpochMilli()
        );
    }

    private static String userLabel(User u) {
        if (u.getDisplayName() != null && !u.getDisplayName().isBlank()) {
            return u.getDisplayName().trim();
        }
        return u.getEmail();
    }

    private MusicTrackResponse toResponse(MusicTrack t) {
        boolean hasLyrics = StringUtils.hasText(t.getLyricsUrl()) || StringUtils.hasText(t.getLyricsStoredRelpath());
        boolean hasCover = StringUtils.hasText(t.getCoverUrl()) || StringUtils.hasText(t.getCoverStoredRelpath());
        String coverForClient = t.getCoverUrl();
        if (!StringUtils.hasText(coverForClient) && StringUtils.hasText(t.getCoverStoredRelpath())) {
            coverForClient = "/api/music/tracks/" + t.getId() + "/cover";
        }
        String lyricsForClient = t.getLyricsUrl();
        if (!StringUtils.hasText(lyricsForClient) && StringUtils.hasText(t.getLyricsStoredRelpath())) {
            lyricsForClient = "/api/music/tracks/" + t.getId() + "/lyrics";
        }
        return new MusicTrackResponse(
                t.getId(),
                t.getPlaylistId(),
                t.getTitle(),
                t.getArtist(),
                t.getAlbum(),
                t.getNote(),
                t.getDurationSeconds(),
                t.getOriginalFilename(),
                t.isMetadataFromFile(),
                t.getCreatedAt().toEpochMilli(),
                t.getAudioUrl(),
                lyricsForClient,
                hasLyrics,
                coverForClient,
                hasCover,
                t.getPlayCount()
        );
    }

    private String validateExt(String original) {
        String ext = AudioMetadataExtractor.extensionOf(original).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXT.contains(ext)) {
            throw new ResponseStatusException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "不支持的格式，请使用: " + String.join(", ", ALLOWED_EXT)
            );
        }
        return ext;
    }

    private String buildRelativePath(long userId, String ext) {
        return userId + "/" + UUID.randomUUID() + "." + ext;
    }

    private String firstNonBlank(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private String guessMime(String ext, String fromUpload) {
        if (StringUtils.hasText(fromUpload) && !fromUpload.contains("application/octet-stream")) {
            return fromUpload;
        }
        return switch (ext) {
            case "mp3" -> "audio/mpeg";
            case "m4a", "aac" -> "audio/mp4";
            case "flac" -> "audio/flac";
            case "wav" -> "audio/wav";
            case "ogg" -> "audio/ogg";
            case "rc" -> "application/octet-stream";
            default -> "application/octet-stream";
        };
    }

    /**
     * 仅本人默认歌单：每用户一个「我的歌单」；新用户首次上传时创建并写入 OWNER 成员。
     */
    private Playlist getOrCreateDefaultPlaylist(long userId) {
        return playlistRepository.findByUserIdAndDefaultPlaylistTrue(userId).orElseGet(() -> {
            Playlist p = new Playlist();
            p.setUserId(userId);
            p.setName(DEFAULT_PLAYLIST_NAME);
            p.setDefaultPlaylist(true);
            p = playlistRepository.save(p);
            addMember(p.getId(), userId, PlaylistMemberRole.OWNER);
            return p;
        });
    }
}
