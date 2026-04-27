package com.bendoudou.server.admin;

import com.bendoudou.server.guestbook.GuestbookService;
import com.bendoudou.server.guestbook.dto.GuestbookMessageResponse;
import com.bendoudou.server.user.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端留言：需登录且为管理员；列出全站主楼及回复。
 */
@RestController
@RequestMapping("/api/admin/guestbook")
public class AdminGuestbookController {

    private final GuestbookService guestbookService;
    private final UserService userService;

    public AdminGuestbookController(GuestbookService guestbookService, UserService userService) {
        this.guestbookService = guestbookService;
        this.userService = userService;
    }

    @GetMapping
    public Page<GuestbookMessageResponse> listThreads(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            Authentication auth
    ) {
        long requester = requireUserId(auth);
        userService.requireAdmin(requester);
        int s = Math.min(Math.max(size, 1), 50);
        int p = Math.max(page, 0);
        Pageable pageable = PageRequest.of(p, s);
        return guestbookService.listAllThreadsForAdmin(pageable);
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
