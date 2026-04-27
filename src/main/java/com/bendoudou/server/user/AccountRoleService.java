package com.bendoudou.server.user;

import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.context.event.ApplicationReadyEvent;

import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 多角色：扩展角色存于 user_account_roles；与 {@link User#role} 在迁移后应一致，旧数据以 User.role 回退。
 */
@Service
public class AccountRoleService {

    private static final Set<UserRole> PRIMARY_ROLES = EnumSet.of(UserRole.USER, UserRole.ADMIN);

    private final UserRepository userRepository;
    private final UserAccountRoleRepository userAccountRoleRepository;

    public AccountRoleService(
            UserRepository userRepository,
            UserAccountRoleRepository userAccountRoleRepository
    ) {
        this.userRepository = userRepository;
        this.userAccountRoleRepository = userAccountRoleRepository;
    }

    @Order(100)
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void migrateLegacyUserRoles() {
        for (User u : userRepository.findAll(Sort.by("id"))) {
            if (userAccountRoleRepository.findByUserId(u.getId()).isEmpty()) {
                UserRole r = u.getRole() != null ? u.getRole() : UserRole.USER;
                UserAccountRole row = new UserAccountRole();
                row.setUserId(u.getId());
                row.setRole(r);
                userAccountRoleRepository.save(row);
            }
        }
    }

    @Transactional(readOnly = true)
    public Set<UserRole> effectiveRolesForUserId(long userId) {
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) {
            return Set.of();
        }
        List<UserAccountRole> rows = userAccountRoleRepository.findByUserId(userId);
        if (rows.isEmpty()) {
            return Set.of(u.getRole() != null ? u.getRole() : UserRole.USER);
        }
        return rows.stream().map(UserAccountRole::getRole).collect(Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public List<String> roleNamesForUserId(long userId) {
        return effectiveRolesForUserId(userId).stream()
                .map(Enum::name)
                .sorted(Comparator.comparing(s -> s))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean hasRole(long userId, UserRole need) {
        return effectiveRolesForUserId(userId).contains(need);
    }

    @Transactional
    public void assignOnUserCreatedIfEmpty(long userId, UserRole primary) {
        if (userAccountRoleRepository.findByUserId(userId).isEmpty()) {
            addRoleIfAbsent(userId, primary);
        }
    }

    @Transactional
    public void addRoleIfAbsent(long userId, UserRole role) {
        if (userAccountRoleRepository.existsByUserIdAndRole(userId, role)) {
            return;
        }
        UserAccountRole e = new UserAccountRole();
        e.setUserId(userId);
        e.setRole(role);
        userAccountRoleRepository.save(e);
    }

    @Transactional
    public void setPrimaryRolePreservingExtra(long userId, UserRole newPrimary) {
        userAccountRoleRepository.deleteByUserIdAndRoleIn(userId, new java.util.ArrayList<>(PRIMARY_ROLES));
        UserAccountRole e = new UserAccountRole();
        e.setUserId(userId);
        e.setRole(newPrimary);
        userAccountRoleRepository.save(e);
    }

    /**
     * 用于 /me 与登录响应：单字段兼容旧前端；取 ADMIN 优先，其次 DEVELOPER，再 USER
     */
    public static String primaryRoleName(Set<UserRole> roles) {
        if (roles == null || roles.isEmpty()) {
            return UserRole.USER.name();
        }
        if (roles.contains(UserRole.ADMIN)) {
            return UserRole.ADMIN.name();
        }
        if (roles.contains(UserRole.USER)) {
            return UserRole.USER.name();
        }
        if (roles.contains(UserRole.DEVELOPER)) {
            return UserRole.DEVELOPER.name();
        }
        return UserRole.USER.name();
    }
}
