package com.bendoudou.server.music;

import com.bendoudou.server.music.dto.CreatePlaylistRequest;
import com.bendoudou.server.music.dto.CreateCosUploadTicketRequest;
import com.bendoudou.server.music.dto.CreateTrackFromCosRequest;
import com.bendoudou.server.music.dto.CosUploadTicketResponse;
import com.bendoudou.server.music.dto.InvitationItemResponse;
import com.bendoudou.server.music.dto.InviteToPlaylistRequest;
import com.bendoudou.server.music.dto.MusicPreviewResponse;
import com.bendoudou.server.music.dto.MusicTrackCommentResponse;
import com.bendoudou.server.music.dto.MusicTrackResponse;
import com.bendoudou.server.music.dto.PlaylistItemResponse;
import com.bendoudou.server.music.dto.PlaylistListeningStatusResponse;
import com.bendoudou.server.music.dto.PlaylistMemberItemResponse;
import com.bendoudou.server.music.dto.PostTrackCommentRequest;
import com.bendoudou.server.music.dto.UpdateMusicTrackRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistListeningStateRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistNameRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistWallpaperRequest;
import com.bendoudou.server.music.dto.TrackPlayUserStatResponse;
import com.bendoudou.server.bean.BeanService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/music")
public class MusicController {

    private static final Pattern SAFE_NAME = Pattern.compile("^[a-zA-Z0-9._-]+$");

    private final MusicService musicService;
    private final BeanService beanService;

    public MusicController(MusicService musicService, BeanService beanService) {
        this.musicService = musicService;
        this.beanService = beanService;
    }

    @GetMapping("/playlists")
    public List<PlaylistItemResponse> listPlaylists(Authentication authentication) {
        long userId = parseUserId(authentication);
        beanService.awardDailyUsage(userId);
        return musicService.listVisiblePlaylists(userId);
    }

    @PostMapping("/playlists")
    public PlaylistItemResponse createPlaylist(
            @Valid @RequestBody CreatePlaylistRequest request,
            Authentication authentication
    ) {
        return musicService.createPlaylist(parseUserId(authentication), request);
    }

    @PatchMapping("/playlists/{id}")
    public PlaylistItemResponse renamePlaylist(
            @PathVariable long id,
            @Valid @RequestBody UpdatePlaylistNameRequest request,
            Authentication authentication
    ) {
        return musicService.updatePlaylistName(parseUserId(authentication), id, request);
    }

    @DeleteMapping("/playlists/{id}")
    public void deletePlaylist(@PathVariable long id, Authentication authentication) {
        musicService.deletePlaylist(parseUserId(authentication), id);
    }

    @GetMapping("/playlists/{id}/members")
    public List<PlaylistMemberItemResponse> playlistMembers(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.listPlaylistMembers(parseUserId(authentication), id);
    }

    @GetMapping("/playlists/{id}/listening-status")
    public PlaylistListeningStatusResponse playlistListeningStatus(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.listPlaylistListeningStatus(parseUserId(authentication), id);
    }

    @PostMapping("/playlists/{id}/listening-state")
    public void updatePlaylistListeningState(
            @PathVariable long id,
            @Valid @RequestBody UpdatePlaylistListeningStateRequest request,
            Authentication authentication
    ) {
        musicService.updatePlaylistListeningState(parseUserId(authentication), id, request);
    }

    @GetMapping("/playlists/{id}/invitations/pending")
    public List<InvitationItemResponse> playlistPendingInvitations(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.listPendingInvitationsForPlaylist(parseUserId(authentication), id);
    }

    @DeleteMapping("/playlists/{playlistId}/members/{userId}")
    public void removePlaylistMember(
            @PathVariable long playlistId,
            @PathVariable long userId,
            Authentication authentication
    ) {
        musicService.removeMemberFromPlaylist(parseUserId(authentication), playlistId, userId);
    }

    @PutMapping("/playlists/{id}/wallpaper")
    public PlaylistItemResponse updatePlaylistWallpaper(
            @PathVariable long id,
            @Valid @RequestBody UpdatePlaylistWallpaperRequest request,
            Authentication authentication
    ) {
        return musicService.updatePlaylistWallpaperFromRemote(parseUserId(authentication), id, request);
    }

    @PostMapping(value = "/playlists/{id}/wallpaper", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PlaylistItemResponse uploadPlaylistWallpaper(
            @PathVariable long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        return musicService.uploadPlaylistWallpaperFile(parseUserId(authentication), id, file);
    }

    @GetMapping("/playlists/{id}/wallpaper")
    public ResponseEntity<?> playlistWallpaper(
            @PathVariable long id,
            Authentication authentication
    ) {
        long userId = parseUserId(authentication);
        String publicUrl = musicService.publicWallpaperUrlForUser(userId, id);
        if (StringUtils.hasText(publicUrl)) {
            return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(publicUrl)).build();
        }
        Resource r = musicService.wallpaperResourceForUser(userId, id);
        String mime = musicService.mimeForPlaylistWallpaper(userId, id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(r);
    }

    @PostMapping("/invitations")
    public InvitationItemResponse invite(
            @Valid @RequestBody InviteToPlaylistRequest request,
            Authentication authentication
    ) {
        return musicService.inviteToPlaylist(parseUserId(authentication), request);
    }

    @GetMapping("/invitations/incoming")
    public List<InvitationItemResponse> incoming(Authentication authentication) {
        return musicService.listIncomingInvitations(parseUserId(authentication));
    }

    @GetMapping("/invitations/sent")
    public List<InvitationItemResponse> sent(Authentication authentication) {
        return musicService.listSentInvitations(parseUserId(authentication));
    }

    @PostMapping("/invitations/{id}/accept")
    public void accept(@PathVariable long id, Authentication authentication) {
        musicService.acceptInvitation(parseUserId(authentication), id);
    }

    @PostMapping("/invitations/{id}/decline")
    public void decline(@PathVariable long id, Authentication authentication) {
        musicService.declineInvitation(parseUserId(authentication), id);
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MusicPreviewResponse preview(
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        parseUserId(authentication);
        return musicService.preview(file);
    }

    @PostMapping(value = "/tracks", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MusicTrackResponse upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "lyricsFile", required = false) MultipartFile lyricsFile,
            @RequestParam(value = "playlistId", required = false) Long playlistId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "artist", required = false) String artist,
            @RequestParam(value = "album", required = false) String album,
            @RequestParam(value = "note", required = false) String note,
            Authentication authentication
    ) {
        return musicService.upload(
                parseUserId(authentication),
                playlistId,
                file,
                lyricsFile,
                title,
                artist,
                album,
                note
        );
    }

    @PostMapping("/tracks/upload-ticket")
    public CosUploadTicketResponse createUploadTicket(
            @Valid @RequestBody CreateCosUploadTicketRequest request,
            Authentication authentication
    ) {
        return musicService.createCosUploadTicket(parseUserId(authentication), request);
    }

    @PostMapping("/tracks/from-cos")
    public MusicTrackResponse createTrackFromCos(
            @Valid @RequestBody CreateTrackFromCosRequest request,
            Authentication authentication
    ) {
        return musicService.createTrackFromCos(parseUserId(authentication), request);
    }

    @GetMapping("/tracks")
    public List<MusicTrackResponse> list(
            @RequestParam("playlistId") long playlistId,
            Authentication authentication
    ) {
        return musicService.listTracksForPlaylist(parseUserId(authentication), playlistId);
    }

    @GetMapping("/hearts/tracks")
    public List<MusicTrackResponse> listHeartTracks(Authentication authentication) {
        return musicService.listHeartTracks(parseUserId(authentication));
    }

    @GetMapping("/history/tracks")
    public List<MusicTrackResponse> listPlayHistoryTracks(Authentication authentication) {
        return musicService.listPlayHistoryTracks(parseUserId(authentication));
    }

    @PostMapping("/tracks/{id}/heart")
    public MusicTrackResponse addHeart(@PathVariable long id, Authentication authentication) {
        return musicService.addHeart(parseUserId(authentication), id);
    }

    @DeleteMapping("/tracks/{id}/heart")
    public MusicTrackResponse removeHeart(@PathVariable long id, Authentication authentication) {
        return musicService.removeHeart(parseUserId(authentication), id);
    }

    @DeleteMapping("/tracks/{id}")
    public void deleteTrack(@PathVariable long id, Authentication authentication) {
        musicService.deleteTrackFromPlaylist(parseUserId(authentication), id);
    }

    @PutMapping("/tracks/{id}")
    public MusicTrackResponse update(
            @PathVariable long id,
            @Valid @RequestBody UpdateMusicTrackRequest request,
            Authentication authentication
    ) {
        return musicService.updateTrack(parseUserId(authentication), id, request);
    }

    @PostMapping("/tracks/{id}/record-play")
    public MusicTrackResponse recordPlay(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.recordTrackPlay(parseUserId(authentication), id);
    }

    @GetMapping("/tracks/{id}/play-stats")
    public List<TrackPlayUserStatResponse> trackPlayStats(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.listTrackPlayStats(parseUserId(authentication), id);
    }

    @GetMapping("/tracks/{id}/comments")
    public Page<MusicTrackCommentResponse> listComments(
            @PathVariable long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        int p = Math.max(0, page);
        int s = Math.min(Math.max(size, 1), 50);
        Pageable pageable = PageRequest.of(p, s);
        return musicService.listTrackComments(parseUserId(authentication), id, pageable);
    }

    @PostMapping("/tracks/{id}/comments")
    public MusicTrackCommentResponse postComment(
            @PathVariable long id,
            @Valid @RequestBody PostTrackCommentRequest request,
            Authentication authentication
    ) {
        return musicService.postTrackComment(parseUserId(authentication), id, request);
    }

    @PostMapping("/comments/{id}/like")
    public MusicTrackCommentResponse likeComment(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.likeTrackComment(parseUserId(authentication), id);
    }

    @DeleteMapping("/comments/{id}/like")
    public MusicTrackCommentResponse unlikeComment(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.unlikeTrackComment(parseUserId(authentication), id);
    }

    @GetMapping("/tracks/{id}/cover")
    public ResponseEntity<?> cover(@PathVariable long id, Authentication authentication) {
        long userId = parseUserId(authentication);
        String publicUrl = musicService.publicCoverUrlForUser(userId, id);
        if (StringUtils.hasText(publicUrl)) {
            return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(publicUrl)).build();
        }
        Resource r = musicService.coverResourceForUser(userId, id);
        String mime = musicService.mimeForCoverTrack(userId, id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=86400")
                .body(r);
    }

    @GetMapping("/tracks/{id}/lyrics")
    public ResponseEntity<?> lyrics(@PathVariable long id, Authentication authentication) {
        long userId = parseUserId(authentication);
        String publicUrl = musicService.publicLyricsUrlForUser(userId, id);
        if (StringUtils.hasText(publicUrl)) {
            return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(publicUrl)).build();
        }
        Resource r = musicService.lyricsResourceForUser(userId, id);
        String mime = musicService.mimeForLyricsTrack(userId, id);
        String filename = musicService.lyricsDownloadFilename(userId, id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(filename))
                .body(r);
    }

    @GetMapping("/tracks/{id}/file")
    public ResponseEntity<?> file(@PathVariable long id, Authentication authentication) {
        long userId = parseUserId(authentication);
        String publicUrl = musicService.publicAudioUrlForUser(userId, id);
        if (StringUtils.hasText(publicUrl)) {
            return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(publicUrl)).build();
        }
        Resource r = musicService.fileResourceForUser(userId, id);
        String mime = musicService.mimeForTrack(userId, id);
        String filename = musicService.downloadFilename(userId, id);
        if (!StringUtils.hasText(mime) || "application/octet-stream".equals(mime)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/octet-stream"))
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(filename))
                    .body(r);
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mime))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(filename))
                .body(r);
    }

    private static String contentDisposition(String filename) {
        if (!StringUtils.hasText(filename) || !SAFE_NAME.matcher(filename).matches()) {
            return "inline; filename=\"media\"";
        }
        return "inline; filename=\"" + filename + "\"";
    }

    private static long parseUserId(Authentication authentication) {
        if (authentication == null || !StringUtils.hasText(authentication.getName())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "需要登录"
            );
        }
        return Long.parseLong(authentication.getName());
    }
}
