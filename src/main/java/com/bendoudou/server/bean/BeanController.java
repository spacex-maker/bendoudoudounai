package com.bendoudou.server.bean;

import com.bendoudou.server.bean.dto.BeanBalanceResponse;
import com.bendoudou.server.bean.dto.BeanTransactionDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/beans")
public class BeanController {

    private final BeanService beanService;

    public BeanController(BeanService beanService) {
        this.beanService = beanService;
    }

    @GetMapping("/me")
    public BeanBalanceResponse getMyOverview(Authentication auth) {
        long userId = Long.parseLong(auth.getName());
        beanService.awardDailyUsage(userId);
        return beanService.getBalance(userId);
    }

    @GetMapping("/me/transactions")
    public Page<BeanTransactionDto> getMyTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth
    ) {
        long userId = Long.parseLong(auth.getName());
        int p = Math.max(0, page);
        int s = Math.min(Math.max(size, 1), 50);
        return beanService.listTransactions(userId, PageRequest.of(p, s));
    }
}
