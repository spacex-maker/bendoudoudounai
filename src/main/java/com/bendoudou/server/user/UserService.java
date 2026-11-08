package com.bendoudou.server.user;

import com.bendoudou.server.bean.BeanService;
import com.bendoudou.server.auth.EmailCodeGenerator;
import com.bendoudou.server.auth.InviteCodeGenerator;
import com.bendoudou.server.auth.dto.AuthResponse;
import com.bendoudou.server.auth.dto.InviteCodeValidateResponse;
import com.bendoudou.server.auth.dto.MeResponse;
import com.bendoudou.server.auth.dto.RegisterRequest;
import com.bendoudou.server.auth.dto.RegisterSendEmailRequest;
import com.bendoudou.server.auth.dto.ResetPasswordRequest;
import com.bendoudou.server.auth.dto.ResetPasswordSendEmailRequest;
import com.bendoudou.server.mail.MailService;
import com.bendoudou.server.security.JwtTokenService;
import com.bendoudou.server.user.dto.AdminUserCreateRequest;
import com.bendoudou.server.user.dto.AdminUserListItem;
import com.bendoudou.server.user.dto.AdminUserPatchRequest;
import com.bendoudou.server.user.dto.ChangePasswordRequest;
import com.bendoudou.server.user.dto.InviteCodeItemResponse;
import com.bendoudou.server.user.dto.MyInvitesResponse;
import com.bendoudou.server.user.dto.UpdateMyProfileRequest;
import com.bendoudou.server.user.dto.UserDirectoryItem;
import com.bendoudou.server.user.dto.UserEmailLookupResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final Set<String> AVATAR_EXT = Set.of("jpg", "jpeg", "png", "webp");
    private static final long MAX_AVATAR_BYTES = 2 * 1024 * 1024;

    private final UserRepository userRepository;
    private final EmailVerificationCodeRepository emailVerificationCodeRepository;
    private final InviteCodeRepository inviteCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final AccountRoleService accountRoleService;
    private final BeanService beanService;
    private final UserPrivacyService userPrivacyService;
    private final MailService mailService;
    private final Path uploadBase;

    public UserService(
            UserRepository userRepository,
            EmailVerificationCodeRepository emailVerificationCodeRepository,
            InviteCodeRepository inviteCodeRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            AccountRoleService accountRoleService,
            BeanService beanService,
            UserPrivacyService userPrivacyService,
            MailService mailService,
            @Value("${bendoudou.music-upload-dir}") String musicUploadDir
    ) {
        this.userRepository = userRepository;
        this.emailVerificationCodeRepository = emailVerificationCodeRepository;
        this.inviteCodeRepository = inviteCodeRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.accountRoleService = accountRoleService;
        this.beanService = beanService;
        this.userPrivacyService = userPrivacyService;
        this.mailService = mailService;
        this.uploadBase = Path.of(musicUploadDir).toAbsolutePath().normalize();
    }

    public AuthResponse login(String email, String password, String clientIp) {
        User u = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "邮箱或密码错误"));
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "邮箱或密码错误");
        }
        if (!u.isAccountEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号已禁用");
        }
        userPrivacyService.recordLogin(u.getId(), clientIp);
        u.setLastActiveAt(java.time.Instant.now());
        userRepository.save(u);
        if (userPrivacyService.shouldRecordLogin(u.getId())) {
            beanService.awardDailyUsage(u.getId());
        }
        return buildAuthResponse(u);
    }

    public AuthResponse buildAuthResponse(User u) {
        String token = jwtTokenService.generateToken(
                String.valueOf(u.getId()),
                Map.of("email", u.getEmail())
        );
        var eff = accountRoleService.effectiveRolesForUserId(u.getId());
        var primary = AccountRoleService.primaryRoleName(eff);
        var roles = eff.stream().map(UserRole::name).sorted().collect(Collectors.toList());
        return new AuthResponse(token, u.getEmail(), u.getDisplayName(), primary, roles);
    }

    public MeResponse toMeResponse(User u) {
        ensureInviteCode(u);
        var eff = accountRoleService.effectiveRolesForUserId(u.getId());
        var roleNames = eff.stream().map(UserRole::name).sorted().collect(Collectors.toList());
        var primary = AccountRoleService.primaryRoleName(eff);
        long beanBalance = beanService.queryBalance(u.getId());
        long total = inviteCodeRepository.countByOwnerUserId(u.getId());
        long unused = inviteCodeRepository.countByOwnerUserIdAndInviteeUserIdIsNull(u.getId());
        String firstUnused = inviteCodeRepository.findByOwnerUserIdOrderByCreatedAtDesc(u.getId()).stream()
                .filter(c -> !c.isUsed())
                .map(InviteCode::getCode)
                .findFirst()
                .orElse(null);
        String inviteeLabel = inviteCodeRepository
                .findByOwnerUserIdAndInviteeUserIdIsNotNullOrderByUsedAtDesc(u.getId())
                .stream()
                .findFirst()
                .map(c -> userLabel(c.getInviteeUserId()))
                .orElse(null);
        return new MeResponse(
                u.getId(),
                u.getEmail(),
                u.getDisplayName(),
                StringUtils.hasText(u.getAvatarStoredRelpath()),
                primary,
                roleNames,
                (u.getGender() == null ? UserGender.UNKNOWN : u.getGender()).name(),
                beanBalance,
                beanService.resolveLevelCode(beanBalance),
                beanService.resolveLevelName(beanBalance),
                firstUnused,
                unused == 0 && total > 0,
                inviteeLabel,
                total,
                unused
        );
    }

    private String userLabel(Long userId) {
        if (userId == null) return null;
        return userRepository.findById(userId)
                .map(x -> StringUtils.hasText(x.getDisplayName()) ? x.getDisplayName().trim() : x.getEmail())
                .orElse(null);
    }

    /**
     * 保证用户至少有一枚邀请码（写入 invite_codes；并同步 User.invite_code 兼容字段）。
     */
    @Transactional
    public void ensureInviteCode(User u) {
        if (u.getId() == null) {
            // 注册流程里尚未 save：先落库再发码
            u = userRepository.save(u);
        }
        migrateLegacyInviteIfNeeded(u);
        if (inviteCodeRepository.countByOwnerUserId(u.getId()) > 0) {
            syncLegacyInviteFields(u);
            return;
        }
        InviteCode created = createInviteCodeForOwner(u.getId(), InviteCode.SOURCE_INITIAL);
        u.setInviteCode(created.getCode());
        u.setInviteCodeUsed(false);
        userRepository.save(u);
    }

    /** 把旧版 User.invite_code 迁到 invite_codes 表（幂等） */
    @Transactional
    public void migrateLegacyInviteIfNeeded(User u) {
        if (!StringUtils.hasText(u.getInviteCode())) return;
        String code = InviteCodeGenerator.normalize(u.getInviteCode());
        if (inviteCodeRepository.existsByCode(code)) return;
        InviteCode row = new InviteCode();
        row.setCode(code);
        row.setOwnerUserId(u.getId());
        row.setSource(InviteCode.SOURCE_INITIAL);
        row.setCreatedAt(Instant.now());
        if (u.isInviteCodeUsed()) {
            userRepository.findFirstByInvitedByUserId(u.getId()).ifPresent(invitee -> {
                row.setInviteeUserId(invitee.getId());
                row.setUsedAt(invitee.getCreatedAt() != null ? invitee.getCreatedAt() : Instant.now());
            });
        }
        inviteCodeRepository.save(row);
    }

    private void syncLegacyInviteFields(User u) {
        List<InviteCode> all = inviteCodeRepository.findByOwnerUserIdOrderByCreatedAtDesc(u.getId());
        String unused = all.stream().filter(c -> !c.isUsed()).map(InviteCode::getCode).findFirst().orElse(null);
        boolean changed = false;
        if (unused != null) {
            if (!unused.equals(u.getInviteCode()) || u.isInviteCodeUsed()) {
                u.setInviteCode(unused);
                u.setInviteCodeUsed(false);
                changed = true;
            }
        } else if (!all.isEmpty()) {
            String last = all.get(0).getCode();
            if (!last.equals(u.getInviteCode()) || !u.isInviteCodeUsed()) {
                u.setInviteCode(last);
                u.setInviteCodeUsed(true);
                changed = true;
            }
        }
        if (changed) userRepository.save(u);
    }

    private InviteCode createInviteCodeForOwner(long ownerUserId, String source) {
        for (int i = 0; i < 16; i++) {
            String code = InviteCodeGenerator.generate();
            if (inviteCodeRepository.existsByCode(code) || userRepository.existsByInviteCode(code)) {
                continue;
            }
            InviteCode row = new InviteCode();
            row.setCode(code);
            row.setOwnerUserId(ownerUserId);
            row.setSource(source);
            row.setCreatedAt(Instant.now());
            return inviteCodeRepository.save(row);
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "邀请码生成失败");
    }

    @Transactional(readOnly = true)
    public MyInvitesResponse listMyInvites(long userId) {
        User u = requireUser(userId);
        ensureInviteCode(u);
        List<InviteCode> all = inviteCodeRepository.findByOwnerUserIdOrderByCreatedAtDesc(userId);
        List<InviteCodeItemResponse> codes = all.stream().map(this::toInviteItem).collect(Collectors.toList());
        List<InviteCodeItemResponse> records = all.stream()
                .filter(InviteCode::isUsed)
                .map(this::toInviteItem)
                .collect(Collectors.toList());
        long unused = all.stream().filter(c -> !c.isUsed()).count();
        return new MyInvitesResponse(all.size(), unused, codes, records);
    }

    private InviteCodeItemResponse toInviteItem(InviteCode c) {
        return new InviteCodeItemResponse(
                c.getId(),
                c.getCode(),
                c.isUsed(),
                c.getSource(),
                c.isUsed() ? userLabel(c.getInviteeUserId()) : null,
                c.getCreatedAt() == null ? null : c.getCreatedAt().toString(),
                c.getUsedAt() == null ? null : c.getUsedAt().toString()
        );
    }

    /** 管理员批量生成邀请码（归属于自己，便于活动发放；后期可再扩展发放给指定用户） */
    @Transactional
    public List<InviteCodeItemResponse> generateInviteCodesAsAdmin(long adminUserId, int count) {
        if (!accountRoleService.hasRole(adminUserId, UserRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "需要管理员权限");
        }
        if (count < 1 || count > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "一次可生成 1～50 枚");
        }
        requireUser(adminUserId);
        List<InviteCodeItemResponse> out = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            InviteCode created = createInviteCodeForOwner(adminUserId, InviteCode.SOURCE_ADMIN);
            out.add(toInviteItem(created));
        }
        syncLegacyInviteFields(requireUser(adminUserId));
        return out;
    }

    @Transactional(readOnly = true)
    public InviteCodeValidateResponse validateInviteCode(String raw) {
        String code = InviteCodeGenerator.normalize(raw);
        if (!StringUtils.hasText(code)) {
            return new InviteCodeValidateResponse(false, "请填写邀请码");
        }
        InviteCode row = inviteCodeRepository.findByCode(code).orElse(null);
        if (row == null) {
            // 兼容尚未迁移的旧 User.invite_code
            User inviter = userRepository.findByInviteCode(code).orElse(null);
            if (inviter == null || !inviter.isAccountEnabled()) {
                return new InviteCodeValidateResponse(false, "邀请码无效");
            }
            if (inviter.isInviteCodeUsed()) {
                return new InviteCodeValidateResponse(false, "该邀请码已被使用");
            }
            return new InviteCodeValidateResponse(true, "邀请码有效");
        }
        if (row.isUsed()) {
            return new InviteCodeValidateResponse(false, "该邀请码已被使用");
        }
        User owner = userRepository.findById(row.getOwnerUserId()).orElse(null);
        if (owner == null || !owner.isAccountEnabled()) {
            return new InviteCodeValidateResponse(false, "邀请码无效");
        }
        return new InviteCodeValidateResponse(true, "邀请码有效");
    }

    @Transactional
    public AuthResponse register(RegisterRequest req, String clientIp) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册");
        }
        String inviteNorm = InviteCodeGenerator.normalize(req.inviteCode());
        InviteCode inviteRow = inviteCodeRepository.findByCode(inviteNorm).orElse(null);
        User inviter;
        if (inviteRow != null) {
            if (inviteRow.isUsed()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "该邀请码已被使用");
            }
            inviter = userRepository.findById(inviteRow.getOwnerUserId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "邀请码无效"));
        } else {
            inviter = userRepository.findByInviteCode(inviteNorm)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "邀请码无效"));
            if (inviter.isInviteCodeUsed()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "该邀请码已被使用");
            }
        }
        if (!inviter.isAccountEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "邀请码无效");
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

        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        if (StringUtils.hasText(req.displayName())) {
            u.setDisplayName(req.displayName().trim());
        }
        u.setRole(UserRole.USER);
        u.setAccountEnabled(true);
        u.setInvitedByUserId(inviter.getId());
        u = userRepository.save(u);
        accountRoleService.assignOnUserCreatedIfEmpty(u.getId(), UserRole.USER);
        ensureInviteCode(u);

        if (inviteRow != null) {
            inviteRow.setInviteeUserId(u.getId());
            inviteRow.setUsedAt(Instant.now());
            inviteCodeRepository.save(inviteRow);
        } else {
            // 旧字段路径：迁并占用
            InviteCode migrated = new InviteCode();
            migrated.setCode(inviteNorm);
            migrated.setOwnerUserId(inviter.getId());
            migrated.setSource(InviteCode.SOURCE_INITIAL);
            migrated.setCreatedAt(Instant.now());
            migrated.setInviteeUserId(u.getId());
            migrated.setUsedAt(Instant.now());
            inviteCodeRepository.save(migrated);
        }
        if (inviteNorm.equals(InviteCodeGenerator.normalize(inviter.getInviteCode()))) {
            inviter.setInviteCodeUsed(true);
            userRepository.save(inviter);
        }
        syncLegacyInviteFields(inviter);

        emailVerificationCodeRepository.deleteByEmailAndPurpose(email, EmailVerificationCode.PURPOSE_REGISTER);

        userPrivacyService.recordLogin(u.getId(), clientIp);
        u.setLastActiveAt(Instant.now());
        userRepository.save(u);
        return buildAuthResponse(u);
    }

    @Transactional
    public void sendRegisterEmailCode(RegisterSendEmailRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已注册");
        }
        var latest = emailVerificationCodeRepository
                .findFirstByEmailAndPurposeOrderByCreatedAtDesc(email, EmailVerificationCode.PURPOSE_REGISTER);
        if (latest.isPresent()) {
            Instant created = latest.get().getCreatedAt();
            if (created != null && created.isAfter(Instant.now().minus(60, ChronoUnit.SECONDS))) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "发送过于频繁，请稍后再试");
            }
        }
        String code = EmailCodeGenerator.sixDigits();
        emailVerificationCodeRepository.deleteByEmailAndPurpose(email, EmailVerificationCode.PURPOSE_REGISTER);
        EmailVerificationCode row = new EmailVerificationCode();
        row.setEmail(email);
        row.setCode(code);
        row.setPurpose(EmailVerificationCode.PURPOSE_REGISTER);
        row.setCreatedAt(Instant.now());
        row.setExpiresAt(Instant.now().plus(5, ChronoUnit.MINUTES));
        emailVerificationCodeRepository.save(row);
        mailService.sendRegisterCode(email, code, req.locale());
    }

    @Transactional
    public void sendResetPasswordEmailCode(ResetPasswordSendEmailRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        if (!user.isAccountEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号已禁用");
        }
        var latest = emailVerificationCodeRepository
                .findFirstByEmailAndPurposeOrderByCreatedAtDesc(email, EmailVerificationCode.PURPOSE_RESET_PASSWORD);
        if (latest.isPresent()) {
            Instant created = latest.get().getCreatedAt();
            if (created != null && created.isAfter(Instant.now().minus(60, ChronoUnit.SECONDS))) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "发送过于频繁，请稍后再试");
            }
        }
        String code = EmailCodeGenerator.sixDigits();
        emailVerificationCodeRepository.deleteByEmailAndPurpose(email, EmailVerificationCode.PURPOSE_RESET_PASSWORD);
        EmailVerificationCode row = new EmailVerificationCode();
        row.setEmail(email);
        row.setCode(code);
        row.setPurpose(EmailVerificationCode.PURPOSE_RESET_PASSWORD);
        row.setCreatedAt(Instant.now());
        row.setExpiresAt(Instant.now().plus(5, ChronoUnit.MINUTES));
        emailVerificationCodeRepository.save(row);
        mailService.sendResetPasswordCode(email, code, req.locale());
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));
        if (!user.isAccountEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号已禁用");
        }
        EmailVerificationCode stored = emailVerificationCodeRepository
                .findFirstByEmailAndPurposeOrderByCreatedAtDesc(email, EmailVerificationCode.PURPOSE_RESET_PASSWORD)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先获取邮箱验证码"));
        if (stored.getExpiresAt() == null || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码已过期，请重新获取");
        }
        if (!req.code().trim().equals(stored.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "验证码错误");
        }
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        userRepository.save(user);
        emailVerificationCodeRepository.deleteByEmailAndPurpose(email, EmailVerificationCode.PURPOSE_RESET_PASSWORD);
    }

    public User requireUser(long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户不存在"));
    }

    @Transactional
    public User saveUser(User u) {
        return userRepository.save(u);
    }

    @Transactional(readOnly = true)
    public List<AdminUserListItem> listUsersForAdmin(long requesterId) {
        assertIsAdmin(requesterId);
        return userRepository.findAll(Sort.by("id")).stream()
                .map(this::toAdminListItem)
                .toList();
    }

    @Transactional
    public AdminUserListItem createUserByAdmin(long requesterId, AdminUserCreateRequest req) {
        assertIsAdmin(requesterId);
        String email = req.email().trim().toLowerCase();
        if (!StringUtils.hasText(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写邮箱");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已存在");
        }
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        if (StringUtils.hasText(req.displayName())) {
            u.setDisplayName(req.displayName().trim());
        }
        u.setGender(parseGender(req.gender()));
        UserRole newRole = UserRole.USER;
        if (StringUtils.hasText(req.role())) {
            try {
                newRole = UserRole.valueOf(req.role().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的角色");
            }
        }
        if (newRole == UserRole.DEVELOPER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "主角色仅可为 USER 或 ADMIN；开发者在审核中授予");
        }
        u.setRole(newRole);
        u.setAccountEnabled(true);
        u = userRepository.save(u);
        ensureInviteCode(u);
        accountRoleService.assignOnUserCreatedIfEmpty(u.getId(), newRole);
        return toAdminListItem(u);
    }

    @Transactional
    public AdminUserListItem patchUserByAdmin(long requesterId, long targetId, AdminUserPatchRequest req) {
        assertIsAdmin(requesterId);
        User u = requireUser(targetId);
        if (req.displayName() == null && req.role() == null && req.enabled() == null
                && !StringUtils.hasText(req.newPassword()) && req.gender() == null) {
            return toAdminListItem(u);
        }
        if (StringUtils.hasText(req.newPassword())) {
            if (targetId == requesterId) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请通过个人中心修改自己的密码");
            }
            if (req.newPassword().length() < 6) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "新密码至少 6 位");
            }
            u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        }
        if (req.enabled() != null) {
            if (targetId == requesterId && !req.enabled()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能禁用自己的账号");
            }
            u.setAccountEnabled(req.enabled());
        }
        if (req.role() != null) {
            if (targetId == requesterId) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不能修改自己的角色");
            }
            UserRole newPrimary;
            try {
                newPrimary = UserRole.valueOf(req.role().trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的角色");
            }
            if (newPrimary == UserRole.DEVELOPER) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "主角色仅可为 USER 或 ADMIN；开发者在审核中授予");
            }
            u.setRole(newPrimary);
            accountRoleService.setPrimaryRolePreservingExtra(u.getId(), newPrimary);
        }
        if (req.displayName() != null) {
            String dn = req.displayName().trim();
            u.setDisplayName(StringUtils.hasText(dn) ? dn : null);
        }
        if (req.gender() != null) {
            u.setGender(parseGender(req.gender()));
        }
        userRepository.save(u);
        return toAdminListItem(u);
    }

    @Transactional
    public MeResponse updateOwnProfile(long userId, UpdateMyProfileRequest req) {
        User u = requireUser(userId);
        if (req.displayName() != null) {
            String dn = req.displayName().trim();
            u.setDisplayName(StringUtils.hasText(dn) ? dn : null);
        }
        if (req.gender() != null) {
            u.setGender(parseGender(req.gender()));
        }
        userRepository.save(u);
        return toMeResponse(u);
    }

    @Transactional
    public void resetUserPasswordByAdmin(long requesterId, long targetId) {
        assertIsAdmin(requesterId);
        User u = requireUser(targetId);
        u.setPasswordHash(passwordEncoder.encode(DEFAULT_RESET_PASSWORD));
        userRepository.save(u);
    }

    @Transactional
    public void changeOwnPassword(long userId, ChangePasswordRequest req) {
        User u = requireUser(userId);
        if (!passwordEncoder.matches(req.oldPassword(), u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "原密码错误");
        }
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(u);
    }

    private static final String DEFAULT_RESET_PASSWORD = "123456";

    /** 非管理员则 403；供管理端接口在执行业务前校验。 */
    public void requireAdmin(long userId) {
        assertIsAdmin(userId);
    }

    private void assertIsAdmin(long userId) {
        if (!accountRoleService.hasRole(userId, UserRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "需要管理员权限");
        }
    }

    private AdminUserListItem toAdminListItem(User u) {
        var eff = accountRoleService.effectiveRolesForUserId(u.getId());
        var names = eff.stream().map(UserRole::name).sorted().collect(Collectors.toList());
        var primary = AccountRoleService.primaryRoleName(eff);
        long beanBalance = beanService.queryBalance(u.getId());
        return new AdminUserListItem(
                u.getId(),
                u.getEmail(),
                u.getDisplayName(),
                (u.getGender() == null ? UserGender.UNKNOWN : u.getGender()).name(),
                primary,
                names,
                StringUtils.hasText(u.getAvatarStoredRelpath()),
                u.getCreatedAt().toEpochMilli(),
                u.isAccountEnabled(),
                beanBalance,
                beanService.resolveLevelCode(beanBalance),
                beanService.resolveLevelName(beanBalance)
        );
    }

    private static UserGender parseGender(String raw) {
        if (!StringUtils.hasText(raw)) {
            return UserGender.UNKNOWN;
        }
        try {
            return UserGender.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "无效的性别");
        }
    }

    /** 精确邮箱查找（小写 trim）；未注册返回 exists=false，不抛错。 */
    @Transactional(readOnly = true)
    public UserEmailLookupResponse lookupByExactEmail(String rawEmail) {
        if (!StringUtils.hasText(rawEmail)) {
            return new UserEmailLookupResponse(false, null, null);
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        return userRepository.findByEmail(email)
                .filter(User::isAccountEnabled)
                .map(u -> new UserEmailLookupResponse(
                        true,
                        StringUtils.hasText(u.getDisplayName()) ? u.getDisplayName().trim() : u.getEmail(),
                        u.getEmail()
                ))
                .orElseGet(() -> new UserEmailLookupResponse(false, null, email));
    }

    /** 留言板选择「仅某人可见」：列出全部注册用户（小站用户量小，直接全表）。 */
    public List<UserDirectoryItem> listDirectoryForGuestbook() {
        return userRepository.findAll(Sort.by("id")).stream()
                .filter(User::isAccountEnabled)
                .map(u -> {
                    UserRole r = u.getRole() != null ? u.getRole() : UserRole.USER;
                    Long beanBalance = null;
                    String beanLevelCode = null;
                    String beanLevelName = null;
                    if (userPrivacyService.canExposeBeanLevel(u.getId())) {
                        long b = beanService.queryBalance(u.getId());
                        beanBalance = b;
                        beanLevelCode = beanService.resolveLevelCode(b);
                        beanLevelName = beanService.resolveLevelName(b);
                    }
                    Long lastOnlineAtMillis = null;
                    if (userPrivacyService.canExposeLastOnline(u.getId()) && u.getLastActiveAt() != null) {
                        lastOnlineAtMillis = u.getLastActiveAt().toEpochMilli();
                    }
                    return new UserDirectoryItem(
                            u.getId(),
                            StringUtils.hasText(u.getDisplayName()) ? u.getDisplayName().trim() : u.getEmail(),
                            u.getEmail(),
                            StringUtils.hasText(u.getAvatarStoredRelpath()),
                            r.name(),
                            beanBalance,
                            beanLevelCode,
                            beanLevelName,
                            lastOnlineAtMillis
                    );
                })
                .toList();
    }

    public Resource avatarResourceForUser(long userId) {
        User u = requireUser(userId);
        if (!StringUtils.hasText(u.getAvatarStoredRelpath())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未设置头像");
        }
        Path file = uploadBase.resolve(u.getAvatarStoredRelpath()).normalize();
        if (!file.startsWith(uploadBase) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "头像文件不存在");
        }
        return new FileSystemResource(file);
    }

    public MediaType mimeForUserAvatar(long userId) {
        User u = requireUser(userId);
        if (!StringUtils.hasText(u.getAvatarStoredRelpath())) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        String rel = u.getAvatarStoredRelpath().toLowerCase(Locale.ROOT);
        if (rel.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (rel.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        return MediaType.IMAGE_JPEG;
    }

    @Transactional
    public void uploadAvatar(long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择图片文件");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "头像需小于 2MB");
        }
        String orig = file.getOriginalFilename();
        String ext = extensionOf(orig);
        if (ext == null || !AVATAR_EXT.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "仅支持 jpg、png、webp");
        }
        User u = requireUser(userId);
        deleteAvatarFileIfExists(u);
        String rel = "avatars/" + userId + "." + ext;
        Path dest = uploadBase.resolve(rel).normalize();
        if (!dest.startsWith(uploadBase)) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "路径无效");
        }
        try {
            Files.createDirectories(dest.getParent());
            file.transferTo(dest);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "保存头像失败");
        }
        u.setAvatarStoredRelpath(rel);
        userRepository.save(u);
    }

    private void deleteAvatarFileIfExists(User u) {
        if (!StringUtils.hasText(u.getAvatarStoredRelpath())) {
            return;
        }
        Path prev = uploadBase.resolve(u.getAvatarStoredRelpath()).normalize();
        if (prev.startsWith(uploadBase)) {
            try {
                Files.deleteIfExists(prev);
            } catch (IOException ignored) {
            }
        }
    }

    private static String extensionOf(String filename) {
        if (filename == null || !filename.contains(".")) {
            return null;
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }
}
