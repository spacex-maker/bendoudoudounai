package com.bendoudou.server.music;

import com.bendoudou.server.music.dto.CreatePlaylistRequest;
import com.bendoudou.server.music.dto.InvitationItemResponse;
import com.bendoudou.server.music.dto.InviteToPlaylistRequest;
import com.bendoudou.server.music.dto.MusicPreviewResponse;
import com.bendoudou.server.music.dto.MusicTrackResponse;
import com.bendoudou.server.music.dto.PlaylistItemResponse;
import com.bendoudou.server.music.dto.PlaylistMemberItemResponse;
import com.bendoudou.server.music.dto.UpdateMusicTrackRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistNameRequest;
import com.bendoudou.server.music.dto.UpdatePlaylistWallpaperRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
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

    public MusicController(MusicService musicService) {
        this.musicService = musicService;
    }

    @GetMapping("/playlists")
    public List<PlaylistItemResponse> listPlaylists(Authentication authentication) {
        return musicService.listVisiblePlaylists(parseUserId(authentication));
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

    @GetMapping("/playlists/{id}/members")
    public List<PlaylistMemberItemResponse> playlistMembers(
            @PathVariable long id,
            Authentication authentication
    ) {
        return musicService.listPlaylistMembers(parseUserId(authentication), id);
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

    @GetMapping("/tracks")
    public List<MusicTrackResponse> list(
            @RequestParam("playlistId") long playlistId,
            Authentication authentication
    ) {
        return musicService.listTracksForPlaylist(parseUserId(authentication), playlistId);
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
