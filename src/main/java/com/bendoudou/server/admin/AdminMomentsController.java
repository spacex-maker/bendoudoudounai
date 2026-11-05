package com.bendoudou.server.admin;

import com.bendoudou.server.moments.MomentService;
import com.bendoudou.server.moments.dto.CreateMomentPhotoRequest;
import com.bendoudou.server.moments.dto.CreateMomentUploadTicketRequest;
import com.bendoudou.server.moments.dto.MomentPhotoResponse;
import com.bendoudou.server.moments.dto.MomentUploadTicketResponse;
import com.bendoudou.server.moments.dto.PatchMomentPhotoRequest;
import com.bendoudou.server.moments.dto.ReplaceMomentPhotoRequest;
import com.bendoudou.server.moments.dto.SetMomentsFeaturedPlaylistRequest;
import com.bendoudou.server.music.MusicService;
import com.bendoudou.server.music.dto.PlaylistItemResponse;
import com.bendoudou.server.user.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/moments")
public class AdminMomentsController {

    private final MomentService momentService;
    private final MusicService musicService;
    private final UserService userService;

    public AdminMomentsController(MomentService momentService, MusicService musicService, UserService userService) {
        this.momentService = momentService;
        this.musicService = musicService;
        this.userService = userService;
    }

    @PostMapping("/upload-ticket")
    public MomentUploadTicketResponse uploadTicket(
            @Valid @RequestBody CreateMomentUploadTicketRequest request,
            Authentication auth
    ) {
        return momentService.createUploadTicket(requireUserId(auth), request);
    }

    @PostMapping
    public MomentPhotoResponse create(
            @Valid @RequestBody CreateMomentPhotoRequest request,
            Authentication auth
    ) {
        return momentService.create(requireUserId(auth), request);
    }

    @GetMapping
    public Page<MomentPhotoResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "40") int size,
            @RequestParam(required = false) Integer hue,
            @RequestParam(required = false) Integer tolerance,
            @RequestParam(required = false) String mood,
            @RequestParam(required = false) String sort,
            Authentication auth
    ) {
        return momentService.list(requireUserId(auth), page, size, hue, tolerance, mood, sort);
    }

    @PatchMapping("/{id}")
    public MomentPhotoResponse patch(
            @PathVariable long id,
            @Valid @RequestBody PatchMomentPhotoRequest request,
            Authentication auth
    ) {
        return momentService.patch(requireUserId(auth), id, request);
    }

    @PostMapping("/{id}/replace")
    public MomentPhotoResponse replace(
            @PathVariable long id,
            @Valid @RequestBody ReplaceMomentPhotoRequest request,
            Authentication auth
    ) {
        return momentService.replace(requireUserId(auth), id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id, Authentication auth) {
        momentService.delete(requireUserId(auth), id);
    }

    @GetMapping("/featured-playlist")
    public Map<String, Object> featuredPlaylist(Authentication auth) {
        long uid = requireUserId(auth);
        userService.requireAdmin(uid);
        java.util.HashMap<String, Object> out = new java.util.HashMap<>();
        out.put("playlist", musicService.getMomentsFeaturedPlaylist(uid).orElse(null));
        return out;
    }

    @PutMapping("/featured-playlist")
    public Map<String, Object> setFeaturedPlaylist(
            @RequestBody(required = false) SetMomentsFeaturedPlaylistRequest request,
            Authentication auth
    ) {
        long uid = requireUserId(auth);
        userService.requireAdmin(uid);
        Long playlistId = request == null ? null : request.playlistId();
        PlaylistItemResponse pl = musicService.setMomentsFeaturedPlaylist(uid, playlistId);
        java.util.HashMap<String, Object> out = new java.util.HashMap<>();
        out.put("playlist", pl);
        return out;
    }

    @PostMapping("/featured-playlist/ensure")
    public PlaylistItemResponse ensureFeaturedPlaylist(Authentication auth) {
        long uid = requireUserId(auth);
        userService.requireAdmin(uid);
        return musicService.ensureMomentsFeaturedPlaylist(uid);
    }

    private static long requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        return Long.parseLong(auth.getName());
    }
}
