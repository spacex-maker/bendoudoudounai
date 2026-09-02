package com.bendoudou.server.auth.registration;

import com.bendoudou.server.auth.registration.dto.RegisterApplyRequest;
import com.bendoudou.server.auth.registration.dto.RegisterApplyStatusResponse;
import com.bendoudou.server.auth.registration.dto.RegistrationApplicationItem;
import com.bendoudou.server.auth.registration.dto.RejectRegistrationRequest;
import com.bendoudou.server.mail.MailService;
import com.bendoudou.server.user.AccountRoleService;
import com.bendoudou.server.user.EmailVerificationCode;
import com.bendoudou.server.user.EmailVerificationCodeRepository;
import com.bendoudou.server.user.User;
import com.bendoudou.server.user.UserRepository;
import com.bendoudou.server.user.UserRole;
import com.bendoudou.server.user.UserService;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class RegistrationApplicationService {

    private final RegistrationApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final EmailVerificationCodeRepository emailVerificationCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountRoleService accountRoleService;
    private final UserService userService;
    private final MailService mailService;

    public RegistrationApplicationService(
            RegistrationApplicationRepository applicationRepository,
            UserRepository userRepository,
            EmailVerificationCodeRepository emailVerificationCodeRepository,
            PasswordEncoder passwordEncoder,
            AccountRoleService accountRoleService,
            @Lazy UserService userService,
            MailService mailService
    ) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.emailVerificationCodeRepository = emailVerificationCodeRepository;
        this.passwordEncoder = passwordEncoder;
        this.accountRoleService = accountRoleService;
        this.userService = userService;
        this.mailService = mailService;
    }

    @Transactional(readOnly = true)
    public RegisterApplyStatusResponse statusByEmail(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (!StringUtils.hasText(email)) {
            return new RegisterApplyStatusResponse("NONE", null, "请填写邮箱");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            return new RegisterApplyStatusResponse("REGISTERED", null, "该邮箱已注册，请直接登录");
        }
        RegistrationApplication latest = applicationRepository.findFirstByEmailOrderByCreatedAtDesc(email).orElse(null);
        if (latest == null) {
            return new RegisterApplyStatusResponse("NONE", null, null);
        }
        return switch (latest.getStatus()) {
            case PENDING -> new RegisterApplyStatusResponse("PENDING", null, "该邮箱已有注册申请正在审核中");
            case REJECTED -> new RegisterApplyStatusResponse(
                    "REJECTED",
                    latest.getResolutionNote(),
                    "上次申请未通过，可修改资料后重新申请"
            );
            case APPROVED -> new RegisterApplyStatusResponse("APPROVED", null, "申请已通过，请使用该邮箱登录");
        };
    }

    @Transactional
    public RegisterApplyStatusResponse apply(RegisterApplyRequest req) {
        String email = normalizeEmail(req.email());
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册，请直接登录");
        }
        if (applicationRepository.existsByEmailAndStatus(email, RegistrationApplicationStatus.PENDING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已有注册申请正在审核中");
        }

        EmailVerificationCode stored = emailVerificationCodeRepository
                .findFirstByEmailAndPurposeOrderByCreatedAtDesc(email, EmailVerificationCode.PURPOSE_REGISTER)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先获取邮箱验证码"));
        if (stored.getExpiresAt() == null || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码已过期，请重新获取");
        }
        if (!req.code().trim().equals(stored.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码错误");
        }

        RegistrationApplication a = new RegistrationApplication();
        a.setEmail(email);
        a.setPasswordHash(passwordEncoder.encode(req.password()));
        if (StringUtils.hasText(req.displayName())) {
            a.setDisplayName(req.displayName().trim());
        }
        if (StringUtils.hasText(req.message())) {
            String msg = req.message().trim();
            a.setMessage(msg.length() > 1000 ? msg.substring(0, 1000) : msg);
        }
        a.setLocale(req.locale());
        a.setStatus(RegistrationApplicationStatus.PENDING);
        a.setCreatedAt(Instant.now());
        applicationRepository.save(a);

        emailVerificationCodeRepository.deleteByEmailAndPurpose(email, EmailVerificationCode.PURPOSE_REGISTER);

        return new RegisterApplyStatusResponse("PENDING", null, "申请已提交，请等待管理员审核");
    }

    @Transactional(readOnly = true)
    public List<RegistrationApplicationItem> listForAdmin(long adminId, RegistrationApplicationStatus status) {
        requireAdmin(adminId);
        List<RegistrationApplication> rows = status == null
                ? applicationRepository.findAllByOrderByCreatedAtDesc()
                : applicationRepository.findByStatusOrderByCreatedAtAsc(status);
        return rows.stream().map(this::toItem).collect(Collectors.toList());
    }

    @Transactional
    public void approve(long adminId, long applicationId) {
        requireAdmin(adminId);
        RegistrationApplication a = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "申请不存在"));
        if (a.getStatus() != RegistrationApplicationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该申请已处理");
        }
        if (userRepository.findByEmail(a.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册，无法再通过申请创建");
        }

        User u = new User();
        u.setEmail(a.getEmail());
        u.setPasswordHash(a.getPasswordHash());
        u.setDisplayName(a.getDisplayName());
        u.setRole(UserRole.USER);
        u.setAccountEnabled(true);
        u = userRepository.save(u);
        accountRoleService.assignOnUserCreatedIfEmpty(u.getId(), UserRole.USER);
        userService.ensureInviteCode(u);

        a.setStatus(RegistrationApplicationStatus.APPROVED);
        a.setResolvedAt(Instant.now());
        a.setResolvedByUserId(adminId);
        applicationRepository.save(a);

        try {
            mailService.sendRegistrationApproved(a.getEmail(), a.getLocale());
        } catch (Exception ignored) {
            /* 账号已创建，邮件失败不回滚 */
        }
    }

    @Transactional
    public void reject(long adminId, long applicationId, RejectRegistrationRequest req) {
        requireAdmin(adminId);
        if (req == null || !StringUtils.hasText(req.reason())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写拒绝原因");
        }
        String reason = req.reason().trim();
        if (reason.length() > 1000) {
            reason = reason.substring(0, 1000);
        }

        RegistrationApplication a = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "申请不存在"));
        if (a.getStatus() != RegistrationApplicationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该申请已处理");
        }
        a.setStatus(RegistrationApplicationStatus.REJECTED);
        a.setResolvedAt(Instant.now());
        a.setResolvedByUserId(adminId);
        a.setResolutionNote(reason);
        applicationRepository.save(a);

        mailService.sendRegistrationRejected(a.getEmail(), reason, a.getLocale());
    }

    private void requireAdmin(long userId) {
        if (!accountRoleService.hasRole(userId, UserRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "需要管理员权限");
        }
    }

    private static String normalizeEmail(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    }

    private RegistrationApplicationItem toItem(RegistrationApplication a) {
        return new RegistrationApplicationItem(
                a.getId(),
                a.getEmail(),
                a.getDisplayName(),
                a.getMessage(),
                a.getStatus().name(),
                a.getCreatedAt().toEpochMilli(),
                a.getResolvedAt() == null ? null : a.getResolvedAt().toEpochMilli(),
                a.getResolutionNote()
        );
    }
}
