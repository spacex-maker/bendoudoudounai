package com.bendoudou.server.user.application;

import com.bendoudou.server.user.AccountRoleService;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import com.bendoudou.server.user.UserRole;
import com.bendoudou.server.user.application.dto.DeveloperApplicationItem;
import com.bendoudou.server.user.application.dto.DeveloperApplicationRequest;
import com.bendoudou.server.user.application.dto.ResolutionRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DeveloperRoleApplicationService {

    private final DeveloperRoleApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final AccountRoleService accountRoleService;

    public DeveloperRoleApplicationService(
            DeveloperRoleApplicationRepository applicationRepository,
            UserRepository userRepository,
            AccountRoleService accountRoleService
    ) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.accountRoleService = accountRoleService;
    }

    @Transactional
    public void applyForDeveloper(long userId, DeveloperApplicationRequest req) {
        if (accountRoleService.hasRole(userId, UserRole.DEVELOPER)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "您已是开发者");
        }
        if (applicationRepository.existsByUserIdAndStatus(userId, RoleApplicationStatus.PENDING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已有一条待审核的申请");
        }
        String msg = req != null && StringUtils.hasText(req.message()) ? req.message().trim() : null;
        if (msg != null && msg.length() > 1000) {
            msg = msg.substring(0, 1000);
        }
        DeveloperRoleApplication a = new DeveloperRoleApplication();
        a.setUserId(userId);
        a.setMessage(msg);
        a.setStatus(RoleApplicationStatus.PENDING);
        applicationRepository.save(a);
    }

    @Transactional(readOnly = true)
    public List<DeveloperApplicationItem> listMine(long userId) {
        return applicationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toItem)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DeveloperApplicationItem> listForAdmin(long requesterId, RoleApplicationStatus status) {
        requireAdmin(requesterId);
        if (status == null) {
            return applicationRepository.findAll().stream()
                    .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                    .map(this::toItem)
                    .toList();
        }
        return applicationRepository.findByStatusOrderByCreatedAtAsc(status).stream()
                .map(this::toItem)
                .toList();
    }

    @Transactional
    public void approve(long adminId, long applicationId) {
        requireAdmin(adminId);
        DeveloperRoleApplication a = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "申请不存在"));
        if (a.getStatus() != RoleApplicationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该申请已处理");
        }
        a.setStatus(RoleApplicationStatus.APPROVED);
        a.setResolvedAt(Instant.now());
        a.setResolvedByUserId(adminId);
        applicationRepository.save(a);
        accountRoleService.addRoleIfAbsent(a.getUserId(), UserRole.DEVELOPER);
    }

    @Transactional
    public void reject(long adminId, long applicationId, ResolutionRequest req) {
        requireAdmin(adminId);
        DeveloperRoleApplication a = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "申请不存在"));
        if (a.getStatus() != RoleApplicationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该申请已处理");
        }
        a.setStatus(RoleApplicationStatus.REJECTED);
        a.setResolvedAt(Instant.now());
        a.setResolvedByUserId(adminId);
        String n = req != null && StringUtils.hasText(req.note()) ? req.note().trim() : null;
        if (n != null && n.length() > 1000) {
            n = n.substring(0, 1000);
        }
        a.setResolutionNote(n);
        applicationRepository.save(a);
    }

    private void requireAdmin(long userId) {
        if (!accountRoleService.hasRole(userId, UserRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "需要管理员权限");
        }
    }

    private DeveloperApplicationItem toItem(DeveloperRoleApplication a) {
        User u = userRepository.findById(a.getUserId()).orElse(null);
        String name = u == null ? "?" : (StringUtils.hasText(u.getDisplayName()) ? u.getDisplayName().trim() : u.getEmail());
        return new DeveloperApplicationItem(
                a.getId(),
                a.getUserId(),
                name,
                u == null ? "?" : u.getEmail(),
                a.getMessage(),
                a.getStatus().name(),
                a.getCreatedAt().toEpochMilli(),
                a.getResolvedAt() == null ? null : a.getResolvedAt().toEpochMilli(),
                a.getResolutionNote()
        );
    }
}
