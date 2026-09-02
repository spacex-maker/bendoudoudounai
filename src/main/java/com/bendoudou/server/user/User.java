package com.bendoudou.server.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", length = 255)
    private String displayName;

    /** 相对 bendoudou.music-upload-dir，如 avatars/12.jpg */
    @Column(name = "avatar_stored_relpath", length = 512)
    private String avatarStoredRelpath;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private UserRole role = UserRole.USER;

    @Column(name = "account_enabled", nullable = false)
    private boolean accountEnabled = true;

    @Column(name = "last_active_at")
    private Instant lastActiveAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false, length = 16)
    private UserGender gender = UserGender.UNKNOWN;

    /** 兼容字段：同步自 invite_codes 中一枚未使用码（多码以 invite_codes 为准） */
    @Column(name = "invite_code", unique = true, length = 16)
    private String inviteCode;

    /** 兼容字段：当前是否已无可用邀请码 */
    @Column(name = "invite_code_used", nullable = false)
    private boolean inviteCodeUsed = false;

    /** 注册时使用的邀请人用户 id */
    @Column(name = "invited_by_user_id")
    private Long invitedByUserId;

    @PrePersist
    void ensureRole() {
        if (role == null) {
            role = UserRole.USER;
        }
    }

    public boolean isAccountEnabled() {
        return accountEnabled;
    }

    public void setAccountEnabled(boolean accountEnabled) {
        this.accountEnabled = accountEnabled;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getAvatarStoredRelpath() {
        return avatarStoredRelpath;
    }

    public void setAvatarStoredRelpath(String avatarStoredRelpath) {
        this.avatarStoredRelpath = avatarStoredRelpath;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public Instant getLastActiveAt() {
        return lastActiveAt;
    }

    public void setLastActiveAt(Instant lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }

    public UserGender getGender() {
        return gender;
    }

    public void setGender(UserGender gender) {
        this.gender = gender;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public boolean isInviteCodeUsed() {
        return inviteCodeUsed;
    }

    public void setInviteCodeUsed(boolean inviteCodeUsed) {
        this.inviteCodeUsed = inviteCodeUsed;
    }

    public Long getInvitedByUserId() {
        return invitedByUserId;
    }

    public void setInvitedByUserId(Long invitedByUserId) {
        this.invitedByUserId = invitedByUserId;
    }
}
