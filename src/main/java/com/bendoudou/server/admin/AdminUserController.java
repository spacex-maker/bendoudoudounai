package com.bendoudou.server.admin;

import com.bendoudou.server.user.UserService;
import com.bendoudou.server.user.dto.AdminUserCreateRequest;
import com.bendoudou.server.user.dto.AdminUserListItem;
import com.bendoudou.server.user.dto.AdminUserPatchRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 管理端接口：需登录且为 {@link com.bendoudou.server.user.UserRole#ADMIN}。
 */
@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

    private final UserService userService;

    public AdminUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/users")
    public List<AdminUserListItem> listUsers(Authentication auth) {
        long id = requireUserId(auth);
        return userService.listUsersForAdmin(id);
    }

    @PostMapping("/users")
    public AdminUserListItem createUser(
            @Valid @RequestBody AdminUserCreateRequest body,
            Authentication auth
    ) {
        long requester = requireUserId(auth);
        return userService.createUserByAdmin(requester, body);
    }

    @PatchMapping("/users/{id}")
    public AdminUserListItem patchUser(
            @PathVariable long id,
            @RequestBody AdminUserPatchRequest body,
            Authentication auth
    ) {
        long requester = requireUserId(auth);
        return userService.patchUserByAdmin(requester, id, body);
    }

    @PostMapping("/users/{id}/reset-password")
    public void resetUserPassword(@PathVariable long id, Authentication auth) {
        long requester = requireUserId(auth);
        userService.resetUserPasswordByAdmin(requester, id);
    }

    private static long requireUserId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED, "未登录"
            );
        }
        return Long.parseLong(auth.getName());
    }
}
