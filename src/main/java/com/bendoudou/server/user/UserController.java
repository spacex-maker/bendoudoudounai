package com.bendoudou.server.user;

import com.bendoudou.server.auth.dto.MeResponse;
import com.bendoudou.server.bean.BeanService;
import com.bendoudou.server.user.dto.ChangePasswordRequest;
import com.bendoudou.server.user.dto.UpdateUserPrivacySettingsRequest;
import com.bendoudou.server.user.dto.UpdateMyProfileRequest;
import com.bendoudou.server.user.dto.UserPrivacySettingsResponse;
import com.bendoudou.server.user.dto.UserDirectoryItem;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final BeanService beanService;
    private final UserPrivacyService userPrivacyService;

    public UserController(
            UserService userService,
            BeanService beanService,
            UserPrivacyService userPrivacyService
    ) {
        this.userService = userService;
        this.beanService = beanService;
        this.userPrivacyService = userPrivacyService;
    }

    @GetMapping("/directory")
    public List<UserDirectoryItem> directory(Authentication auth) {
        parseUserId(auth);
        return userService.listDirectoryForGuestbook();
    }

    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "未登录"
            );
        }
        long id = Long.parseLong(auth.getName());
        beanService.awardDailyUsage(id);
        User u = userService.requireUser(id);
        u.setLastActiveAt(java.time.Instant.now());
        userService.saveUser(u);
        return userService.toMeResponse(u);
    }

    @GetMapping("/me/avatar")
    public ResponseEntity<Resource> myAvatar(Authentication auth) {
        long id = parseUserId(auth);
        Resource r = userService.avatarResourceForUser(id);
        MediaType mime = userService.mimeForUserAvatar(id);
        return ResponseEntity.ok()
                .contentType(mime)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .body(r);
    }

    /**
     * 已登录用户获取任意用户的头像直链（与留言板选人等场景展示一致；无头像 404）
     */
    @GetMapping("/{userId}/avatar")
    public ResponseEntity<Resource> userAvatarById(@PathVariable long userId, Authentication auth) {
        parseUserId(auth);
        Resource r = userService.avatarResourceForUser(userId);
        MediaType mime = userService.mimeForUserAvatar(userId);
        return ResponseEntity.ok()
                .contentType(mime)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .body(r);
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MeResponse uploadMyAvatar(
            @RequestParam("file") MultipartFile file,
            Authentication auth
    ) {
        long id = parseUserId(auth);
        userService.uploadAvatar(id, file);
        User u = userService.requireUser(id);
        return userService.toMeResponse(u);
    }

    @PostMapping("/me/password")
    public void changeMyPassword(
            @Valid @RequestBody ChangePasswordRequest body,
            Authentication auth
    ) {
        long id = parseUserId(auth);
        userService.changeOwnPassword(id, body);
    }

    @PostMapping("/me/profile")
    public MeResponse updateMyProfile(
            @RequestBody UpdateMyProfileRequest body,
            Authentication auth
    ) {
        long id = parseUserId(auth);
        return userService.updateOwnProfile(id, body);
    }

    @GetMapping("/me/privacy")
    public UserPrivacySettingsResponse myPrivacy(Authentication auth) {
        long id = parseUserId(auth);
        return userPrivacyService.getSettings(id);
    }

    @PostMapping("/me/privacy")
    public UserPrivacySettingsResponse updateMyPrivacy(
            @RequestBody UpdateUserPrivacySettingsRequest body,
            Authentication auth
    ) {
        long id = parseUserId(auth);
        return userPrivacyService.updateSettings(id, body);
    }

    private static long parseUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "未登录"
            );
        }
        return Long.parseLong(auth.getName());
    }

}
