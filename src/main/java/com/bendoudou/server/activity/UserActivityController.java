package com.bendoudou.server.activity;

import com.bendoudou.server.activity.dto.RecordActivityRequest;
import com.bendoudou.server.activity.dto.UserActivityEventResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/activity")
public class UserActivityController {

    private final UserActivityService userActivityService;

    public UserActivityController(UserActivityService userActivityService) {
        this.userActivityService = userActivityService;
    }

    /** 前端上报（如歌单内搜索）；服务端关键路径也会自动写库 */
    @PostMapping
    public UserActivityEventResponse record(
            @Valid @RequestBody RecordActivityRequest request,
            Authentication authentication
    ) {
        return userActivityService.record(parseUserId(authentication), request);
    }

    /** 当前用户自己的痕迹（管理后台以后另做） */
    @GetMapping("/me")
    public List<UserActivityEventResponse> mine(
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            Authentication authentication
    ) {
        return userActivityService.listMine(parseUserId(authentication), action, limit);
    }

    private static long parseUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
    }
}
