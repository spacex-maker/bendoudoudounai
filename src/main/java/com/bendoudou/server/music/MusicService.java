package com.bendoudou.server.music;

import com.bendoudou.server.bean.BeanService;
import com.bendoudou.server.bean.BeanActionType;
import com.bendoudou.server.bean.BeanTransactionReason;
import com.bendoudou.server.music.AudioMetadataExtractor.ExtractionResult;
import com.bendoudou.server.music.dto.CreatePlaylistRequest;
import com.bendoudou.server.music.dto.CreateCosUploadTicketRequest;
import com.bendoudou.server.music.dto.CreateTrackFromCosRequest;
import com.bendoudou.server.music.dto.CosUploadTicketResponse;
import com.bendoudou.server.music.dto.InvitationItemResponse;
import com.bendoudou.server.music.dto.InviteToPlaylistRequest;
import com.bendoudou.server.music.dto.MusicMentionNotificationResponse;
import com.bendoudou.server.music.dto.MusicPreviewResponse;
import com.bendoudou.server.music.dto.MusicTrackCommentResponse;
import com.bendoudou.server.music.dto.MusicTrackResponse;
import com.bendoudou.server.music.dto.PlaylistMemberItemResponse;
import com.bendoudou.server.music.dto.PlaylistItemResponse;
import com.bendoudou.server.music.dto.PlaylistListeningStatusItemResponse;
import com.bendoudou.server.music.dto.PlaylistListeningStatusResponse;
import com.bendoudou.server.music.dto.PostTrackCommentRequest;
import com.bendoudou.server.music.dto.UpdateMusicTrackRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistListeningStateRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistNameRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistWallpaperRequest;
import com.bendoudou.server.music.dto.TrackPlayUserStatResponse;
import com.bendoudou.server.music.ws.PlaylistListeningWebSocketHandler;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserPrivacyService;
import com.bendoudou.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MusicService {

    /** 与数据库 / 业务日切一致，用于歌单「新」字判断 */
    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");

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
    private final UserTrackHeartRepository userTrackHeartRepository;
    private final UserTrackPlayHistoryRepository userTrackPlayHistoryRepository;
    private final MusicTrackCommentRepository musicTrackCommentRepository;
    private final MusicTrackCommentLikeRepository musicTrackCommentLikeRepository;
    private final MusicMentionNotificationRepository musicMentionNotificationRepository;
    private final PlaylistListeningStatusRepository playlistListeningStatusRepository;
    private final UserRepository userRepository;
    private final AudioMetadataExtractor audioMetadataExtractor;
    private final CosStorageService cosStorageService;
    private final CosStsService cosStsService;
    private final FileContentHasher fileContentHasher;
    private final BeanService beanService;
    private final UserPrivacyService userPrivacyService;
    private final PlaylistListeningWebSocketHandler playlistListeningWebSocketHandler;

    public MusicService(
            @Value("${bendoudou.music-upload-dir}") String musicUploadDir,
            PlaylistRepository playlistRepository,
            MusicTrackRepository musicTrackRepository,
            PlaylistMemberRepository playlistMemberRepository,
            PlaylistInvitationRepository playlistInvitationRepository,
            UserTrackHeartRepository userTrackHeartRepository,
            UserTrackPlayHistoryRepository userTrackPlayHistoryRepository,
            MusicTrackCommentRepository musicTrackCommentRepository,
            MusicTrackCommentLikeRepository musicTrackCommentLikeRepository,
            MusicMentionNotificationRepository musicMentionNotificationRepository,
            PlaylistListeningStatusRepository playlistListeningStatusRepository,
            UserRepository userRepository,
            AudioMetadataExtractor audioMetadataExtractor,
            CosStorageService cosStorageService,
            CosStsService cosStsService,
            FileContentHasher fileContentHasher,
            BeanService beanService,
            UserPrivacyService userPrivacyService,
            PlaylistListeningWebSocketHandler playlistListeningWebSocketHandler
    ) {
        this.uploadBase = Path.of(musicUploadDir).toAbsolutePath().normalize();
        this.playlistRepository = playlistRepository;
        this.musicTrackRepository = musicTrackRepository;
        this.playlistMemberRepository = playlistMemberRepository;
        this.playlistInvitationRepository = playlistInvitationRepository;
        this.userTrackHeartRepository = userTrackHeartRepository;
        this.userTrackPlayHistoryRepository = userTrackPlayHistoryRepository;
        this.musicTrackCommentRepository = musicTrackCommentRepository;
        this.musicTrackCommentLikeRepository = musicTrackCommentLikeRepository;
        this.musicMentionNotificationRepository = musicMentionNotificationRepository;
        this.playlistListeningStatusRepository = playlistListeningStatusRepository;
        this.userRepository = userRepository;
        this.audioMetadataExtractor = audioMetadataExtractor;
        this.cosStorageService = cosStorageService;
        this.cosStsService = cosStsService;
        this.fileContentHasher = fileContentHasher;
        this.beanService = beanService;
        this.userPrivacyService = userPrivacyService;
        this.playlistListeningWebSocketHandler = playlistListeningWebSocketHandler;
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
        beanService.awardDailyUsage(userId);
        beanService.awardByRule(userId, BeanActionType.PLAYLIST_CREATE, BeanTransactionReason.PLAYLIST_CREATE, p.getId());
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
        if (!userPrivacyService.canReceivePlaylistInvite(invitee.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "对方已关闭歌单邀请");
        }
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
                if (!cosStorageService.isUsable()) {
                    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS 未配置完整，已禁用本地存储");
                }
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
            }

            processEmbeddedCover(temp, ext, track, storageReused);

            processLyricsUpload(lyricsFile, track);

            track = musicTrackRepository.save(track);
            backfillCoverToSiblingTracks(track);
            return toResponse(track, false);
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
        String resolvedAudio = resolveCosPublicUrl(previous.getAudioUrl(), previous.getStoredRelpath());
        if (StringUtils.hasText(resolvedAudio) && StringUtils.hasText(previous.getStoredRelpath())) {
            track.setAudioUrl(resolvedAudio);
            track.setStoredRelpath(previous.getStoredRelpath());
            track.setCoverUrl(previous.getCoverUrl());
            track.setCoverStoredRelpath(previous.getCoverStoredRelpath());
            if (!hasLyricsUpload) {
                track.setLyricsUrl(previous.getLyricsUrl());
                track.setLyricsStoredRelpath(previous.getLyricsStoredRelpath());
            }
            return true;
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
            if (!cosStorageService.isUsable()) {
                return;
            }
            String key = cosStorageService.buildCoverObjectKey(songSha, imgExt);
            try {
                cosStorageService.uploadObject(key, ctemp, clen, cover.mimeType());
                track.setCoverUrl(cosStorageService.publicObjectUrl(key));
                track.setCoverStoredRelpath(key);
            } catch (Exception ignored) {
                // 封面上传失败不阻断主流程
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
            if (!cosStorageService.isUsable()) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS 未配置完整，已禁用本地存储");
            }
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
            track.setLyricsStoredRelpath(key);
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
        List<MusicTrack> list = musicTrackRepository.findByPlaylistIdOrderByCreatedAtDesc(playlistId);
        List<Long> ids = list.stream().map(MusicTrack::getId).collect(Collectors.toList());
        Set<Long> hearted = heartedTrackIdsForUser(userId, ids);
        return list.stream()
                .map(t -> toResponse(t, hearted.contains(t.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TrackPlayUserStatResponse> listTrackPlayStats(long requesterId, long trackId) {
        MusicTrack track = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(track.getPlaylistId(), requesterId);
        return userTrackPlayHistoryRepository.countByTrackGroupedByUser(trackId).stream()
                .map(row -> {
                    long uid = row.getUserId() == null ? 0L : row.getUserId();
                    User u = uid == 0L ? null : userRepository.findById(uid).orElse(null);
                    String label = u == null ? ("用户#" + uid) : userLabel(u);
                    return new TrackPlayUserStatResponse(uid, label, row.getPlayCount());
                })
                .toList();
    }

    @Transactional
    public List<MusicTrackResponse> listHeartTracks(long userId) {
        List<UserTrackHeart> hearts = userTrackHeartRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<MusicTrackResponse> out = new ArrayList<>();
        for (UserTrackHeart h : hearts) {
            Optional<MusicTrack> opt = musicTrackRepository.findById(h.getTrackId());
            if (opt.isEmpty()) {
                userTrackHeartRepository.deleteByUserIdAndTrackId(userId, h.getTrackId());
                continue;
            }
            MusicTrack t = opt.get();
            if (!playlistMemberRepository.existsByPlaylistIdAndUserId(t.getPlaylistId(), userId)) {
                userTrackHeartRepository.deleteByUserIdAndTrackId(userId, h.getTrackId());
                continue;
            }
            out.add(toResponse(t, true));
        }
        return out;
    }

    @Transactional
    public List<MusicTrackResponse> listPlayHistoryTracks(long userId) {
        if (!userPrivacyService.shouldRecordPlay(userId)) {
            return List.of();
        }
        List<UserTrackPlayHistory> rows = userTrackPlayHistoryRepository.findTop200ByUserIdOrderByPlayedAtDesc(userId);
        LinkedHashSet<Long> recentTrackIds = new LinkedHashSet<>();
        for (UserTrackPlayHistory row : rows) {
            recentTrackIds.add(row.getTrackId());
        }

        List<MusicTrackResponse> out = new ArrayList<>();
        for (Long trackId : recentTrackIds) {
            Optional<MusicTrack> opt = musicTrackRepository.findById(trackId);
            if (opt.isEmpty()) {
                continue;
            }
            MusicTrack t = opt.get();
            if (!playlistMemberRepository.existsByPlaylistIdAndUserId(t.getPlaylistId(), userId)) {
                continue;
            }
            boolean hearted = userTrackHeartRepository.existsByUserIdAndTrackId(userId, t.getId());
            out.add(toResponse(t, hearted));
        }
        return out;
    }

    @Transactional
    public MusicTrackResponse addHeart(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (!userTrackHeartRepository.existsByUserIdAndTrackId(userId, trackId)) {
            UserTrackHeart row = new UserTrackHeart();
            row.setUserId(userId);
            row.setTrackId(trackId);
            userTrackHeartRepository.save(row);
            beanService.awardDailyUsage(userId);
            beanService.awardByRule(userId, BeanActionType.TRACK_HEART, BeanTransactionReason.TRACK_HEART, trackId);
        }
        return toResponse(t, true);
    }

    @Transactional
    public MusicTrackResponse removeHeart(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        userTrackHeartRepository.deleteByUserIdAndTrackId(userId, trackId);
        return toResponse(t, false);
    }

    @Transactional
    public void deleteTrackFromPlaylist(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        Playlist pl = playlistRepository.findById(t.getPlaylistId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (pl.getUserId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只有歌单创建者可以从歌单中移除歌曲");
        }
        long dupCount = 1;
        if (StringUtils.hasText(t.getFileSha256())) {
            dupCount = musicTrackRepository.countByFileSha256(t.getFileSha256());
        }
        List<MusicTrackComment> comments = musicTrackCommentRepository.findByTrackId(trackId);
        if (!comments.isEmpty()) {
            List<Long> commentIds = comments.stream().map(MusicTrackComment::getId).toList();
            musicTrackCommentLikeRepository.deleteByCommentIdIn(commentIds);
            musicTrackCommentRepository.deleteByTrackId(trackId);
        }
        musicMentionNotificationRepository.deleteByTrackId(trackId);
        userTrackHeartRepository.deleteByTrackId(trackId);
        userTrackPlayHistoryRepository.deleteByTrackId(trackId);
        musicTrackRepository.delete(t);
        if (dupCount <= 1) {
            tryDeleteOrphanStoredFiles(t);
        }
    }

    @Transactional
    public MusicTrackResponse recordTrackPlay(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        t.setPlayCount(t.getPlayCount() + 1);
        musicTrackRepository.save(t);
        touchListeningStatus(t.getPlaylistId(), userId, trackId);
        if (userPrivacyService.shouldRecordPlay(userId)) {
            UserTrackPlayHistory row = new UserTrackPlayHistory();
            row.setUserId(userId);
            row.setTrackId(trackId);
            userTrackPlayHistoryRepository.save(row);
            beanService.awardDailyUsage(userId);
            beanService.awardByRule(userId, BeanActionType.TRACK_PLAY, BeanTransactionReason.TRACK_PLAY, trackId);
        }
        return toResponse(t, userTrackHeartRepository.existsByUserIdAndTrackId(userId, trackId));
    }

    @Transactional
    public void updatePlaylistListeningState(long userId, long playlistId, UpdatePlaylistListeningStateRequest req) {
        assertMember(playlistId, userId);
        if (!req.playing()) {
            playlistListeningStatusRepository.deleteByPlaylistIdAndUserId(playlistId, userId);
            playlistListeningWebSocketHandler.broadcastListeningClear(playlistId, userId);
            return;
        }
        if (req.trackId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少 trackId");
        }
        MusicTrack t = musicTrackRepository.findById(req.trackId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        if (t.getPlaylistId() != playlistId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "歌曲不属于该歌单");
        }
        touchListeningStatus(playlistId, userId, req.trackId());
    }

    @Transactional(readOnly = true)
    public PlaylistListeningStatusResponse listPlaylistListeningStatus(long userId, long playlistId) {
        assertMember(playlistId, userId);
        Instant activeAfter = Instant.now().minusSeconds(120);
        List<PlaylistListeningStatusItemResponse> items = playlistListeningStatusRepository
                .findByPlaylistIdAndUpdatedAtAfter(playlistId, activeAfter)
                .stream()
                .filter(s -> s.getUserId() != userId)
                .map(s -> {
                    User u = userRepository.findById(s.getUserId()).orElse(null);
                    String label = u == null ? ("用户#" + s.getUserId()) : userLabel(u);
                    return new PlaylistListeningStatusItemResponse(
                            s.getTrackId(),
                            s.getUserId(),
                            label,
                            s.getUpdatedAt().toEpochMilli()
                    );
                })
                .toList();
        return new PlaylistListeningStatusResponse(items);
    }

    @Transactional(readOnly = true)
    public Page<MusicTrackCommentResponse> listTrackComments(long userId, long trackId, Pageable pageable) {
        MusicTrack track = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(track.getPlaylistId(), userId);
        Page<MusicTrackComment> roots = musicTrackCommentRepository
                .findByTrackIdAndParentIdIsNullOrderByCreatedAtDesc(trackId, pageable);
        List<MusicTrackComment> rootRows = roots.getContent();
        if (rootRows.isEmpty()) {
            return roots.map(r -> toCommentResponse(r, null, false, List.of()));
        }
        List<Long> rootIds = rootRows.stream().map(MusicTrackComment::getId).toList();
        List<MusicTrackComment> replies = musicTrackCommentRepository.findByParentIdInOrderByCreatedAtAsc(rootIds);

        java.util.Map<Long, List<MusicTrackComment>> repliesByParent = new java.util.LinkedHashMap<>();
        for (Long id : rootIds) repliesByParent.put(id, new ArrayList<>());
        for (MusicTrackComment r : replies) {
            if (r.getParentId() != null && repliesByParent.containsKey(r.getParentId())) {
                repliesByParent.get(r.getParentId()).add(r);
            }
        }

        Set<Long> needUserIds = new LinkedHashSet<>();
        Set<Long> allCommentIds = new LinkedHashSet<>();
        for (MusicTrackComment c : rootRows) {
            needUserIds.add(c.getUserId());
            allCommentIds.add(c.getId());
        }
        for (MusicTrackComment c : replies) {
            needUserIds.add(c.getUserId());
            allCommentIds.add(c.getId());
        }

        java.util.Map<Long, User> userById = userRepository.findAllById(needUserIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        Set<Long> likedByMe = allCommentIds.isEmpty()
                ? Set.of()
                : musicTrackCommentLikeRepository.findLikedCommentIds(userId, allCommentIds);

        return roots.map(root -> {
            List<MusicTrackCommentResponse> childRes = repliesByParent.getOrDefault(root.getId(), List.of()).stream()
                    .map(r -> toCommentResponse(r, userById.get(r.getUserId()), likedByMe.contains(r.getId()), List.of()))
                    .toList();
            return toCommentResponse(root, userById.get(root.getUserId()), likedByMe.contains(root.getId()), childRes);
        });
    }

    @Transactional
    public MusicTrackCommentResponse postTrackComment(long userId, long trackId, PostTrackCommentRequest req) {
        MusicTrack track = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(track.getPlaylistId(), userId);
        String content = req.content() == null ? "" : req.content().trim();
        if (!StringUtils.hasText(content)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "评论内容不能为空");
        }
        Long parentId = req.parentId();
        if (parentId != null) {
            MusicTrackComment parent = musicTrackCommentRepository.findById(parentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "要回复的评论不存在"));
            if (!Objects.equals(parent.getTrackId(), trackId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "回复目标不属于该歌曲");
            }
            if (parent.getParentId() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持回复一级评论");
            }
            parent.setReplyCount(parent.getReplyCount() + 1);
            parent.setUpdatedAt(Instant.now());
            musicTrackCommentRepository.save(parent);
        }

        MusicTrackComment c = new MusicTrackComment();
        c.setTrackId(trackId);
        c.setParentId(parentId);
        c.setUserId(userId);
        c.setContent(content);
        c.setLikeCount(0);
        c.setReplyCount(0);
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        c = musicTrackCommentRepository.save(c);
        createMentionNotifications(track, c, content, userId, req.mentionUserIds());
        beanService.awardDailyUsage(userId);
        beanService.awardByRule(userId, BeanActionType.TRACK_COMMENT, BeanTransactionReason.TRACK_COMMENT, c.getId());
        User u = userRepository.findById(userId).orElse(null);
        return toCommentResponse(c, u, false, List.of());
    }

    @Transactional(readOnly = true)
    public List<MusicMentionNotificationResponse> listMentionNotifications(long userId, int size) {
        var pageable = PageRequest.of(0, size);
        return musicMentionNotificationRepository
                .findByRecipientUserIdOrderByCreatedAtDesc(userId, pageable)
                .stream()
                .map(n -> {
                    MusicTrack track = musicTrackRepository.findById(n.getTrackId()).orElse(null);
                    if (track == null) {
                        return null;
                    }
                    if (!playlistMemberRepository.existsByPlaylistIdAndUserId(track.getPlaylistId(), userId)) {
                        return null;
                    }
                    User actor = userRepository.findById(n.getActorUserId()).orElse(null);
                    String actorLabel = actor == null ? ("用户#" + n.getActorUserId()) : userLabel(actor);
                    return new MusicMentionNotificationResponse(
                            n.getId(),
                            n.getPlaylistId(),
                            n.getTrackId(),
                            track.getTitle(),
                            n.getCommentId(),
                            n.getActorUserId(),
                            actorLabel,
                            n.getContentPreview(),
                            n.isRead(),
                            n.getCreatedAt().toEpochMilli()
                    );
                })
                .filter(Objects::nonNull)
                .toList();
    }

    @Transactional
    public void markMentionNotificationRead(long userId, long mentionId) {
        MusicMentionNotification row = musicMentionNotificationRepository
                .findByIdAndRecipientUserId(mentionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "消息不存在"));
        if (!row.isRead()) {
            row.setRead(true);
            musicMentionNotificationRepository.save(row);
        }
    }

    @Transactional
    public MusicTrackCommentResponse likeTrackComment(long userId, long commentId) {
        MusicTrackComment c = musicTrackCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "评论不存在"));
        MusicTrack t = musicTrackRepository.findById(c.getTrackId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (!musicTrackCommentLikeRepository.existsByCommentIdAndUserId(commentId, userId)) {
            MusicTrackCommentLike row = new MusicTrackCommentLike();
            row.setCommentId(commentId);
            row.setUserId(userId);
            musicTrackCommentLikeRepository.save(row);
            c.setLikeCount(c.getLikeCount() + 1);
            c.setUpdatedAt(Instant.now());
            c = musicTrackCommentRepository.save(c);
        }
        User u = userRepository.findById(c.getUserId()).orElse(null);
        return toCommentResponse(c, u, true, List.of());
    }

    @Transactional
    public MusicTrackCommentResponse unlikeTrackComment(long userId, long commentId) {
        MusicTrackComment c = musicTrackCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "评论不存在"));
        MusicTrack t = musicTrackRepository.findById(c.getTrackId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        if (musicTrackCommentLikeRepository.existsByCommentIdAndUserId(commentId, userId)) {
            musicTrackCommentLikeRepository.deleteByCommentIdAndUserId(commentId, userId);
            c.setLikeCount(Math.max(0, c.getLikeCount() - 1));
            c.setUpdatedAt(Instant.now());
            c = musicTrackCommentRepository.save(c);
        }
        User u = userRepository.findById(c.getUserId()).orElse(null);
        return toCommentResponse(c, u, false, List.of());
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

    /**
     * 歌单内待处理的协作者邀请（当前用户为歌单成员时可见，用于详情页与成员列表一起展示状态）。
     */
    @Transactional(readOnly = true)
    public List<InvitationItemResponse> listPendingInvitationsForPlaylist(long userId, long playlistId) {
        assertMember(playlistId, userId);
        return playlistInvitationRepository
                .findByPlaylistIdAndStatusOrderByCreatedAtDesc(playlistId, PlaylistInvitationStatus.PENDING)
                .stream()
                .map(this::toInvitationItem)
                .collect(Collectors.toList());
    }

    /**
     * 仅歌单创建者可移出协作者，不可移出自己（创建者行）。
     */
    @Transactional
    public void removeMemberFromPlaylist(long actorUserId, long playlistId, long targetUserId) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        if (p.getUserId() != actorUserId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅创建者可移出成员");
        }
        if (targetUserId == actorUserId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能移出自己");
        }
        PlaylistMember row = playlistMemberRepository.findByPlaylistIdAndUserId(playlistId, targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "该用户不是歌单成员"));
        if (row.getRole() == PlaylistMemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能移出歌单创建者");
        }
        playlistMemberRepository.delete(row);
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
    public void deletePlaylist(long userId, long playlistId) {
        Playlist p = playlistRepository.findById(playlistId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
        if (p.getUserId() != userId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "只有创建者可以删除歌单");
        }
        if (p.isDefaultPlaylist()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "默认歌单不可删除");
        }
        assertMember(playlistId, userId);

        Playlist fallback = getOrCreateDefaultPlaylist(userId);
        if (fallback.getId().equals(playlistId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "默认歌单不可删除");
        }

        List<MusicTrack> tracks = musicTrackRepository.findByPlaylistId(playlistId);
        if (!tracks.isEmpty()) {
            for (MusicTrack track : tracks) {
                track.setPlaylistId(fallback.getId());
            }
            musicTrackRepository.saveAll(tracks);
        }

        clearPlaylistWallpaper(p);
        playlistInvitationRepository.deleteByPlaylistId(playlistId);
        playlistMemberRepository.deleteByPlaylistId(playlistId);
        playlistRepository.delete(p);
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
        return toResponse(t, userTrackHeartRepository.existsByUserIdAndTrackId(userId, trackId));
    }

    @Transactional(readOnly = true)
    public CosUploadTicketResponse createCosUploadTicket(long userId, CreateCosUploadTicketRequest req) {
        String sha = req.audioSha256() == null ? "" : req.audioSha256().toLowerCase(Locale.ROOT).trim();
        if (!sha.matches("^[a-f0-9]{64}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "audioSha256 格式错误");
        }
        String ext = req.audioExt() == null ? "" : req.audioExt().toLowerCase(Locale.ROOT).trim();
        if (!ALLOWED_EXT.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "audioExt 不支持");
        }
        String lyricsExt = req.lyricsExt() == null ? "" : req.lyricsExt().toLowerCase(Locale.ROOT).trim();
        if (StringUtils.hasText(lyricsExt) && !ALLOWED_LYRICS_EXT.contains(lyricsExt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lyricsExt 不支持");
        }
        String coverExt = req.coverExt() == null ? "" : req.coverExt().toLowerCase(Locale.ROOT).trim();
        if (StringUtils.hasText(coverExt) && !Set.of("jpg", "jpeg", "png", "webp").contains(coverExt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "coverExt 不支持");
        }
        if (!cosStsService.isUsable()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS 配置不可用");
        }
        String audioObjectKey = cosStorageService.buildAudioObjectKey(sha, ext);
        String lyricsObjectKey = StringUtils.hasText(lyricsExt)
                ? cosStorageService.buildLyricsObjectKey(sha, lyricsExt)
                : null;
        String coverObjectKey = StringUtils.hasText(coverExt)
                ? cosStorageService.buildCoverObjectKey(sha, coverExt)
                : null;
        return cosStsService.issueTicket(audioObjectKey, lyricsObjectKey, coverObjectKey);
    }

    @Transactional
    public MusicTrackResponse createTrackFromCos(long userId, CreateTrackFromCosRequest req) {
        Playlist pl;
        if (req.playlistId() == null) {
            pl = getOrCreateDefaultPlaylist(userId);
        } else {
            pl = playlistRepository.findById(req.playlistId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌单不存在"));
            assertMember(pl.getId(), userId);
        }
        if (!cosStsService.isUsable()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "COS 配置不可用");
        }
        String sha = req.audioSha256().toLowerCase(Locale.ROOT);
        String ext = validateExt("x." + req.audioExt());
        String expectedAudioKey = cosStorageService.buildAudioObjectKey(sha, ext);
        if (!expectedAudioKey.equals(req.audioObjectKey())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "audioObjectKey 与摘要或扩展名不匹配");
        }
        if (StringUtils.hasText(req.lyricsObjectKey())) {
            String expectedLyricsPrefix = cosStorageService.buildLyricsObjectKey(sha, "lrc")
                    .replaceAll("\\.lrc$", ".");
            if (!req.lyricsObjectKey().startsWith(expectedLyricsPrefix)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "lyricsObjectKey 与摘要不匹配");
            }
        }
        if (StringUtils.hasText(req.coverObjectKey())) {
            String expectedCoverPrefix = cosStorageService.buildCoverObjectKey(sha, "jpg")
                    .replaceAll("\\.jpg$", ".");
            if (!req.coverObjectKey().startsWith(expectedCoverPrefix)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "coverObjectKey 与摘要不匹配");
            }
        }
        MusicTrack track = new MusicTrack();
        track.setUserId(userId);
        track.setPlaylistId(pl.getId());
        track.setTitle(firstNonBlank(req.title()) != null ? firstNonBlank(req.title()) : "未知标题");
        track.setArtist(firstNonBlank(req.artist()) != null ? firstNonBlank(req.artist()) : "未知歌手");
        track.setAlbum(firstNonBlank(req.album()) != null ? firstNonBlank(req.album()) : "未知专辑");
        track.setNote(firstNonBlank(req.note()));
        track.setDurationSeconds(Math.max(0, req.durationSeconds()));
        track.setOriginalFilename(StringUtils.hasText(req.originalFilename()) ? req.originalFilename().trim() : "audio");
        track.setFileSize(Math.max(0, req.fileSize()));
        track.setMimeType(StringUtils.hasText(req.mimeType()) ? req.mimeType().trim() : guessMime(ext, null));
        track.setMetadataFromFile(req.metadataFromFile());
        track.setFileSha256(sha);
        track.setStoredRelpath(req.audioObjectKey());
        track.setAudioUrl(cosStorageService.publicObjectUrl(req.audioObjectKey()));
        if (StringUtils.hasText(req.lyricsObjectKey())) {
            track.setLyricsStoredRelpath(req.lyricsObjectKey());
            track.setLyricsUrl(cosStorageService.publicObjectUrl(req.lyricsObjectKey()));
        }
        if (StringUtils.hasText(req.coverObjectKey())) {
            track.setCoverStoredRelpath(req.coverObjectKey());
            track.setCoverUrl(cosStorageService.publicObjectUrl(req.coverObjectKey()));
        }
        boolean storageReused = applyStorageDeduplication(track, track.getFileSize(), StringUtils.hasText(req.lyricsObjectKey()));
        if (!StringUtils.hasText(track.getCoverUrl()) && !StringUtils.hasText(track.getCoverStoredRelpath())) {
            processEmbeddedCoverFromCos(track, ext, storageReused);
        }
        track = musicTrackRepository.save(track);
        backfillCoverToSiblingTracks(track);
        return toResponse(track, userTrackHeartRepository.existsByUserIdAndTrackId(userId, track.getId()));
    }

    /**
     * 前端直传 COS 后，服务端补做一次 MP3 内嵌封面抽取，保持与 multipart 上传体验一致。
     */
    private void processEmbeddedCoverFromCos(MusicTrack track, String ext, boolean storageReused) {
        if (!"mp3".equalsIgnoreCase(ext)) {
            return;
        }
        if (!StringUtils.hasText(track.getAudioUrl())) {
            return;
        }
        Path temp = null;
        HttpURLConnection conn = null;
        try {
            temp = Files.createTempFile("music-cos-cover-", ".mp3");
            URL url = URI.create(track.getAudioUrl()).toURL();
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(15000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                return;
            }
            try (InputStream in = conn.getInputStream()) {
                Files.copy(in, temp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            processEmbeddedCover(temp, ext, track, storageReused);
        } catch (Exception ignored) {
            // 封面抽取失败不影响主流程
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public String publicLyricsUrlForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        return resolveCosPublicUrl(t.getLyricsUrl(), t.getLyricsStoredRelpath());
    }

    @Transactional(readOnly = true)
    public Resource lyricsResourceForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        throw new ResponseStatusException(HttpStatus.GONE, "已禁用本地歌词读取，请使用 COS 公网链接");
    }

    @Transactional(readOnly = true)
    public String publicAudioUrlForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        return resolveCosPublicUrl(t.getAudioUrl(), t.getStoredRelpath());
    }

    @Transactional(readOnly = true)
    public Resource fileResourceForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        throw new ResponseStatusException(HttpStatus.GONE, "已禁用本地音频读取，请使用 COS 公网链接");
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
        return resolveCosPublicUrl(t.getCoverUrl(), t.getCoverStoredRelpath());
    }

    @Transactional(readOnly = true)
    public Resource coverResourceForUser(long userId, long trackId) {
        MusicTrack t = musicTrackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "歌曲不存在"));
        assertMember(t.getPlaylistId(), userId);
        throw new ResponseStatusException(HttpStatus.GONE, "已禁用本地封面读取，请使用 COS 公网链接");
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

    private MusicTrackCommentResponse toCommentResponse(
            MusicTrackComment c,
            User user,
            boolean likedByMe,
            List<MusicTrackCommentResponse> replies
    ) {
        String authorLabel = user == null ? "用户" : userLabel(user);
        boolean hasAvatar = user != null && StringUtils.hasText(user.getAvatarStoredRelpath());
        return new MusicTrackCommentResponse(
                c.getId(),
                c.getTrackId(),
                c.getParentId(),
                c.getUserId(),
                authorLabel,
                hasAvatar,
                c.getContent(),
                c.getLikeCount(),
                c.getReplyCount(),
                likedByMe,
                c.getCreatedAt().toEpochMilli(),
                c.getUpdatedAt().toEpochMilli(),
                replies
        );
    }

    private void addMember(long playlistId, long userId, PlaylistMemberRole role) {
        if (playlistMemberRepository.existsByPlaylistIdAndUserId(playlistId, userId)) {
            return;
        }
        PlaylistMember m = new PlaylistMember();
        m.setPlaylistId(playlistId);
        m.setUserId(userId);
        m.setRole(role);
        try {
            // flush：并发两次「接受邀请」时可能都通过 exists 检查，第二笔 insert 会撞唯一键
            playlistMemberRepository.saveAndFlush(m);
        } catch (DataIntegrityViolationException ex) {
            if (playlistMemberRepository.existsByPlaylistIdAndUserId(playlistId, userId)) {
                return;
            }
            throw ex;
        }
    }

    private void touchListeningStatus(long playlistId, long userId, long trackId) {
        Instant now = Instant.now();
        // 单条 SQL 原子 UPSERT，避免并发下 insert 后异常污染当前 Hibernate Session
        playlistListeningStatusRepository.upsertListeningStatus(playlistId, userId, trackId, now);
        User u = userRepository.findById(userId).orElse(null);
        String label = u == null ? ("用户#" + userId) : userLabel(u);
        playlistListeningWebSocketHandler.broadcastListeningUpdate(
                playlistId,
                new PlaylistListeningStatusItemResponse(trackId, userId, label, now.toEpochMilli())
        );
    }

    private void createMentionNotifications(
            MusicTrack track,
            MusicTrackComment comment,
            String content,
            long actorUserId,
            List<Long> rawMentionUserIds
    ) {
        if (rawMentionUserIds == null || rawMentionUserIds.isEmpty()) {
            return;
        }
        Set<Long> memberIds = playlistMemberRepository.findByPlaylistId(track.getPlaylistId())
                .stream()
                .map(PlaylistMember::getUserId)
                .collect(Collectors.toSet());
        List<Long> mentionUserIds = rawMentionUserIds.stream()
                .filter(Objects::nonNull)
                .map(Long::longValue)
                .distinct()
                .filter(uid -> uid != actorUserId)
                .filter(memberIds::contains)
                .limit(20)
                .toList();
        if (mentionUserIds.isEmpty()) {
            return;
        }
        String preview = content.length() > 260 ? content.substring(0, 260) : content;
        List<MusicMentionNotification> batch = new ArrayList<>();
        for (Long mentionUserId : mentionUserIds) {
            MusicMentionNotification n = new MusicMentionNotification();
            n.setRecipientUserId(mentionUserId);
            n.setActorUserId(actorUserId);
            n.setPlaylistId(track.getPlaylistId());
            n.setTrackId(track.getId());
            n.setCommentId(comment.getId());
            n.setContentPreview(preview);
            n.setRead(false);
            n.setCreatedAt(Instant.now());
            batch.add(n);
        }
        musicMentionNotificationRepository.saveAll(batch);
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
                    boolean newForToday = isInAppZoneLocalToday(p.getCreatedAt()) || isInAppZoneLocalToday(row.getCreatedAt());
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
                            p.getCreatedAt().toEpochMilli(),
                            newForToday
                    );
                })
                .orElse(null);
    }

    private static boolean isInAppZoneLocalToday(Instant instant) {
        LocalDate d = instant.atZone(APP_ZONE).toLocalDate();
        return d.equals(ZonedDateTime.now(APP_ZONE).toLocalDate());
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

    private Set<Long> heartedTrackIdsForUser(long userId, List<Long> trackIds) {
        if (trackIds.isEmpty()) {
            return Set.of();
        }
        return userTrackHeartRepository.findTrackIdsByUserIdAndTrackIdIn(userId, trackIds);
    }

    private void tryDeleteOrphanStoredFiles(MusicTrack t) {
        // COS-only: 删除曲目时不再触碰本地文件系统
    }

    private String resolveCosPublicUrl(String directUrl, String storedRelpath) {
        if (StringUtils.hasText(directUrl)) {
            return directUrl;
        }
        if (StringUtils.hasText(storedRelpath) && cosStorageService.isUsable()) {
            return cosStorageService.publicObjectUrl(storedRelpath);
        }
        return null;
    }

    private MusicTrackResponse toResponse(MusicTrack t, boolean hearted) {
        String audioForClient = resolveCosPublicUrl(t.getAudioUrl(), t.getStoredRelpath());
        String lyricsForClient = resolveCosPublicUrl(t.getLyricsUrl(), t.getLyricsStoredRelpath());
        String coverForClient = resolveCosPublicUrl(t.getCoverUrl(), t.getCoverStoredRelpath());
        boolean hasLyrics = StringUtils.hasText(lyricsForClient);
        boolean hasCover = StringUtils.hasText(coverForClient);
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
                audioForClient,
                lyricsForClient,
                hasLyrics,
                coverForClient,
                hasCover,
                t.getPlayCount(),
                hearted
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
