package com.bendoudou.server.user;

import com.bendoudou.server.bean.BeanService;
import com.bendoudou.server.auth.dto.AuthResponse;
import com.bendoudou.server.auth.dto.MeResponse;
import com.bendoudou.server.security.JwtTokenService;
import com.bendoudou.server.user.dto.AdminUserCreateRequest;
import com.bendoudou.server.user.dto.AdminUserListItem;
import com.bendoudou.server.user.dto.AdminUserPatchRequest;
import com.bendoudou.server.user.dto.ChangePasswordRequest;
import com.bendoudou.server.user.dto.UpdateMyProfileRequest;
import com.bendoudou.server.user.dto.UserDirectoryItem;
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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final AccountRoleService accountRoleService;
    private final BeanService beanService;
    private final UserPrivacyService userPrivacyService;
    private final Path uploadBase;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            AccountRoleService accountRoleService,
            BeanService beanService,
            UserPrivacyService userPrivacyService,
            @Value("${bendoudou.music-upload-dir}") String musicUploadDir
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.accountRoleService = accountRoleService;
        this.beanService = beanService;
        this.userPrivacyService = userPrivacyService;
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
        var eff = accountRoleService.effectiveRolesForUserId(u.getId());
        var roleNames = eff.stream().map(UserRole::name).sorted().collect(Collectors.toList());
        var primary = AccountRoleService.primaryRoleName(eff);
        long beanBalance = beanService.queryBalance(u.getId());
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
                beanService.resolveLevelName(beanBalance)
        );
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
        return new AdminUserListItem(
                u.getId(),
                u.getEmail(),
                u.getDisplayName(),
                (u.getGender() == null ? UserGender.UNKNOWN : u.getGender()).name(),
                primary,
                names,
                StringUtils.hasText(u.getAvatarStoredRelpath()),
                u.getCreatedAt().toEpochMilli(),
                u.isAccountEnabled()
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
