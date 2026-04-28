package com.bendoudou.server.admin;

import com.bendoudou.server.bean.BeanService;
import com.bendoudou.server.bean.dto.*;
import com.bendoudou.server.user.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/beans")
public class AdminBeanController {

    private final BeanService beanService;
    private final UserService userService;

    public AdminBeanController(BeanService beanService, UserService userService) {
        this.beanService = beanService;
        this.userService = userService;
    }

    @GetMapping("/transactions")
    public Page<BeanTransactionDto> listTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            Authentication auth
    ) {
        long requester = requireUserId(auth);
        userService.requireAdmin(requester);
        int p = Math.max(0, page);
        int s = Math.min(Math.max(1, size), 100);
        return beanService.listTransactionsForAdmin(PageRequest.of(p, s));
    }

    @GetMapping("/rules")
    public List<BeanRuleDto> listRules(Authentication auth) {
        userService.requireAdmin(requireUserId(auth));
        return beanService.listRules();
    }

    @PutMapping("/rules")
    public List<BeanRuleDto> updateRules(
            @Valid @RequestBody List<UpdateBeanRuleRequest> request,
            Authentication auth
    ) {
        userService.requireAdmin(requireUserId(auth));
        return beanService.updateRules(request);
    }

    @GetMapping("/levels")
    public List<BeanLevelDto> listLevels(Authentication auth) {
        userService.requireAdmin(requireUserId(auth));
        return beanService.listLevels();
    }

    @PutMapping("/levels")
    public List<BeanLevelDto> replaceLevels(
            @Valid @RequestBody List<UpdateBeanLevelRequest> request,
            Authentication auth
    ) {
        userService.requireAdmin(requireUserId(auth));
        return beanService.replaceLevels(request);
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
