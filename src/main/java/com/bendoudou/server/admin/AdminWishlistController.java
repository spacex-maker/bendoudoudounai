package com.bendoudou.server.admin;

import com.bendoudou.server.user.UserService;
import com.bendoudou.server.wishlist.WishlistService;
import com.bendoudou.server.wishlist.dto.WishlistEntryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端心愿单：需登录且为管理员；列表与前台同源按时间倒序，支持删除单条。
 */
@RestController
@RequestMapping("/api/admin/wishlist")
public class AdminWishlistController {

    private final WishlistService wishlistService;
    private final UserService userService;

    public AdminWishlistController(WishlistService wishlistService, UserService userService) {
        this.wishlistService = wishlistService;
        this.userService = userService;
    }

    @GetMapping
    public Page<WishlistEntryResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            Authentication auth
    ) {
        long requester = requireUserId(auth);
        userService.requireAdmin(requester);
        int s = Math.min(Math.max(size, 1), 100);
        int p = Math.max(page, 0);
        Pageable pageable = PageRequest.of(p, s);
        return wishlistService.list(pageable);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id, Authentication auth) {
        long requester = requireUserId(auth);
        userService.requireAdmin(requester);
        wishlistService.deleteByAdmin(id);
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
