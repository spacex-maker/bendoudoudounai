package com.bendoudou.server.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 用户可拥有多角色；与 {@link User#role} 同步迁移后，以本表为权限判断来源（兼容旧行则回退到 User.role）
 */
@Entity
@Table(
        name = "user_account_roles",
        uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "role" })
)
public class UserAccountRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role;

    public UserAccountRole() {
    }

    public UserAccountRole(Long id, long userId, UserRole role) {
        this.id = id;
        this.userId = userId;
        this.role = role;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public long getUserId() {
        return userId;
    }

    public void setUserId(long userId) {
        this.userId = userId;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }
}
